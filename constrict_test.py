# 使用 MindOpt 建立的排班模型 (Python 實現)
import pandas as pd
from ortools.linear_solver import pywraplp

# 載入輸入數據
schedule_df = pd.read_csv("班次.csv")
num_demand_df = pd.read_csv("需求人数.csv")
num_demand_long_df = pd.read_csv("需求人数-长列表.csv")

# 參數設定
schedules = schedule_df["班次"].tolist()  # 班次列表
days = num_demand_df["日期"].tolist()  # 日期列表
max_day = max(days)  # 最大日期
total_slots = num_demand_long_df["人数"].sum()  # 總排班需求數量

# 員工數量估算
estimated_employees = int(total_slots / 5) + 1  # 預估需要的員工數量
employees = [f"Employee {i+1}" for i in range(estimated_employees)]  # 員工列表

# 每位員工的排班需求
employees_days = {
    "Employee 1": [13, 4, 3],
    "Employee 2": [12, 5, 3],
    "Employee 3": [10, 6, 4],
    "Employee 4": [15, 3, 2],
    "Employee 5": [8, 4, 5]
}

# 建立求解器
solver = pywraplp.Solver.CreateSolver("SCIP")
if not solver:
    raise Exception("找不到求解器！")

# 定義決策變數
x = {}
for day in days:
    for schedule in schedules:
        for emp in employees:
            x[day, schedule, emp] = solver.BoolVar(f"x[{day},{schedule},{emp}]")

# 約束條件
# 1. 滿足每天每個班次的需求人數
for day in days:
    for schedule in schedules:
        solver.Add(
            sum(x[day, schedule, emp] for emp in employees) >= num_demand_long_df[(num_demand_long_df["日期"] == day) & (num_demand_long_df["班次"] == schedule)]["人数"].iloc[0]
        )

# 2. 每位員工每天最多只能排一個班次
for day in days:
    for emp in employees:
        solver.Add(sum(x[day, schedule, emp] for schedule in schedules) <= 1)

# 3. 禁止夜班後接早班
#    禁止小夜班後接早班
for emp in employees:
    for day in range(1, max_day):
        if day + 1 <= max_day:
            solver.Add(
                x[day, "夜班0-8点", emp] + x[day + 1, "早班8-16点", emp] <= 1
            )
            solver.Add(
                x[day, "小夜班16-24点", emp] + x[day + 1, "早班8-16点", emp] <= 1
            )

# 4. 限制每位員工不得連續工作超過 7 天，但允許部分天休息
for emp in employees:
    for start_day in range(1, max_day - 7 + 2):  # 設定窗口起點範圍，確保窗口不超出總日期
        slack_var = solver.NumVar(0, 7, f"slack_continuous[{emp},{start_day}]")
        solver.Add(
            sum(
                sum(x[start_day + offset, schedule, emp] for schedule in schedules)
                for offset in range(7)  # 檢查連續 7 天
            ) <= 7 + slack_var  # 加入 slack 變數允許部分違反
        )

# 5. 滿足每位員工的班次需求總數（作為次要目標，非必須）
slack_vars = {}
for emp, (white_shifts, small_night_shifts, big_night_shifts) in employees_days.items():
    # 白班需求
    slack_white = solver.NumVar(0, white_shifts, f"slack_white[{emp}]")
    solver.Add(
        sum(x[day, "白班8-16点", emp] for day in days) >= white_shifts - slack_white
    )
    # 小夜班需求
    slack_small_night = solver.NumVar(0, small_night_shifts, f"slack_small_night[{emp}]")
    solver.Add(
        sum(x[day, "小夜班16-24点", emp] for day in days) >= small_night_shifts - slack_small_night
    )
    # 大夜班需求
    slack_big_night = solver.NumVar(0, big_night_shifts, f"slack_big_night[{emp}]")
    solver.Add(
        sum(x[day, "大夜班0-8点", emp] for day in days) >= big_night_shifts - slack_big_night
    )
    slack_vars[emp] = [slack_white, slack_small_night, slack_big_night]

# 目標函數：最小化分配的班次總數並處理違規
objective = solver.Objective()
# 最小化班次
for day, schedule, emp in x:
    objective.SetCoefficient(x[day, schedule, emp], 1)
# 對 slack 權重
for emp in employees:
    for start_day in range(1, max_day - 7 + 2):
        slack_var = solver.LookupVariable(f"slack_continuous[{emp},{start_day}]")
        objective.SetCoefficient(slack_var, 10)  # 權重較低

for emp in employees:
    slack_white, slack_small_night, slack_big_night = slack_vars[emp]
    objective.SetCoefficient(slack_white, 20)  # 權重最低
    objective.SetCoefficient(slack_small_night, 20)
    objective.SetCoefficient(slack_big_night, 20)

objective.SetMinimization()

# 求解
status = solver.Solve()

if status == pywraplp.Solver.OPTIMAL:
    print("找到最佳解！")
    schedule_data = []
    for day in days:
        for schedule in schedules:
            for emp in employees:
                if x[day, schedule, emp].solution_value() > 0.5:
                    schedule_data.append([day, schedule, emp])
    schedule_df = pd.DataFrame(schedule_data, columns=["日期", "班次", "員工"])
    schedule_df.to_excel("schedule_output.xlsx", index=False)
    print("排班結果已保存至 schedule_output.xlsx")
else:
    print("找不到可行解！")
