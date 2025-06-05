from supabase import create_client
import os
from dotenv import load_dotenv

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

def fetch_shift_requirements():
    """獲取所有班次需求資料，並轉換為所需格式"""
    try:
        # 直接使用 Supabase 查詢而不是 RPC
        response = (supabase
            .from_('shift_requirements')
            .select('employees(name), shift_type, required_days')
            .execute()
        )
        
        # 轉換為程式所需的格式
        requirements = {}
        for row in response.data:
            emp_name = row['employees']['name']
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