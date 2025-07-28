# -*- coding: utf-8 -*-
"""
offday_planner.py

二階段排班法：第一階段決定每人每日是否上班，第二階段再分配班別。
本檔案為第一階段，支援從 Supabase 取得資料，並預留前端串接欄位。

Step 1 of the two‑phase rostering approach proposed by the user:
only decide *whether* an employee works on a given day, not **which**
shift they work.  The resulting matrix will later be refined when
shifts are allocated.

Hard constraints
----------------
1. Each employee can work at most one shift per day (captured by the
   binary variable itself).
2. Daily staffing demand  
   • Monday‑Friday : ≥ 6 people  
   • Saturday     : ≥ 4 people  
   • Sunday       : ≥ 3 people
3. An employee tagged with 「紅O」or「特休」 is OFF on that date.
4. Rolling 14‑day window: each employee must have ≥ 2 days off
   → at most 12 work‑days per any 14‑day period.
5. Total number of work‑days for every employee equals the sum of all
   shift‑type requirements in *simulate_shiftrequirements.json*.

Soft constraint
---------------
If *simulate_employeepreferences.json* sets
`max_continuous_days = true` for an employee, then any run of more
than 5 consecutive work‑days incurs a linear penalty in the objective.

The script prints a CSV‑like table and writes **schedule.json** with
0/1 indicators for downstream steps.
"""

import json
from datetime import datetime, timedelta
from pathlib import Path
from ortools.sat.python import cp_model
from supabase_client import (
    fetch_employees,
    fetch_shift_requirements,
    fetch_employee_preferences,
    fetch_temp_offdays,
    fetch_schedule_cycle
)
from verify_shift import verify_shift_assignment

# ===================== 第一階段：休假分配 =====================
class OffdayPlanner:
    def __init__(self, cycle_id):
        self.cycle_id = cycle_id
        self.model = cp_model.CpModel()
        self.load_data()

    def load_data(self):
        # 取得週期資訊
        cycle_info = fetch_schedule_cycle(self.cycle_id)
        if not cycle_info:
            raise ValueError(f"找不到 cycle_id={self.cycle_id} 的週期資料")
        self.start_date = datetime.fromisoformat(str(cycle_info['start_date']))
        self.end_date = datetime.fromisoformat(str(cycle_info['end_date']))
        self.dates = [
            (self.start_date + timedelta(days=i)).strftime('%Y-%m-%d')
            for i in range((self.end_date - self.start_date).days + 1)
        ]
        self.D = len(self.dates)

        # 取得人員、需求、偏好、休假資料
        self.employees_data = fetch_employees()
        self.shift_req_data = fetch_shift_requirements(self.cycle_id)
        self.offdays_raw = fetch_temp_offdays(self.cycle_id)
        self.prefs_raw = fetch_employee_preferences()
        self.emp_names = [e['name'] for e in self.employees_data]
        self.E = len(self.emp_names)
        self.emp_idx = {name: i for i, name in enumerate(self.emp_names)}

        # 需求、休假、偏好
        #每個員工的上班總天數
        #格式:{str(員工):int(天數)}
        self.total_days_req = {
            name: sum(self.shift_req_data.get(name, {}).values())
            for name in self.emp_names
        }
        #各員工的休假
        #格式:{str(員工):set(休假日期YYYY-MM-DD)}
        self.offday_set = {
            name: {item['date'].strftime('%Y-%m-%d') if hasattr(item['date'], 'strftime') else str(item['date']) for item in self.offdays_raw.get(name, [])}
            for name in self.emp_names
        }
        #軟限制:偏好不上超過五天
        #格式:{str(員工):boolyn}
        self.pref_max_cont = {
            name: self.prefs_raw.get(name, {}).get('max_continuous_days', False)
            for name in self.emp_names
        }
        #軟限制:偏好C(大夜)班後休兩天
        #格式:{str(員工):boolyn}
        self.double_off_after_c = {
            name: self.prefs_raw.get(name, {}).get('double_off_after_C', False)
            for name in self.emp_names
        }
    def build_model(self):
        # 建立決策變數
        self.x = {
            (e, d): self.model.NewBoolVar(f'x_{e}_{d}')
            for e in range(self.E) for d in range(self.D)
        }
        # 硬性限制
        # 1. 硬限制:員工休假(紅O及特休)
        for name, dates in self.offday_set.items():
            e = self.emp_idx[name]
            for d, date_str in enumerate(self.dates):
                if date_str in dates:
                    self.model.Add(self.x[e, d] == 0)
        # 2. 硬限制:每日需求(每日上班人數)
        for d, date_str in enumerate(self.dates):
            dt = datetime.strptime(date_str, '%Y-%m-%d')
            required = 6 if dt.weekday() <= 4 else (4 if dt.weekday() == 5 else 3)
            self.model.Add(sum(self.x[e, d] for e in range(self.E)) >= required)
        # 3. 硬限制:員工每月上班天數加總
        for name in self.emp_names:
            e = self.emp_idx[name]
            self.model.Add(sum(self.x[e, d] for d in range(self.D)) == self.total_days_req[name])
        # 4. 硬限制:14天連續上班天數(應休兩天) & 7天連續上班天數(應休一天)
        for e in range(self.E):
            for start in range(self.D - 13):
                self.model.Add(sum(self.x[e, d] for d in range(start, start + 14)) <= 12)
            for start in range(self.D - 6):
                self.model.Add(sum(self.x[e, d] for d in range(start, start + 7)) <= 6)
        # 軟性限制
        self.penalties = []
        # 5. 軟性限制:如果有選擇連續上班天數上限的員工，自動設置不超過五天
        for name in self.emp_names:
            if self.pref_max_cont[name]:
                e = self.emp_idx[name]
                for start in range(self.D - 5):
                    over = self.model.NewIntVar(0, 6, f'over_{e}_{start}')
                    self.model.Add(over >= sum(self.x[e, d] for d in range(start, start + 6)) - 5)
                    self.penalties.append(over)
        # 6. 軟性限制:盡量不出現OWO，也就是休假-上班-休假這種情況
        for e in range(self.E):
            for d in range(self.D - 2):
                y = self.model.NewBoolVar(f'owo_{e}_{d}')
                self.model.Add(y >= self.x[e, d + 1] - self.x[e, d] - self.x[e, d + 2])
                self.penalties.append(y)
        # 7. 軟性限制:如果有選擇C班後方連續休假的員工，則先優先安排連續休假狀況
        for name in self.emp_names:
            if self.double_off_after_c[name]:
                e = self.emp_idx[name]
                for d in range(self.D - 2):
                    # 若 x[e, d]==1 (上班)，且 x[e, d+1]==0 且 x[e, d+2]==0，則為 W-O-O
                    # 若不是 W-O-O，則 penalty
                    not_double_off = self.model.NewBoolVar(f'not_double_off_{e}_{d}')
                    # not_double_off = 1 代表違反 W-O-O
                    # 若 x[e,d]==1 且 (x[e,d+1]!=0 或 x[e,d+2]!=0) 則違反
                    self.model.AddBoolAnd([
                        self.x[e, d],
                        self.x[e, d+1].Not(),
                        self.x[e, d+2].Not()
                    ]).OnlyEnforceIf(not_double_off.Not())
                    self.model.AddBoolOr([
                        self.x[e, d].Not(),
                        self.x[e, d+1],
                        self.x[e, d+2]
                    ]).OnlyEnforceIf(not_double_off)
                    self.penalties.append(not_double_off)

        if self.penalties:
            self.model.Minimize(sum(self.penalties))
        else:
            self.model.Minimize(0)

# ---------------------------------------------------------------------------
# Solve
# ---------------------------------------------------------------------------
    def solve(self):
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 30
        solver.parameters.num_search_workers = 8
        status = solver.Solve(self.model)
        return solver, status

    def format_result(self, solver, status):
        result = {
            'status': 'success' if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else 'error',
            'message': '',
            'schedule': {},
            'dates': self.dates,
            'raw_table': []
        }
        if result['status'] == 'success':
            for e, name in enumerate(self.emp_names):
                row = [int(solver.Value(self.x[e, d])) for d in range(self.D)]
                result['schedule'][name] = row
                result['raw_table'].append([name] + row)
            result['message'] = '排班成功'
        else:
            result['message'] = '無可行解'
        return result

    def print_table(self, result):
        # CLI 輸出
        header = ['員工'] + result['dates']
        print(','.join(header))
        for row in result['raw_table']:
            print(','.join([str(x) for x in row]))

    def run(self):
        self.build_model()
        solver, status = self.solve()
        result = self.format_result(solver, status)
        self.print_table(result)
        return result

# ===================== 第二階段：班別分配 =====================

class ShiftAssignmentSolver:
    def __init__(self, first_stage_result, shift_requirements, offdays_raw, dates=None):
        """
        first_stage_result: dict, 來自第一階段的 result['schedule']，格式 {員工: [0/1, ...]}
        shift_requirements: dict, 來自 simulate_shiftrequirements.json
        offdays_raw: dict, 來自 simulate_offdays.json
        dates: list, 日期字串清單（可選，若有則用於藍O判斷）
        """
        self.model = cp_model.CpModel()
        self.employees = list(first_stage_result.keys())
        self.D = len(next(iter(first_stage_result.values())))
        self.shifts = ['A', 'B', 'C']
        self.shift_requirements = shift_requirements
        self.offdays_raw = offdays_raw
        self.dates = dates if dates is not None else [str(i) for i in range(self.D)]
        # print(self.employees)
        # print(self.D)
        # print(self.shift_requirements)
        # 取得藍O日期
        self.blue_off = {name: set(item['date'] for item in offdays_raw.get(name, []) if item['type'] == '藍O') for name in self.employees}

        # 只針對 W 的日子建立班別決策變數
        self.x = {}  # (e, d, s): BoolVar
        for e, name in enumerate(self.employees):
            for d in range(self.D):
                if int(first_stage_result[name][d]) == 1:
                    for s in self.shifts:
                        self.x[(e, d, s)] = self.model.NewBoolVar(f'{name}_{d}_{s}')

    def add_constraints(self):
        # 1. 每個 W 的日子只能排一種班
        for e, name in enumerate(self.employees):
            for d in range(self.D):
                if any(self.x.get((e, d, s)) is not None for s in self.shifts):
                    self.model.Add(sum(self.x[(e, d, s)] for s in self.shifts if self.x.get((e, d, s)) is not None) == 1)
        
        # 2. 硬限制:每日需求(每日上班人數)
        # 改為軟限制，避免與其他限制衝突導致無解
        self.daily_penalties = []
        for d in range(self.D):
            # 取得該日期對應的星期幾
            date_str = self.dates[d]
            dt = datetime.strptime(date_str, '%Y-%m-%d')
            weekday = dt.weekday()  # Monday = 0, Sunday = 6
            
            # 根據星期幾設定每日班別需求
            if weekday <= 4:  # 週一到週五
                daily_req = {'A': 3, 'B': 2, 'C': 1}
            elif weekday == 5:  # 週六
                daily_req = {'A': 2, 'B': 1, 'C': 1}
            else:  # 週日
                daily_req = {'A': 1, 'B': 1, 'C': 1}
            # 加入每日班別需求限制（懲罰不足的情況）
            for s in self.shifts:
                # if daily_req[s] > 0:
                #     pol=sum(self.x[(e, d, s)] for e, name in enumerate(self.employees) if self.x.get((e, d, s)) is not None) == daily_req[s]
                #     # print(pol)
                #     self.model.Add(pol)

                if daily_req[s] > 0:
                    actual = sum(self.x[(e, d, s)] for e, name in enumerate(self.employees) if self.x.get((e, d, s)) is not None)
                    # print(actual)
                    shortage = self.model.NewIntVar(0, daily_req[s], f'shortage_{d}_{s}')
                    self.model.Add(shortage >= daily_req[s] - actual)
                    self.daily_penalties.append(shortage * 100)  # 每日需求不足的懲罰權重

        
        
        # 3. 硬限制: 班與班之間必須休息超過11小時
        for e, name in enumerate(self.employees):
            for d in range(self.D - 1):
                # C班後不可A/B
                if self.x.get((e, d, 'C')) is not None and self.x.get((e, d+1, 'A')) is not None:
                    self.model.Add(self.x[(e, d, 'C')] + self.x[(e, d+1, 'A')] <= 1)
                if self.x.get((e, d, 'C')) is not None and self.x.get((e, d+1, 'B')) is not None:
                    self.model.Add(self.x[(e, d, 'C')] + self.x[(e, d+1, 'B')] <= 1)
                # B班後不可A
                if self.x.get((e, d, 'B')) is not None and self.x.get((e, d+1, 'A')) is not None:
                    self.model.Add(self.x[(e, d, 'B')] + self.x[(e, d+1, 'A')] <= 1)

        # 4. 硬限制: shift_requirements==0 的班別嚴格禁止
        for e, name in enumerate(self.employees):
            for s in self.shifts:
                if self.shift_requirements[name][s] == 0:
                    for d in range(self.D):
                        if self.x.get((e, d, s)) is not None:
                            self.model.Add(self.x[(e, d, s)] == 0)

    def add_soft_constraints(self):
        self.penalties = []

        # 5. 軟限制: 各班別總和與需求相差0不罰，正負1/2/3天分別懲罰
        for e, name in enumerate(self.employees):
            for s in self.shifts:
                total = sum(self.x[(e, d, s)] for d in range(self.D) if self.x.get((e, d, s)) is not None)
                required = self.shift_requirements[name][s]
                diff = self.model.NewIntVar(-self.D, self.D, f'diff_{name}_{s}')
                self.model.Add(diff == total - required)
                # 懲罰正負1天
                penalty1 = self.model.NewBoolVar(f'penalty1_{name}_{s}')
                self.model.AddAbsEquality(penalty1, diff)
                self.model.Add(penalty1 == 1).OnlyEnforceIf(penalty1)
                self.model.Add(penalty1 != 1).OnlyEnforceIf(penalty1.Not())
                self.penalties.append(penalty1 * 15)
                # 懲罰正負2天
                penalty2 = self.model.NewBoolVar(f'penalty2_{name}_{s}')
                self.model.AddAbsEquality(penalty2, diff)
                self.model.Add(penalty2 == 2).OnlyEnforceIf(penalty2)
                self.model.Add(penalty2 != 2).OnlyEnforceIf(penalty2.Not())
                self.penalties.append(penalty2 * 30)
                # 懲罰正負3天
                penalty3 = self.model.NewBoolVar(f'penalty3_{name}_{s}')
                self.model.AddAbsEquality(penalty3, diff)
                self.model.Add(penalty3 == 3).OnlyEnforceIf(penalty3)
                self.model.Add(penalty3 != 3).OnlyEnforceIf(penalty3.Not())
                self.penalties.append(penalty3 * 50)

        # 6. 軟限制: 藍O日安排任何班別都罰50
        for e, name in enumerate(self.employees):
            for d in range(self.D):
                if self.dates and str(self.dates[d]) in self.blue_off.get(name, set()):
                    for s in self.shifts:
                        if self.x.get((e, d, s)) is not None:
                            self.penalties.append(self.x[(e, d, s)] * 50)

        if self.penalties:
            self.model.Minimize(sum(self.penalties) + sum(self.daily_penalties))
        else:
            self.model.Minimize(sum(self.daily_penalties))
    def solve(self):
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 300
        status = solver.Solve(self.model)
        return solver, status

    def get_result(self, solver, status):
        result = {}
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            for e, name in enumerate(self.employees):
                result[name] = []
                for d in range(self.D):
                    if any(self.x.get((e, d, s)) is not None for s in self.shifts):
                        for s in self.shifts:
                            var = self.x.get((e, d, s))
                            if var is not None and solver.Value(var):
                                result[name].append(s)
                                break
                        else:
                            # 若該天有W但沒排到班，標記為O
                            result[name].append('O')
                    else:
                        result[name].append('O')
        return result

# ===================== 主流程串接 =====================
def main():
    # 第一階段：休假安排
    planner = OffdayPlanner(cycle_id=14)
    first_stage_result = planner.run()

    # 第二階段：班別分配與驗證
    max_retries = 5  # 最大重試次數
    current_retry = 0
    
    while current_retry < max_retries:
        print(f"\n=== 第二階段班別分配 (第 {current_retry + 1} 次嘗試) ===")
        
        # 這裡 shift_requirements, offdays_raw 可直接用 supabase_client 或本地json
        shift_requirements = planner.shift_req_data
        offdays_raw = planner.offdays_raw
        shift_solver = ShiftAssignmentSolver(first_stage_result['schedule'], shift_requirements, offdays_raw, dates=planner.dates)
        shift_solver.add_constraints()
        shift_solver.add_soft_constraints()
        solver, status = shift_solver.solve()
        
        # 檢查是否有解
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            shift_result = shift_solver.get_result(solver, status)
            
            # 輸出班別分配結果
            print('\n=== 第二階段班別分配結果 ===')
            print("日期區間: %s-%s"%(planner.start_date,planner.end_date))
            for name, row in shift_result.items():
                print(name, ','.join(row))
            
            # 驗證班別分配結果
            print('\n' + '='*60)
            print('開始驗證班別分配結果...')
            print('='*60)
            
            verification_passed = verify_shift_assignment(shift_result, planner.dates)
            
            if verification_passed:
                print('\n' + '='*60)
                print('✓ 驗證通過！班別分配結果符合所有限制條件')
                print('='*60)
                return shift_result
            else:
                print(f'\n✗ 驗證未通過，準備重新生成 (第 {current_retry + 1}/{max_retries} 次)')
                current_retry += 1
                
                if current_retry >= max_retries:
                    print(f'\n❌ 已達到最大重試次數 ({max_retries})，無法生成符合條件的班別分配')
                    return None
        else:
            print("第二階段無可行解")
            return None
    
    return None

if __name__ == '__main__':
    main()