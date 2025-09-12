from supabase import create_client
import os,requests,json
from dotenv import load_dotenv
from datetime import datetime


# 載入環境變數
load_dotenv('/app/web/.env')

# 初始化 Supabase 客戶端
supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_KEY')
)

def fetch_employees():
    """獲取所有員工資料"""
    try:
        response = supabase.table('employees').select('*').execute()
        return [{'id': emp['id'], 'name': emp['name']} for emp in response.data]
    except Exception as e:
        print(f"Error fetching employees: {e}")
        return []

def fetch_shift_requirements(cycle_id: int):
    """獲取指定週期中所有班次需求資料，並轉換為所需格式"""
    try:
        # 直接使用 Supabase 查詢而不是 RPC
        response = (supabase
            .from_('schedule_cycle_members')
            .select('snapshot_name, shift_type, required_days')
            .eq('cycle_id',cycle_id)
            .execute()
        )
        
        # 轉換為程式所需的格式
        requirements = {}
        for row in response.data:
            emp_name = row['snapshot_name']
            if emp_name not in requirements:
                requirements[emp_name] = {'A': 0, 'B': 0, 'C': 0}
            requirements[emp_name][row['shift_type']] = row['required_days']
        
        return requirements
    except Exception as e:
        print(f"Error fetching shift requirements: {e}")
        return {}

def fetch_employee_preferences():
    """獲取所有員工偏好設定"""
    try:
        # 直接使用 Supabase 查詢而不是 RPC
        response = (supabase
            .from_('employee_preferences')
            .select('employees(name), max_continuous_days, continuous_c, double_off_after_c')
            .execute()
        )
        
        # 轉換為程式所需的格式
        preferences = {}
        for row in response.data:
            preferences[row['employees']['name']] = {
                'max_continuous_days': row['max_continuous_days'],
                'continuous_C': row['continuous_c'],
                'double_off_after_C': row['double_off_after_c']
            }
        return preferences
    except Exception as e:
        print(f"Error fetching employee preferences: {e}")
        return {} 
    
def fetch_temp_offdays(cycle_id:int):
    """指定週期中所有休假需求資料"""
    try:
        response = (supabase
            .from_('schedule_cycle_temp_offdays')
            .select('employees(name),offdate,offtype')
            .eq('cycle_id',cycle_id)
            .execute()
            )
        off_date ={}
        for row in response.data:
            employee = row['employees']['name']
            off_date.setdefault(employee,[])
            off_date[employee].append({
                'date': datetime.fromisoformat(row['offdate']).date(),
                'type': row['offtype'] 
            })
        return off_date
    except Exception as e:
        print(f"Error fetching employee offdate: {e}")
        return {} 

def fetch_schedule_cycle(cycle_id: int):
    """根據 cycle_id 取得 schedule_cycles 的週期資訊（start_date, end_date, status, cycle_comment）"""
    try:
        response = (
            supabase
            .from_('schedule_cycles')
            .select('cycle_id, start_date, end_date, status, shift_group, cycle_comment')
            .eq('cycle_id', cycle_id)
            .execute()
        )
        if response.data:
            return response.data[0]
        else:
            return None
    except Exception as e:
        print(f"Error fetching schedule cycle: {e}")
        return None 
    
def fetch_shift_group(cycle_id: int):
    """根據shift_group_name調取該班別群組的每週上班狀態"""
    try:
        # 先查 cycle_id 取得 shift_group 名稱
        cycle = (
            supabase
            .from_("schedule_cycles")
            .select("shift_group")
            .eq("cycle_id", cycle_id)   # cycle_id 改成實際的參數
            .single()
            .execute()
        )
        shift_group_name = cycle.data["shift_group"]
        response = (
            supabase
            .from_('shift_group')
            .select('group_name, weekday, shift_type(shift_name,shift_subname,shift_group),amount')
            .eq('group_name', shift_group_name)
            .execute()
        )
        if response.data:
            # 轉換為程式所需的格式
            shift_group = {}
            for row in response.data:
                weekday = row['weekday']
                shift_group.setdefault(weekday,[])
                shift_group[row['weekday']].append({
                    'shift_name': row['shift_type']['shift_name'],
                    'shift_subname': row['shift_type']['shift_subname'],
                    'shift_group': row['shift_type']['shift_group'],
                    'amount': row['amount']
                })
            return shift_group
        else:
            return None
    except Exception as e:
        print(f"Error fetching shift_group: {e}")
        return None 
    
def fetch_is_holiday(start_date, end_date):
    """
    根據開始日期和結束日期抓取國定假日資料
    
    Args:
        start_date: 開始日期，可以是 datetime 物件或字串格式 'YYYY-MM-DD'
        end_date: 結束日期，可以是 datetime 物件或字串格式 'YYYY-MM-DD'
    
    Returns:
        list: 包含國定假日資訊的列表，格式為 [{"date": "YYYYMMDD", "week": "X", "isHoliday": true}]
    """
    try:
        from datetime import datetime, timedelta
        
        # 處理不同格式的日期輸入
        if isinstance(start_date, datetime):
            start_dt = start_date
        elif isinstance(start_date, str):
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        else:
            raise ValueError(f"不支援的 start_date 格式: {type(start_date)}")
            
        if isinstance(end_date, datetime):
            end_dt = end_date
        elif isinstance(end_date, str):
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
        else:
            raise ValueError(f"不支援的 end_date 格式: {type(end_date)}")
        
        # 提取需要查詢的年份範圍
        start_year = start_dt.year
        end_year = end_dt.year
        
        # 儲存所有國定假日的列表
        all_holidays = []
        
        # 遍歷每個年份，抓取該年的國定假日資料
        for year in range(start_year, end_year + 1):
            try:
                # 構建 API URL
                api_url = f"https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/{year}.json"
                
                # 發送 GET 請求
                response = requests.get(api_url, timeout=10)
                response.raise_for_status()  # 檢查 HTTP 錯誤
                
                # 解析 JSON 資料
                year_data = response.json()
                
                # 過濾出指定日期範圍內的國定假日
                for day_data in year_data:
                    # 將日期字串轉換為 datetime 物件進行比較
                    day_date_str = day_data['date']
                    day_dt = datetime.strptime(day_date_str, '%Y%m%d')
                    
                    # 檢查是否在指定日期範圍內且為國定假日
                    if start_dt <= day_dt <= end_dt and day_data.get('isHoliday', False):
                        # 格式化回傳資料，只包含需要的欄位
                        holiday_info = {
                            "date": day_dt,
                            "week": day_data['week'],
                            "isHoliday": day_data['isHoliday']
                        }
                        all_holidays.append(holiday_info)
                        
            except requests.exceptions.RequestException as req_e:
                print(f"Error fetching holiday data for year {year}: {req_e}")
                continue
            except json.JSONDecodeError as json_e:
                print(f"Error parsing JSON data for year {year}: {json_e}")
                continue
            except Exception as year_e:
                print(f"Unexpected error processing year {year}: {year_e}")
                continue
        
        # 按日期排序
        all_holidays.sort(key=lambda x: x['date'])
        
        return all_holidays
        
    except ValueError as ve:
        print(f"Error parsing date format: {ve}")
        return []
    except Exception as e:
        print(f"Error fetching holiday data: {e}")
        return [] 