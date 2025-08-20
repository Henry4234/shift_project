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
        
        // 休假狀態定義：依序切換的休假類型
        this.leaveStates = [
            { text: '', class: '', weight: 0 }, // 空狀態
            { text: 'O', class: 'leave-high', weight: 2 }, // 紅色底、紅色字體 - 權重較大的休假
            { text: 'O', class: 'leave-low', weight: 1 }, // 藍色底、藍色字體 - 權重較小的休假
            { text: '特', class: 'leave-special', weight: 3 } // 紫色底、紫色字體 - 特休（最大權重）
        ];
        
        // 班別狀態定義：自動排班後的班別選擇
        this.shiftStates = [
            { text: '', class: '', weight: 0 }, // 空狀態
            { text: 'A', class: 'morning-shift', weight: 1 }, // 早班
            { text: 'B', class: 'afternoon-shift', weight: 2 }, // 中班
            { text: 'C', class: 'night-shift', weight: 3 }, // 晚班
            { text: 'O', class: 'leave-high', weight: 4 }, // 紅色底休假
            { text: 'O', class: 'leave-low', weight: 5 }, // 藍色底休假
            { text: '特', class: 'leave-special', weight: 6 }, // 特休
            { text: 'O', class: 'day-off', weight: 7 }, //自動排班的O
        ];
        
        // 儲存每個員工每天的休假狀態
        this.leaveData = new Map(); // 格式: Map<"employeeName_date", {state: number, weight: number}>
        
        // 標記是否已經執行過自動排班
        this.hasAutoScheduled = false;
        
        // === 新增：員工班別需求管理 ===
        // 儲存原始需求資料（用於比較是否有變更）
        this.originalRequirements = new Map(); // 格式: Map<"employeeName_shiftType", number>
        // 儲存當前需求資料
        this.currentRequirements = new Map(); // 格式: Map<"employeeName_shiftType", number>
        // 標記是否有需求變更
        this.hasRequirementsChanged = false;
        // 當前選中的需求儲存格
        this.selectedRequirementCell = null;
        
        // === 新增：工作內容安排模式 ===
        this.shiftGroupData = null; // 儲存班別群組資料
        this.isSubtypeMode = false; // 標記是否處於工作內容安排模式
        
        // === 新增：時間軸流程狀態管理 ===
        this.timelineSteps = [
            { id: 'create-cycle', name: '建立週期', status: 'completed' },
            { id: 'set-leaves', name: '預/畫假', status: 'current' },
            { id: 'auto-schedule', name: '自動排班', status: 'pending' },
            { id: 'verify-schedule', name: '驗證排班', status: 'pending' },
            { id: 'add-subtype', name: '安排工作內容', status: 'pending' },
            { id: 'complete', name: '完成', status: 'pending' }
        ];
    }

    /**
     * 顯示特定週期的暫存班表
     * @param {object} cycleData - 週期資料，包含 cycle_id, start_date, end_date, shift_group
     */
    async show(cycleData) {
        this.cycleData = cycleData;
        // 1. 渲染基本結構 (標題、副標題、表格容器)
        this.container.innerHTML = `
            <div class="temp-schedule-timeline">
                ${this.renderTimeline()}
            </div>
            <div class="temp-schedule-mode">
                <div class="temp-schedule-header">
                    <div>
                        <h2>週期 #${this.cycleData.cycle_id}</h2>
                        <p>日期區間: ${this.cycleData.start_date} ~ ${this.cycleData.end_date}</p>
                        <p>班別群組: ${this.cycleData.shift_group}</p>
                    </div>
                    <div class="header-actions">
                        <button type="button" class="btn-save-leaves">儲存休假資料</button>    
                        <button type="button" class="btn-auto-schedule">自動排班</button>
                        <button type="button" class="btn-clear-off">清除全部畫假</button>
                    </div>
                </div>
                <div class="employees-table-outer">

                    <table class="employees-table">
                        <thead>
                            <tr>
                                <th class="sticky-col">員工姓名</th>
                                <!-- 日期標題將會動態生成 -->
                            </tr>
                        </thead>
                        <tbody>
                            <!-- 員工列將會動態生成 -->
                            <tr class="loading-row">
                                <td colspan="32" style="text-align: center; padding: 20px;">
                                <div class="spinner-border text-primary"></div> 載入中...
                                </td>
                            </tr>
                        </tbody>
                    </table>

                </div>
            </div>
            <div class="verify-schedule">
                <div class="verify-schedule-header">
                    <h3>驗證排班</h3>
                    <div class="verify-action">
                        <button type="button" class="verify-shift-btn" onclick="">驗證班表</button>
                        <button type="button" class="shift-subtype-btn" onclick="">工作內容安排</button>
                    </div>
                </div>
                <div class="verify-schedule-content">
                    <div class="verify-schedule-row">
                        <div class="verify-schedule-cell">
                            <div class="verify-checkbox-group">
                                <div class="verify-checkbox-item">
                                    <input type="checkbox" id="verify-daily-count" class="verify-checkbox" disabled>
                                    <label for="verify-daily-count">每日上班人數</label>
                                </div>
                                <div class="verify-checkbox-item">
                                    <input type="checkbox" id="verify-consecutive-days" class="verify-checkbox" disabled>
                                    <label for="verify-consecutive-days">連續上班天數</label>
                                </div>
                                <div class="verify-checkbox-item">
                                    <input type="checkbox" id="verify-shift-connection" class="verify-checkbox" disabled>
                                    <label for="verify-shift-connection">班別銜接</label>
                                </div>
                            </div>
                        </div>
                        <div class="verify-schedule-cell">
                            <textarea id="verifycomment" placeholder="點擊右上角驗證按鈕開始驗證...&#10;自動驗證是否符合以下情況&#10;1. 每日上班人數&#10;2. 連續上班天數&#10;3. 班別銜接"></textarea>
                        </div>
                    </div>
                </div>

                
            </div>

            <div class="temp-schedule-bottom">
                <div class="temp-schedule-require">
                    <div class="schedule-require-header">    
                        <h3>員工班別</h3>
                        <button type="button" class="update-require-btn" onclick="">上班天數更新</button>
                    </div>
                        <div class="temp-schedule-require-table"></div>
                </div>
                <div class="temp-schedule-comment">
                    <h3>備註</h3>
                    <textarea id="scheduleComment" placeholder="請輸入備註內容..."></textarea>
                    <button type="button" class="save-comment-btn" onclick="tempScheduleMode.saveComment()">儲存備註</button>
                </div>
            </div>
        `;
        
        // 1.5 載入備註
        await this.loadComment();
        // 2. 先獲取此週期的成員
        const members = await this.fetchCycleMembers();
        // 3. 產生包含日期和成員的表格
        this.generateScheduleTable(members);
        // 4. 載入已儲存的休假資料（合併原 fetchCycleLeaveStatus）
        await this.loadSavedLeaveData();
        // 5. 載入完畢後移除 loading 畫面
        this.hideLoading();
        // 6. 添加淡入動畫
        setTimeout(() => {
            const modeElement = this.container.querySelector('.temp-schedule-mode');
            if (modeElement) {
                modeElement.classList.add('fadein');
            }
        }, 50);
        // 7. 啟用水平滾動
        this.addHorizontalScroll();
        // 8. 添加點擊事件監聽器
        this.addClickEventListeners();
        // 9. 添加按鈕事件監聽器
        this.addButtonEventListeners();
        
        // 10. 初始化驗證 checkbox 狀態
        this.disableVerificationCheckboxes();
        
        // 11. 初始化時間軸狀態
        this.initializeTimeline();
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

        thead.innerHTML = '<th class="sticky-col">員工姓名</th>';
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
            nameCell.classList.add('sticky-col'); // sticky for each row
            row.appendChild(nameCell);
            dateArray.forEach((date, dateIndex) => {
                const cell = document.createElement('td');
                cell.className = 'shift-cell';
                // 如果是週末，加上 weekend 樣式
                if (date.getDay() === 0 || date.getDay() === 6) {
                    cell.classList.add('weekend');
                }
                cell.textContent = ''; // 暫時為空
                
                // 添加資料屬性，方便後續識別
                const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD 格式
                cell.dataset.employeeName = name;
                cell.dataset.date = dateStr;
                cell.dataset.dateIndex = dateIndex;
                
                row.appendChild(cell);
            });
            tbody.appendChild(row);
        });

        // === 新增：員工班別需求表格 ===
        // 先移除舊的需求表格（避免重複）
        const reqContainer = this.container.querySelector('.temp-schedule-require-table');
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
                <th>實際白班</th>
                <th>小夜班</th>
                <th>實際小夜</th>
                <th>大夜班</th>
                <th>實際大夜</th>
            </tr>
        `;
        reqTable.appendChild(reqThead);

        // 表身
        const reqTbody = document.createElement('tbody');
        uniqueNames.forEach(name => {
            const a = members.find(m => m.snapshot_name === name && m.shift_type === 'A');
            const b = members.find(m => m.snapshot_name === name && m.shift_type === 'B');
            const c = members.find(m => m.snapshot_name === name && m.shift_type === 'C');
            
            // 儲存原始需求資料
            const aValue = a ? a.required_days : 0;
            const bValue = b ? b.required_days : 0;
            const cValue = c ? c.required_days : 0;
            
            this.originalRequirements.set(`${name}_A`, aValue);
            this.originalRequirements.set(`${name}_B`, bValue);
            this.originalRequirements.set(`${name}_C`, cValue);
            
            this.currentRequirements.set(`${name}_A`, aValue);
            this.currentRequirements.set(`${name}_B`, bValue);
            this.currentRequirements.set(`${name}_C`, cValue);
            
            // 計算實際班別統計（初始為0，後續會更新）
            const actualA = 0;
            const actualB = 0;
            const actualC = 0;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${name}</td>
                <td class="requirement-cell" data-employee="${name}" data-shift="A">
                    <div class="requirement-content">
                        <span class="requirement-value">${aValue}</span>
                    </div>
                </td>
                <td class="actual-shift-cell" data-employee="${name}" data-shift="A">
                    <div class="actual-shift-content">
                        <span class="actual-shift-value">${actualA}</span>
                    </div>
                </td>
                <td class="requirement-cell" data-employee="${name}" data-shift="B">
                    <div class="requirement-content">
                        <span class="requirement-value">${bValue}</span>
                    </div>
                </td>
                <td class="actual-shift-cell" data-employee="${name}" data-shift="B">
                    <div class="actual-shift-content">
                        <span class="actual-shift-value">${actualB}</span>
                    </div>
                </td>
                <td class="requirement-cell" data-employee="${name}" data-shift="C">
                    <div class="requirement-content">
                        <span class="requirement-value">${cValue}</span>
                    </div>
                </td>
                <td class="actual-shift-cell" data-employee="${name}" data-shift="C">
                    <div class="actual-shift-content">
                        <span class="actual-shift-value">${actualC}</span>
                    </div>
                </td>
            `;
            reqTbody.appendChild(row);
        });
        reqTable.appendChild(reqTbody);

        // 插入到 .temp-schedule-require-table div 中
        if (reqContainer) {
            reqContainer.appendChild(reqTable);
        }
        
        // 添加需求表格的點擊事件監聽器
        this.addRequirementTableEventListeners();
        
        // 更新實際班別統計
        this.updateActualShiftCounts();
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

    /**
     * 添加點擊事件監聽器到所有 shift-cell
     */
    addClickEventListeners() {
        const shiftCells = this.container.querySelectorAll('.shift-cell');
        shiftCells.forEach(cell => {
            cell.addEventListener('click', (event) => {
                this.handleShiftCellClick(event);
            });
        });
    }

    /**
     * 添加按鈕事件監聽器
     */
    addButtonEventListeners() {
        // 清除全部畫假按鈕
        const clearOffBtn = this.container.querySelector('.btn-clear-off');
        if (clearOffBtn) {
            clearOffBtn.addEventListener('click', () => {
                this.showClearConfirmation();
            });
        }

        // 自動排班按鈕
        const autoScheduleBtn = this.container.querySelector('.btn-auto-schedule');
        if (autoScheduleBtn) {
            autoScheduleBtn.addEventListener('click', async () => {
                await this.runAutoScheduling();
            });
        }

        // 儲存休假資料按鈕
        const saveLeavesBtn = this.container.querySelector('.btn-save-leaves');
        if (saveLeavesBtn) {
            saveLeavesBtn.addEventListener('click', async () => {
                const result = await this.saveLeaveData();
                console.log('儲存休假資料結果:', result);
            });
        }

        // === 新增：上班天數更新按鈕 ===
        const updateRequireBtn = this.container.querySelector('.update-require-btn');
        if (updateRequireBtn) {
            // 初始狀態設為 disabled
            updateRequireBtn.disabled = true;
            updateRequireBtn.addEventListener('click', async () => {
                await this.saveRequirementsChanges();
            });
        }

        // === 新增：驗證班表按鈕 ===
        const verifyShiftBtn = this.container.querySelector('.verify-shift-btn');
        if (verifyShiftBtn) {
            verifyShiftBtn.addEventListener('click', async () => {
                await this.runScheduleVerification();
            });
        }

        // === 新增：工作內容安排按鈕 ===
        const shiftSubtypeBtn = this.container.querySelector('.shift-subtype-btn');
        if (shiftSubtypeBtn) {
            shiftSubtypeBtn.addEventListener('click', async () => {
                await this.toggleSubtypeMode();
            });
        }
    }

    /**
     * 處理 shift-cell 的點擊事件
     * @param {Event} event - 點擊事件物件
     */
    handleShiftCellClick(event) {
        const cell = event.target;
        const employeeName = cell.dataset.employeeName;
        const date = cell.dataset.date;
        const key = `${employeeName}_${date}`;
        
        // 根據是否執行過自動排班來決定使用哪種狀態切換邏輯
        if (this.hasAutoScheduled) {
            // 自動排班後：支援 A,B,C 班別選擇
            this.handleShiftCellClickAfterAutoSchedule(cell, key);
        } else {
            // 自動排班前：只支援休假選擇
            this.handleShiftCellClickBeforeAutoSchedule(cell, key);
        }
    }

    /**
     * 自動排班前的點擊處理（只支援休假選擇）
     * @param {HTMLElement} cell - 儲存格元素
     * @param {string} key - 員工日期鍵值
     */
    handleShiftCellClickBeforeAutoSchedule(cell, key) {
        const employeeName = cell.dataset.employeeName;
        const date = cell.dataset.date;
        
        // 獲取當前狀態
        const currentState = this.leaveData.get(key) || { state: 0, weight: 0 };
        
        // 計算下一個狀態（循環切換）
        const nextStateIndex = (currentState.state + 1) % this.leaveStates.length;
        const nextState = this.leaveStates[nextStateIndex];
        
        // 更新儲存的狀態
        this.leaveData.set(key, {
            state: nextStateIndex,
            weight: nextState.weight
        });
        
        // 更新視覺顯示
        this.updateCellDisplay(cell, nextState);
        
        // 更新實際班別統計
        this.updateActualShiftCounts();
        
        console.log(`員工 ${employeeName} 在 ${date} 的休假狀態已更新為: ${nextState.text} (權重: ${nextState.weight})`);
    }

    /**
     * 自動排班後的點擊處理（支援 A,B,C 班別選擇）
     * @param {HTMLElement} cell - 儲存格元素
     * @param {string} key - 員工日期鍵值
     */
    handleShiftCellClickAfterAutoSchedule(cell, key) {
        const employeeName = cell.dataset.employeeName;
        const date = cell.dataset.date;
        
        // 獲取當前狀態
        const currentState = this.leaveData.get(key) || { state: 0, weight: 0 };
        
        // 計算下一個狀態（循環切換）
        const nextStateIndex = (currentState.state + 1) % this.shiftStates.length;
        const nextState = this.shiftStates[nextStateIndex];
        
        // 更新儲存的狀態
        this.leaveData.set(key, {
            state: nextStateIndex,
            weight: nextState.weight
        });
        
        // 更新視覺顯示
        this.updateCellDisplay(cell, nextState);
        
        // 更新實際班別統計
        this.updateActualShiftCounts();
        
        console.log(`員工 ${employeeName} 在 ${date} 的班別狀態已更新為: ${nextState.text} (權重: ${nextState.weight})`);
    }

    /**
     * 更新儲存格的視覺顯示
     * @param {HTMLElement} cell - 要更新的儲存格
     * @param {Object} state - 狀態物件
     */
    updateCellDisplay(cell, state) {
        // 清除所有可能的樣式類別
        cell.classList.remove('leave-high', 'leave-low', 'leave-special','day-off', 'morning-shift', 'afternoon-shift', 'night-shift');
        
        // 設置文字內容
        cell.textContent = state.text;
        
        // 添加對應的樣式類別
        if (state.class) {
            cell.classList.add(state.class);
        }
        
        // 如果沒有狀態，清除所有樣式
        if (!state.text) {
            if (cell.classList.contains('weekend')) {
                cell.className = 'shift-cell weekend';
            } else {
                cell.className = 'shift-cell';
            }
        }
    }

    /**
     * 載入 cycle_comment
     */
    async loadComment() {
        const cycleId = this.cycleData.cycle_id;
        const commentTextarea = document.getElementById('scheduleComment');
        if (!commentTextarea) return;
        try {
            const response = await fetch(`/api/schedule-cycles-comment?cycle_id=${cycleId}`);
            if (!response.ok) throw new Error('無法取得備註');
            const data = await response.json();
            if (data.cycle_comment) {
                commentTextarea.value = data.cycle_comment;
            } else {
                commentTextarea.value = '';
                commentTextarea.placeholder = "請輸入備註內容...";
            }
        } catch (err) {
            commentTextarea.value = '';
            commentTextarea.placeholder = "請輸入備註內容...";
        }
    }

    /**
     * 儲存備註內容
     */
    async saveComment() {
        const commentTextarea = document.getElementById('scheduleComment');
        if (!commentTextarea) {
            console.error('找不到備註文字區域');
            return;
        }
        const comment = commentTextarea.value.trim();
        const cycleId = this.cycleData.cycle_id;
        // Toast loading
        const toastContainer = document.querySelector('.toast-container');
        let loadingToast = document.createElement('div');
        loadingToast.className = 'toast';
        loadingToast.innerHTML = `
            <div class="toast-header">
                <strong class="me-auto">系統訊息</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">正在儲存備註...</div>
        `;
        toastContainer.appendChild(loadingToast);
        let bsLoadingToast = new bootstrap.Toast(loadingToast);
        bsLoadingToast.show();
        try {
            const response = await fetch('/api/schedule-cycles-comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cycle_id: cycleId, cycle_comment: comment })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '儲存備註失敗');
            }
            // 移除 loading toast
            bsLoadingToast.hide();
            loadingToast.remove();
            // 成功 toast
            let resultToast = document.createElement('div');
            resultToast.className = 'toast';
            resultToast.innerHTML = `
                <div class="toast-header">
                    <strong class="me-auto">系統訊息</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">備註已儲存！</div>
            `;
            toastContainer.appendChild(resultToast);
            let bsResultToast = new bootstrap.Toast(resultToast);
            bsResultToast.show();
            setTimeout(() => { resultToast.remove(); }, 3000);
        } catch (error) {
            bsLoadingToast.hide();
            loadingToast.remove();
            let errorToast = document.createElement('div');
            errorToast.className = 'toast';
            errorToast.innerHTML = `
                <div class="toast-header">
                    <strong class="me-auto">錯誤訊息</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">儲存失敗：${error.message}</div>
            `;
            toastContainer.appendChild(errorToast);
            let bsErrorToast = new bootstrap.Toast(errorToast);
            bsErrorToast.show();
            setTimeout(() => { errorToast.remove(); }, 3000);
        }
    }

    /**
     * 儲存休假資料到後端 API
     * @returns {Promise<Object>} API 回應結果
     */
    async saveLeaveData() {
        const cycleId = this.cycleData.cycle_id;
        
        // 將 Map 轉換為陣列格式，方便傳送
        const leaveDataArray = [];
        this.leaveData.forEach((value, key) => {
            const [employeeName, date] = key.split('_');
            leaveDataArray.push({
                cycle_id: cycleId,
                employee_name: employeeName,
                date: date,
                leave_state: value.state,
                leave_weight: value.weight
            });
        });

        console.log(`正在儲存週期 #${cycleId} 的休假資料...`, leaveDataArray);

        // ===== 新增 toast loading =====
        const toastContainer = document.querySelector('.toast-container');
        let loadingToast = document.createElement('div');
        loadingToast.className = 'toast';
        loadingToast.innerHTML = `
            <div class="toast-header">
                <strong class="me-auto">系統訊息</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">正在儲存休假資料...</div>
        `;
        toastContainer.appendChild(loadingToast);
        let bsLoadingToast = new bootstrap.Toast(loadingToast);
        bsLoadingToast.show();

        try {
            // 串接後端 API 儲存休假資料
            const response = await fetch('/api/schedule-cycle-leaves', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cycle_id: cycleId,
                    leave_data: leaveDataArray
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '儲存休假資料失敗');
            }
            
            const result = await response.json();
            console.log('休假資料儲存成功:', result);
            
            // 移除 loading toast
            bsLoadingToast.hide();
            loadingToast.remove();

            // 顯示成功訊息 toast
            let resultToast = document.createElement('div');
            resultToast.className = 'toast';
            resultToast.innerHTML = `
                <div class="toast-header">
                    <strong class="me-auto">系統訊息</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">儲存成功！共儲存 ${result.count} 筆資料。</div>
            `;
            toastContainer.appendChild(resultToast);
            let bsResultToast = new bootstrap.Toast(resultToast);
            bsResultToast.show();
            // 3秒後移除 toast
            setTimeout(() => {
                resultToast.remove();
            }, 3000);
            
            // 更新時間軸狀態 - 休假資料已儲存
            this.updateTimelineStep('set-leaves', 'completed');
            
            return result;
            
        } catch (error) {
            // 移除 loading toast
            bsLoadingToast.hide();
            loadingToast.remove();
            // 顯示錯誤訊息 toast
            let errorToast = document.createElement('div');
            errorToast.className = 'toast';
            errorToast.innerHTML = `
                <div class="toast-header">
                    <strong class="me-auto">錯誤訊息</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">儲存失敗：${error.message}</div>
            `;
            toastContainer.appendChild(errorToast);
            let bsErrorToast = new bootstrap.Toast(errorToast);
            bsErrorToast.show();
            // 3秒後移除 toast
            setTimeout(() => {
                errorToast.remove();
            }, 3000);   
            return { success: false, message: error.message };
        }
    }

    /**
     * 載入已儲存的休假資料
     */
    async loadSavedLeaveData() {
        const cycleId = this.cycleData.cycle_id;
        
        try {
            console.log(`正在載入週期 #${cycleId} 的已儲存休假資料...`);
            
            const response = await fetch(`/api/schedule-cycle-leaves?cycle_id=${cycleId}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                console.warn('載入休假資料失敗:', errorData.error);
                return;
            }
            
            const leavesData = await response.json();
            console.log('載入到的休假資料:', leavesData);
            
            // 將休假資料轉換為內部格式並更新顯示
            leavesData.forEach(leaveItem => {
                const employeeName = leaveItem.employee_name;
                const date = leaveItem.date;
                const offtype = leaveItem.offtype;
                
                // 根據 offtype 決定 state
                let state = 0;
                if (offtype === '紅O') {
                    state = 1;
                } else if (offtype === '藍O') {
                    state = 2;
                } else if (offtype === '特休') {
                    state = 3;
                }
                
                if (state > 0) {
                    const key = `${employeeName}_${date}`;
                    const weight = this.leaveStates[state].weight;
                    
                    // 更新內部資料
                    this.leaveData.set(key, {
                        state: state,
                        weight: weight
                    });
                    
                    // 更新視覺顯示
                    const cell = this.container.querySelector(`[data-employee-name="${employeeName}"][data-date="${date}"]`);
                    if (cell) {
                        this.updateCellDisplay(cell, this.leaveStates[state]);
                    }
                }
            });
            
            console.log(`成功載入 ${leavesData.length} 筆休假資料`);
            
            // 更新實際班別統計
            this.updateActualShiftCounts();
            
        } catch (error) {
            console.error('載入休假資料時發生錯誤:', error);
        }
    }

    /**
     * 顯示清除確認彈出視窗
     */
    showClearConfirmation() {
        const cycleId = this.cycleData.cycle_id;
        const confirmed = confirm(`確定要清除週期 #${cycleId} 的所有休假資料嗎？\n\n此操作將永久刪除資料庫中的所有休假記錄，且無法復原。`);
        
        if (confirmed) {
            this.clearAllLeavesFromDatabase();
        }
    }

    /**
     * 從資料庫清除所有休假資料
     */
    async clearAllLeavesFromDatabase() {
        const cycleId = this.cycleData.cycle_id;
        
        try {
            console.log(`正在清除週期 #${cycleId} 的所有休假資料...`);
            
            const response = await fetch('/api/schedule-cycle-leaves', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cycle_id: cycleId
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '清除休假資料失敗');
            }
            
            const result = await response.json();
            console.log('清除休假資料成功:', result);
            
            // 清除前端顯示
            this.clearAllLeaves();
            
            // 更新時間軸狀態 - 清除休假後回到預/畫假階段
            this.updateTimelineStep('set-leaves', 'current');
            this.updateTimelineStep('auto-schedule', 'pending');
            this.updateTimelineStep('verify-schedule', 'pending');
            this.updateTimelineStep('complete', 'pending');
            
            // 顯示成功訊息
            if (result.status === 'success') {
                alert(`成功清除 ${result.count} 筆休假資料！`);
            } else {
                alert('清除休假資料時發生錯誤');
            }
            
            return result;
            
        } catch (error) {
            console.error('清除休假資料時發生錯誤:', error);
            alert('清除休假資料失敗: ' + error.message);
            return { success: false, message: error.message };
        }
    }

    /**
     * 清除所有休假標記（僅前端顯示）
     */
    clearAllLeaves() {
        // 清除儲存的資料
        this.leaveData.clear();
        
        // 清除所有儲存格的顯示
        const shiftCells = this.container.querySelectorAll('.shift-cell');
        shiftCells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('leave-high', 'leave-low', 'leave-special');
        });
        
        // 更新實際班別統計
        this.updateActualShiftCounts();
        
        // 更新時間軸狀態 - 清除休假後回到預/畫假階段
        this.updateTimelineStep('set-leaves', 'current');
        this.updateTimelineStep('auto-schedule', 'pending');
        this.updateTimelineStep('verify-schedule', 'pending');
        this.updateTimelineStep('complete', 'pending');
        
        console.log('已清除所有休假標記');
    }

    /**
     * 執行自動排班功能
     */
    async runAutoScheduling() {
        const cycleId = this.cycleData.cycle_id;
        
        // 顯示載入狀態
        this.showLoadingOverlay('正在執行自動排班...');
        
        try {
            console.log(`開始執行週期 #${cycleId} 的自動排班...`);
            
            // 呼叫後端 API
            const response = await fetch('/api/run-schedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cycle_id: cycleId
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('自動排班結果:', result);
            
            // 隱藏載入狀態
            this.hideLoadingOverlay();
            
            if (result.success) {
                // 排班成功，更新表格內容
                this.updateScheduleTable(result.data);
                
                // 重新載入已儲存的休假資料，確保休假安排正確
                await this.loadSavedLeaveData();
                
                // 更新實際班別統計
                this.updateActualShiftCounts();
                
                // 標記已執行自動排班
                this.hasAutoScheduled = true;
                
                // 更新時間軸狀態
                this.updateTimelineStep('set-leaves', 'completed');
                this.updateTimelineStep('auto-schedule', 'completed');
                this.updateTimelineStep('verify-schedule', 'current');
                
                this.showMessage('自動排班成功！', 'success');
            } else {
                // 排班失敗，顯示錯誤訊息
                this.showMessage(`自動排班失敗: ${result.message}`, 'error');
            }
            
        } catch (error) {
            console.error('自動排班執行失敗:', error);
            this.hideLoadingOverlay();
            this.showMessage(`自動排班執行失敗: ${error.message}`, 'error');
        }
    }

    /**
     * 顯示載入遮罩
     * @param {string} message - 載入訊息
     */
    showLoadingOverlay(message = '載入中...') {
        // 移除現有的遮罩
        this.hideLoadingOverlay();
        
        // 建立遮罩元素
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">載入中...</span>
                </div>
                <div class="loading-message">${message}</div>
            </div>
        `;
        
        // 添加到表格容器
        const tableContainer = this.container.querySelector('.employees-table-outer');
        if (tableContainer) {
            tableContainer.appendChild(overlay);
        }
    }

    /**
     * 隱藏載入遮罩
     */
    hideLoadingOverlay() {
        const overlay = this.container.querySelector('.loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    /**
     * 顯示訊息框
     * @param {string} message - 訊息內容
     * @param {string} type - 訊息類型 ('success', 'error', 'info')
     */
    showMessage(message, type = 'info') {
        // 移除現有的訊息框
        this.hideMessage();
        
        // 建立訊息框元素
        const messageBox = document.createElement('div');
        messageBox.className = `message-box message-${type}`;
        messageBox.innerHTML = `
            <div class="message-content">
                <span class="message-text">${message}</span>
                <button type="button" class="message-close" onclick="this.parentElement.parentElement.remove()">
                    <span>&times;</span>
                </button>
            </div>
        `;
        
        // 添加到容器
        this.container.appendChild(messageBox);
        
        // 3秒後自動隱藏（成功訊息）
        if (type === 'success') {
            setTimeout(() => {
                this.hideMessage();
            }, 3000);
        }
    }

    /**
     * 隱藏訊息框
     */
    hideMessage() {
        const messageBox = this.container.querySelector('.message-box');
        if (messageBox) {
            messageBox.remove();
        }
    }

    /**
     * 根據自動排班結果更新表格內容
     * @param {Object} data - 排班結果資料
     */
    updateScheduleTable(data) {
        const { schedule, dates } = data;
        
        if (!schedule || !dates) {
            console.error('排班資料格式錯誤');
            return;
        }
        
        // 更新表格內容
        const tbody = this.container.querySelector('.employees-table tbody');
        if (!tbody) return;
        
        // 清空現有內容
        tbody.innerHTML = '';
        
        // 重新生成表格行
        Object.keys(schedule).forEach(employeeName => {
            const row = document.createElement('tr');
            
            // 員工姓名欄位
            const nameCell = document.createElement('td');
            nameCell.textContent = employeeName;
            nameCell.classList.add('sticky-col');
            row.appendChild(nameCell);
            
            // 班別欄位
            const shifts = schedule[employeeName];
            dates.forEach((date, index) => {
                const cell = document.createElement('td');
                cell.className = 'shift-cell';
                
                // 設定班別文字和樣式
                const shift = shifts[index];
                if (shift && shift !== 'O') {
                    cell.textContent = shift;
                    cell.classList.add(this.shiftTypeMap[shift]?.class || '');
                } else {
                    cell.textContent = 'O';
                    cell.classList.add('day-off');
                }
                
                // 如果是週末，加上 weekend 樣式
                const dateObj = new Date(date);
                if (dateObj.getDay() === 0 || dateObj.getDay() === 6) {
                    cell.classList.add('weekend');
                }
                
                // 添加資料屬性
                cell.dataset.employeeName = employeeName;
                cell.dataset.date = date;
                cell.dataset.dateIndex = index;
                
                row.appendChild(cell);
            });
            
            tbody.appendChild(row);
        });
        
        // 重新添加點擊事件監聽器
        this.addClickEventListeners();
        
        // 更新實際班別統計
        this.updateActualShiftCounts();
        
        console.log('表格內容已更新');
    }

    // 新增：移除 loading 畫面
    hideLoading() {
        const tbody = this.container.querySelector('.employees-table tbody');
        if (tbody) {
            const loadingRow = tbody.querySelector('.loading-row');
            if (loadingRow) loadingRow.remove();
        }
    }

    /**
     * 添加需求表格的點擊事件監聽器
     */
    addRequirementTableEventListeners() {
        const requirementCells = this.container.querySelectorAll('.requirement-cell');
        requirementCells.forEach(cell => {
            cell.addEventListener('click', (event) => {
                this.handleRequirementCellClick(event);
            });
        });
    }

    /**
     * 更新實際班別統計數據
     */
    updateActualShiftCounts() {
        const table = this.container.querySelector('.employees-table');
        if (!table) {
            console.error('找不到班表表格');
            return;
        }

        const tbody = table.querySelector('tbody');
        if (!tbody) {
            console.error('找不到班表表格內容');
            return;
        }

        // 統計每個員工的實際班別數量
        const actualCounts = {};
        const rows = tbody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 1) {
                const employeeName = cells[0].textContent.trim();
                actualCounts[employeeName] = { A: 0, B: 0, C: 0 };
                
                // 從第二個儲存格開始統計班別
                for (let i = 1; i < cells.length; i++) {
                    const cell = cells[i];
                    
                    // 根據儲存格的樣式類別判斷班別
                    if (cell.classList.contains('morning-shift')) {
                        actualCounts[employeeName].A++;
                    } else if (cell.classList.contains('afternoon-shift')) {
                        actualCounts[employeeName].B++;
                    } else if (cell.classList.contains('night-shift')) {
                        actualCounts[employeeName].C++;
                    }
                    // 休假類型不計入統計
                }
            }
        });

        // 更新需求表格中的實際班別數據
        const reqTable = this.container.querySelector('.employee-requirements-table');
        if (reqTable) {
            const reqRows = reqTable.querySelectorAll('tbody tr');
            reqRows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 7) { // 確保有足夠的欄位
                    const employeeName = cells[0].textContent.trim();
                    const employeeCounts = actualCounts[employeeName] || { A: 0, B: 0, C: 0 };
                    
                    // 更新實際白班 (第2欄)
                    const actualACell = cells[2];
                    if (actualACell && actualACell.classList.contains('actual-shift-cell')) {
                        const valueSpan = actualACell.querySelector('.actual-shift-value');
                        if (valueSpan) {
                            valueSpan.textContent = employeeCounts.A;
                        }
                    }
                    
                    // 更新實際小夜班 (第4欄)
                    const actualBCell = cells[4];
                    if (actualBCell && actualBCell.classList.contains('actual-shift-cell')) {
                        const valueSpan = actualBCell.querySelector('.actual-shift-value');
                        if (valueSpan) {
                            valueSpan.textContent = employeeCounts.B;
                        }
                    }
                    
                    // 更新實際大夜班 (第6欄)
                    const actualCCell = cells[6];
                    if (actualCCell && actualCCell.classList.contains('actual-shift-cell')) {
                        const valueSpan = actualCCell.querySelector('.actual-shift-value');
                        if (valueSpan) {
                            valueSpan.textContent = employeeCounts.C;
                        }
                    }
                }
            });
        }

        console.log('實際班別統計已更新:', actualCounts);
    }

    /**
     * 處理需求表格的點擊事件
     * @param {Event} event - 點擊事件物件
     */
    handleRequirementCellClick(event) {
        const cell = event.target.closest('.requirement-cell');
        if (!cell) return;
        
        const employeeName = cell.dataset.employee;
        const shiftType = cell.dataset.shift;
        const key = `${employeeName}_${shiftType}`;

        // 如果已經有選中的儲存格，先清除之前的 +/- 按鈕
        if (this.selectedRequirementCell && this.selectedRequirementCell !== cell) {
            this.clearRequirementCellButtons(this.selectedRequirementCell);
        }

        // 如果點擊的是同一個儲存格，切換 +/- 按鈕的顯示
        if (this.selectedRequirementCell === cell) {
            this.clearRequirementCellButtons(cell);
            this.selectedRequirementCell = null;
            return;
        }

        // 為當前儲存格添加 +/- 按鈕
        this.addRequirementCellButtons(cell);
        this.selectedRequirementCell = cell;
    }

    /**
     * 為需求儲存格添加 +/- 按鈕
     * @param {HTMLElement} cell - 需求儲存格元素
     */
    addRequirementCellButtons(cell) {
        const employeeName = cell.dataset.employee;
        const shiftType = cell.dataset.shift;
        const key = `${employeeName}_${shiftType}`;
        const currentValue = this.currentRequirements.get(key) || 0;

        // 更新儲存格的 HTML 結構
        cell.innerHTML = `
            <div class="requirement-content">
                <button type="button" class="requirement-btn requirement-btn-minus" data-action="decrease">-</button>
                <span class="requirement-value">${currentValue}</span>
                <button type="button" class="requirement-btn requirement-btn-plus" data-action="increase">+</button>
            </div>
        `;

        // 添加按鈕事件監聽器
        const minusBtn = cell.querySelector('.requirement-btn-minus');
        const plusBtn = cell.querySelector('.requirement-btn-plus');

        minusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.updateRequirementValue(cell, -1);
        });

        plusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.updateRequirementValue(cell, 1);
        });

        // 添加選中樣式
        cell.classList.add('selected');
        
        // 觸發按鈕的淡入動畫
        setTimeout(() => {
            minusBtn.style.animation = 'fade-in 0.3s ease-out forwards';
            plusBtn.style.animation = 'fade-in 0.3s ease-out forwards';
        }, 10);
    }

    /**
     * 清除需求儲存格的 +/- 按鈕
     * @param {HTMLElement} cell - 需求儲存格元素
     */
    clearRequirementCellButtons(cell) {
        const employeeName = cell.dataset.employee;
        const shiftType = cell.dataset.shift;
        const key = `${employeeName}_${shiftType}`;
        const currentValue = this.currentRequirements.get(key) || 0;

        // 先觸發淡出動畫
        const minusBtn = cell.querySelector('.requirement-btn-minus');
        const plusBtn = cell.querySelector('.requirement-btn-plus');
        
        if (minusBtn && plusBtn) {
            // 添加淡出動畫
            minusBtn.classList.add('fade-out');
            plusBtn.classList.add('fade-out');
            
            // 等待動畫完成後再更新 HTML
            setTimeout(() => {
                // 恢復原始 HTML 結構
                cell.innerHTML = `
                    <div class="requirement-content">
                        <span class="requirement-value">${currentValue}</span>
                    </div>
                `;
                
                // 移除選中樣式
                cell.classList.remove('selected');
            }, 200); // 與 CSS 動畫時間一致
        } else {
            // 如果沒有按鈕，直接更新
            cell.innerHTML = `
                <div class="requirement-content">
                    <span class="requirement-value">${currentValue}</span>
                </div>
            `;
            cell.classList.remove('selected');
        }
    }

    /**
     * 更新需求值
     * @param {HTMLElement} cell - 需求儲存格元素
     * @param {number} delta - 增減值
     */
    updateRequirementValue(cell, delta) {
        const employeeName = cell.dataset.employee;
        const shiftType = cell.dataset.shift;
        const key = `${employeeName}_${shiftType}`;
        const currentValue = this.currentRequirements.get(key) || 0;

        // 計算新值（限制在 0-30 範圍內）
        let newValue = currentValue + delta;
        newValue = Math.max(0, Math.min(30, newValue));

        // 更新儲存的值
        this.currentRequirements.set(key, newValue);

        // 更新視覺顯示
        const valueSpan = cell.querySelector('.requirement-value');
        if (valueSpan) {
            valueSpan.textContent = newValue;
        }

        // 檢查是否有變更
        this.checkRequirementsChanged();
        this.updateRequirementButtonState();

        console.log(`員工 ${employeeName} 的 ${shiftType} 需求已更新為: ${newValue}`);
    }

    /**
     * 更新需求按鈕狀態
     */
    updateRequirementButtonState() {
        const updateRequireBtn = this.container.querySelector('.update-require-btn');
        if (updateRequireBtn) {
            updateRequireBtn.disabled = !this.hasRequirementsChanged;
        }
    }

    /**
     * 檢查是否有需求變更
     */
    checkRequirementsChanged() {
        let hasChanges = false;
        this.originalRequirements.forEach((originalValue, key) => {
            const currentValue = this.currentRequirements.get(key);
            if (originalValue !== currentValue) {
                hasChanges = true;
                return;
            }
        });
        this.hasRequirementsChanged = hasChanges;
        return hasChanges;
    }

    /**
     * 儲存需求變更到後端 API
     */
    async saveRequirementsChanges() {
        const cycleId = this.cycleData.cycle_id;
        const changes = [];
        this.currentRequirements.forEach((value, key) => {
            const originalValue = this.originalRequirements.get(key);
            if (value !== originalValue) {
                const [employeeName, shiftType] = key.split('_');
                changes.push({
                    cycle_id: cycleId,
                    employee_name: employeeName,
                    shift_type: shiftType,
                    required_days: value
                });
            }
        });

        if (changes.length === 0) {
            this.showMessage('沒有需求變更，不需儲存。', 'info');
            return;
        }

        // Toast loading
        const toastContainer = document.querySelector('.toast-container');
        let loadingToast = document.createElement('div');
        loadingToast.className = 'toast';
        loadingToast.innerHTML = `
            <div class="toast-header">
                <strong class="me-auto">系統訊息</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">正在儲存需求變更...</div>
        `;
        toastContainer.appendChild(loadingToast);
        let bsLoadingToast = new bootstrap.Toast(loadingToast);
        bsLoadingToast.show();

        try {
            const response = await fetch('/api/update-employee-requirements', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cycle_id: cycleId,
                    changes: changes
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '儲存需求變更失敗');
            }

            const result = await response.json();
            console.log('需求變更儲存成功:', result);

            // 移除 loading toast
            bsLoadingToast.hide();
            loadingToast.remove();

            // 顯示成功訊息 toast
            let resultToast = document.createElement('div');
            resultToast.className = 'toast';
            resultToast.innerHTML = `
                <div class="toast-header">
                    <strong class="me-auto">系統訊息</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">需求變更已儲存！</div>
            `;
            toastContainer.appendChild(resultToast);
            let bsResultToast = new bootstrap.Toast(resultToast);
            bsResultToast.show();
            setTimeout(() => { resultToast.remove(); }, 3000);

            // 重新載入原始需求資料，以便下次比較
            await this.loadSavedLeaveData(); // 重新載入休假資料，因為需求變更也會影響休假安排
            this.originalRequirements.clear();
            this.currentRequirements.forEach((value, key) => {
                const [employeeName, shiftType] = key.split('_');
                this.originalRequirements.set(key, value);
            });
            this.hasRequirementsChanged = false;
            this.showMessage('需求變更已儲存！', 'success');

        } catch (error) {
            bsLoadingToast.hide();
            loadingToast.remove();
            let errorToast = document.createElement('div');
            errorToast.className = 'toast';
            errorToast.innerHTML = `
                <div class="toast-header">
                    <strong class="me-auto">錯誤訊息</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">儲存失敗：${error.message}</div>
            `;
            toastContainer.appendChild(errorToast);
            let bsErrorToast = new bootstrap.Toast(errorToast);
            bsErrorToast.show();
            setTimeout(() => { errorToast.remove(); }, 3000);
        }
    }

    /**
     * 執行班表驗證
     */
    async runScheduleVerification() {
        const cycleId = this.cycleData.cycle_id;
        
        // 更新驗證狀態
        this.updateVerificationStatus('verifying', '正在驗證班表...');
        
        // 啟用所有 checkbox
        this.enableVerificationCheckboxes();
        
        try {
            console.log(`開始驗證週期 #${cycleId} 的班表...`);
            
            // 從 employees-table 中提取班表資料
            const scheduleData = this.extractScheduleDataFromTable();
            
            if (!scheduleData) {
                throw new Error('無法提取班表資料');
            }
            
            console.log('提取的班表資料:', scheduleData);
            
            // 呼叫後端 API 進行驗證
            const response = await fetch('/api/verify-schedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cycle_id: cycleId,
                    schedule_data: scheduleData
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '驗證請求失敗');
            }
            
            const result = await response.json();
            console.log('驗證結果:', result);
            
            // 更新驗證結果
            this.updateVerificationResults(result);
            
            // 驗證完成
            this.updateVerificationStatus('success', '驗證完成！');
            
            // 檢查所有驗證項目是否都通過
            const allVerificationsPassed = this.checkAllVerificationsPassed(result);
            
            if (allVerificationsPassed) {
                // 所有驗證都通過，更新時間軸狀態
                this.updateTimelineStep('verify-schedule', 'completed');
                this.updateTimelineStep('add-subtype', 'current');
                this.showMessage('班表驗證完成！所有項目均通過！', 'success');
            } else {
                // 有驗證項目未通過，不更新時間軸狀態
                this.showMessage('班表驗證完成！但仍有項目需要修正。', 'info');
            }
            
        } catch (error) {
            console.error('班表驗證失敗:', error);
            this.updateVerificationStatus('error', '驗證失敗');
            this.showMessage(`班表驗證失敗: ${error.message}`, 'error');
        }
    }

    /**
     * 從 employees-table 中提取班表資料
     * @returns {Object} 班表資料格式 {schedule: {員工名: [班別列表]}, dates: [日期列表]}
     */
    extractScheduleDataFromTable() {
        const table = this.container.querySelector('.employees-table');
        if (!table) {
            console.error('找不到班表表格');
            return null;
        }

        const thead = table.querySelector('thead tr');
        const tbody = table.querySelector('tbody');
        
        if (!thead || !tbody) {
            console.error('表格結構不完整');
            return null;
        }

        // 直接使用週期資料中的日期範圍，而不是從表格標題重建
        const startDate = new Date(this.cycleData.start_date);
        const endDate = new Date(this.cycleData.end_date);
        const dates = [];
        
        // 生成日期範圍
        for (let dt = new Date(startDate); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
            const dateStr = dt.toISOString().split('T')[0]; // YYYY-MM-DD 格式
            dates.push(dateStr);
        }

        // 提取員工班別資料
        const schedule = {};
        const rows = tbody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 1) {
                const employeeName = cells[0].textContent.trim();
                const shifts = [];
                
                // 從第二個儲存格開始提取班別資料
                for (let i = 1; i < cells.length; i++) {
                    const cell = cells[i];
                    const cellText = cell.textContent.trim();
                    
                    // 根據儲存格的樣式類別判斷班別
                    let shift = 'O'; // 預設為休假
                    
                    if (cell.classList.contains('morning-shift')) {
                        shift = 'A';
                    } else if (cell.classList.contains('afternoon-shift')) {
                        shift = 'B';
                    } else if (cell.classList.contains('night-shift')) {
                        shift = 'C';
                    } else if (cell.classList.contains('leave-high') || 
                              cell.classList.contains('leave-low') || 
                              cell.classList.contains('leave-special')) {
                        shift = 'O'; // 各種休假類型都視為休假
                    } else if (cell.classList.contains('day-off')) {
                        shift = 'O';
                    }
                    
                    shifts.push(shift);
                }
                
                schedule[employeeName] = shifts;
            }
        });

        return {
            schedule: schedule,
            dates: dates
        };
    }

    /**
     * 更新驗證結果到介面
     * @param {Object} result - 驗證結果
     */
    updateVerificationResults(result) {
        // 更新 checkbox 狀態
        const dailyCountCheckbox = document.getElementById('verify-daily-count');
        const consecutiveDaysCheckbox = document.getElementById('verify-consecutive-days');
        const shiftConnectionCheckbox = document.getElementById('verify-shift-connection');
        
        if (dailyCountCheckbox) {
            dailyCountCheckbox.checked = result.daily_staffing_passed;
        }
        if (consecutiveDaysCheckbox) {
            consecutiveDaysCheckbox.checked = result.continuous_work_passed;
        }
        if (shiftConnectionCheckbox) {
            shiftConnectionCheckbox.checked = result.shift_connection_passed;
        }

        this.disableVerificationCheckboxes();

        // 更新驗證註解
        const verifyComment = document.getElementById('verifycomment');
        if (verifyComment) {
            let commentText = '班表驗證結果：\n\n';
            
            // 每日上班人數驗證
            commentText += `1. 每日上班人數: ${result.daily_staffing_passed ? '✓ 通過' : '✗ 未通過'}\n`;
            if (!result.daily_staffing_passed && result.daily_staffing_details) {
                commentText += `   問題詳情:\n`;
                result.daily_staffing_details.forEach(detail => {
                    commentText += `   - ${detail}\n`;
                });
            }
            commentText += '\n';
            
            // 連續上班天數驗證
            commentText += `2. 連續上班天數: ${result.continuous_work_passed ? '✓ 通過' : '✗ 未通過'}\n`;
            if (!result.continuous_work_passed && result.continuous_work_details) {
                commentText += `   問題詳情:\n`;
                result.continuous_work_details.forEach(detail => {
                    commentText += `   - ${detail}\n`;
                });
            }
            commentText += '\n';
            
            // 班別銜接驗證
            commentText += `3. 班別銜接: ${result.shift_connection_passed ? '✓ 通過' : '✗ 未通過'}\n`;
            if (!result.shift_connection_passed && result.shift_connection_details) {
                commentText += `   問題詳情:\n`;
                result.shift_connection_details.forEach(detail => {
                    commentText += `   - ${detail}\n`;
                });
            }
            commentText += '\n';
            
            // 總結
            const allPassed = result.daily_staffing_passed && result.continuous_work_passed && result.shift_connection_passed;
            commentText += `整體驗證結果: ${allPassed ? '✓ 全部通過' : '✗ 需要修正'}`;
            
            verifyComment.value = commentText;
        }
    }

    /**
     * 更新驗證狀態
     * @param {string} status - 狀態類型 ('verifying', 'success', 'error')
     * @param {string} message - 狀態訊息
     */
    updateVerificationStatus(status, message) {
        const statusElement = this.container.querySelector('.verify-status');
        const statusTextElement = this.container.querySelector('.verify-status-text');
        
        if (statusElement && statusTextElement) {
            // 移除所有狀態類別
            statusElement.classList.remove('verifying', 'success', 'error');
            
            // 添加新的狀態類別
            statusElement.classList.add(status);
            statusTextElement.textContent = message;
        }
    }

    /**
     * 啟用驗證 checkbox
     */
    enableVerificationCheckboxes() {
        const checkboxes = this.container.querySelectorAll('.verify-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.disabled = false;
        });
    }

    /**
     * 禁用驗證 checkbox
     */
    disableVerificationCheckboxes() {
        const checkboxes = this.container.querySelectorAll('.verify-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.disabled = true;
            // checkbox.checked = false;
        });
    }

    /**
     * 渲染時間軸流程
     * @returns {string} HTML 字串
     */
    renderTimeline() {
        return `
            <div class="timeline-header">
                <h3>暫存班表流程</h3>
            </div>
            <div class="timeline-steps">
                ${this.timelineSteps.map((step, index) => `
                    <div class="timeline-step ${step.status}" data-step="${step.id}">
                        <div class="step-icon">
                            <i class="bx ${this.getStepIcon(step.status)}"></i>
                        </div>
                        <div class="step-label">${step.name}</div>
                    </div>
                    ${index < this.timelineSteps.length - 1 ? '<div class="timeline-arrow"><i class="bx bx-chevron-right"></i></div>' : ''}
                `).join('')}
            </div>
        `;
    }

    /**
     * 根據步驟狀態獲取對應的圖示
     * @param {string} status - 步驟狀態
     * @returns {string} 圖示類別名稱
     */
    getStepIcon(status) {
        switch (status) {
            case 'completed':
                return 'bx-check-circle';
            case 'current':
                return 'bx-time';
            case 'pending':
                return 'bx-circle';
            default:
                return 'bx-circle';
        }
    }

    /**
     * 初始化時間軸狀態
     */
    initializeTimeline() {
        // 根據當前狀態設定時間軸
        this.updateTimelineStep('create-cycle', 'completed');
        this.updateTimelineStep('set-leaves', 'current');
        this.updateTimelineStep('auto-schedule', 'pending');
        this.updateTimelineStep('verify-schedule', 'pending');
        this.updateTimelineStep('add-subtype','pending');
        this.updateTimelineStep('complete', 'pending');
    }

    /**
     * 更新時間軸步驟狀態
     * @param {string} stepId - 步驟ID
     * @param {string} status - 新狀態
     */
    updateTimelineStep(stepId, status) {
        const step = this.timelineSteps.find(s => s.id === stepId);
        if (step) {
            step.status = status;
            this.renderTimelineStep(stepId, status);
        }
    }

    /**
     * 渲染時間軸步驟
     * @param {string} stepId - 步驟ID
     * @param {string} status - 步驟狀態
     */
    renderTimelineStep(stepId, status) {
        const stepElement = this.container.querySelector(`[data-step="${stepId}"]`);
        if (stepElement) {
            // 移除所有狀態類別
            stepElement.classList.remove('completed', 'current', 'pending');
            // 添加新狀態類別
            stepElement.classList.add(status);
            
            // 更新圖示
            const iconElement = stepElement.querySelector('.step-icon i');
            if (iconElement) {
                iconElement.className = `bx ${this.getStepIcon(status)}`;
            }
        }
    }

    /**
     * 檢查所有驗證項目是否都通過
     * @param {Object} result - 驗證結果
     * @returns {boolean} 是否所有驗證都通過
     */
    checkAllVerificationsPassed(result) {
        // 檢查三個主要驗證項目是否都通過
        return result.daily_staffing_passed && 
               result.continuous_work_passed && 
               result.shift_connection_passed;
    }

    /**
     * 更新整個時間軸狀態
     */
    updateTimelineStatus() {
        // 根據當前進度更新時間軸
        if (this.hasAutoScheduled) {
            this.updateTimelineStep('set-leaves', 'completed');
            this.updateTimelineStep('auto-schedule', 'completed');
            this.updateTimelineStep('verify-schedule', 'current');
        }
    }

    /**
     * 切換工作內容安排模式
     */
    async toggleSubtypeMode() {
        try {
            if (this.isSubtypeMode) {
                // 從工作內容安排模式切換回正常模式
                await this.renderNormalScheduleTable();
                this.isSubtypeMode = false;
                this.updateTimelineStep('verify-schedule', 'current');
                this.showMessage('已切換回正常排班表檢視', 'success');
            } else {
                // 進入工作內容安排模式
                await this.enterSubtypeMode();
            }
        } catch (error) {
            console.error('切換工作內容安排模式時發生錯誤:', error);
            this.showMessage('切換模式失敗，請稍後再試', 'error');
        }
    }

    /**
     * 進入工作內容安排模式
     */
    async enterSubtypeMode() {
        try {
            this.showMessage('正在載入班別群組資料...', 'info');
            
            // 從 API 獲取班別群組資料
            const response = await fetch(`/api/schedule-cycle-shift-group?cycle_id=${this.cycleData.cycle_id}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP 錯誤! 狀態: ${response.status}`);
            }
            
            this.shiftGroupData = await response.json();
            console.log('成功獲取班別群組資料:', this.shiftGroupData);
            
            // 渲染工作內容安排表格
            this.renderSubtypeScheduleTable();
            this.isSubtypeMode = true;
            
            // 更新時間軸狀態
            this.updateTimelineStep('verify-schedule', 'completed');
            this.addTimelineStep('work-content', '工作內容安排', 'current');
            
            this.showMessage('已進入工作內容安排模式', 'success');
            
        } catch (error) {
            console.error('進入工作內容安排模式時發生錯誤:', error);
            this.showMessage(`無法載入班別群組資料: ${error.message}`, 'error');
        }
    }

    /**
     * 渲染工作內容安排表格（使用 rowspan=2 的結構）
     */
    renderSubtypeScheduleTable() {
        const table = document.querySelector('.employees-table');
        if (!table) {
            console.error('找不到員工班表元素');
            return;
        }

        const thead = table.querySelector('thead tr');
        const tbody = table.querySelector('tbody');

        // 清空現有內容
        thead.innerHTML = '<th rowspan="2">員工姓名</th>'; // 員工姓名欄位跨越兩列
        tbody.innerHTML = '';

        // 生成日期標題
        for (let i = 0; i < 7; i++) {
            const date = new Date(this.cycleData.start_date);
            date.setDate(date.getDate() + i);
            
            const dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
            const month = date.getMonth() + 1;
            const day = date.getDate();
            
            const th = document.createElement('th');
            th.innerHTML = `${month}/${day}<br>(${dayOfWeek})`;
            th.className = date.getDay() === 0 || date.getDay() === 6 ? 'weekend' : '';
            
            // 添加班別子類型標題
            if (this.shiftGroupData && this.shiftGroupData[i]) {
                const shifts = this.shiftGroupData[i];
                const dayShifts = shifts.filter(s => s.shift_group === 'day');
                const eveningShifts = shifts.filter(s => s.shift_group === 'evening');
                const nightShifts = shifts.filter(s => s.shift_group === 'night');
                
                const shiftSubtypes = document.createElement('div');
                shiftSubtypes.className = 'shift-subtypes';
                
                if (dayShifts.length > 0) {
                    const dayDiv = document.createElement('div');
                    dayDiv.className = 'shift-subtype morning-shift';
                    dayDiv.textContent = 'A班';
                    shiftSubtypes.appendChild(dayDiv);
                }
                
                if (eveningShifts.length > 0) {
                    const eveningDiv = document.createElement('div');
                    eveningDiv.className = 'shift-subtype afternoon-shift';
                    eveningDiv.textContent = 'B班';
                    shiftSubtypes.appendChild(eveningDiv);
                }
                
                if (nightShifts.length > 0) {
                    const nightDiv = document.createElement('div');
                    nightDiv.className = 'shift-subtype night-shift';
                    nightDiv.textContent = 'C班';
                    shiftSubtypes.appendChild(nightDiv);
                }
                
                th.appendChild(shiftSubtypes);
            }
            
            thead.appendChild(th);
        }

        // 獲取員工姓名
        let uniqueNames = [];
        if (this.cycleData && this.cycleData.members) {
            uniqueNames = this.cycleData.members.map(member => member.name);
        }

        // 為每個員工創建兩列：第一列顯示主要班別，第二列顯示子班別
        uniqueNames.forEach(employeeName => {
            const mainRow = document.createElement('tr');
            const subRow = document.createElement('tr');
            subRow.className = 'shift-subtype-row';
            
            // 員工姓名欄 - 跨越兩列（使用 rowspan=2）
            const nameCell = document.createElement('td');
            nameCell.textContent = employeeName;
            nameCell.rowSpan = 2; // 跨越兩列
            nameCell.className = 'employee-name-cell';
            mainRow.appendChild(nameCell);
            
            // 生成每天的班表欄位
            for (let i = 0; i < 7; i++) {
                const date = new Date(this.cycleData.start_date);
                date.setDate(date.getDate() + i);
                
                // 檢查是否為週末
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                
                // 第一列：主要班別儲存格
                const mainCell = document.createElement('td');
                mainCell.className = 'shift-main-cell';
                
                // 根據 shiftGroupData 決定主要班別
                if (this.shiftGroupData && this.shiftGroupData[i]) {
                    const shifts = this.shiftGroupData[i];
                    const dayShifts = shifts.filter(s => s.shift_group === 'day');
                    const eveningShifts = shifts.filter(s => s.shift_group === 'evening');
                    const nightShifts = shifts.filter(s => s.shift_group === 'night');
                    
                    if (dayShifts.length > 0) {
                        mainCell.textContent = 'A';
                        mainCell.classList.add('morning-shift');
                    } else if (eveningShifts.length > 0) {
                        mainCell.textContent = 'B';
                        mainCell.classList.add('afternoon-shift');
                    } else if (nightShifts.length > 0) {
                        mainCell.textContent = 'C';
                        mainCell.classList.add('night-shift');
                    } else {
                        mainCell.textContent = 'O';
                        mainCell.classList.add('day-off');
                    }
                } else {
                    mainCell.textContent = 'O';
                    mainCell.classList.add('day-off');
                }
                
                // 如果是週末，加上 weekend 樣式
                if (isWeekend) {
                    mainCell.classList.add('weekend');
                }
                
                mainRow.appendChild(mainCell);
                
                // 第二列：子班別儲存格
                const subCell = document.createElement('td');
                subCell.className = 'shift-sub-cell';
                
                // 根據 shiftGroupData 顯示子班別
                if (this.shiftGroupData && this.shiftGroupData[i]) {
                    const shifts = this.shiftGroupData[i];
                    const shiftSubtypes = shifts.map(s => `${s.shift_name}-${s.shift_subname}`).join(', ');
                    subCell.textContent = shiftSubtypes;
                    
                    // 繼承上方儲存格的樣式類別
                    if (mainCell.classList.contains('morning-shift')) {
                        subCell.classList.add('morning-shift');
                    } else if (mainCell.classList.contains('afternoon-shift')) {
                        subCell.classList.add('afternoon-shift');
                    } else if (mainCell.classList.contains('night-shift')) {
                        subCell.classList.add('night-shift');
                    }
                } else {
                    subCell.textContent = '';
                }
                
                // 如果是週末，加上 weekend 樣式
                if (isWeekend) {
                    subCell.classList.add('weekend');
                }
                
                subRow.appendChild(subCell);
            }
            
            tbody.appendChild(mainRow);
            tbody.appendChild(subRow);
        });
    }

    /**
     * 渲染正常排班表格
     */
    async renderNormalScheduleTable() {
        try {
            // 重新獲取週期成員資料
            await this.fetchCycleMembers();
            
            // 重新生成標準排班表格
            this.generateEmployeesTable();
            
            // 重新載入已儲存的休假資料
            await this.loadSavedLeaveData();
            
            // 更新班別統計
            this.updateActualShiftCounts();
            
            console.log('已切換回正常排班表檢視');
            
        } catch (error) {
            console.error('渲染正常排班表格時發生錯誤:', error);
            throw error;
        }
    }

    /**
     * 獲取班別群組對應的 CSS 類別
     * @param {string} shiftGroup - 班別群組 ('day', 'evening', 'night')
     * @returns {string} CSS 類別名稱
     */
    getShiftClass(shiftGroup) {
        switch (shiftGroup) {
            case 'day':
                return 'morning-shift';
            case 'evening':
                return 'afternoon-shift';
            case 'night':
                return 'night-shift';
            default:
                return 'day-off';
        }
    }

    /**
     * 添加新的時間軸步驟
     * @param {string} id - 步驟 ID
     * @param {string} name - 步驟名稱
     * @param {string} status - 步驟狀態
     */
    addTimelineStep(id, name, status = 'pending') {
        // 檢查步驟是否已存在
        const existingStep = this.timelineSteps.find(step => step.id === id);
        if (!existingStep) {
            this.timelineSteps.push({ id, name, status });
            this.renderTimeline();
        } else {
            // 如果已存在，更新狀態
            this.updateTimelineStep(id, status);
        }
    }
}

// 建立全域實例，方便從其他 script 檔案呼叫
if (!window.tempScheduleMode) {
    window.tempScheduleMode = new TempScheduleMode();
} 