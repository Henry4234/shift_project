from flask import Flask, jsonify, request, abort
from flask_cors import CORS
import subprocess
import json
import os
from cpmodel_2025 import main as run_schedule_model
from supabase import create_client
import logging
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

def create_logger(app):
    """建立日誌記錄器"""
    if not app.debug:
        logging.basicConfig(level=logging.INFO)
    return logging.getLogger(__name__)

class APIServer():
    def __init__(self, name, host="0.0.0.0", port=5000, debug=False):
        # init flask app
        self.host = host
        self.port = port
        self.debug = debug
        self.app = Flask(name)
        self.logger = create_logger(self.app)
        
        # 啟用 CORS
        CORS(self.app)

        # init supabase
        url = os.getenv("SUPABASE_URL")
        api_key = os.getenv("SUPABASE_KEY")  # 使用 SUPABASE_KEY 而不是 SUPABASE_API_KEY

        if not url:
            self.logger.error("Missing env SUPABASE_URL while connecting to Supabase.")
            abort(500)
        elif not api_key:
            self.logger.error("Missing env SUPABASE_KEY while connecting to Supabase.")
            abort(500)
        else:
            self.supa_url = url
            self.supa_api_key = api_key
            self.supabase_client = create_client(self.supa_url, self.supa_api_key)
            self.logger.info("Successfully connected to Supabase.")

        # 註冊路由
        self.register_routes()

    def register_routes(self):
        """註冊所有 API 路由"""
        
        @self.app.route('/api/employees', methods=['GET'])
        def get_employees():
            """獲取員工資料"""
            try:
                self.logger.info('開始從 Supabase 獲取員工資料...')
                
                response = self.supabase_client.table('employees').select('*').execute()
                employees = response.data
                
                self.logger.info(f'從 Supabase 獲取到的資料：{employees}')
                
                if not employees:
                    self.logger.warning('警告：沒有找到任何員工資料')
                
                return jsonify(employees)
            except Exception as err:
                self.logger.error(f'取得人員資料時發生錯誤：{str(err)}')
                return jsonify({'error': '無法載入人員資料'}), 500

        @self.app.route('/api/employee-preferences', methods=['GET'])
        def get_employee_preferences():
            """獲取員工偏好設定"""
            try:
                self.logger.info('開始從 Supabase 獲取員工偏好設定...')
                
                response = self.supabase_client.table('employee_preferences').select('*').execute()
                preferences = response.data
                
                self.logger.info(f'從 Supabase 獲取到的員工偏好設定：{preferences}')
                return jsonify(preferences)
            except Exception as err:
                self.logger.error(f'取得員工偏好設定時發生錯誤：{str(err)}')
                return jsonify({'error': '無法載入員工偏好設定'}), 500

        @self.app.route('/api/shift-requirements', methods=['GET'])
        def get_shift_requirements():
            """獲取班表需求"""
            try:
                self.logger.info('開始從 Supabase 獲取班表需求...')
                
                response = self.supabase_client.table('shift_requirements').select('*').execute()
                requirements = response.data
                
                self.logger.info(f'從 Supabase 獲取到的班表需求：{requirements}')
                return jsonify(requirements)
            except Exception as err:
                self.logger.error(f'取得班表需求時發生錯誤：{str(err)}')
                return jsonify({'error': '無法載入班表需求'}), 500

        @self.app.route('/api/employee-preferences/<int:employee_id>', methods=['POST'])
        def update_employee_preferences(employee_id):
            """更新員工偏好設定"""
            try:
                data = request.get_json()
                max_continuous_days = data.get('max_continuous_days')
                continuous_c = data.get('continuous_c')
                double_off_after_c = data.get('double_off_after_c')

                self.logger.info(f'更新員工 {employee_id} 的偏好設定...')
                self.logger.info(f'更新資料：{data}')

                # 檢查是否已存在偏好設定
                existing_response = self.supabase_client.table('employee_preferences').select('id').eq('employee_id', employee_id).execute()
                
                if existing_response.data:
                    # 更新現有記錄
                    response = self.supabase_client.table('employee_preferences').update({
                        'max_continuous_days': max_continuous_days,
                        'continuous_c': continuous_c,
                        'double_off_after_c': double_off_after_c
                    }).eq('employee_id', employee_id).execute()
                else:
                    # 創建新記錄
                    response = self.supabase_client.table('employee_preferences').insert({
                        'employee_id': employee_id,
                        'max_continuous_days': max_continuous_days,
                        'continuous_c': continuous_c,
                        'double_off_after_c': double_off_after_c
                    }).execute()

                result = response.data[0] if response.data else None
                self.logger.info(f'更新成功：{result}')
                return jsonify(result)
            except Exception as err:
                self.logger.error(f'更新員工偏好設定時發生錯誤：{str(err)}')
                return jsonify({'error': '無法更新員工偏好設定'}), 500

        @self.app.route('/api/employee-amount/<int:employee_id>', methods=['POST'])
        def update_employee_amount(employee_id):
            """更新員工班別數量"""
            try:
                shift_requirements = request.get_json()  # 預期格式: { A: 數量, B: 數量, C: 數量 }

                self.logger.info(f'更新員工 {employee_id} 的班別需求...')
                self.logger.info(f'更新資料：{shift_requirements}')

                updates = []

                # 處理每個班別的更新
                for shift_type, required_days in shift_requirements.items():
                    # 檢查是否已存在該班別的記錄
                    existing_response = self.supabase_client.table('shift_requirements').select('id').eq('employee_id', employee_id).eq('shift_type', shift_type).execute()
                    
                    if existing_response.data:
                        # 更新現有記錄
                        response = self.supabase_client.table('shift_requirements').update({
                            'required_days': required_days
                        }).eq('employee_id', employee_id).eq('shift_type', shift_type).execute()
                    else:
                        # 創建新記錄
                        response = self.supabase_client.table('shift_requirements').insert({
                            'employee_id': employee_id,
                            'shift_type': shift_type,
                            'required_days': required_days
                        }).execute()

                    if response.data:
                        updates.append(response.data[0])

                self.logger.info(f'更新成功：{updates}')
                return jsonify(updates)
            except Exception as err:
                self.logger.error(f'更新班別需求時發生錯誤：{str(err)}')
                return jsonify({'error': '無法更新班別需求'}), 500

        @self.app.route('/api/employees', methods=['POST'])
        def add_employee():
            """新增員工"""
            try:
                data = request.get_json()
                name = data.get('name')
                shift_requirements = data.get('shift_requirements')
                preferences = data.get('preferences')

                # 驗證姓名
                if not name or not isinstance(name, str) or name.strip() == '':
                    return jsonify({'error': '請輸入有效的員工姓名'}), 400

                # 驗證班別天數
                def validate_shift_days(days):
                    try:
                        num = int(days)
                        return 0 <= num <= 30
                    except (ValueError, TypeError):
                        return False

                if not all(validate_shift_days(shift_requirements.get(shift_type, 0)) 
                          for shift_type in ['A', 'B', 'C']):
                    return jsonify({'error': '班別天數必須是 0-30 之間的整數'}), 400

                self.logger.info('開始新增員工...')
                self.logger.info(f'新增資料：{data}')

                # 1. 新增員工基本資料
                employee_response = self.supabase_client.table('employees').insert({
                    'name': name.strip()
                }).execute()
                
                if not employee_response.data:
                    raise Exception("無法新增員工基本資料")
                
                employee_id = employee_response.data[0]['id']

                # 2. 新增員工偏好設定
                self.supabase_client.table('employee_preferences').insert({
                    'employee_id': employee_id,
                    'max_continuous_days': preferences['max_continuous_days'],
                    'continuous_c': preferences['continuous_c'],
                    'double_off_after_c': preferences['double_off_after_c']
                }).execute()

                # 3. 新增班別需求
                for shift_type in ['A', 'B', 'C']:
                    self.supabase_client.table('shift_requirements').insert({
                        'employee_id': employee_id,
                        'shift_type': shift_type,
                        'required_days': shift_requirements[shift_type]
                    }).execute()

                self.logger.info(f'新增員工成功：{employee_id}')
                return jsonify({'id': employee_id, 'name': name.strip()})
            except Exception as err:
                self.logger.error(f'新增員工時發生錯誤：{str(err)}')
                return jsonify({'error': '無法新增員工'}), 500

        @self.app.route('/api/employee-schedules', methods=['GET'])
        def get_employee_schedules():
            """獲取員工班表"""
            try:
                year = request.args.get('year')
                month = request.args.get('month')

                # 驗證查詢參數
                if not year or not month:
                    return jsonify({'error': '缺少年份或月份參數'}), 400

                try:
                    year_num = int(year)
                    month_num = int(month)
                except ValueError:
                    return jsonify({'error': '無效的年份或月份格式'}), 400

                if month_num < 1 or month_num > 12:
                    return jsonify({'error': '無效的月份格式'}), 400

                # 計算月份的第一天和最後一天
                start_date = f"{year_num}-{month_num:02d}-01"
                import calendar
                last_day = calendar.monthrange(year_num, month_num)[1]
                end_date = f"{year_num}-{month_num:02d}-{last_day:02d}"

                self.logger.info(f'開始從 Supabase 獲取 {year_num}年{month_num}月 的班表資料...')
                self.logger.info(f'查詢區間: {start_date} 到 {end_date}')

                response = self.supabase_client.table('employee_schedules').select('*').gte('work_date', start_date).lte('work_date', end_date).execute()
                schedules = response.data

                self.logger.info(f'從 Supabase 獲取到的班表資料：{schedules}')
                return jsonify(schedules)
            except Exception as err:
                self.logger.error(f'取得員工班表時發生錯誤：{str(err)}')
                return jsonify({'error': '無法載入員工班表資料'}), 500

        @self.app.route('/api/run-schedule', methods=['POST'])
        def run_schedule():
            """執行排班模型"""
            try:
                # 直接執行排班模型
                result = run_schedule_model()
                
                if result['status'] == 'success':
                    return jsonify({
                        'status': 'success',
                        'message': result['message'],
                        'data': {
                            'schedules': result['schedules'],
                            'penalty': result['penalty']
                        }
                    })
                else:
                    return jsonify({
                        'status': 'error',
                        'message': result['message'],
                        'data': {
                            'violations': result.get('violations', {}),
                            'diagnostic_info': result.get('diagnostic_info', {})
                        }
                    }), 500
                    
            except Exception as e:
                return jsonify({
                    'status': 'error',
                    'message': f'發生錯誤：{str(e)}'
                }), 500

    def run(self):
        """啟動 Flask 應用"""
        self.app.run(host=self.host, port=self.port, debug=self.debug)

# 建立並啟動 API 服務器
if __name__ == '__main__':
    server = APIServer(__name__, debug=True)
    server.run() 