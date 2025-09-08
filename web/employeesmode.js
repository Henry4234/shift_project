// 功能：處理人員班表模式的顯示和操作

class EmployeesMode {
    constructor() {
        // 初始化變數
        this.container = null;
        this.employees = []; // 員工資料陣列
        this.shiftTypeMap = {
            'A': { text: 'A', class: 'morning-shift' },
            'B': { text: 'B', class: 'afternoon-shift' },
            'C': { text: 'C', 'class': 'night-shift' },
            'O': { text: 'O', class: 'day-off' }
        };
        
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
            <div class="employee-controls">
                    <div class="date-selector-title">
                        <h3>請選擇觀看的年份/月份:</h3>
                    </div>       
                 <div class="date-selector">
                    <div class="select-container">
                      <span>年份選擇:</span>
                      <div class="select-wrapper">
                        <select id="year-select" class="form-control"></select>
                        <i class='bx bx-expand-vertical' ></i>
                      </div>
                    </div>
                    <div class="select-container">
                      <span>月份選擇:</span>
                      <div class="select-wrapper">
                        <select id="month-select" class="form-control"></select>
                        <i class='bx bx-expand-vertical' ></i>
                      </div>
                    </div>
                </div>
                <button id="search-schedule-btn" class="btn btn-primary"><i class='bx bx-search'></i> 搜尋</button>
            </div>
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
        
        // 填充日期選擇器
        this.populateDateSelectors();

        // 首次載入時獲取當前月份的班表
        this.fetchAndRenderSchedules();
        
        // 添加淡入動畫
        setTimeout(() => {
            contentNav.classList.add('fadein');
        }, 50);

        // 啟用滑鼠滾輪水平滾動
        this.addHorizontalScroll();
    }
    
    // 生成人員班表
    generateEmployeesTable(schedules = []) {
        const table = document.querySelector('.employees-table');
        if (!table) {
            console.error('找不到員工班表元素');
            return;
        }
        
        const thead = table.querySelector('thead tr');
        const tbody = table.querySelector('tbody');
        
        // 將班表資料轉換為 Map 以便快速查找
        const scheduleMap = new Map();
        schedules.forEach(s => {
            const workDate = s.work_date.split('T')[0]; // 確保只取 yyyy-mm-dd
            scheduleMap.set(`${s.employee_id}-${workDate}`, {
                shift_type: s.shift_type,
                shift_subtype: s.shift_subtype || '' // 新增 shift_subtype 欄位
            });
        });

        // 清空現有內容
        thead.innerHTML = '<th rowspan="2">員工姓名</th>'; // 員工姓名欄位跨越兩列
        tbody.innerHTML = '';
        
        // 獲取當前月份的天數
        const yearSelect = document.getElementById('year-select');
        const monthSelect = document.getElementById('month-select');

        // 如果選擇器不存在，則不執行
        if (!yearSelect || !monthSelect) {
            return;
        }

        const year = yearSelect.value;
        const month = monthSelect.value; // 0-11
        const daysInMonth = new Date(year, parseInt(month) + 1, 0).getDate();
        
        // 生成日期標題 - 第一列：日期
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
            const th = document.createElement('th');
            th.innerHTML = `${parseInt(month, 10) + 1}/${day}<br>(${dayOfWeek})`;
            th.className = date.getDay() === 0 || date.getDay() === 6 ? 'weekend' : '';
            thead.appendChild(th);
        }
        
        // 使用載入的員工資料生成員工行
        this.employees.forEach(employee => {
            // 為每個員工創建兩列：第一列顯示 shift_type，第二列顯示 shift_subtype
            const mainRow = document.createElement('tr');
            const subRow = document.createElement('tr');
            subRow.className = 'shift-subtype-row';
            
            // 員工姓名欄 - 跨越兩列
            const nameCell = document.createElement('td');
            nameCell.textContent = employee.name;
            nameCell.rowSpan = 2; // 跨越兩列
            nameCell.className = 'employee-name-cell';
            mainRow.appendChild(nameCell);
            
            // 生成每天的班表欄位
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const scheduleData = scheduleMap.get(`${employee.id}-${dateStr}`);
                
                // 檢查是否為週末
                const date = new Date(year, month, day);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isMonday = date.getDay() === 1;
                // 第一列：shift_type 儲存格
                const mainCell = document.createElement('td');
                mainCell.className = 'shift-cell shift-main-cell';
                mainCell.setAttribute('data-employee', employee.id);
                mainCell.setAttribute('data-date', dateStr);
                
                if (scheduleData && scheduleData.shift_type) {
                    const shiftInfo = this.shiftTypeMap[scheduleData.shift_type];
                    if (shiftInfo) {
                        mainCell.textContent = shiftInfo.text;
                        mainCell.classList.add(shiftInfo.class);
                    }
                }
                
                // 如果是週末，加上 weekend 樣式
                if (isWeekend) {
                    mainCell.classList.add('weekend');
                }
                else if (isMonday) {
                    mainCell.classList.add('monday');
                }
                
                // 檢查特殊條件：禮拜一且 shift_type 為 A 且 shift_subtype 為 5
                if (isMonday && scheduleData && scheduleData.shift_type === 'A' && scheduleData.shift_subtype === '5') {
                    mainCell.classList.add('monday-special-condition');
                }
                mainRow.appendChild(mainCell);
                
                // 第二列：shift_subtype 儲存格
                const subCell = document.createElement('td');
                subCell.className = 'shift-cell shift-sub-cell';
                subCell.setAttribute('data-employee', employee.id);
                subCell.setAttribute('data-date', dateStr);
                
                if (scheduleData && scheduleData.shift_subtype) {
                    subCell.textContent = scheduleData.shift_subtype;
                    // 繼承上方儲存格的樣式類別
                    const shiftInfo = this.shiftTypeMap[scheduleData.shift_type];
                    if (shiftInfo) {
                        subCell.classList.add(shiftInfo.class);
                    }
                }
                
                // 如果是週末，加上 weekend 樣式
                if (isWeekend) {
                    subCell.classList.add('weekend');
                }
                else if (isMonday) {
                    subCell.classList.add('monday');
                }
                
                // 檢查特殊條件：禮拜一且 shift_type 為 A 且 shift_subtype 為 5
                if (isMonday && scheduleData && scheduleData.shift_type === 'A' && scheduleData.shift_subtype === '5') {
                    subCell.classList.add('monday-special-condition');
                }
                subRow.appendChild(subCell);
            }
            
            tbody.appendChild(mainRow);
            tbody.appendChild(subRow);
        });
    }
    
    // 新增：獲取並渲染班表資料
    async fetchAndRenderSchedules() {
        const yearSelect = document.getElementById('year-select');
        const monthSelect = document.getElementById('month-select');
        if (!yearSelect || !monthSelect) return;

        const year = yearSelect.value;
        const month = parseInt(monthSelect.value) + 1; // API 預期 1-12

        console.log(`正在獲取 ${year} 年 ${month} 月的班表...`);
        try {
            const response = await fetch(`/api/employee-schedules?year=${year}&month=${month}`);
            // const response = await fetch(`./simulate_schedules.json`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP 錯誤! 狀態: ${response.status}`);
            }
            const schedules = await response.json();
            console.log('成功獲取班表資料:', schedules);
            this.generateEmployeesTable(schedules);
        } catch (error) {
            console.error('獲取班表資料時發生錯誤:', error);
            const tbody = document.querySelector('.employees-table tbody');
            if(tbody) {
                const year = yearSelect.value;
                const month = monthSelect.value;
                const daysInMonth = new Date(year, parseInt(month) + 1, 0).getDate();
                tbody.innerHTML = `<tr><td colspan="${daysInMonth + 1}" style="text-align:center; color: red; padding: 20px;">無法載入班表資料。</td></tr>`;
            }
        }
    }
    
    // 新增：啟用滑鼠滾輪水平滾動
    addHorizontalScroll() {
        const scrollContainer = document.querySelector('.employees-table-outer');
        if (scrollContainer) {
            scrollContainer.addEventListener('wheel', (evt) => {
                // 如果是垂直滾動，則阻止預設行為並轉換為水平滾動
                if (Math.abs(evt.deltaY) > Math.abs(evt.deltaX)) {
                    evt.preventDefault();
                    scrollContainer.scrollLeft += evt.deltaY;
                }
            }, { passive: false });
        }
    }

    // 填充年月選擇器
    populateDateSelectors() {
        const yearSelect = document.getElementById('year-select');
        const monthSelect = document.getElementById('month-select');
        const searchBtn = document.getElementById('search-schedule-btn');

        if (!yearSelect || !monthSelect || !searchBtn) return;

        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth(); // 0-11

        // 填充年份
        for (let i = currentYear - 2; i <= currentYear + 2; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}年`;
            if (i === currentYear) option.selected = true;
            yearSelect.appendChild(option);
        }

        // 填充月份
        for (let i = 0; i < 12; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i + 1}月`;
            if (i === currentMonth) option.selected = true;
            monthSelect.appendChild(option);
        }
        
        // 搜尋按鈕事件
        searchBtn.addEventListener('click', () => this.fetchAndRenderSchedules());
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