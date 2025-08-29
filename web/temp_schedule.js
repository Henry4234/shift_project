// 功能：處理暫存班表模式的顯示

class TempScheduleMode {
    constructor() {
        this.container = document.querySelector('nav.content');
        this.cycleData = null;
        this.shiftTypeMap = {
            'A': { text: 'A', class: 'morning-shift' },
            'B': { text: 'B', class: 'afternoon-shift' },
            'C': { text: 'C', class: 'night-shift' },
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
                        <button type="button" class="btn-del-cycle">刪除週期</button>
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
                        <button type="button" class="shift-upload-btn" onclick="">上傳/發佈班表</button>
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
        // 緩存成員資料以供後續上傳時使用 employee_id 對應
        this.members = members;
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
        
        // 12. disabled之後才會開啟的btn
        const initDisabledBtn = this.container.querySelectorAll('.shift-subtype-btn, .shift-upload-btn');
        initDisabledBtn.forEach(el => el.disabled = true);
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
     * 移除點擊事件監聽器到所有 shift-cell
     */
    removeClickEventListeners() {
        const shiftCells = this.container.querySelectorAll('.shift-cell');
        shiftCells.forEach(cell => {
            cell.removeEventListener('click', (event) => {
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
        // === 刪除週期按鈕 ===
        const DelCycleBtn = this.container.querySelector('.btn-del-cycle');
        if (DelCycleBtn) {
            DelCycleBtn.addEventListener('click', async () => {
                await this.deleteCycle();
            });
        }

        // === 上班天數更新按鈕 ===
        const updateRequireBtn = this.container.querySelector('.update-require-btn');
        if (updateRequireBtn) {
            // 初始狀態設為 disabled
            updateRequireBtn.disabled = true;
            updateRequireBtn.addEventListener('click', async () => {
                await this.saveRequirementsChanges();
            });
        }

        // === 驗證班表按鈕 ===
        const verifyShiftBtn = this.container.querySelector('.verify-shift-btn');
        if (verifyShiftBtn) {
            verifyShiftBtn.addEventListener('click', async () => {
                await this.runScheduleVerification();
            });
        }

        // === 工作內容安排按鈕 ===
        const shiftSubtypeBtn = this.container.querySelector('.shift-subtype-btn');
        if (shiftSubtypeBtn) {
            shiftSubtypeBtn.addEventListener('click', async () => {
                await this.AddSubtypeMode();
            });
        }

        // === 上傳/發佈班表 ===
        const UploadBtn = this.container.querySelector('.shift-upload-btn');
        if (UploadBtn) {
            UploadBtn.addEventListener('click', async () => {
                await this.uploadSchedule();
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
            const SubtypeBtn = this.container.querySelector('.shift-subtype-btn');

            if (allVerificationsPassed) {
                // 所有驗證都通過，更新時間軸狀態
                this.updateTimelineStep('verify-schedule', 'completed');
                this.updateTimelineStep('add-subtype', 'current');
                this.showMessage('班表驗證完成！所有項目均通過！', 'success');
                //打開工作內容安排按鈕
                SubtypeBtn.disabled=false;
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
        const rows = tbody.querySelectorAll('tr:not(.shift-subtype-row)');
        
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
     * 提取整個 employees-table（包含子班別列）的資料
     * 產出格式：[{ employee_name, employee_id, work_date, shift_type, shift_subtype }]
     */
    extractFullScheduleWithSubtype() {
        const table = this.container.querySelector('.employees-table');
        if (!table) return [];

        const tbody = table.querySelector('tbody');
        if (!tbody) return [];

        // 建立姓名對 employee_id 的對照
        const nameToId = new Map();
        if (Array.isArray(this.members)) {
            this.members.forEach(m => {
                nameToId.set(m.snapshot_name, m.employee_id);
            });
        }

        const results = [];
        const rows = Array.from(tbody.querySelectorAll('tr'));
        for (let i = 0; i < rows.length; i++) {
            const mainRow = rows[i];
            if (mainRow.classList.contains('shift-subtype-row')) continue;

            const nameCell = mainRow.querySelector('td:first-child');
            if (!nameCell) continue;
            const employeeName = nameCell.textContent.trim();
            const employeeId = nameToId.get(employeeName) || null;

            // 找到對應的 subtype row（下一列且有 class）
            let subRow = null;
            if (i + 1 < rows.length && rows[i + 1].classList.contains('shift-subtype-row')) {
                subRow = rows[i + 1];
            }

            const mainCells = mainRow.querySelectorAll('td');
            const subCells = subRow ? subRow.querySelectorAll('td') : [];

            // 從第二個儲存格開始（第一格是姓名）
            for (let c = 1; c < mainCells.length; c++) {
                const shiftCell = mainCells[c];
                const subCell = subCells[c - 1];

                const dateStr = shiftCell.dataset.date;
                if (!dateStr) continue;

                // 判斷班別類型 A/B/C/O 以樣式為準
                let shiftType = 'O';
                if (shiftCell.classList.contains('morning-shift')) shiftType = 'A';
                else if (shiftCell.classList.contains('afternoon-shift')) shiftType = 'B';
                else if (shiftCell.classList.contains('night-shift')) shiftType = 'C';
                else if (shiftCell.classList.contains('day-off') ||
                         shiftCell.classList.contains('leave-high') ||
                         shiftCell.classList.contains('leave-low') ||
                         shiftCell.classList.contains('leave-special')) shiftType = 'O';

                const shiftSubtype = subCell ? (subCell.textContent || '').trim() : '';

                results.push({
                    employee_name: employeeName,
                    employee_id: employeeId,
                    work_date: dateStr,
                    shift_type: shiftType,
                    shift_subtype: shiftSubtype
                });
            }

            // 跳過已處理的 subRow
            if (subRow) i += 1;
        }

        return results;
    }

    /**
     * 上傳/發佈班表到後端
     */
    async uploadSchedule() {
        try {
            const cycleId = this.cycleData?.cycle_id;
            if (!cycleId) {
                this.showMessage('缺少 cycle_id', 'error');
                return;
            }

            // 取得完整表格資料
            const payloadRows = this.extractFullScheduleWithSubtype();
            if (!payloadRows.length) {
                this.showMessage('沒有可上傳的班表資料', 'info');
                return;
            }

            // 驗證 employee_id 是否齊全
            const missingId = payloadRows.some(r => !r.employee_id);
            if (missingId) {
                this.showMessage('有員工缺少 employee_id 對應，請確認成員資料是否正確載入', 'error');
                return;
            }

            // 傳送到後端
            const resp = await fetch('/api/employee-schedules/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cycle_id: cycleId, rows: payloadRows })
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
                throw new Error(err.error || `HTTP ${resp.status}`);
            }

            const result = await resp.json();
            this.showMessage(`上傳成功！共處理 ${result.count || 0} 筆`, 'success');

            // 1) 通知後端將該週期狀態更新為 finished
            try {
                await fetch('/api/schedule-cycles/finish', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cycle_id: cycleId })
                });
            } catch (e) {
                console.warn('更新週期狀態為 finished 失敗：', e);
            }

            // 2) 重新載入 draft 班表
            if (window.loadDraftCycles) {
                window.loadDraftCycles();
            }
        } catch (e) {
            console.error('上傳班表失敗:', e);
            this.showMessage(`上傳失敗：${e.message}`, 'error');
        }
    }

    /**
     * 更新subtype到employees-table
     * @param {Object} result - 驗證結果
     */
    /**
     * 進入工作內容安排模式
     */
    async AddSubtypeMode() {
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
            
            // 重置已使用的班別記錄
            this.resetUsedShifts();
            
            // 更新現有的 employees-table 結構
            this.updateEmployeesTableForSubtypeMode();
            this.isSubtypeMode = true;
            
            // 鎖定employees-table點擊功能
            this.removeClickEventListeners();
            // 更新時間軸狀態
            this.updateTimelineStep('add-subtype', 'completed');
            this.updateTimelineStep('complete', 'current');
            
            this.showMessage('工作內容安排完成', 'success');
            const UploadBtn = this.container.querySelector('.shift-upload-btn');
            UploadBtn.disabled=false;
        } catch (error) {
            console.error('進入工作內容安排模式時發生錯誤:', error);
            this.showMessage(`無法載入班別群組資料: ${error.message}`, 'error');
        }
    }

    /**
     * 重置已使用的班別記錄
     */
    resetUsedShifts() {
        if (this.usedShifts) {
            this.usedShifts.clear();
        }
        this.usedShifts = new Map();
    }

    /**
     * 更新 employees-table 為工作內容安排模式
     */
    updateEmployeesTableForSubtypeMode() {
        const table = this.container.querySelector('.employees-table');
        if (!table) {
            console.error('找不到員工班表元素');
            return;
        }

        // 驗證 API 資料格式
        if (!this.shiftGroupData || typeof this.shiftGroupData !== 'object') {
            console.error('班別群組資料格式錯誤');
            this.showMessage('班別群組資料格式錯誤', 'error');
            return;
        }

        // 檢查是否有必要的資料
        const hasValidData = Object.keys(this.shiftGroupData).some(key => {
            const shifts = this.shiftGroupData[key];
            return Array.isArray(shifts) && shifts.length > 0;
        });

        if (!hasValidData) {
            console.error('沒有有效的班別群組資料');
            this.showMessage('沒有有效的班別群組資料', 'error');
            return;
        }

        const thead = table.querySelector('thead tr');
        const tbody = table.querySelector('tbody');

        // 1. 更新表頭：員工姓名欄位跨越兩列
        const nameHeader = thead.querySelector('th:first-child');
        if (nameHeader) {
            nameHeader.rowSpan = 2;
        }

                    // 2. 為每個員工行添加子班別行
        // 先清除既有的子班別行，確保重新建立
        const existingSubtypeRows = tbody.querySelectorAll('tr.shift-subtype-row');
        existingSubtypeRows.forEach(r => r.remove());

        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, rowIndex) => {
            // 為每個員工行創建對應的子班別行
            const subRow = document.createElement('tr');
            subRow.className = 'shift-subtype-row';
            
            // 如果遇到子班別行（理論上已被清除），直接跳過
            if (row.classList.contains('shift-subtype-row')) {
                return;
            }

            // 獲取員工姓名儲存格並設置 rowspan=2
            const nameCell = row.querySelector('td:first-child');
            if (nameCell) {
                nameCell.rowSpan = 2;
                nameCell.classList.add('employee-name-cell');
            }

            // 為每個班別儲存格創建對應的子班別儲存格
            const shiftCells = row.querySelectorAll('.shift-cell');
            shiftCells.forEach((shiftCell, cellIndex) => {
                const subCell = document.createElement('td');
                subCell.className = 'shift-sub-cell';
                subCell.setAttribute('data-date', shiftCell.dataset.date || '');
                
                // 如果是週末，加上 weekend 樣式
                const dateStr = shiftCell.dataset.date;
                if (dateStr) {
                    const date = new Date(dateStr);
                    const weekday = date.getDay();
                    // 如果是週末，加上 weekend 樣式
                    if (weekday === 0 || weekday === 6) {
                        subCell.classList.add('weekend');
                    }
                }
                
                subRow.appendChild(subCell);
            });
            
            // 在當前行之後插入子班別行
            row.after(subRow);
        });
        
        // 3. 使用新的子函式重新映射並更新所有班別儲存格內容
        this.updateAllShiftCellsContent();
        
        // 重新綁定點擊事件（因為表格結構已改變）
        // this.addClickEventListeners();
        
        // console.log('已成功更新表格為工作內容安排模式');
    }

    /**
     * 更新班別儲存格和子班別儲存格的內容
     * @param {HTMLElement} shiftCell - 主要班別儲存格
     * @param {HTMLElement} subCell - 子班別儲存格
     * @param {number} apiIndex - API 資料的索引
     */
    updateShiftCellContent(shiftCell, subCell, apiIndex) {
        if (!this.shiftGroupData || !this.shiftGroupData[apiIndex]) {
            console.warn(`找不到索引 ${apiIndex} 的班別群組資料`);
            return;
        }

        const shifts = this.shiftGroupData[apiIndex];
        if (!Array.isArray(shifts) || shifts.length === 0) {
            console.warn(`索引 ${apiIndex} 的班別資料為空或格式錯誤`);
            return;
        }

        const cellText = shiftCell.textContent.trim();
        console.log(`更新儲存格內容，索引: ${apiIndex}, 班別數量: ${shifts.length}`);
        
        // 根據班別類型隨機選擇對應的 shift_group 元素
        if (shiftCell.classList.contains('morning-shift')) {
            // 早班：選擇 shift_group="day" 的元素
            const dayShifts = shifts.filter(s => s.shift_group === 'day');
            console.log(`早班選項:`, dayShifts);
            if (dayShifts.length > 0) {
                // 隨機選擇一個不重複的早班
                const randomDayShift = this.getRandomUnusedShift(dayShifts, 'day');
                if (randomDayShift) {
                    shiftCell.textContent = randomDayShift.shift_name;
                    subCell.textContent = randomDayShift.shift_subname;
                    subCell.classList.add('morning-shift');
                    // console.log(`已選擇早班: ${randomDayShift.shift_name}-${randomDayShift.shift_subname}`);
                }
            }
        } else if (shiftCell.classList.contains('afternoon-shift')) {
            // 中班：選擇 shift_group="evening" 的元素
            const eveningShifts = shifts.filter(s => s.shift_group === 'evening');
            console.log(`中班選項:`, eveningShifts);
            if (eveningShifts.length > 0) {
                // 隨機選擇一個不重複的中班
                const randomEveningShift = this.getRandomUnusedShift(eveningShifts, 'evening');
                if (randomEveningShift) {
                    shiftCell.textContent = randomEveningShift.shift_name;
                    subCell.textContent = randomEveningShift.shift_subname;
                    subCell.classList.add('afternoon-shift');
                    // console.log(`已選擇中班: ${randomEveningShift.shift_name}-${randomEveningShift.shift_subname}`);
                }
            }
        } else if (shiftCell.classList.contains('night-shift')) {
            // 晚班：選擇 shift_group="night" 的元素
            const nightShifts = shifts.filter(s => s.shift_group === 'night');
            console.log(`晚班選項:`, nightShifts);
            if (nightShifts.length > 0) {
                // 隨機選擇一個不重複的晚班
                const randomNightShift = this.getRandomUnusedShift(nightShifts, 'night');
                if (randomNightShift) {
                    shiftCell.textContent = randomNightShift.shift_name;
                    subCell.textContent = randomNightShift.shift_subname;
                    subCell.classList.add('night-shift');
                    // console.log(`已選擇晚班: ${randomNightShift.shift_name}-${randomNightShift.shift_subname}`);
                }
            }
        } else if (shiftCell.classList.contains('day-off') || 
                   shiftCell.classList.contains('leave-high') || 
                   shiftCell.classList.contains('leave-low') || 
                   shiftCell.classList.contains('leave-special')) {
            // 休假：保持原有內容，子班別為空
            subCell.textContent = '';
            // console.log(`休假儲存格，保持原有內容`);
        } else {
            console.log(`未知的班別類型，儲存格內容: ${cellText}`);
        }
    }

    /**
     * 根據日期重新映射並更新所有班別儲存格內容
     * 這個函式會按日期來組織迴圈，因為 API 資料是按星期來區分的
     */
    updateAllShiftCellsContent() {
        if (!this.shiftGroupData) {
            console.warn('班別群組資料尚未載入');
            return;
        }

        console.log('開始重新映射所有班別儲存格內容...');

        // 獲取所有班別儲存格，按日期分組
        const allShiftCells = this.container.querySelectorAll('.employees-table tbody tr:not(.shift-subtype-row) .shift-cell');
        const allSubCells = this.container.querySelectorAll('.employees-table tbody tr.shift-subtype-row .shift-sub-cell');

        if (allShiftCells.length !== allSubCells.length) {
            console.warn('班別儲存格數量與子班別儲存格數量不匹配');
            return;
        }

        // 按日期分組儲存格
        const cellsByDate = new Map(); // Map<dateStr, {shiftCells: [], subCells: []}>

        // 將儲存格按日期分組
        allShiftCells.forEach((shiftCell, index) => {
            const subCell = allSubCells[index];
            const dateStr = shiftCell.dataset.date;

            if (!dateStr) {
                console.warn(`班別儲存格 ${index} 缺少 data-date 屬性`);
                return;
            }

            if (!cellsByDate.has(dateStr)) {
                cellsByDate.set(dateStr, { shiftCells: [], subCells: [] });
            }

            cellsByDate.get(dateStr).shiftCells.push(shiftCell);
            cellsByDate.get(dateStr).subCells.push(subCell);
        });

        // 按日期順序處理每個日期的儲存格
        const sortedDates = Array.from(cellsByDate.keys()).sort();
        
        sortedDates.forEach(dateStr => {
            const dateCells = cellsByDate.get(dateStr);
            const apiIndex = this.calculateApiIndexFromDate(dateStr);
            
            console.log(`處理日期: ${dateStr}, API索引: ${apiIndex}, 儲存格數量: ${dateCells.shiftCells.length}`);
            
            // 批次處理該日期的所有儲存格
            this.updateShiftCellsByDate(dateCells.shiftCells, dateCells.subCells, apiIndex);
        });

        console.log('所有班別儲存格內容更新完成');
    }

    /**
     * 根據日期字串計算 API 索引
     * @param {string} dateStr - 日期字串 (YYYY-MM-DD 格式)
     * @returns {number} API 索引 (0=週一, 1=週二, ..., 5=週六, 6=週日)
     */
    calculateApiIndexFromDate(dateStr) {
        const date = new Date(dateStr);
        const weekday = date.getDay();
        
        // 轉換為 API 的索引格式 (0=週一, 6=週日)
        // JavaScript 的 getDay() 返回 0=週日, 1=週一, ..., 6=週六
        // API 的索引是 0=週一, 1=週二, ..., 5=週六, 6=週日
        let apiIndex;
        if (weekday === 0) { // 週日
            apiIndex = 6;
        } else if (weekday === 6) { // 週六
            apiIndex = 5;
        } else {
            apiIndex = weekday - 1; // 週一到週五：1->0, 2->1, 3->2, 4->3, 5->4
        }
        
        return apiIndex;
    }

    /**
     * 批次處理某個日期的所有班別儲存格
     * @param {Array} shiftCells - 該日期的所有班別儲存格
     * @param {Array} subCells - 該日期的所有子班別儲存格
     * @param {number} apiIndex - API 資料的索引
     */
    updateShiftCellsByDate(shiftCells, subCells, apiIndex) {
        if (!this.shiftGroupData || !this.shiftGroupData[apiIndex]) {
            console.warn(`找不到索引 ${apiIndex} 的班別群組資料`);
            return;
        }

        const shifts = this.shiftGroupData[apiIndex];
        if (!Array.isArray(shifts) || shifts.length === 0) {
            console.warn(`索引 ${apiIndex} 的班別資料為空或格式錯誤`);
            return;
        }

        console.log(`批次處理日期，API索引: ${apiIndex}, 班別數量: ${shifts.length}`);

        // 1. 排除休假儲存格，分類 A/B/C 班別
        const workCells = [];
        const leaveCells = [];

        shiftCells.forEach((shiftCell, index) => {
            const subCell = subCells[index];
            
            if (shiftCell.classList.contains('day-off') || 
                shiftCell.classList.contains('leave-high') || 
                shiftCell.classList.contains('leave-low') || 
                shiftCell.classList.contains('leave-special')) {
                // 休假儲存格
                leaveCells.push({ shiftCell, subCell });
            } else {
                // 工作儲存格
                workCells.push({ shiftCell, subCell });
            }
        });

        // 2. 統計 A/B/C 班別數量
        const shiftCounts = {
            morning: 0,  // A班
            afternoon: 0, // B班
            night: 0      // C班
        };

        workCells.forEach(({ shiftCell }) => {
            if (shiftCell.classList.contains('morning-shift')) {
                shiftCounts.morning++;
            } else if (shiftCell.classList.contains('afternoon-shift')) {
                shiftCounts.afternoon++;
            } else if (shiftCell.classList.contains('night-shift')) {
                shiftCounts.night++;
            }
        });

        console.log(`班別統計 - A班: ${shiftCounts.morning}, B班: ${shiftCounts.afternoon}, C班: ${shiftCounts.night}`);

        // 3. 檢查 API 資料是否足夠
        const apiShiftCounts = {
            day: shifts.filter(s => s.shift_group === 'day').length,
            evening: shifts.filter(s => s.shift_group === 'evening').length,
            night: shifts.filter(s => s.shift_group === 'night').length
        };

        console.log(`API資料統計 - day: ${apiShiftCounts.day}, evening: ${apiShiftCounts.evening}, night: ${apiShiftCounts.night}`);

        // 4. 檢查數量是否匹配
        if (shiftCounts.morning > apiShiftCounts.day) {
            console.warn(`A班數量 (${shiftCounts.morning}) 超過 API day 群組數量 (${apiShiftCounts.day})`);
        }
        if (shiftCounts.afternoon > apiShiftCounts.evening) {
            console.warn(`B班數量 (${shiftCounts.afternoon}) 超過 API evening 群組數量 (${apiShiftCounts.evening})`);
        }
        if (shiftCounts.night > apiShiftCounts.night) {
            console.warn(`C班數量 (${shiftCounts.night}) 超過 API night 群組數量 (${apiShiftCounts.night})`);
        }

        // 5. 分配班別
        this.assignShiftsToCells(workCells, shifts, shiftCounts);

        // 6. 處理休假儲存格
        leaveCells.forEach(({ subCell }) => {
            subCell.textContent = '';
        });

        console.log(`批次處理完成 - 工作儲存格: ${workCells.length}, 休假儲存格: ${leaveCells.length}`);
    }

    /**
     * 分配班別到儲存格
     * @param {Array} workCells - 工作儲存格陣列
     * @param {Array} shifts - API 班別資料
     * @param {Object} shiftCounts - 班別數量統計
     */
    assignShiftsToCells(workCells, shifts, shiftCounts) {
        // 按班別類型分組 API 資料
        const dayShifts = shifts.filter(s => s.shift_group === 'day');
        const eveningShifts = shifts.filter(s => s.shift_group === 'evening');
        const nightShifts = shifts.filter(s => s.shift_group === 'night');

        // 按班別類型分組儲存格
        const morningCells = workCells.filter(({ shiftCell }) => shiftCell.classList.contains('morning-shift'));
        const afternoonCells = workCells.filter(({ shiftCell }) => shiftCell.classList.contains('afternoon-shift'));
        const nightCells = workCells.filter(({ shiftCell }) => shiftCell.classList.contains('night-shift'));

        // 分配 A 班
        this.assignShiftsToCellGroup(morningCells, dayShifts, 'morning-shift');

        // 分配 B 班
        this.assignShiftsToCellGroup(afternoonCells, eveningShifts, 'afternoon-shift');

        // 分配 C 班
        this.assignShiftsToCellGroup(nightCells, nightShifts, 'night-shift');
    }

    /**
     * 分配班別到特定群組的儲存格
     * @param {Array} cells - 儲存格陣列
     * @param {Array} shifts - 班別資料陣列
     * @param {string} shiftClass - 班別 CSS 類別
     */
    assignShiftsToCellGroup(cells, shifts, shiftClass) {
        if (cells.length === 0 || shifts.length === 0) {
            return;
        }

        // 如果儲存格數量等於班別數量，隨機分配
        if (cells.length === shifts.length) {
            // 隨機打亂班別順序
            const shuffledShifts = [...shifts].sort(() => Math.random() - 0.5);
            
            cells.forEach(({ shiftCell, subCell }, index) => {
                const shift = shuffledShifts[index];
                shiftCell.textContent = shift.shift_name;
                subCell.textContent = shift.shift_subname;
                subCell.classList.add(shiftClass);
            });
            
            console.log(`隨機分配 ${shiftClass} 班別完成，數量: ${cells.length}`);
        } else {
            // 數量不匹配，使用原有的隨機選擇邏輯
            cells.forEach(({ shiftCell, subCell }) => {
                const randomShift = this.getRandomUnusedShift(shifts, shiftClass);
                if (randomShift) {
                    shiftCell.textContent = randomShift.shift_name;
                    subCell.textContent = randomShift.shift_subname;
                    subCell.classList.add(shiftClass);
                }
            });
            
            console.log(`使用隨機選擇邏輯分配 ${shiftClass} 班別，數量: ${cells.length}`);
        }
    }

    /**
     * 獲取隨機且不重複的班別
     * @param {Array} shifts - 班別陣列
     * @param {string} shiftGroup - 班別群組
     * @returns {Object|null} 選中的班別物件
     */
    getRandomUnusedShift(shifts, shiftGroup) {
        if (!shifts || shifts.length === 0) {
            return null;
        }
        
        // 如果沒有追蹤已使用的班別，初始化
        if (!this.usedShifts) {
            this.usedShifts = new Map();
        }
        
        // 使用週期 ID 和班別群組作為鍵值，確保每個週期都有獨立的追蹤
        const cycleId = this.cycleData.cycle_id;
        const key = `${cycleId}_${shiftGroup}`;
        
        // 獲取已使用的班別
        let usedShifts = this.usedShifts.get(key) || new Set();
        
        // 找出未使用的班別
        const availableShifts = shifts.filter(shift => {
            const shiftKey = `${shift.shift_name}_${shift.shift_subname}`;
            return !usedShifts.has(shiftKey);
        });
        
        // 如果沒有可用的班別，重置已使用記錄
        if (availableShifts.length === 0) {
            usedShifts.clear();
            this.usedShifts.set(key, usedShifts);
            console.log(`重置 ${shiftGroup} 班別的已使用記錄`);
            return shifts[0]; // 返回第一個班別
        }
        
        // 隨機選擇一個未使用的班別
        const randomIndex = Math.floor(Math.random() * availableShifts.length);
        const selectedShift = availableShifts[randomIndex];
        
        // 標記為已使用
        const shiftKey = `${selectedShift.shift_name}_${selectedShift.shift_subname}`;
        usedShifts.add(shiftKey);
        this.usedShifts.set(key, usedShifts);
        
        console.log(`選擇 ${shiftGroup} 班別: ${shiftKey}, 剩餘可用: ${availableShifts.length - 1}`);
        
        return selectedShift;
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
    
     /**
     * 刪除週期功能
     */
     async deleteCycle() {
       
        const cycleId = this.cycleData.cycle_id;
        
        // 1. 顯示 Bootstrap Modal 確認視窗
        const confirmed = await this.showDeleteConfirmationModal(cycleId);
        
        if (!confirmed) {
            return; // 用戶取消刪除
        }
        
        // 2. 顯示載入狀態
        this.showLoadingOverlay('正在刪除週期...');
        
        try {
            console.log(`開始刪除週期 #${cycleId}...`);
            
            // 3. 呼叫後端 API 刪除週期
            const response = await fetch(`/api/schedule-cycles/${cycleId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '刪除週期失敗');
            }
            
            const result = await response.json();
            console.log('刪除週期成功:', result);
            
            // 4. 隱藏載入狀態
            this.hideLoadingOverlay();
            
            // 5. 顯示成功 toast 提示
            this.showMessage(`刪除週期 #${cycleId}成功!`);
            
            // 6. 延遲一下再返回月曆模式，讓用戶看到成功訊息
            setTimeout(() => {
                this.returnToCalendarMode();
            }, 100);
            
        } catch (error) {
            console.error('刪除週期時發生錯誤:', error);
            this.hideLoadingOverlay();
            this.showMessage(`刪除週期失敗: ${error.message}`, 'error');
        }
    }

    /**
     * 顯示刪除確認 Modal
     * @param {number} cycleId - 週期 ID
     * @returns {Promise<boolean>} 用戶是否確認刪除
     */
    showDeleteConfirmationModal(cycleId) {
        return new Promise((resolve) => {
            // 創建 Modal HTML
            const modalHtml = `
                <div class="modal fade" id="deleteCycleModal" tabindex="-1" aria-labelledby="deleteCycleModalLabel" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="deleteCycleModalLabel">確認刪除週期</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <p>您確定要刪除週期 #${cycleId} 嗎？</p>
                                <p class="text-danger">
                                    <strong>警告：</strong>此操作將永久刪除此週期的所有資料，包括：
                                </p>
                                <ul class="text-danger">
                                    <li>週期基本資訊</li>
                                    <li>所有休假安排</li>
                                    <li>員工班別需求</li>
                                </ul>
                                <p class="text-danger"><strong>此操作無法復原！</strong></p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                                <button type="button" class="btn btn-danger" id="confirmDeleteBtn">確定刪除</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // 添加到頁面
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            const modal = document.getElementById('deleteCycleModal');
            const confirmBtn = document.getElementById('confirmDeleteBtn');
            
            // 創建 Bootstrap Modal 實例
            const bsModal = new bootstrap.Modal(modal);
            
            // 綁定確認按鈕事件
            confirmBtn.addEventListener('click', () => {
                bsModal.hide();
                resolve(true);
            });
            
            // 綁定 Modal 關閉事件
            modal.addEventListener('hidden.bs.modal', () => {
                bsModal.hide();
                resolve(false);
            });
            
            // 顯示 Modal
            bsModal.show();
        });
    }

    /**
     * 返回月曆模式
     */
    returnToCalendarMode() {
        // 先重新載入 draft 班表
        if (window.loadDraftCycles) {
            window.loadDraftCycles();
        }
        
        // 檢查是否有 modeSwitcher 實例
        if (window.modeSwitcher) {
            // 先切換到月曆模式
            window.modeSwitcher.switchToMode('calendar');
            
            // 確保月曆被正確初始化
            setTimeout(() => {
                if (window.initCalendar) {
                    window.initCalendar();
                }
            }, 450); // 等待 hideCurrentMode 的動畫完成 (400ms) + 一些緩衝時間
        } else {
            // 備用方案：直接重新載入頁面
            console.warn('找不到 modeSwitcher 實例，重新載入頁面');
            window.location.reload();
        }
    }

}

// 建立全域實例，方便從其他 script 檔案呼叫
if (!window.tempScheduleMode) {
    window.tempScheduleMode = new TempScheduleMode();
} 