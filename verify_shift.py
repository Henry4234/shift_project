# -*- coding: utf-8 -*-
"""
verify_shift.py

驗證第二階段班別分配結果是否符合各種限制條件
包含每日上班人數檢查、連續上班天數檢查、班別銜接檢查

驗證項目：
1. 每日上班人數是否符合需求
2. 是否有連續上班超過七天
3. 大夜班(C)後方是否為大夜班(C)或休假(O)
"""

from datetime import datetime
from typing import Dict, List, Tuple, Optional
from supabase_client import(
    fetch_shift_group,
    fetch_is_holiday
)
class ShiftVerifier:
    def __init__(self, shift_result: Dict[str, List[str]], dates: List[str]):
        """
        初始化驗證器
        
        Args:
            shift_result: 班別分配結果，格式 {員工名: [班別列表]}
            dates: 日期列表，格式 ['YYYY-MM-DD', ...]
            cycle_id: int, 週期id
        """
        self.shift_result = shift_result
        self.dates = dates
        # self.cycle_id= cycle_id
        self.employees = list(shift_result.keys())
        self.D = len(dates)
        
        # 每日班別需求定義
        # self.daily_requirements=fetch_shift_group(self.cycle_id)
        self.daily_requirements = {
            0: {'A': 3, 'B': 2, 'C': 1},  # 週一
            1: {'A': 3, 'B': 2, 'C': 1},  # 週二
            2: {'A': 3, 'B': 2, 'C': 1},  # 週三
            3: {'A': 3, 'B': 2, 'C': 1},  # 週四
            4: {'A': 3, 'B': 2, 'C': 1},  # 週五
            5: {'A': 2, 'B': 1, 'C': 1},  # 週六
            6: {'A': 1, 'B': 1, 'C': 1}   # 週日
        }
        
        self.verification_results = {
            'daily_staffing': {'passed': False, 'details': []},
            'continuous_work': {'passed': False, 'details': []},
            'shift_connection': {'passed': False, 'details': []}
        }

    def verify_daily_staffing(self) -> bool:
        """
        驗證每日上班人數是否符合需求
        
        Returns:
            bool: 是否通過驗證
        """
        print("=== 驗證每日上班人數 ===")
        passed = True
        details = []
        
        for d, date_str in enumerate(self.dates):
            # 取得該日期的星期幾
            dt = datetime.strptime(date_str, '%Y-%m-%d')
            weekday = dt.weekday()
            required = self.daily_requirements[weekday]
            
            # 統計該日各班別實際人數
            actual = {'A': 0, 'B': 0, 'C': 0}
            for emp_name, shifts in self.shift_result.items():
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
                    day_details.append(f"{shift_type}班過多: 需要{required[shift_type]}人，實際{actual[shift_type]}人")
            
            if not day_passed:
                passed = False
                details.append(f"{date_str} ({self._get_weekday_name(weekday)}): {', '.join(day_details)}")
            else:
                details.append(f"{date_str} ({self._get_weekday_name(weekday)}): 符合需求")
        
        # 輸出詳細結果
        for detail in details:
            print(detail)
        
        self.verification_results['daily_staffing'] = {
            'passed': passed,
            'details': details
        }
        
        print(f"每日上班人數驗證: {'通過' if passed else '未通過'}")
        return passed

    def verify_continuous_work(self) -> bool:
        """
        驗證是否有連續上班超過七天
        
        Returns:
            bool: 是否通過驗證
        """
        print("\n=== 驗證連續上班天數 ===")
        passed = True
        details = []
        
        for emp_name, shifts in self.shift_result.items():
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
                details.append(f"{emp_name}: 最大連續上班{max_continuous}天 (符合限制)")
        
        # 輸出詳細結果
        for detail in details:
            print(detail)
        
        self.verification_results['continuous_work'] = {
            'passed': passed,
            'details': details
        }
        
        print(f"連續上班天數驗證: {'通過' if passed else '未通過'}")
        return passed

    def verify_shift_connection(self) -> bool:
        """
        驗證大夜班(C)後方是否為大夜班(C)或休假(O)
        
        Returns:
            bool: 是否通過驗證
        """
        print("\n=== 驗證班別銜接 ===")
        passed = True
        details = []
        
        for emp_name, shifts in self.shift_result.items():
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
                details.append(f"{emp_name}: 班別銜接正常")
        
        # 輸出詳細結果
        for detail in details:
            print(detail)
        
        self.verification_results['shift_connection'] = {
            'passed': passed,
            'details': details
        }
        
        print(f"班別銜接驗證: {'通過' if passed else '未通過'}")
        return passed

    def verify_all(self) -> bool:
        """
        執行所有驗證項目
        
        Returns:
            bool: 是否所有驗證都通過
        """
        print("開始驗證班別分配結果...")
        print(f"驗證期間: {self.dates[0]} 至 {self.dates[-1]}")
        print(f"員工數: {len(self.employees)}")
        print(f"天數: {self.D}")
        print("=" * 50)
        
        # 執行三個驗證項目
        daily_passed = self.verify_daily_staffing()
        continuous_passed = self.verify_continuous_work()
        connection_passed = self.verify_shift_connection()
        
        # 總結結果
        all_passed = daily_passed and continuous_passed and connection_passed
        
        print("\n" + "=" * 50)
        print("驗證總結:")
        print(f"每日上班人數: {'✓' if daily_passed else '✗'}")
        print(f"連續上班天數: {'✓' if continuous_passed else '✗'}")
        print(f"班別銜接: {'✓' if connection_passed else '✗'}")
        print(f"整體結果: {'✓ 全部通過' if all_passed else '✗ 需要重新生成'}")
        
        return all_passed

    def get_verification_summary(self) -> Dict:
        """
        取得驗證結果摘要
        
        Returns:
            Dict: 驗證結果摘要
        """
        return {
            'all_passed': all(result['passed'] for result in self.verification_results.values()),
            'verification_results': self.verification_results,
            'total_employees': len(self.employees),
            'total_days': self.D,
            'date_range': f"{self.dates[0]} 至 {self.dates[-1]}"
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


def verify_shift_assignment(shift_result: Dict[str, List[str]], dates: List[str]) -> bool:
    """
    驗證班別分配結果的便捷函數
    
    Args:
        shift_result: 班別分配結果
        dates: 日期列表
        
    Returns:
        bool: 是否通過所有驗證
    """
    verifier = ShiftVerifier(shift_result, dates)
    return verifier.verify_all()


if __name__ == '__main__':
    # 測試用的範例資料
    test_shift_result = {
        '員工A': ['A', 'B', 'C', 'O', 'A', 'B', 'C', 'O'],
        '員工B': ['B', 'C', 'O', 'A', 'B', 'C', 'O', 'A'],
        '員工C': ['C', 'O', 'A', 'B', 'C', 'O', 'A', 'B']
    }
    test_dates = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04',
                  '2024-01-05', '2024-01-06', '2024-01-07', '2024-01-08']
    
    verifier = ShiftVerifier(test_shift_result, test_dates)
    result = verifier.verify_all()
    print(f"\n測試結果: {'通過' if result else '未通過'}") 