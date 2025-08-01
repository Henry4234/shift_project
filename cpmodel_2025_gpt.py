from ortools.sat.python import cp_model
from datetime import datetime, timedelta
import calendar, json

from supabase_client import (
    fetch_active_cycle,
    fetch_employees,
    fetch_shift_requirements,
    fetch_employee_preferences,
    fetch_temp_offdays
)

PREF_BLUE_OFF_PENALTY = 5          # 藍 O 未休的懲罰權重
MAX_SOLVE_TIME        = 120        # 秒

class CPMODEL:
    def __init__(self):
        self.model = cp_model.CpModel()

        # ───── 1. 讀取「目前週期」基本資料 ─────
        cycle = fetch_active_cycle()
        if not cycle:
            raise RuntimeError("找不到任何未完成的 schedule_cycles ！")

        self.cycle_id   = cycle['cycle_id']
        self.start_date = datetime.fromisoformat(cycle['start_date']).date()
        self.end_date   = datetime.fromisoformat(cycle['end_date']).date()
        self.days       = (self.end_date - self.start_date).days + 1
        self.dates      = [
            self.start_date + timedelta(days=i) for i in range(self.days)
        ]

        # ───── 2. 取員工／需求／偏好／預排休假 ─────
        self.employees_data           = fetch_employees()
        self.shift_requirements_data  = fetch_shift_requirements(self.cycle_id)
        self.employee_preferences_data= fetch_employee_preferences()
        self.temp_offdays_data        = fetch_temp_offdays(self.cycle_id)

        self.employees = [e['name'] for e in self.employees_data]
        self.shifts    = ['A', 'B', 'C', 'O']

        # 每日人力需求（依星期幾）
        self.daily_requirements = {}
        for idx, day in enumerate(self.dates):
            wd = day.weekday()
            if wd == 5:   # Sat
                self.daily_requirements[idx] = {'A':2,'B':1,'C':1}
            elif wd == 6: # Sun
                self.daily_requirements[idx] = {'A':1,'B':1,'C':1}
            else:         # Mon-Fri
                self.daily_requirements[idx] = {'A':3,'B':2,'C':1}

        # 建立決策變數 shift[e, d, s] (d = 0..days-1)
        self.shifts_var = {
            (e, d, s): self.model.NewBoolVar(f'{e}_{d}_{s}')
            for e in self.employees
            for d in range(self.days)
            for s in self.shifts
        }

    # ───────────────────────────────────────────────
    # 硬性限制
    # ───────────────────────────────────────────────
    def add_constraints(self):
        # 每日各班次人數需求
        for d in range(self.days):
            for s in ['A','B','C']:
                self.model.Add(
                    sum(self.shifts_var[(e,d,s)] for e in self.employees)
                    == self.daily_requirements[d][s]
                )

        # 每人每天僅能上一個班
        for e in self.employees:
            for d in range(self.days):
                self.model.Add(
                    sum(self.shifts_var[(e,d,s)] for s in self.shifts) == 1
                )

        # 各員工指定班次天數
        for e in self.employees:
            if e in self.shift_requirements_data:
                for s in ['A','B','C']:
                    self.model.Add(
                        sum(self.shifts_var[(e,d,s)] for d in range(self.days))
                        == self.shift_requirements_data[e][s]
                    )

        # C→(隔天)A/B、B→(隔天)A  禁止
        for e in self.employees:
            for d in range(self.days-1):
                self.model.Add(self.shifts_var[(e,d,'C')] + self.shifts_var[(e,d+1,'A')] <= 1)
                self.model.Add(self.shifts_var[(e,d,'C')] + self.shifts_var[(e,d+1,'B')] <= 1)
                self.model.Add(self.shifts_var[(e,d,'B')] + self.shifts_var[(e,d+1,'A')] <= 1)

        # 7 日內至少休 1 天、14 日內至少休 2 天
        for e in self.employees:
            for s in range(self.days-6):
                self.model.Add(sum(self.shifts_var[(e,d,'O')] for d in range(s, s+7)) >= 1)
            for s in range(self.days-13):
                self.model.Add(sum(self.shifts_var[(e,d,'O')] for d in range(s, s+14)) >= 2)

        # ── ⬇︎  新增：處理「預排休假」硬性限制  ⬇︎ ──
        for e in self.employees:
            for off in self.temp_offdays_data.get(e, []):
                d_idx = (off['date'] - self.start_date).days
                if d_idx < 0 or d_idx >= self.days:
                    continue  # safety
                if off['type'] in ('紅O', '特休'):
                    # 必休
                    self.model.Add(self.shifts_var[(e, d_idx, 'O')] == 1)

    # ───────────────────────────────────────────────
    # 偏好 (軟性限制)
    # ───────────────────────────────────────────────
    def add_preferences(self):
        self.penalties = []

        # (1) 原有三類偏好 … 內容保持不動 … ############
        # 為了節省篇幅此處省略，邏輯與舊版相同
        # #############################################

        # (2) 新增：藍 O 偏好
        for e in self.employees:
            for off in self.temp_offdays_data.get(e, []):
                if off['type'] == '藍O':
                    d_idx = (off['date'] - self.start_date).days
                    want_off = self.model.NewBoolVar(f'{e}_want_off_{d_idx}')
                    self.model.Add(self.shifts_var[(e, d_idx, 'O')] == 0).OnlyEnforceIf(want_off)
                    self.model.Add(self.shifts_var[(e, d_idx, 'O')] == 1).OnlyEnforceIf(want_off.Not())
                    self.penalties.append((want_off, PREF_BLUE_OFF_PENALTY))

        # 目標：最小化總懲罰
        self.model.Minimize(sum(var * w for var, w in self.penalties))

    # ───────────────────────────────────────────────
    # 求解、輸出 (略)
    #   solve() / print_results() 與舊版一致，唯一差別：
    #   - d 迴圈改為 range(self.days)
    #   - 取得實際日期時可用 self.dates[d]
    # ───────────────────────────────────────────────
    # ……（其餘程式碼請依此邏輯將 day 改為 d_idx）……
