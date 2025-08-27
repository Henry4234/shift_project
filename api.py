from flask import Flask, jsonify, request, abort
from flask_cors import CORS
import subprocess
import json
import os
from cpmodel_2025 import main as run_schedule_model
from test_plup import run_auto_scheduling
from supabase import create_client
import logging
from dotenv import load_dotenv
from datetime import datetime

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

        # 新增：批次上傳/發佈班表（含子班別）
        @self.app.route('/api/employee-schedules/upload', methods=['POST'])
        def upload_employee_schedules():
            """
            批次上傳/發佈班表資料到 employee_schedules
            請求格式：{
              "cycle_id": 1,
              "rows": [
                 {"employee_id": 1, "work_date": "2025-01-01", "shift_type": "A", "shift_subtype": "3"}, ...
              ]
            }
            - upsert 覆寫相同 (employee_id, work_date)
            - shift_type 僅允許 A/B/C/O
            """
            try:
                data = request.get_json()
                cycle_id = data.get('cycle_id')
                rows = data.get('rows', [])

                if not cycle_id:
                    return jsonify({'error': '缺少 cycle_id 參數'}), 400
                if not rows:
                    return jsonify({'status': 'success', 'count': 0})

                valid_shift_types = {'A', 'B', 'C', 'O'}
                prepared = []
                for r in rows:
                    employee_id = r.get('employee_id')
                    work_date = r.get('work_date')
                    shift_type = r.get('shift_type')
                    shift_subtype = r.get('shift_subtype', '')

                    if not all([employee_id, work_date, shift_type]):
                        continue
                    if shift_type not in valid_shift_types:
                        continue

                    prepared.append({
                        'employee_id': int(employee_id),
                        'work_date': work_date,
                        'shift_type': shift_type,
                        'shift_subtype': shift_subtype or '',
                        'updated_at': datetime.now().isoformat()
                    })

                # 使用單次 upsert 批次處理，on_conflict 以 (employee_id, work_date) 覆寫
                try:
                    upsert_resp = self.supabase_client.table('employee_schedules') \
                        .upsert(prepared, on_conflict='employee_id,work_date') \
                        .execute()
                except Exception as e:
                    # 任何資料錯誤（例如違反檢查或重複鍵）直接回傳錯誤
                    self.logger.error(f'批次上傳錯誤：{str(e)}')
                    return jsonify({'error': f'批次上傳失敗: {str(e)}'}), 500

                count = len(upsert_resp.data) if hasattr(upsert_resp, 'data') and upsert_resp.data else len(prepared)
                return jsonify({'status': 'success', 'count': count})
            except Exception as err:
                self.logger.error(f'上傳班表時發生錯誤：{str(err)}')
                return jsonify({'error': '上傳班表失敗'}), 500

        @self.app.route('/api/run-schedule', methods=['POST'])
        def run_schedule():
            """執行排班模型"""
            try:
                data = request.get_json()
                cycle_id = data.get('cycle_id')
                
                if not cycle_id:
                    return jsonify({
                        'success': False,
                        'message': '缺少 cycle_id 參數',
                        'stage': 'error',
                        'data': None
                    }), 400
                
                # 執行排班模型
                result = run_auto_scheduling(cycle_id=cycle_id)
                
                # 直接回傳 run_auto_scheduling 的結果，保持格式一致
                if result['success']:
                    return jsonify(result)
                else:
                    return jsonify(result), 500
                    
            except Exception as e:
                return jsonify({
                    'success': False,
                    'message': f'執行排班時發生錯誤：{str(e)}',
                    'stage': 'error',
                    'data': None
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
                shift_group = data.get('shift_group')  # 新增：班別群組
                if not start_date or not end_date:
                    return jsonify({'error': '缺少開始或結束日期'}), 400
                
                # 準備插入資料
                insert_data = {
                    'start_date': start_date,
                    'end_date': end_date,
                    'status': 'draft',
                    'shift_group':shift_group
                }
                
                response = self.supabase_client.table('schedule_cycles').insert(insert_data).execute()
                if not response.data:
                    raise Exception("無法建立排班週期")
                cycle = response.data[0]
                return jsonify({'cycle_id': cycle['cycle_id']})
            except Exception as err:
                self.logger.error(f'建立排班週期時發生錯誤：{str(err)}')
                return jsonify({'error': '無法建立排班週期'}), 500
        # 刪除排班週期
        @self.app.route('/api/schedule-cycles/<int:cycle_id>', methods=['DELETE'])
        def delete_schedule_cycle(cycle_id):
            """
            刪除指定的排班週期及其相關資料
            - 路徑參數: cycle_id (int)
            - 回傳: {"status": "success", "message": "週期已刪除"}
            """
            try:
                self.logger.info(f'開始刪除週期 #{cycle_id}...')
                
                # 1. 先檢查週期是否存在
                cycle_response = self.supabase_client.table('schedule_cycles') \
                    .select('cycle_id') \
                    .eq('cycle_id', cycle_id) \
                    .execute()
                
                if not cycle_response.data:
                    return jsonify({'error': '找不到指定的週期'}), 404
                
                # 2. 刪除相關的休假資料
                self.supabase_client.table('schedule_cycle_temp_offdays') \
                    .delete() \
                    .eq('cycle_id', cycle_id) \
                    .execute()
                
                # 3. 刪除週期成員資料
                self.supabase_client.table('schedule_cycle_members') \
                    .delete() \
                    .eq('cycle_id', cycle_id) \
                    .execute()
                
                # 4. 刪除週期本身
                self.supabase_client.table('schedule_cycles') \
                    .delete() \
                    .eq('cycle_id', cycle_id) \
                    .execute()
                
                self.logger.info(f'成功刪除週期 #{cycle_id}')
                
                return jsonify({
                    'status': 'success',
                    'message': f'週期 #{cycle_id} 已成功刪除'
                })
                
            except Exception as err:
                self.logger.error(f'刪除週期時發生錯誤：{str(err)}')
                return jsonify({'error': '刪除週期失敗'}), 500
            
        # 新增/更新週期備註
        @self.app.route('/api/schedule-cycles-comment', methods=['POST'])
        def update_cycle_comment():
            """
            更新指定週期的 cycle_comment
            請求格式: { "cycle_id": 1, "cycle_comment": "備註內容" }
            回傳: { "status": "success" }
            """
            try:
                data = request.get_json()
                cycle_id = data.get('cycle_id')
                cycle_comment = data.get('cycle_comment', '')
                if not cycle_id:
                    return jsonify({'error': '缺少 cycle_id 參數'}), 400
                # 更新 cycle_comment
                response = self.supabase_client.table('schedule_cycles') \
                    .update({'cycle_comment': cycle_comment}) \
                    .eq('cycle_id', int(cycle_id)) \
                    .execute()
                return jsonify({'status': 'success'})
            except Exception as err:
                self.logger.error(f'更新週期備註時發生錯誤：{str(err)}')
                return jsonify({'error': '無法更新週期備註'}), 500

        # 查詢週期備註
        @self.app.route('/api/schedule-cycles-comment', methods=['GET'])
        def get_cycle_comment():
            """
            查詢指定週期的 cycle_comment
            查詢參數: cycle_id
            回傳: { "cycle_comment": "..." }
            """
            cycle_id = request.args.get('cycle_id')
            if not cycle_id:
                return jsonify({'error': '缺少 cycle_id 參數'}), 400
            try:
                response = self.supabase_client.table('schedule_cycles') \
                    .select('cycle_comment') \
                    .eq('cycle_id', int(cycle_id)) \
                    .single() \
                    .execute()
                comment = response.data['cycle_comment'] if response.data else None
                return jsonify({'cycle_comment': comment})
            except Exception as err:
                self.logger.error(f'查詢週期備註時發生錯誤：{str(err)}')
                return jsonify({'error': '無法查詢週期備註'}), 500

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

        # === 新增：獲取班別群組資訊 ===
        @self.app.route('/api/schedule-cycle-shift-group', methods=['GET'])
        def get_schedule_cycle_shift_group():
            """
            根據 cycle_id 獲取該週期的班別群組資訊
            - 查詢參數: cycle_id (int)
            - 回傳: 重新整理後的班別群組資料
            """
            cycle_id = request.args.get('cycle_id')
            if not cycle_id:
                return jsonify({'error': '缺少 cycle_id 參數'}), 400
            
            try:
                self.logger.info(f'開始獲取週期 #{cycle_id} 的班別群組資訊...')
                
                # 先查詢週期的 shift_group 名稱
                cycle_response = self.supabase_client.table('schedule_cycles') \
                    .select('shift_group') \
                    .eq('cycle_id', int(cycle_id)) \
                    .single() \
                    .execute()
                
                if not cycle_response.data:
                    return jsonify({'error': '找不到指定的週期'}), 404
                
                shift_group_name = cycle_response.data['shift_group']
                
                # 查詢該班別群組的詳細資訊
                response = self.supabase_client.table('shift_group') \
                    .select('group_name, weekday, shift_type(shift_name, shift_subname, shift_group), amount') \
                    .eq('group_name', shift_group_name) \
                    .execute()
                
                if not response.data:
                    return jsonify({'error': '找不到班別群組資料'}), 404
                
                # 重新整理資料格式
                shift_group_data = {}
                for row in response.data:
                    weekday = row['weekday']
                    shift_info = row['shift_type']
                    
                    if weekday not in shift_group_data:
                        shift_group_data[weekday] = []
                    
                    shift_group_data[weekday].append({
                        'shift_name': shift_info['shift_name'],
                        'shift_subname': shift_info['shift_subname'],
                        'shift_group': shift_info['shift_group'],
                        'amount': row['amount']
                    })
                
                self.logger.info(f'成功獲取週期 #{cycle_id} 的班別群組資料')
                return jsonify(shift_group_data)
                
            except Exception as err:
                self.logger.error(f'獲取班別群組資訊時發生錯誤：{str(err)}')
                return jsonify({'error': '獲取班別群組資訊失敗'}), 500

        # === 新增：驗證班表 ===
        @self.app.route('/api/verify-schedule', methods=['POST'])
        def verify_schedule():
            """
            驗證班表是否符合各種限制條件
            - 請求格式: {
                "cycle_id": 1,
                "schedule_data": {
                    "schedule": {"員工名": ["A", "B", "C", "O", ...]},
                    "dates": ["2025-01-01", "2025-01-02", ...]
                }
            }
            - 回傳: {
                "daily_staffing_passed": bool,
                "daily_staffing_details": [str],
                "continuous_work_passed": bool,
                "continuous_work_details": [str],
                "shift_connection_passed": bool,
                "shift_connection_details": [str]
            }
            """
            try:
                data = request.get_json()
                cycle_id = data.get('cycle_id')
                schedule_data = data.get('schedule_data')
                
                if not cycle_id:
                    return jsonify({'error': '缺少 cycle_id 參數'}), 400
                
                if not schedule_data:
                    return jsonify({'error': '缺少 schedule_data 參數'}), 400
                
                self.logger.info(f'開始驗證週期 #{cycle_id} 的班表...')
                self.logger.info(f'班表資料: {schedule_data}')
                
                # 呼叫驗證模組
                from verify_shift_2 import verify_schedule_data
                verification_result = verify_schedule_data(schedule_data)
                
                self.logger.info(f'驗證結果: {verification_result}')
                
                return jsonify(verification_result)
                
            except Exception as err:
                self.logger.error(f'驗證班表時發生錯誤：{str(err)}')
                return jsonify({'error': '驗證班表失敗'}), 500

        # === 新增：更新員工需求 ===
        @self.app.route('/api/update-employee-requirements', methods=['POST'])
        def update_employee_requirements():
            """
            更新指定週期的員工班別需求
            - 請求格式: {
                "cycle_id": 1,
                "changes": [
                    {
                        "employee_name": "張小明",
                        "shift_type": "A",
                        "required_days": 5
                    }
                ]
            }
            - 回傳: {"status": "success", "count": 3}
            """
            try:
                data = request.get_json()
                cycle_id = data.get('cycle_id')
                changes = data.get('changes', [])
                
                if not cycle_id:
                    return jsonify({'error': '缺少 cycle_id 參數'}), 400
                
                if not changes:
                    return jsonify({'error': '缺少變更資料'}), 400
                
                self.logger.info(f'開始更新週期 #{cycle_id} 的員工需求...')
                self.logger.info(f'變更數量: {len(changes)}')
                
                updated_count = 0
                
                for change in changes:
                    employee_name = change.get('employee_name')
                    shift_type = change.get('shift_type')
                    required_days = change.get('required_days')
                    
                    if not all([employee_name, shift_type, required_days is not None]):
                        self.logger.warning(f'跳過無效的變更資料: {change}')
                        continue
                    
                    # 根據員工姓名查詢 employee_id
                    employee_response = self.supabase_client.table('employees') \
                        .select('id') \
                        .eq('name', employee_name) \
                        .execute()
                    
                    if not employee_response.data:
                        self.logger.warning(f'找不到員工: {employee_name}')
                        continue
                    
                    employee_id = employee_response.data[0]['id']
                    
                    # 更新 schedule_cycle_members 表格中的需求資料
                    response = self.supabase_client.table('schedule_cycle_members') \
                        .update({'required_days': required_days}) \
                        .eq('cycle_id', int(cycle_id)) \
                        .eq('employee_id', employee_id) \
                        .eq('shift_type', shift_type) \
                        .execute()
                    
                    if response.data:
                        updated_count += 1
                        self.logger.info(f'成功更新員工 {employee_name} 的 {shift_type} 需求為 {required_days}')
                    else:
                        self.logger.warning(f'無法更新員工 {employee_name} 的 {shift_type} 需求')
                
                self.logger.info(f'成功更新 {updated_count} 筆需求資料')
                
                return jsonify({
                    'status': 'success',
                    'count': updated_count,
                    'message': f'成功更新 {updated_count} 筆需求資料'
                })
                
            except Exception as err:
                self.logger.error(f'更新員工需求時發生錯誤：{str(err)}')
                return jsonify({'error': '更新員工需求失敗'}), 500

        # === 新增：班別類型管理 API ===
        @self.app.route('/api/shift-types', methods=['GET'])
        def get_shift_types():
            """獲取所有班別類型資料"""
            try:
                self.logger.info('開始從 Supabase 獲取班別類型資料...')
                
                response = self.supabase_client.table('shift_type').select('*').order('id').execute()
                shift_types = response.data
                
                self.logger.info(f'從 Supabase 獲取到的班別類型資料：{shift_types}')
                return jsonify(shift_types)
            except Exception as err:
                self.logger.error(f'取得班別類型資料時發生錯誤：{str(err)}')
                return jsonify({'error': '無法載入班別類型資料'}), 500

        @self.app.route('/api/shift-types', methods=['POST'])
        def add_shift_type():
            """新增班別類型"""
            try:
                data = request.get_json()
                shift_name = data.get('shift_name')
                shift_subname = data.get('shift_subname')
                shift_group = data.get('shift_group')
                start_time = data.get('start_time')
                end_time = data.get('end_time')

                # 驗證必填欄位
                if not all([shift_name, shift_subname, start_time, end_time]):
                    return jsonify({'error': '請填寫所有必填欄位'}), 400

                self.logger.info('開始新增班別類型...')
                self.logger.info(f'新增資料：{data}')

                response = self.supabase_client.table('shift_type').insert({
                    'shift_name': shift_name.strip(),
                    'shift_subname': shift_subname.strip(),
                    'shift_group': shift_group.strip() if shift_group else None,
                    'start_time': start_time,
                    'end_time': end_time
                }).execute()
                
                if not response.data:
                    raise Exception("無法新增班別類型")
                
                shift_type = response.data[0]
                self.logger.info(f'新增班別類型成功：{shift_type}')
                return jsonify(shift_type)
            except Exception as err:
                self.logger.error(f'新增班別類型時發生錯誤：{str(err)}')
                return jsonify({'error': '無法新增班別類型'}), 500

        @self.app.route('/api/shift-types/<int:shift_id>', methods=['PUT'])
        def update_shift_type(shift_id):
            """更新班別類型"""
            try:
                data = request.get_json()
                shift_name = data.get('shift_name')
                shift_subname = data.get('shift_subname')
                shift_group = data.get('shift_group')
                start_time = data.get('start_time')
                end_time = data.get('end_time')

                # 驗證必填欄位
                if not all([shift_name, shift_subname, start_time, end_time]):
                    return jsonify({'error': '請填寫所有必填欄位'}), 400

                self.logger.info(f'開始更新班別類型 ID: {shift_id}...')
                self.logger.info(f'更新資料：{data}')

                response = self.supabase_client.table('shift_type').update({
                    'shift_name': shift_name.strip(),
                    'shift_subname': shift_subname.strip(),
                    'shift_group': shift_group.strip() if shift_group else None,
                    'start_time': start_time,
                    'end_time': end_time
                }).eq('id', shift_id).execute()
                
                if not response.data:
                    return jsonify({'error': '找不到指定的班別類型'}), 404
                
                shift_type = response.data[0]
                self.logger.info(f'更新班別類型成功：{shift_type}')
                return jsonify(shift_type)
            except Exception as err:
                self.logger.error(f'更新班別類型時發生錯誤：{str(err)}')
                return jsonify({'error': '無法更新班別類型'}), 500

        @self.app.route('/api/shift-types/<int:shift_id>', methods=['DELETE'])
        def delete_shift_type(shift_id):
            """刪除班別類型"""
            try:
                self.logger.info(f'開始刪除班別類型 ID: {shift_id}...')

                response = self.supabase_client.table('shift_type').delete().eq('id', shift_id).execute()
                
                if not response.data:
                    return jsonify({'error': '找不到指定的班別類型'}), 404
                
                self.logger.info(f'刪除班別類型成功：ID {shift_id}')
                return jsonify({'status': 'success', 'message': '班別類型已刪除'})
            except Exception as err:
                self.logger.error(f'刪除班別類型時發生錯誤：{str(err)}')
                return jsonify({'error': '無法刪除班別類型'}), 500

        # === 新增：班別群組管理 API ===
        @self.app.route('/api/shift-groups', methods=['GET'])
        def get_shift_groups():
            """獲取所有班別群組資料"""
            try:
                self.logger.info('開始從 Supabase 獲取班別群組資料...')
                
                # 聯結查詢取得班別類型資訊
                response = self.supabase_client.table('shift_group').select(
                    '*, shift_type(shift_name, shift_subname)'
                ).order('group_name').execute()
                
                shift_groups = response.data
                
                self.logger.info(f'從 Supabase 獲取到的班別群組資料：{shift_groups}')
                return jsonify(shift_groups)
            except Exception as err:
                self.logger.error(f'取得班別群組資料時發生錯誤：{str(err)}')
                return jsonify({'error': '無法載入班別群組資料'}), 500

        @self.app.route('/api/shift-groups', methods=['POST'])
        def add_shift_group():
            """新增班別群組"""
            try:
                data = request.get_json()
                group_name = data.get('group_name')
                weekday = data.get('weekday')
                shift_id = data.get('shift_id')
                amount = data.get('amount')

                # 驗證必填欄位
                if not all([group_name, weekday is not None, shift_id, amount is not None]):
                    return jsonify({'error': '請填寫所有必填欄位'}), 400

                # 驗證星期範圍 (0-6)
                if not (0 <= weekday <= 6):
                    return jsonify({'error': '星期必須在 0-6 之間'}), 400

                # 驗證人數為正整數
                if amount < 0:
                    return jsonify({'error': '上班人數必須大於等於 0'}), 400

                self.logger.info('開始新增班別群組...')
                self.logger.info(f'新增資料：{data}')

                response = self.supabase_client.table('shift_group').insert({
                    'group_name': group_name.strip(),
                    'weekday': weekday,
                    'shift_id': shift_id,
                    'amount': amount
                }).execute()
                
                if not response.data:
                    raise Exception("無法新增班別群組")
                
                shift_group = response.data[0]
                self.logger.info(f'新增班別群組成功：{shift_group}')
                return jsonify(shift_group)
            except Exception as err:
                self.logger.error(f'新增班別群組時發生錯誤：{str(err)}')
                return jsonify({'error': '無法新增班別群組'}), 500

        @self.app.route('/api/shift-groups/<uuid:group_uuid>', methods=['PUT'])
        def update_shift_group(group_uuid):
            """更新班別群組"""
            try:
                data = request.get_json()
                group_name = data.get('group_name')
                weekday = data.get('weekday')
                shift_id = data.get('shift_id')
                amount = data.get('amount')

                # 驗證必填欄位
                if not all([group_name, weekday is not None, shift_id, amount is not None]):
                    return jsonify({'error': '請填寫所有必填欄位'}), 400

                # 驗證星期範圍 (0-6)
                if not (0 <= weekday <= 6):
                    return jsonify({'error': '星期必須在 0-6 之間'}), 400

                # 驗證人數為正整數
                if amount < 0:
                    return jsonify({'error': '上班人數必須大於等於 0'}), 400

                self.logger.info(f'開始更新班別群組 UUID: {group_uuid}...')
                self.logger.info(f'更新資料：{data}')

                response = self.supabase_client.table('shift_group').update({
                    'group_name': group_name.strip(),
                    'weekday': weekday,
                    'shift_id': shift_id,
                    'amount': amount
                }).eq('uuid', str(group_uuid)).execute()
                
                if not response.data:
                    return jsonify({'error': '找不到指定的班別群組'}), 404
                
                shift_group = response.data[0]
                self.logger.info(f'更新班別群組成功：{shift_group}')
                return jsonify(shift_group)
            except Exception as err:
                self.logger.error(f'更新班別群組時發生錯誤：{str(err)}')
                return jsonify({'error': '無法更新班別群組'}), 500

        @self.app.route('/api/shift-groups/<uuid:group_uuid>', methods=['DELETE'])
        def delete_shift_group(group_uuid):
            """刪除班別群組"""
            try:
                self.logger.info(f'開始刪除班別群組 UUID: {group_uuid}...')

                response = self.supabase_client.table('shift_group').delete().eq('uuid', str(group_uuid)).execute()
                
                if not response.data:
                    return jsonify({'error': '找不到指定的班別群組'}), 404
                
                self.logger.info(f'刪除班別群組成功：UUID {group_uuid}')
                return jsonify({'status': 'success', 'message': '班別群組已刪除'})
            except Exception as err:
                self.logger.error(f'刪除班別群組時發生錯誤：{str(err)}')
                return jsonify({'error': '無法刪除班別群組'}), 500

        # 新增：獲取班別群組的唯一名稱
        @self.app.route('/api/shift-group-names', methods=['GET'])
        def get_shift_group_names():
            """獲取 shift_group 表格中 group_name 的唯一值"""
            try:
                self.logger.info('開始從 Supabase 獲取班別群組名稱...')
                
                # 查詢所有不重複的 group_name
                response = self.supabase_client.table('shift_group').select('group_name').execute()
                group_names = response.data if response.data else []
                
                # 提取唯一的 group_name 值
                unique_names = list(set([item['group_name'] for item in group_names if item['group_name']]))
                unique_names.sort()  # 排序
                
                self.logger.info(f'從 Supabase 獲取到的班別群組名稱：{unique_names}')
                return jsonify(unique_names)
            except Exception as err:
                self.logger.error(f'取得班別群組名稱時發生錯誤：{str(err)}')
                return jsonify({'error': '無法載入班別群組名稱'}), 500

    def run(self):
        """啟動 Flask 應用"""
        self.app.run(host=self.host, port=self.port, debug=self.debug)

# 建立並啟動 API 服務器
if __name__ == '__main__':
    server = APIServer(__name__, debug=True)
    server.run() 