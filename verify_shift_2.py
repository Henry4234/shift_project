# -*- coding: utf-8 -*-
"""
verify_shift_2.py

驗證班表是否符合各種限制條件
基於原有的 verify_shift.py 但修改回傳格式

驗證項目：
1. 每日上班人數是否符合需求
2. 是否有連續上班超過七天
3. 大夜班(C)後方是否為大夜班(C)或休假(O)

回傳格式：
{
    "daily_staffing_passed": bool,
    "daily_staffing_details": [str],
    "continuous_work_passed": bool,
    "continuous_work_details": [str],
    "shift_connection_passed": bool,
    "shift_connection_details": [str]
}
"""

from datetime import datetime
from typing import Dict, List, Tuple, Optional
from supabase_client import(
    fetch_shift_group,
    fetch_is_holiday
)
class ScheduleVerifier:
    def __init__(self, cycle_id: int, schedule_data: Dict):
        """
        初始化驗證器
        
        Args:
            schedule_data: 班表資料，格式 {
                "schedule": {員工名: [班別列表]},
                "dates": [日期列表]
            }
        """
        self.cycle_id = cycle_id
        self.schedule = schedule_data.get('schedule', {})
        self.dates = schedule_data.get('dates', [])
        self.employees = list(self.schedule.keys())
        self.D = len(self.dates)
        
        # 從資料庫讀取班別需求
        self.shift_group_raw = fetch_shift_group(self.cycle_id)
        if not self.shift_group_raw:
            raise ValueError(f"無法取得 cycle_id={cycle_id} 的班別群組資料")
        
        # 轉換班別需求格式
        self.daily_requirements = self._convert_shift_group_requirements()
        # 取得國定假日資料
        if self.dates:
            start_date = min(self.dates)
            end_date = max(self.dates)
            self.is_holidays = fetch_is_holiday(start_date, end_date)
        else:
            self.is_holidays = []
        # 建立國定假日字典，提高查找效率
        # 格式: {日期字串: True}
        self.holiday_dict = {
            holiday['date'].strftime('%Y-%m-%d'): True 
            for holiday in self.is_holidays
        }
        # 每日班別需求定義
        # self.daily_requirements = {
        #     0: {'A': 3, 'B': 2, 'C': 1},  # 週一
        #     1: {'A': 3, 'B': 2, 'C': 1},  # 週二
        #     2: {'A': 3, 'B': 2, 'C': 1},  # 週三
        #     3: {'A': 3, 'B': 2, 'C': 1},  # 週四
        #     4: {'A': 3, 'B': 2, 'C': 1},  # 週五
        #     5: {'A': 2, 'B': 1, 'C': 1},  # 週六
        #     6: {'A': 1, 'B': 1, 'C': 1}   # 週日
        # }
    def _convert_shift_group_requirements(self) -> Dict[int, Dict[str, int]]:
        """
        將 shift_group_raw 轉換為每日班別需求格式
        
        Returns:
            Dict[int, Dict[str, int]]: 格式為 {weekday: {'A': count, 'B': count, 'C': count}}
        """
        from collections import defaultdict
        
        # 班別轉換對照表
        shift_group_convert = {"day": "A", "evening": "B", "night": "C"}
        
        daily_requirements = {}
        for weekday, shifts in self.shift_group_raw.items():
            counter = defaultdict(int)
            for shift_item in shifts:
                shift_group = shift_item["shift_group"]
                if shift_group in shift_group_convert:
                    shift_type = shift_group_convert[shift_group]
                    counter[shift_type] += shift_item["amount"]
            daily_requirements[weekday] = dict(counter)
        
        return daily_requirements
    
    def verify_daily_staffing(self) -> Tuple[bool, List[str]]:
        """
        驗證每日上班人數是否符合需求
        
        Returns:
            Tuple[bool, List[str]]: (是否通過, 詳細訊息列表)
        """
        passed = True
        details = []
        
        for d, date_str in enumerate(self.dates):
            # 取得該日期的星期幾
            dt = datetime.strptime(date_str, '%Y-%m-%d')
            weekday = dt.weekday()

            # 使用字典查找檢查是否為國定假日
            is_holiday = date_str in self.holiday_dict
            # 根據國定假日狀態和星期幾設定每日班別需求
            if is_holiday:
                # 如果是國定假日且為週末(週六或週日)，則跳過驗證
                if weekday in [5, 6]:  # 週六=5, 週日=6
                    required = self.daily_requirements[weekday]
                # 如果是國定假日且為週一到週五，則使用週六的班表需求
                else:
                    required = self.daily_requirements[5]  # 使用週六的班別需求
            else:
                # 非國定假日，使用原本的週間班表需求
                required = self.daily_requirements[weekday]
            # required = self.daily_requirements[weekday]
            
            # 統計該日各班別實際人數
            actual = {'A': 0, 'B': 0, 'C': 0}
            for emp_name, shifts in self.schedule.items():
                if d < len(shifts) and shifts[d] in ['A', 'B', 'C']:
                    actual[shifts[d]] += 1
            # 檢查是否符合需求
            day_passed = True
            day_details = []
            for shift_type in ['A', 'B', 'C']:
                if actual[shift_type] < required[shift_type]:
                    day_passed = False
                    day_details.append(f"{shift_type}班不足: 需要{required[shift_type]}人，實際{actual[shift_type]}人")
                elif actual[shift_type] > required[shift_type]:
                    day_passed = False
                    day_details.append(f"{shift_type}班過多: 需要{required[shift_type]}人，實際{actual[shift_type]}人")
            
            if not day_passed:
                passed = False
                details.append(f"{date_str} ({self._get_weekday_name(weekday)}): {', '.join(day_details)}")
            else:
                pass
                # details.append(f"{date_str} ({self._get_weekday_name(weekday)}): 符合需求")
        
        return passed, details

    def verify_continuous_work(self) -> Tuple[bool, List[str]]:
        """
        驗證是否有連續上班超過七天
        
        Returns:
            Tuple[bool, List[str]]: (是否通過, 詳細訊息列表)
        """
        passed = True
        details = []
        
        for emp_name, shifts in self.schedule.items():
            continuous_count = 0
            max_continuous = 0
            violation_dates = []
            
            for d, shift in enumerate(shifts):
                if shift in ['A', 'B', 'C']:  # 上班
                    continuous_count += 1
                    if continuous_count > 7:
                        violation_dates.append(self.dates[d])
                else:  # 休假
                    if continuous_count > 7:
                        passed = False
                        details.append(f"{emp_name}: 連續上班{continuous_count}天 (超過7天限制)")
                    max_continuous = max(max_continuous, continuous_count)
                    continuous_count = 0
            
            # 檢查最後一段連續上班
            if continuous_count > 7:
                passed = False
                details.append(f"{emp_name}: 連續上班{continuous_count}天 (超過7天限制)")
            
            if max_continuous <= 7:
                pass
                # details.append(f"{emp_name}: 最大連續上班{max_continuous}天 (符合限制)")
        
        return passed, details

    def verify_shift_connection(self) -> Tuple[bool, List[str]]:
        """
        驗證大夜班(C)後方是否為大夜班(C)或休假(O)
        
        Returns:
            Tuple[bool, List[str]]: (是否通過, 詳細訊息列表)
        """
        passed = True
        details = []
        
        for emp_name, shifts in self.schedule.items():
            violations = []
            
            for d in range(len(shifts) - 1):
                current_shift = shifts[d]
                next_shift = shifts[d + 1]
                
                # 檢查大夜班(C)後方是否為大夜班(C)或休假(O)
                if current_shift == 'C' and next_shift not in ['C', 'O']:
                    passed = False
                    violations.append(f"{self.dates[d]} C班後接{next_shift}班")
            
            if violations:
                details.append(f"{emp_name}: {', '.join(violations)}")
            else:
                pass
                # details.append(f"{emp_name}: 班別銜接正常")
        
        return passed, details

    def verify_all(self) -> Dict:
        """
        執行所有驗證項目
        
        Returns:
            Dict: 驗證結果字典
        """
        # 執行三個驗證項目
        daily_passed, daily_details = self.verify_daily_staffing()
        continuous_passed, continuous_details = self.verify_continuous_work()
        connection_passed, connection_details = self.verify_shift_connection()
        
        return {
            'daily_staffing_passed': daily_passed,
            'daily_staffing_details': daily_details,
            'continuous_work_passed': continuous_passed,
            'continuous_work_details': continuous_details,
            'shift_connection_passed': connection_passed,
            'shift_connection_details': connection_details
        }

    def _get_weekday_name(self, weekday: int) -> str:
        """
        取得星期幾的中文名稱
        
        Args:
            weekday: 星期幾 (0=週一, 6=週日)
            
        Returns:
            str: 星期幾的中文名稱
        """
        weekday_names = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
        return weekday_names[weekday]


def verify_schedule_data(cycle_id: int, schedule_data: Dict) -> Dict:
    """
    驗證班表資料的便捷函數
    
    Args:
        schedule_data: 班表資料，格式 {
            "schedule": {員工名: [班別列表]},
            "dates": [日期列表]
        }
        
    Returns:
        Dict: 驗證結果字典
    """
    verifier = ScheduleVerifier(cycle_id,schedule_data)
    return verifier.verify_all()


if __name__ == '__main__':
    # 測試用的範例資料
    test_schedule_data = {
        'schedule': {
            '員工A': ['A', 'B', 'C', 'O', 'A', 'B', 'C', 'O'],
            '員工B': ['B', 'C', 'O', 'A', 'B', 'C', 'O', 'A'],
            '員工C': ['C', 'O', 'A', 'B', 'C', 'O', 'A', 'B']
        },
        'dates': ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04',
                  '2024-01-05', '2024-01-06', '2024-01-07', '2024-01-08']
    }
    
    verifier = ScheduleVerifier(test_schedule_data)
    result = verifier.verify_all()
    
    print("驗證結果:")
    print(f"每日上班人數: {'✓' if result['daily_staffing_passed'] else '✗'}")
    print(f"連續上班天數: {'✓' if result['continuous_work_passed'] else '✗'}")
    print(f"班別銜接: {'✓' if result['shift_connection_passed'] else '✗'}")
    
    print("\n詳細結果:")
    for key, value in result.items():
        print(f"{key}: {value}") 