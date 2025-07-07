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
        api_key = os.getenv("SUPABASE_KEY") 

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
                
                response = self.supabase_client.table('shift_requirements_legacy').select('*').execute()
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
                print(employee_id)
                # 2. 新增員工偏好設定
                self.supabase_client.table('employee_preferences').insert({
                    'employee_id': employee_id,
                    'max_continuous_days': preferences['max_continuous_days'],
                    'continuous_c': preferences['continuous_c'],
                    'double_off_after_c': preferences['double_off_after_c']
                }).execute()

                # 3. 新增班別需求
                for shift_type in ['A', 'B', 'C']:
                    self.supabase_client.table('shift_requirements_legacy').insert({
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
        #查詢排班週期
        @self.app.route('/api/schedule-cycles', methods=['GET'])
        def get_cycle():
            """獲取暫存的班表"""
            try:
                status = request.args.get('status')
                query = self.supabase_client.table('schedule_cycles').select('*')
                if status:
                    query = query.eq('status', status)
                response = query.order('created_at', desc=True).execute()
                cycles = response.data
                return jsonify(cycles)
            except Exception as err:
                self.logger.error(f'查詢排班週期時發生錯誤：{str(err)}')
                return jsonify({'error': '無法查詢排班週期'}), 500
        # 建立新的排班週期
        @self.app.route('/api/schedule-cycles', methods=['POST'])
        def create_schedule_cycle():
            try:
                data = request.get_json()
                start_date = data.get('start_date')
                end_date = data.get('end_date')
                if not start_date or not end_date:
                    return jsonify({'error': '缺少開始或結束日期'}), 400
                response = self.supabase_client.table('schedule_cycles').insert({
                    'start_date': start_date,
                    'end_date': end_date,
                    'status': 'draft'
                }).execute()
                if not response.data:
                    raise Exception("無法建立排班週期")
                cycle = response.data[0]
                return jsonify({'cycle_id': cycle['cycle_id']})
            except Exception as err:
                self.logger.error(f'建立排班週期時發生錯誤：{str(err)}')
                return jsonify({'error': '無法建立排班週期'}), 500

        # 查詢 shift_requirements_legacy
        @self.app.route('/api/shift-requirements-legacy', methods=['GET'])
        def get_shift_requirements_legacy():
            """
            取得多位員工在 shift_requirements_legacy 中的班別需求
            Query param:  employee_ids=1,2,3
            回傳: [{employee_id, snapshot_name, shift_type, required_days}, ...]
            """
            ids_param = request.args.get("employee_ids")
            if not ids_param:
                return jsonify({"error": "Query parameter 'employee_ids' is required"}), 400

            try:
                emp_ids = [int(x) for x in ids_param.split(",") if x.strip()]
                if not emp_ids:
                    raise ValueError
            except ValueError:
                return jsonify({"error": "employee_ids must be a comma-separated list of integers"}), 400

            try:
                # Supabase 查詢
                response = (
                    self.supabase_client.table("employees")
                    .select("id, name, shift_requirements_legacy(shift_type, required_days)")
                    .in_("id", emp_ids)
                    .execute()
                )
                
                # 扁平化處理，轉換成前端需要的格式
                flat_result = []
                for employee in response.data:
                    employee_id = employee.get('id')
                    snapshot_name = employee.get('name')
                    requirements = employee.get('shift_requirements_legacy', [])
                    
                    for req in requirements:
                        flat_result.append({
                            "employee_id": employee_id,
                            "snapshot_name": snapshot_name,
                            "shift_type": req.get('shift_type'),
                            "required_days": req.get('required_days')
                        })
                
                return jsonify(flat_result)

            except Exception as err:
                self.logger.error(f'查詢 shift_requirements_legacy 時發生錯誤：{str(err)}')
                return jsonify({'error': '查詢失敗'}), 500

        # 批次寫入 schedule_cycle_members
        @self.app.route('/api/schedule-cycle-members', methods=['POST'])
        def insert_schedule_cycle_members():
            try:
                data = request.get_json()
                cycle_id = data.get('cycle_id')
                members = data.get('members', [])
                if not cycle_id or not members:
                    return jsonify({'error': '缺少 cycle_id 或 members'}), 400
                
                # # 處理重複：因為主鍵是 (cycle_id, employee_id)，每個員工只能有一筆紀錄。
                # # 我們使用字典來確保每個 employee_id 只被處理一次。
                cycle_employees_required = []
                for m in members:
                    employee_id = m['employee_id']
                    cycle_employees_required.append(
                        {
                        'employee_id': employee_id,
                        'cycle_id': cycle_id,
                        'snapshot_name': m['snapshot_name'],
                        'shift_type': m['shift_type'],
                        'required_days': m['required_days']
                    })
                
                if cycle_employees_required:
                    self.supabase_client.table('schedule_cycle_members').insert(cycle_employees_required).execute()

                return jsonify({'status': 'success', 'count': len(cycle_employees_required)})
            except Exception as err:
                self.logger.error(f'批次寫入 schedule_cycle_members 時發生錯誤：{str(err)}')
                return jsonify({'error': '寫入失敗'}), 500

        # 查詢特定週期的成員（含班別資訊）
        @self.app.route('/api/schedule-cycle-members', methods=['GET'])
        def get_schedule_cycle_members():
            """
            取得指定週期 (cycle_id) 的所有成員資料
            - 查詢參數: cycle_id (int)
            - 回傳: [{employee_id, snapshot_name, shift_type, required_days}, ...]
            """
            cycle_id = request.args.get('cycle_id')
            if not cycle_id:
                return jsonify({'error': '缺少 cycle_id 參數'}), 400
            try:
                # 從 schedule_cycle_members 取得所有該週期成員
                response = self.supabase_client.table('schedule_cycle_members') \
                    .select('employee_id, snapshot_name, shift_type, required_days') \
                    .eq('cycle_id', int(cycle_id)) \
                    .execute()
                members = response.data if response.data else []
                return jsonify(members)
            except Exception as err:
                self.logger.error(f'查詢 schedule_cycle_members 時發生錯誤：{str(err)}')
                return jsonify({'error': '查詢失敗'}), 500

        # 儲存週期休假資料
        @self.app.route('/api/schedule-cycle-leaves', methods=['POST'])
        def save_schedule_cycle_leaves():
            """
            儲存指定週期的休假資料到 schedule_cycle_temp_offdays 表格
            - 請求格式: {
                "cycle_id": 1,
                "leave_data": [
                    {
                        "employee_name": "張小明",
                        "date": "2025-01-01",
                        "leave_state": 1,
                        "leave_weight": 1
                    }
                ]
            }
            - 回傳: {"status": "success", "count": 5}
            """
            try:
                data = request.get_json()
                cycle_id = data.get('cycle_id')
                leave_data = data.get('leave_data', [])
                
                if not cycle_id:
                    return jsonify({'error': '缺少 cycle_id 參數'}), 400
                
                if not leave_data:
                    return jsonify({'status': 'success', 'count': 0, 'message': '沒有休假資料需要儲存'})
                
                self.logger.info(f'開始儲存週期 #{cycle_id} 的休假資料...')
                self.logger.info(f'休假資料數量: {len(leave_data)}')
                
                # 先清除該週期的舊休假資料
                self.supabase_client.table('schedule_cycle_temp_offdays') \
                    .delete() \
                    .eq('cycle_id', int(cycle_id)) \
                    .execute()
                
                self.logger.info(f'已清除週期 #{cycle_id} 的舊休假資料')
                
                # 準備新的休假資料
                offdays_data = []
                for leave_item in leave_data:
                    employee_name = leave_item.get('employee_name')
                    date = leave_item.get('date')
                    leave_state = leave_item.get('leave_state')
                    
                    # 根據 leave_state 決定 offtype
                    if leave_state == 1:
                        offtype = "紅O"
                    elif leave_state == 2:
                        offtype = "藍O"
                    elif leave_state == 3:
                        offtype = "特休"
                    else:
                        continue  # 跳過無效狀態
                    
                    # 根據員工姓名查詢 employee_id
                    employee_response = self.supabase_client.table('employees') \
                        .select('id') \
                        .eq('name', employee_name) \
                        .execute()
                    
                    if not employee_response.data:
                        self.logger.warning(f'找不到員工: {employee_name}')
                        continue
                    
                    employee_id = employee_response.data[0]['id']
                    
                    offdays_data.append({
                        'cycle_id': int(cycle_id),
                        'employee_id': employee_id,
                        'offdate': date,
                        'offtype': offtype
                    })
                
                # 批次插入休假資料
                if offdays_data:
                    response = self.supabase_client.table('schedule_cycle_temp_offdays') \
                        .insert(offdays_data) \
                        .execute()
                    
                    inserted_count = len(response.data) if response.data else 0
                    self.logger.info(f'成功儲存 {inserted_count} 筆休假資料')
                    
                    return jsonify({
                        'status': 'success',
                        'count': inserted_count,
                        'message': f'成功儲存 {inserted_count} 筆休假資料'
                    })
                else:
                    return jsonify({
                        'status': 'success',
                        'count': 0,
                        'message': '沒有有效的休假資料需要儲存'
                    })
                    
            except Exception as err:
                self.logger.error(f'儲存週期休假資料時發生錯誤：{str(err)}')
                return jsonify({'error': '儲存休假資料失敗'}), 500

        # 查詢週期休假資料
        @self.app.route('/api/schedule-cycle-leaves', methods=['GET'])
        def get_schedule_cycle_leaves():
            """
            取得指定週期的休假資料
            - 查詢參數: cycle_id (int)
            - 回傳: [{employee_name, date, offtype}, ...]
            """
            cycle_id = request.args.get('cycle_id')
            if not cycle_id:
                return jsonify({'error': '缺少 cycle_id 參數'}), 400
            
            try:
                # 聯結查詢取得員工姓名和休假資料
                response = self.supabase_client.table('schedule_cycle_temp_offdays') \
                    .select('offdate, offtype, employees(name)') \
                    .eq('cycle_id', int(cycle_id)) \
                    .execute()
                
                # 轉換資料格式
                leaves_data = []
                for item in response.data:
                    leaves_data.append({
                        'employee_name': item['employees']['name'],
                        'date': item['offdate'],
                        'offtype': item['offtype']
                    })
                
                self.logger.info(f'查詢到週期 #{cycle_id} 的休假資料: {len(leaves_data)} 筆')
                return jsonify(leaves_data)
                
            except Exception as err:
                self.logger.error(f'查詢週期休假資料時發生錯誤：{str(err)}')
                return jsonify({'error': '查詢休假資料失敗'}), 500

        # 清除週期休假資料
        @self.app.route('/api/schedule-cycle-leaves', methods=['DELETE'])
        def clear_schedule_cycle_leaves():
            """
            清除指定週期的所有休假資料
            - 請求格式: {"cycle_id": 1}
            - 回傳: {"status": "success", "count": 5}
            """
            try:
                data = request.get_json()
                cycle_id = data.get('cycle_id')
                
                if not cycle_id:
                    return jsonify({'error': '缺少 cycle_id 參數'}), 400
                
                self.logger.info(f'開始清除週期 #{cycle_id} 的所有休假資料...')
                
                # 先查詢要刪除的資料數量
                count_response = self.supabase_client.table('schedule_cycle_temp_offdays') \
                    .select('uuid', count='exact') \
                    .eq('cycle_id', int(cycle_id)) \
                    .execute()
                
                delete_count = count_response.count if hasattr(count_response, 'count') else 0
                
                # 刪除該週期的所有休假資料
                self.supabase_client.table('schedule_cycle_temp_offdays') \
                    .delete() \
                    .eq('cycle_id', int(cycle_id)) \
                    .execute()
                
                self.logger.info(f'成功清除週期 #{cycle_id} 的 {delete_count} 筆休假資料')
                
                return jsonify({
                    'status': 'success',
                    'count': delete_count,
                    'message': f'成功清除 {delete_count} 筆休假資料'
                })
                
            except Exception as err:
                self.logger.error(f'清除週期休假資料時發生錯誤：{str(err)}')
                return jsonify({'error': '清除休假資料失敗'}), 500

    def run(self):
        """啟動 Flask 應用"""
        self.app.run(host=self.host, port=self.port, debug=self.debug)

# 建立並啟動 API 服務器
if __name__ == '__main__':
    server = APIServer(__name__, debug=True)
    server.run() 