// 模式切換功能 JavaScript
// 作者：全端工程師
// 功能：處理月曆模式、人員模式、每日上班人員模式之間的切換

class ModeSwitcher {
    constructor() {
        // 初始化變數
        this.currentMode = 'calendar'; // 預設為月曆模式
        this.contentNav = document.querySelector('nav.content');
        this.calendarContainer = document.getElementById('calendar-container');
        
        // 模式按鈕元素
        this.modeButtons = {
            calendar: document.querySelector('.mode-calendar'),
            employees: document.querySelector('.mode-employees'),
            dailyEmployees: document.querySelector('.mode-daily-employees')
        };
        
        // 初始化
        this.init();
    }
    
    init() {
        // 綁定事件監聽器
        this.bindEvents();
        
        // 預設顯示月曆模式（不重新初始化，因為原本就有月曆）
        this.updateActiveButton('calendar');
    }
    
    bindEvents() {
        // 月曆模式按鈕點擊事件
        this.modeButtons.calendar.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToMode('calendar');
        });
        
        // 人員模式按鈕點擊事件
        this.modeButtons.employees.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToMode('employees');
        });
        
        // 每日上班人員模式按鈕點擊事件
        this.modeButtons.dailyEmployees.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToMode('dailyEmployees');
        });
    }
    
    // 切換到指定模式
    switchToMode(mode) {
        if (this.currentMode === mode) return; // 如果已經是當前模式，不執行切換
        
        // 先隱藏當前模式，並在回調中顯示新模式
        this.hideCurrentMode(() => {
            // 切換到新模式
            switch (mode) {
                case 'calendar':
                    this.showCalendarMode();
                    break;
                case 'employees':
                    this.showEmployeesMode();
                    break;
                case 'dailyEmployees':
                    this.showDailyEmployeesMode();
                    break;
            }
            
            this.currentMode = mode;
            this.updateActiveButton(mode);
        });
    }
    
    // 隱藏當前模式
    hideCurrentMode(callback) {
        // 添加淡出動畫
        this.contentNav.classList.add('fadeout');
        
        // 等待動畫完成後隱藏內容並執行回調
        setTimeout(() => {
            // 清空內容區域
            this.contentNav.innerHTML = '';
            this.contentNav.classList.remove('fadeout');
            if (callback) {
                callback();
            }
        }, 400);
    }
    
    // 顯示月曆模式
    showCalendarMode() {
        // 重新添加月曆容器（不重複載入腳本）
        this.contentNav.innerHTML = `
            <div id="calendar-container"></div>
        `;
        
        // 重新初始化月曆（如果需要的話）
        this.reinitializeCalendar();
        
        // 添加淡入動畫
        setTimeout(() => {
            this.contentNav.classList.add('fadein');
        }, 50);
    }
    
    // 顯示人員模式
    showEmployeesMode() {
        // 創建人員班表容器
        this.contentNav.innerHTML = `
            <div class="employeesmode">
                <div class="employees-table-outer">
                    <table class="employees-table">
                        <thead>
                            <tr>
                                <th>員工姓名</th>
                                <!-- 動態生成日期標題 -->
                            </tr>
                        </thead>
                        <tbody>
                            <!-- 動態生成員工行 -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        // 生成人員班表內容
        this.generateEmployeesTable();
        
        // 添加淡入動畫
        setTimeout(() => {
            this.contentNav.classList.add('fadein');
        }, 50);
    }
    
    // 顯示每日上班人員模式
    showDailyEmployeesMode() {
        // 創建每日上班人員容器
        this.contentNav.innerHTML = `
            <div class="daily-employees-mode">
                <h3>每日上班人員模式</h3>
                <p>此功能正在開發中...</p>
            </div>
        `;
        
        // 添加淡入動畫
        setTimeout(() => {
            this.contentNav.classList.add('fadein');
        }, 50);
    }
    
    // 生成人員班表
    generateEmployeesTable() {
        const table = this.contentNav.querySelector('.employees-table');
        const thead = table.querySelector('thead tr');
        const tbody = table.querySelector('tbody');
        
        // 清空現有內容
        thead.innerHTML = '<th>員工姓名</th>';
        tbody.innerHTML = '';
        
        // 獲取當前月份的天數
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // 生成日期標題
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
            const th = document.createElement('th');
            th.textContent = `${day}日(${dayOfWeek})`;
            th.className = date.getDay() === 0 || date.getDay() === 6 ? 'weekend' : '';
            thead.appendChild(th);
        }
        
        // 模擬員工數據（實際應用中應該從資料庫獲取）
        const employees = [
            { id: 1, name: '張小明' },
            { id: 2, name: '李小華' },
            { id: 3, name: '王小美' },
            { id: 4, name: '陳小強' },
            { id: 5, name: '林小芳' }
        ];
        
        // 生成員工行
        employees.forEach(employee => {
            const row = document.createElement('tr');
            
            // 員工姓名欄
            const nameCell = document.createElement('td');
            nameCell.textContent = employee.name;
            row.appendChild(nameCell);
            
            // 生成每天的班表欄位
            for (let day = 1; day <= daysInMonth; day++) {
                const cell = document.createElement('td');
                cell.className = 'shift-cell';
                cell.setAttribute('data-employee', employee.id);
                cell.setAttribute('data-date', `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
                
                // 隨機生成班表（實際應用中應該從資料庫獲取）
                const shifts = ['早班', '中班', '晚班', '休假', ''];
                const randomShift = shifts[Math.floor(Math.random() * shifts.length)];
                cell.textContent = randomShift;
                
                // 根據班別設定樣式
                if (randomShift === '早班') cell.classList.add('morning-shift');
                else if (randomShift === '中班') cell.classList.add('afternoon-shift');
                else if (randomShift === '晚班') cell.classList.add('night-shift');
                else if (randomShift === '休假') cell.classList.add('day-off');
                
                // 添加點擊事件（可編輯班表）
                cell.addEventListener('click', () => this.editShift(cell));
                
                row.appendChild(cell);
            }
            
            tbody.appendChild(row);
        });
    }
    
    // 編輯班表
    editShift(cell) {
        const shifts = ['早班', '中班', '晚班', '休假', ''];
        const currentShift = cell.textContent;
        const currentIndex = shifts.indexOf(currentShift);
        const nextIndex = (currentIndex + 1) % shifts.length;
        const nextShift = shifts[nextIndex];
        
        // 移除舊的樣式類別
        cell.classList.remove('morning-shift', 'afternoon-shift', 'night-shift', 'day-off');
        
        // 設定新的班別和樣式
        cell.textContent = nextShift;
        if (nextShift === '早班') cell.classList.add('morning-shift');
        else if (nextShift === '中班') cell.classList.add('afternoon-shift');
        else if (nextShift === '晚班') cell.classList.add('night-shift');
        else if (nextShift === '休假') cell.classList.add('day-off');
        
        // 這裡可以添加保存到資料庫的邏輯
        console.log(`員工 ${cell.getAttribute('data-employee')} 在 ${cell.getAttribute('data-date')} 的班別改為: ${nextShift}`);
    }
    
    // 重新初始化月曆（如果需要）
    reinitializeCalendar() {
        // 檢查是否有月曆初始化函數
        if (typeof window.initCalendar === 'function') {
            window.initCalendar();
        } else {
            // 如果沒有初始化函數，輸出錯誤
            console.error('未找到日曆初始化函數 (initCalendar)');
        }
    }
    
    // 更新活動按鈕狀態
    updateActiveButton(activeMode) {
        // 移除所有按鈕的活動狀態
        Object.values(this.modeButtons).forEach(button => {
            button.classList.remove('active');
        });
        
        // 添加當前活動按鈕的狀態
        if (this.modeButtons[activeMode]) {
            this.modeButtons[activeMode].classList.add('active');
        }
    }
}

// 當 DOM 載入完成後初始化模式切換器
document.addEventListener('DOMContentLoaded', () => {
    new ModeSwitcher();
}); 