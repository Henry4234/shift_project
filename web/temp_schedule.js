// 功能：處理暫存班表模式的顯示

class TempScheduleMode {
    constructor() {
        this.container = document.querySelector('nav.content');
        this.cycleData = null;
        this.shiftTypeMap = {
            'A': { text: 'A', class: 'morning-shift' },
            'B': { text: 'B', class: 'afternoon-shift' },
            'C': { text: 'C', 'class': 'night-shift' },
            'O': { text: 'O', class: 'day-off' }
        };
    }

    /**
     * 顯示特定週期的暫存班表
     * @param {object} cycleData - 週期資料，包含 cycle_id, start_date, end_date
     */
    async show(cycleData) {
        this.cycleData = cycleData;
        
        // 1. 渲染基本結構 (標題、副標題、表格容器)
        this.container.innerHTML = `
            <div class="temp-schedule-mode">
                <div class="temp-schedule-header">
                    <div>
                        <h2>週期 #${this.cycleData.cycle_id}</h2>
                        <p>日期區間: ${this.cycleData.start_date} ~ ${this.cycleData.end_date}</p>
                    </div>
                    <div class="header-actions">
                        <button type="button" class="btn-auto-schedule">自動排班</button>
                        <button type="button" class="btn-clear-off">清除全部畫假</button>
                    </div>
                </div>
                <div class="employees-table-outer">

                    <table class="employees-table">
                        <thead>
                            <tr>
                                <th>員工姓名</th>
                                <!-- 日期標題將會動態生成 -->
                            </tr>
                        </thead>
                        <tbody>
                            <!-- 員工列將會動態生成 -->
                            <tr>
                                <td colspan="32" style="text-align: center; padding: 20px;">
                                <div class="spinner-border text-primary"></div> 載入中...
                                </td>
                            </tr>
                        </tbody>
                    </table>

                </div>
            </div>
            <div class="temp-schedule-require"></div>
        `;

        // 2. 獲取此週期的成員
        const members = await this.fetchCycleMembers();

        // 3. 產生包含日期和成員的表格
        this.generateScheduleTable(members);

        // 4. 添加淡入動畫
        setTimeout(() => {
            const modeElement = this.container.querySelector('.temp-schedule-mode');
            if (modeElement) {
                modeElement.classList.add('fadein');
            }
        }, 50);

        // 5. 啟用水平滾動
        this.addHorizontalScroll();
    }

    /**
     * 從後端獲取週期成員（含班別資訊）
     * @returns {Promise<Array>}
     */
    async fetchCycleMembers() {
        console.log(`正在獲取週期 #${this.cycleData.cycle_id} 的成員...`);
        try {
            // 串接後端 API，取得 schedule_cycle_members
            const response = await fetch(`/api/schedule-cycle-members?cycle_id=${this.cycleData.cycle_id}`);
            if (!response.ok) {
                throw new Error('無法獲取週期成員');
            }
            /**
             * 預期回傳格式：
             * [
             *   { employee_id, snapshot_name, shift_type, required_days }, ...
             * ]
             */
            const members = await response.json();
            // 檢查資料格式
            if (!Array.isArray(members)) {
                throw new Error('回傳資料格式錯誤');
            }
            // 若無資料，顯示提示
            if (members.length === 0) {
                const tbody = this.container.querySelector('.employees-table tbody');
                if (tbody) {
                    tbody.innerHTML = `<tr><td colspan="32" style="text-align: center; padding: 20px;">此週期沒有排班成員。</td></tr>`;
                }
            }
            return members;
        } catch (error) {
            console.error(error);
            const tbody = this.container.querySelector('.employees-table tbody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="32" style="text-align: center; color: red; padding: 20px;">無法載入此週期成員。</td></tr>`;
            }
            return [];
        }
    }

    /**
     * 產生班表表格
     * @param {Array} members - 員工成員列表
     */
    generateScheduleTable(members) {
        const table = this.container.querySelector('.employees-table');
        if (!table) return;

        const thead = table.querySelector('thead tr');
        const tbody = table.querySelector('tbody');

        thead.innerHTML = '<th>員工姓名</th>';
        tbody.innerHTML = '';

        // 產生日期標題
        const startDate = new Date(this.cycleData.start_date);
        const endDate = new Date(this.cycleData.end_date);
        const dateArray = [];
        for (let dt = new Date(startDate); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
            dateArray.push(new Date(dt));
        }
        
        // 檢查是否有日期
        if (dateArray.length === 0) {
            tbody.innerHTML = '<tr><td colspan="1" style="text-align: center; padding: 20px;">無效的日期範圍。</td></tr>';
            return;
        }

        dateArray.forEach(date => {
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
            const th = document.createElement('th');
            th.innerHTML = `<span>${month}/${day}</span><span class='dayofweek'>(${dayOfWeek})</span>`;
            th.className = date.getDay() === 0 || date.getDay() === 6 ? 'weekend' : '';
            thead.appendChild(th);
        });

        // 產生員工列（原本的主表格，僅顯示姓名與日期，暫不顯示班別需求）
        const uniqueNames = [...new Set(members.map(m => m.snapshot_name))];
        if (uniqueNames.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${dateArray.length + 1}" style="text-align: center; padding: 20px;">此週期沒有排班成員。</td></tr>`;
            return;
        }
        uniqueNames.forEach(name => {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            nameCell.textContent = name;
            row.appendChild(nameCell);
            dateArray.forEach(date => {
                const cell = document.createElement('td');
                cell.className = 'shift-cell';
                // TODO: 之後需串接真實的班表資料
                cell.textContent = ''; // 暫時為空
                row.appendChild(cell);
            });
            tbody.appendChild(row);
        });

        // === 新增：員工班別需求表格 ===
        // 先移除舊的需求表格（避免重複）
        const reqContainer = this.container.querySelector('.temp-schedule-require');
        if (reqContainer) reqContainer.innerHTML = '';

        // 建立新表格
        const reqTable = document.createElement('table');
        reqTable.className = 'employee-requirements-table'; // 套用相同樣式

        // 表頭
        const reqThead = document.createElement('thead');
        reqThead.innerHTML = `
            <tr>
                <th>員工姓名</th>
                <th>白班</th>
                <th>小夜班</th>
                <th>大夜班</th>
            </tr>
        `;
        reqTable.appendChild(reqThead);

        // 表身
        const reqTbody = document.createElement('tbody');
        uniqueNames.forEach(name => {
            const a = members.find(m => m.snapshot_name === name && m.shift_type === 'A');
            const b = members.find(m => m.snapshot_name === name && m.shift_type === 'B');
            const c = members.find(m => m.snapshot_name === name && m.shift_type === 'C');
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${name}</td>
                <td>${a ? a.required_days : 0}</td>
                <td>${b ? b.required_days : 0}</td>
                <td>${c ? c.required_days : 0}</td>
            `;
            reqTbody.appendChild(row);
        });
        reqTable.appendChild(reqTbody);

        // 插入到 .temp-schedule-require div 中
        if (reqContainer) {
            reqContainer.appendChild(reqTable);
        }
    }
    
    /**
     * 啟用表格水平滾動
     */
    addHorizontalScroll() {
        const scrollContainer = this.container.querySelector('.employees-table-outer');
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
}

// 建立全域實例，方便從其他 script 檔案呼叫
if (!window.tempScheduleMode) {
    window.tempScheduleMode = new TempScheduleMode();
} 