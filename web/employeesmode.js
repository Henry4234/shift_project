// 功能：處理人員班表模式的顯示和操作

class EmployeesMode {
    constructor() {
        // 初始化變數
        this.container = null;
        this.employees = []; // 員工資料陣列
        
        // 初始化
        this.init();
    }
    
    init() {
        // 從全域變數獲取員工資料
        this.loadEmployeesData();
    }
    
    // 從全域變數載入員工資料
    loadEmployeesData() {
        // 檢查全域變數是否存在
        if (typeof window.employeesResponse !== 'undefined' && window.employeesResponse) {
            this.employees = window.employeesResponse;
            console.log('已從全域變數載入員工資料：', this.employees);
        } else {
            console.warn('全域變數 employeesResponse 不存在，使用預設資料');
            // 使用預設資料作為備用
            this.employees = [
                { id: 1, name: '張小明' },
                { id: 2, name: '李小華' },
                { id: 3, name: '王小美' },
                { id: 4, name: '陳小強' },
                { id: 5, name: '林小芳' }
            ];
        }
    }
    
    // 顯示人員班表模式
    show() {
        // 創建人員班表容器
        const contentNav = document.querySelector('nav.content');
        contentNav.innerHTML = `
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
            contentNav.classList.add('fadein');
        }, 50);
    }
    
    // 生成人員班表
    generateEmployeesTable() {
        const table = document.querySelector('.employees-table');
        if (!table) {
            console.error('找不到員工班表元素');
            return;
        }
        
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
        
        // 使用載入的員工資料生成員工行
        this.employees.forEach(employee => {
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
    
    // 更新員工資料（當全域變數更新時調用）
    updateEmployeesData() {
        this.loadEmployeesData();
        // 如果當前正在顯示人員模式，重新生成表格
        if (document.querySelector('.employeesmode')) {
            this.generateEmployeesTable();
        }
    }
}

// 創建全域實例
window.employeesMode = new EmployeesMode(); 