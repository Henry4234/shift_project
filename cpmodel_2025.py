from ortools.sat.python import cp_model
import calendar
from datetime import datetime
from supabase_client import fetch_employees, fetch_shift_requirements, fetch_employee_preferences

class CPMODEL:
    def __init__(self):
        # 建立模型
        self.model = cp_model.CpModel()
        
        # 從 Supabase 獲取資料
        self.employees_data = fetch_employees()
        self.shift_requirements_data = fetch_shift_requirements()
        self.employee_preferences_data = fetch_employee_preferences()

        # 定義基本資料
        self.employees = [emp['name'] for emp in self.employees_data]
        self.shifts = ['A', 'B', 'C', 'O']  # A: 白班, B: 小夜班, C: 大夜班, O:休息
        self.shift_hours = {'A': (8,16), 'B': (16,24), 'C': (0,8), 'O': (0,0)}

        # 2023年3月
        self.year, self.month = 2023, 3
        self.days = calendar.monthrange(self.year, self.month)[1]

        # 從 Supabase 獲取員工的指定班數限制
        self.employee_shift_requirements = self.shift_requirements_data

        # 從 Supabase 獲取員工偏好設定
        self.employee_preferences = self.employee_preferences_data

        # 每日所需班次
        self.daily_requirements = {}
        for day in range(1, self.days+1):
            weekday = datetime(self.year, self.month, day).weekday()
            if weekday == 5:  # 週六
                self.daily_requirements[day] = {'A':2, 'B':1, 'C':1}
            elif weekday == 6:  # 週日
                self.daily_requirements[day] = {'A':1, 'B':1, 'C':1}
            else:
                self.daily_requirements[day] = {'A':3, 'B':2, 'C':1}

        # 建立決策變數
        self.shifts_var = {}
        for e in self.employees:
            for d in range(1, self.days+1):
                for s in self.shifts:
                    self.shifts_var[(e,d,s)] = self.model.NewBoolVar(f'{e}_{d}_{s}')

    def add_constraints(self):
        # 限制：每天每班人數需求
        for d in range(1, self.days+1):
            for s in ['A', 'B', 'C']:
                self.model.Add(
                    sum(self.shifts_var[(e,d,s)] for e in self.employees) == self.daily_requirements[d][s]
                )

        # 限制：每人每天僅上一班
        for e in self.employees:
            for d in range(1, self.days+1):
                self.model.Add(sum(self.shifts_var[(e,d,s)] for s in self.shifts) == 1)

        # 限制：每位員工各班次指定天數
        for e in self.employees:
            if e in self.employee_shift_requirements:
                for s in ['A','B','C']:
                    self.model.Add(
                        sum(self.shifts_var[(e,d,s)] for d in range(1,self.days+1)) == self.employee_shift_requirements[e][s]
                    )

        # 限制：班與班之間必須休息超過11小時
        for e in self.employees:
            for d in range(1, self.days):
                self.model.Add(self.shifts_var[(e,d,'C')] + self.shifts_var[(e,d+1,'A')] <= 1)
                self.model.Add(self.shifts_var[(e,d,'C')] + self.shifts_var[(e,d+1,'B')] <= 1)
                self.model.Add(self.shifts_var[(e,d,'B')] + self.shifts_var[(e,d+1,'A')] <= 1)

        # 限制：7天內休息至少1天
        for e in self.employees:
            for start in range(1, self.days-6):
                self.model.Add(sum(self.shifts_var[(e,d,'O')] for d in range(start, start+7)) >= 1)

        # 限制：14天內休息至少兩天
        for e in self.employees:
            for start in range(1, self.days-13):
                self.model.Add(sum(self.shifts_var[(e,d,'O')] for d in range(start, start+14)) >= 2)

    def add_preferences(self):
        # 偏好設定 (軟性限制)
        self.penalties = []

        # 1️⃣ 偏好不連續上班超過5天
        for e in self.employees:
            if self.employee_preferences[e]['max_continuous_days']:
                for start in range(1, self.days - 5):
                    work_7days = self.model.NewBoolVar(f'{e}_work7_{start}')
                    self.model.Add(sum(self.shifts_var[e, d, 'O'] for d in range(start, start + 6)) == 0).OnlyEnforceIf(work_7days)
                    self.model.Add(sum(self.shifts_var[e, d, 'O'] for d in range(start, start + 6)) > 0).OnlyEnforceIf(work_7days.Not())
                    self.penalties.append((work_7days, 10))

        # 2️⃣ 偏好C班盡量連續排
        for e in self.employees:
            if self.employee_preferences[e]['continuous_C']:
                for d in range(1, self.days - 1):
                    interrupted_C = self.model.NewBoolVar(f'{e}_interrupted_C_{d}')
                    self.model.AddBoolAnd([
                        self.shifts_var[e, d, 'C'],
                        self.shifts_var[e, d + 1, 'O'],
                        self.shifts_var[e, d + 2, 'C']
                    ]).OnlyEnforceIf(interrupted_C)
                    self.model.AddBoolOr([
                        self.shifts_var[e, d, 'C'].Not(),
                        self.shifts_var[e, d + 1, 'O'].Not(),
                        self.shifts_var[e, d + 2, 'C'].Not()
                    ]).OnlyEnforceIf(interrupted_C.Not())
                    self.penalties.append((interrupted_C, 10))

        # 3️⃣ 大夜後偏好連續休兩天
        for e in self.employees:
            if self.employee_preferences[e]['double_off_after_C']:
                for d in range(1, self.days - 2):
                    prefer_double_off = self.model.NewBoolVar(f'{e}_double_off_after_C_{d}')
                    # 違反條件：(C->O->非O)，這種情況為違反雙休
                    self.model.AddBoolAnd([
                        self.shifts_var[e, d, 'C'],
                        self.shifts_var[e, d + 1, 'O'],
                        self.shifts_var[e, d + 2, 'O'].Not()
                    ]).OnlyEnforceIf(prefer_double_off)
                    self.model.AddBoolOr([
                        self.shifts_var[e, d, 'C'].Not(),
                        self.shifts_var[e, d + 1, 'O'].Not(),
                        self.shifts_var[e, d + 2, 'O']
                    ]).OnlyEnforceIf(prefer_double_off.Not())
                    self.penalties.append((prefer_double_off, 10))

        # 目標函數：最小化總懲罰
        self.model.Minimize(sum(var * weight for var, weight in self.penalties))

    def solve(self):
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 120
        status = solver.Solve(self.model)
        return solver, status

    def print_results(self, solver, status):
        if status in [cp_model.FEASIBLE, cp_model.OPTIMAL]:
            print("🗓️ 排班結果:")
            for e in self.employees:
                schedule = []
                for d in range(1, self.days+1):
                    for s in self.shifts:
                        if solver.Value(self.shifts_var[e,d,s]):
                            schedule.append(s)
                print(f"{e}: {schedule}")

            print("\n💡 偏好滿足情況:")
            total_penalty = 0
            for var, weight in self.penalties:
                if solver.Value(var):
                    total_penalty += weight
            print(f"總懲罰分數(越低越好): {total_penalty}")

        elif status not in [cp_model.FEASIBLE, cp_model.OPTIMAL]:
            print("❗ 找不到可行解，開始診斷軟限制問題...\n")

            violation_summary = {'連續7天工作':0, 'C班非連續':0, '大夜後非雙休':0}

            for var, weight in self.penalties:
                if 'work7' in var.Name():
                    violation_summary['連續7天工作'] += 1
                elif 'non_cont_C' in var.Name():
                    violation_summary['C班非連續'] += 1
                elif 'double_off_after_C' in var.Name():
                    violation_summary['大夜後非雙休'] += 1

            print("📌 軟限制數量統計：")
            for k,v in violation_summary.items():
                print(f"{k} 限制數量: {v}")

            print("\n建議降低限制數量多的限制的權重或移除部分限制條件。")
        else:
            print("找不到可行解")
            self.print_diagnostic_info()

    def print_diagnostic_info(self):
        # 員工總班次統計
        employee_totals = {e: {'A': 0, 'B': 0, 'C': 0} for e in self.employees}
        for e in self.employees:
            if e in self.employee_shift_requirements:
                for shift_type in ['A', 'B', 'C']:
                    employee_totals[e][shift_type] = self.employee_shift_requirements[e][shift_type]

        # 員工總班次合計
        total_supplied = {'A': 0, 'B': 0, 'C': 0}
        for e in self.employees:
            for s in ['A', 'B', 'C']:
                total_supplied[s] += employee_totals[e][s]

        print("🔹 員工總班次統計:")
        for e in self.employees:
            totals = employee_totals[e]
            print(f"{e}: A班={totals['A']}天, B班={totals['B']}天, C班={totals['C']}天, 總計={totals['A']+totals['B']+totals['C']}天")

        print("\n🔸 員工班次供給總計:")
        for s in ['A', 'B', 'C']:
            print(f"  {s}班總計: {total_supplied[s]} 班")

        # 計算每日班次需求
        daily_requirements_summary = {'A': 0, 'B': 0, 'C': 0}
        for day in range(1, self.days + 1):
            weekday = datetime(self.year, self.month, day).weekday()
            if weekday == 5:  # 週六
                daily_requirements_summary['A'] += 2
                daily_requirements_summary['B'] += 1
                daily_requirements_summary['C'] += 1
            elif weekday == 6:  # 週日
                daily_requirements_summary['A'] += 1
                daily_requirements_summary['B'] += 1
                daily_requirements_summary['C'] += 1
            else:
                daily_requirements_summary['A'] += 3
                daily_requirements_summary['B'] += 2
                daily_requirements_summary['C'] += 1

        print("\n🔸 每日班次需求總計:")
        for s in ['A', 'B', 'C']:
            print(f"  {s}班需求: {daily_requirements_summary[s]} 班")

        # 比較供給與需求差異
        print("\n🔺 供需差異分析:")
        for s in ['A', 'B', 'C']:
            diff = total_supplied[s] - daily_requirements_summary[s]
            status = "足夠" if diff == 0 else ("多出" if diff > 0 else "不足")
            print(f"  {s}班：{status} {abs(diff)} 班")

def main():
    # 建立模型實例
    cp_model_instance = CPMODEL()
    
    # 添加限制條件
    cp_model_instance.add_constraints()
    
    # 添加偏好設定
    cp_model_instance.add_preferences()
    
    # 求解
    solver, status = cp_model_instance.solve()
    
    # 輸出結果
    cp_model_instance.print_results(solver, status)

if __name__ == '__main__':
    main()
