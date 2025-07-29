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
        
        // 儲存每個員工每天的休假狀態
        this.leaveData = new Map(); // 格式: Map<"employeeName_date", {state: number, weight: number}>
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
                    <button type="button" class="verify-shift-btn" onclick="">驗證班表</button>
                </div>
                <textarea id="verifycomment" placeholder="點擊右上角驗證按鈕開始驗證...&#10;自動驗證是否符合以下情況&#10;1. 每日上班人數&#10;2. 連續上班天數&#10;3. 班別銜接"></textarea>
            </div>

            <div class="temp-schedule-bottom">
                <div class="temp-schedule-require">
                    <h3>員工班別</h3>
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

        // 插入到 .temp-schedule-require-table div 中
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

        // 自動排班按鈕（預留功能）
        const autoScheduleBtn = this.container.querySelector('.btn-auto-schedule');
        if (autoScheduleBtn) {
            autoScheduleBtn.addEventListener('click', () => {
                console.log('自動排班功能待實作');
                // TODO: 實作自動排班邏輯
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
        
        console.log(`員工 ${employeeName} 在 ${date} 的休假狀態已更新為: ${nextState.text} (權重: ${nextState.weight})`);
    }

    /**
     * 更新儲存格的視覺顯示
     * @param {HTMLElement} cell - 要更新的儲存格
     * @param {Object} state - 休假狀態物件
     */
    updateCellDisplay(cell, state) {
        // 清除所有可能的休假樣式類別
        cell.classList.remove('leave-high', 'leave-low', 'leave-special');
        
        // 設置文字內容
        cell.textContent = state.text;
        
        // 添加對應的樣式類別
        if (state.class) {
            cell.classList.add(state.class);
        }
        
        // 如果沒有休假狀態，清除所有樣式
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
        
        console.log('已清除所有休假標記');
    }

    // 新增：移除 loading 畫面
    hideLoading() {
        const tbody = this.container.querySelector('.employees-table tbody');
        if (tbody) {
            const loadingRow = tbody.querySelector('.loading-row');
            if (loadingRow) loadingRow.remove();
        }
    }
}

// 建立全域實例，方便從其他 script 檔案呼叫
if (!window.tempScheduleMode) {
    window.tempScheduleMode = new TempScheduleMode();
} 