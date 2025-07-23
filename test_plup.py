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

Usage
-----
$ python offday_planning_step1.py
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
        self.total_days_req = {
            name: sum(self.shift_req_data.get(name, {}).values())
            for name in self.emp_names
        }
        self.offday_set = {
            name: {item['date'].strftime('%Y-%m-%d') if hasattr(item['date'], 'strftime') else str(item['date']) for item in self.offdays_raw.get(name, [])}
            for name in self.emp_names
        }
        self.pref_max_cont = {
            name: self.prefs_raw.get(name, {}).get('max_continuous_days', False)
            for name in self.emp_names
        }
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

if __name__ == '__main__':
    planner = OffdayPlanner(cycle_id=14)
    planner.run()