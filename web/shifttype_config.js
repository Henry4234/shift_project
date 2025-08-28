// 班別類型設定管理模組
class ShiftTypeConfigManager {
    constructor() {
        this.container = document.querySelector('nav.content');
        this.shiftTypes = [];
        this.shiftGroups = []; // 新增：班別群組資料
        this.currentEditId = null;
        this.currentEditGroupId = null; // 新增：當前編輯的群組 ID
    }

    // 顯示班別設定模式
    show() {
        this.renderShiftTypeConfigPanel();
        this.loadShiftTypes();
        this.loadShiftGroups(); // 新增：載入班別群組資料
    }

    // 渲染班別設定面板
    renderShiftTypeConfigPanel() {
        this.container.innerHTML = `
            <div class="shift-config-mode">
                <div class="shift-config-header">
                    <h3><i class='bx bx-spreadsheet'></i> 班別類型設定</h3>
                    <button class="btn btn-primary" id="addShiftTypeBtn">
                        <i class='bx bx-plus'></i> 新增班別
                    </button>
                </div>
                
                <div class="shift-config-content">
                    <div class="loading-spinner" id="loadingSpinner">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">載入中...</span>
                        </div>
                        <p>載入班別資料中...</p>
                    </div>
                    
                    <div class="shift-types-table-container" id="shiftTypesTableContainer" style="display: none;">
                        <table class="shift-types-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>班別名稱</th>
                                    <th>副名稱</th>
                                    <th>班別分組</th>
                                    <th>開始時間</th>
                                    <th>結束時間</th>
                                    <th>建立時間</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody id="shiftTypesTableBody">
                                <!-- 班別資料將動態載入於此 -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- 新增：班別群組設定 -->
            <div class="shift-group-config-mode">
                <div class="shift-group-config-header">
                    <h3><i class='bx bx-group'></i> 班別群組設定</h3>
                    <button class="btn btn-primary" id="addShiftGroupBtn">
                        <i class='bx bx-plus'></i> 新增群組
                    </button>
                </div>
                
                <div class="shift-group-config-content">
                    <div class="loading-spinner" id="groupLoadingSpinner">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">載入中...</span>
                        </div>
                        <p>載入群組資料中...</p>
                    </div>
                    
                    <div class="shift-groups-container" id="shiftGroupsContainer" style="display: none;">
                        <!-- 群組資料將動態載入於此 -->
                    </div>
                </div>
            </div>
        `;

        // 綁定事件
        this.bindEvents();
    }

    // 綁定事件
    bindEvents() {
        // 新增班別按鈕
        document.getElementById('addShiftTypeBtn').addEventListener('click', () => {
            this.showShiftTypeModal();
        });

        // 新增：新增群組按鈕
        document.getElementById('addShiftGroupBtn').addEventListener('click', () => {
            this.showShiftGroupModal();
        });

        // 使用事件委派處理表格內的按鈕
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-shift-btn')) {
                const shiftId = e.target.dataset.shiftId;
                this.editShiftType(shiftId);
            } else if (e.target.classList.contains('delete-shift-btn')) {
                const shiftId = e.target.dataset.shiftId;
                this.deleteShiftType(shiftId);
            } else if (e.target.classList.contains('edit-group-btn')) {
                // 新增：編輯群組按鈕
                const groupId = e.target.dataset.groupId;
                this.editShiftGroup(groupId);
            } else if (e.target.classList.contains('delete-group-btn')) {
                // 新增：刪除群組按鈕
                const groupId = e.target.dataset.groupId;
                this.deleteShiftGroup(groupId);
            } else if (e.target.classList.contains('group-header')) {
                // 新增：群組標題點擊展開/收合
                const groupId = e.target.dataset.groupId;
                this.toggleGroupExpansion(groupId);
            } else if (e.target.classList.contains('edit-group-item-btn')) {
                // 新增：編輯個別群組項目
                const uuid = e.target.dataset.uuid;
                this.editShiftGroupItem(uuid);
            } else if (e.target.classList.contains('delete-group-item-btn')) {
                // 新增：刪除個別群組項目
                const uuid = e.target.dataset.uuid;
                this.deleteShiftGroupItem(uuid);
            }
        });
    }

    // 載入班別類型資料
    async loadShiftTypes() {
        try {
            const response = await fetch('/api/shift-types');
            if (!response.ok) {
                throw new Error('無法載入班別類型資料');
            }
            
            this.shiftTypes = await response.json();
            this.renderShiftTypesTable();
            
            // 隱藏載入動畫，顯示表格
            document.getElementById('loadingSpinner').style.display = 'none';
            document.getElementById('shiftTypesTableContainer').style.display = 'block';
            
        } catch (error) {
            console.error('載入班別類型資料時發生錯誤：', error);
            this.showMessage('載入班別類型資料失敗', 'error');
        }
    }

    // 渲染班別類型表格
    renderShiftTypesTable() {
        const tbody = document.getElementById('shiftTypesTableBody');
        tbody.innerHTML = '';

        if (this.shiftTypes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted">
                        目前沒有任何班別類型，請點擊「新增班別」按鈕來新增
                    </td>
                </tr>
            `;
            return;
        }

        this.shiftTypes.forEach(shiftType => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${shiftType.id}</td>
                <td>${shiftType.shift_name}</td>
                <td>${shiftType.shift_subname}</td>
                <td>${this.mapGroupDbToLabel(shiftType.shift_group)}</td>
                <td>${this.formatTime(shiftType.start_time)}</td>
                <td>${this.formatTime(shiftType.end_time)}</td>
                <td>${this.formatDateTime(shiftType.created_at)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary edit-shift-btn" data-shift-id="${shiftType.id}">
                        <i class='bx bx-edit-alt'></i> 編輯
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-shift-btn" data-shift-id="${shiftType.id}">
                        <i class='bx bx-trash'></i> 刪除
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // 顯示班別類型編輯/新增 Modal
    showShiftTypeModal(shiftType = null) {
        const isEdit = shiftType !== null;
        this.currentEditId = isEdit ? shiftType.id : null;

        const modalHTML = `
            <div class="modal fade" id="shiftTypeModal" tabindex="-1" aria-labelledby="shiftTypeModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <i class='bx bx-spreadsheet'></i>
                            <h5 class="modal-title" id="shiftTypeModalLabel">
                                ${isEdit ? '編輯班別類型' : '新增班別類型'}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="shiftTypeForm">
                                <div class="mb-3">
                                    <label for="shiftName" class="form-label">班別名稱 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="shiftName" required 
                                           value="${isEdit ? shiftType.shift_name : ''}" 
                                           placeholder="例如：A/B/C班">
                                </div>
                                
                                <div class="mb-3">
                                    <label for="shiftSubname" class="form-label">副名稱 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="shiftSubname" required 
                                           value="${isEdit ? shiftType.shift_subname : ''}" 
                                           placeholder="例如：1,2,3">
                                </div>
                                
                                <div class="mb-3">
                                    <label for="shiftGroup" class="form-label">班別分組</label>
                                    <select class="form-control" id="shiftGroup">
                                        <option value="">請選擇分組</option>
                                        <option value="day" ${isEdit && shiftType.shift_group === 'day' ? 'selected' : ''}>白班</option>
                                        <option value="evening" ${isEdit && shiftType.shift_group === 'evening' ? 'selected' : ''}>小夜</option>
                                        <option value="night" ${isEdit && shiftType.shift_group === 'night' ? 'selected' : ''}>大夜</option>
                                    </select>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="startTime" class="form-label">開始時間 <span class="text-danger">*</span></label>
                                            <div class="d-flex">
                                                <select class="form-control me-2" id="startHour" required>
                                                    ${this.generateHourOptions(isEdit ? this.getHourFromTime(shiftType.start_time) : '')}
                                                </select>
                                                <span class="align-self-center me-2">:</span>
                                                <select class="form-control" id="startMinute" required>
                                                    ${this.generateMinuteOptions(isEdit ? this.getMinuteFromTime(shiftType.start_time) : '')}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="endTime" class="form-label">結束時間 <span class="text-danger">*</span></label>
                                            <div class="d-flex">
                                                <select class="form-control me-2" id="endHour" required>
                                                    ${this.generateHourOptions(isEdit ? this.getHourFromTime(shiftType.end_time) : '')}
                                                </select>
                                                <span class="align-self-center me-2">:</span>
                                                <select class="form-control" id="endMinute" required>
                                                    ${this.generateMinuteOptions(isEdit ? this.getMinuteFromTime(shiftType.end_time) : '')}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" id="saveShiftTypeBtn">
                                ${isEdit ? '更新' : '新增'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 移除舊的 Modal（如果存在）
        const existingModal = document.getElementById('shiftTypeModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新的 Modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 初始化 Modal
        const modal = new bootstrap.Modal(document.getElementById('shiftTypeModal'));
        modal.show();

        // 綁定儲存按鈕事件
        document.getElementById('saveShiftTypeBtn').addEventListener('click', () => {
            this.saveShiftType();
        });

        // Modal 關閉時清理
        document.getElementById('shiftTypeModal').addEventListener('hidden.bs.modal', () => {
            this.currentEditId = null;
        });
    }

    // 儲存班別類型
    async saveShiftType() {
        const form = document.getElementById('shiftTypeForm');
        
        // 組合時間格式 (HH:MM)
        const startHour = document.getElementById('startHour').value.padStart(2, '0');
        const startMinute = document.getElementById('startMinute').value.padStart(2, '0');
        const endHour = document.getElementById('endHour').value.padStart(2, '0');
        const endMinute = document.getElementById('endMinute').value.padStart(2, '0');
        
        const formData = {
            shift_name: document.getElementById('shiftName').value.trim(),
            shift_subname: document.getElementById('shiftSubname').value.trim(),
            // 直接送出 day/evening/night（選單 value 即為資料庫值）
            shift_group: document.getElementById('shiftGroup').value.trim(),
            start_time: `${startHour}:${startMinute}:00`,
            end_time: `${endHour}:${endMinute}:00`
        };

        // 驗證必填欄位
        if (!formData.shift_name || !formData.shift_subname || !formData.start_time || !formData.end_time) {
            this.showMessage('請填寫所有必填欄位', 'error');
            return;
        }

        try {
            const url = this.currentEditId 
                ? `/api/shift-types/${this.currentEditId}` 
                : '/api/shift-types';
            
            const method = this.currentEditId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '操作失敗');
            }

            const result = await response.json();
            
            // 關閉 Modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('shiftTypeModal'));
            modal.hide();

            // 重新載入資料
            await this.loadShiftTypes();

            this.showMessage(
                this.currentEditId ? '班別類型更新成功' : '班別類型新增成功', 
                'success'
            );

        } catch (error) {
            console.error('儲存班別類型時發生錯誤：', error);
            this.showMessage(error.message || '操作失敗', 'error');
        }
    }

    // 編輯班別類型
    editShiftType(shiftId) {
        const shiftType = this.shiftTypes.find(st => st.id == shiftId);
        if (shiftType) {
            this.showShiftTypeModal(shiftType);
        }
    }

    // 刪除班別類型
    async deleteShiftType(shiftId) {
        if (!confirm('確定要刪除這個班別類型嗎？此操作無法復原。')) {
            return;
        }

        try {
            const response = await fetch(`/api/shift-types/${shiftId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '刪除失敗');
            }

            // 重新載入資料
            await this.loadShiftTypes();
            this.showMessage('班別類型已刪除', 'success');

        } catch (error) {
            console.error('刪除班別類型時發生錯誤：', error);
            this.showMessage(error.message || '刪除失敗', 'error');
        }
    }

    // 將資料庫值轉中文顯示
    mapGroupDbToLabel(groupValue) {
        if (!groupValue) return '-';
        const map = { day: '白班', evening: '小夜', night: '大夜' };
        return map[groupValue] || groupValue;
    }

    // 格式化時間顯示
    formatTime(timeString) {
        if (!timeString) return '-';
        // 假設時間格式為 "HH:MM:SS" 或 "HH:MM:SS+00"
        return timeString.split('+')[0].substring(0, 5);
    }

    // 格式化時間用於 input
    formatTimeForInput(timeString) {
        if (!timeString) return '';
        return timeString.split('+')[0].substring(0, 5);
    }

    // 生成小時選項 (00-23)
    generateHourOptions(selectedHour = '') {
        let options = '<option value="">時</option>';
        for (let i = 0; i < 24; i++) {
            const hour = i.toString().padStart(2, '0');
            const selected = selectedHour === hour ? 'selected' : '';
            options += `<option value="${hour}" ${selected}>${hour}</option>`;
        }
        return options;
    }

    // 生成分鐘選項 (00, 15, 30, 45)
    generateMinuteOptions(selectedMinute = '') {
        let options = '<option value="">分</option>';
        const minutes = ['00', '15', '30', '45'];
        minutes.forEach(minute => {
            const selected = selectedMinute === minute ? 'selected' : '';
            options += `<option value="${minute}" ${selected}>${minute}</option>`;
        });
        return options;
    }

    // 從時間字串中取得小時
    getHourFromTime(timeString) {
        if (!timeString) return '';
        return timeString.split('+')[0].substring(0, 2);
    }

    // 從時間字串中取得分鐘
    getMinuteFromTime(timeString) {
        if (!timeString) return '';
        return timeString.split('+')[0].substring(3, 5);
    }

    // 格式化日期時間
    formatDateTime(dateTimeString) {
        if (!dateTimeString) return '-';
        const date = new Date(dateTimeString);
        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 顯示訊息
    showMessage(message, type = 'info') {
        const toastContainer = document.querySelector('.toast-container');
        const toastId = 'shiftTypeToast_' + Date.now();
        
        const toastHTML = `
            <div class="toast" id="${toastId}" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <i class='bx ${this.getToastIcon(type)} me-2'></i>
                    <strong class="me-auto">班別設定</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        
        const toast = new bootstrap.Toast(document.getElementById(toastId));
        toast.show();
        
        // 自動移除 toast 元素
        document.getElementById(toastId).addEventListener('hidden.bs.toast', () => {
            document.getElementById(toastId).remove();
        });
    }

    // 取得 toast 圖示
    getToastIcon(type) {
        switch (type) {
            case 'success': return 'bx-check-circle text-success';
            case 'error': return 'bx-x-circle text-danger';
            case 'warning': return 'bx-error text-warning';
            default: return 'bx-info-circle text-info';
        }
    }

    // === 新增：班別群組管理方法 ===

    // 載入班別群組資料
    async loadShiftGroups() {
        try {
            const response = await fetch('/api/shift-groups');
            if (!response.ok) {
                throw new Error('無法載入班別群組資料');
            }
            
            this.shiftGroups = await response.json();
            this.renderShiftGroups();
            
            // 隱藏載入動畫，顯示群組容器
            document.getElementById('groupLoadingSpinner').style.display = 'none';
            document.getElementById('shiftGroupsContainer').style.display = 'block';
            
        } catch (error) {
            console.error('載入班別群組資料時發生錯誤：', error);
            this.showMessage('載入班別群組資料失敗', 'error');
        }
    }

    // 渲染班別群組
    renderShiftGroups() {
        const container = document.getElementById('shiftGroupsContainer');
        container.innerHTML = '';

        if (this.shiftGroups.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class='bx bx-group' style="font-size: 48px; opacity: 0.5;"></i>
                    <p class="mt-3">目前沒有任何班別群組，請點擊「新增群組」按鈕來新增</p>
                </div>
            `;
            return;
        }

        // 按群組名稱分組
        const groupedData = {};
        this.shiftGroups.forEach(group => {
            if (!groupedData[group.group_name]) {
                groupedData[group.group_name] = [];
            }
            groupedData[group.group_name].push(group);
        });

        // 渲染每個群組
        Object.keys(groupedData).forEach(groupName => {
            const groupItems = groupedData[groupName];
            const groupContainer = document.createElement('div');
            groupContainer.className = 'shift-group-item';
            
            // 建立星期對應的班別資料
            const weekdayShifts = {};
            groupItems.forEach(item => {
                const weekday = item.weekday;
                if (!weekdayShifts[weekday]) {
                    weekdayShifts[weekday] = [];
                }
                weekdayShifts[weekday].push({
                    shift_name: item.shift_type ? item.shift_type.shift_name : '未知班別',
                    shift_subname: item.shift_type ? item.shift_type.shift_subname : '',
                    amount: item.amount,
                    uuid: item.uuid
                });
            });

            groupContainer.innerHTML = `
                <div class="group-header" data-group-id="${groupName}">
                    <div class="group-header-content">
                        <i class='bx bx-chevron-right group-expand-icon'></i>
                        <h4 class="group-name">${groupName}</h4>
                        <span class="group-count">(${groupItems.length} 筆設定)</span>
                    </div>
                    <div class="group-actions">
                        <button class="btn btn-sm btn-outline-danger delete-group-btn" data-group-id="${groupName}">
                            <i class='bx bx-trash'></i> 刪除群組
                        </button>
                    </div>
                </div>
                <div class="group-content">
                    <div class="group-details-table-container">
                        <table class="group-details-table">
                            <thead>
                                <tr>
                                    <th>星期一</th>
                                    <th>星期二</th>
                                    <th>星期三</th>
                                    <th>星期四</th>
                                    <th>星期五</th>
                                    <th>星期六</th>
                                    <th>星期日</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    ${[0, 1, 2, 3, 4, 5, 6].map(weekday => {
                                        const shifts = weekdayShifts[weekday] || [];
                                        if (shifts.length === 0) {
                                            return '<td class="no-shift">-</td>';
                                        }
                                        
                                        const shiftHtml = shifts.map(shift => {
                                            let displayText = `${shift.shift_name}${shift.shift_subname}`;
                                            if (shift.amount > 1) {
                                                displayText += ` *${shift.amount}`;
                                            }
                                            return `
                                                <div class="shift-item" data-uuid="${shift.uuid}">
                                                    <span class="shift-text">${displayText}</span>
                                                    <div class="shift-actions">
                                                        <button class="btn btn-sm btn-outline-primary edit-group-item-btn" data-uuid="${shift.uuid}">
                                                            <i class='bx bx-edit-alt'></i>
                                                        </button>
                                                        <button class="btn btn-sm btn-outline-danger delete-group-item-btn" data-uuid="${shift.uuid}">
                                                            <i class='bx bx-trash'></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('');
                                        
                                        return `<td class="has-shift">${shiftHtml}</td>`;
                                    }).join('')}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            container.appendChild(groupContainer);
        });
    }

    // 切換群組展開/收合
    toggleGroupExpansion(groupId) {
        const groupItem = document.querySelector(`[data-group-id="${groupId}"]`).closest('.shift-group-item');
        const content = groupItem.querySelector('.group-content');
        const icon = groupItem.querySelector('.group-expand-icon');
        
        if (!content.classList.contains('show')) {
            // 展開
            content.classList.add('show');
            icon.classList.remove('bx-chevron-right');
            icon.classList.add('bx-chevron-down');
        } else {
            // 收合
            content.classList.remove('show');
            icon.classList.remove('bx-chevron-down');
            icon.classList.add('bx-chevron-right');
        }
    }

    // 顯示班別群組編輯/新增 Modal
    showShiftGroupModal(groupData = null) {
        const isEdit = groupData !== null;
        this.currentEditGroupId = isEdit ? groupData.uuid : null;

        const modalHTML = `
            <div class="modal fade" id="shiftGroupModal" tabindex="-1" aria-labelledby="shiftGroupModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <i class='bx bx-group'></i>
                            <h5 class="modal-title" id="shiftGroupModalLabel">
                                ${isEdit ? '編輯班別群組' : '新增班別群組'}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="shiftGroupForm">
                                <div class="mb-3">
                                    <label for="groupName" class="form-label">群組名稱 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="groupName" required 
                                           value="${isEdit ? groupData.group_name : ''}" 
                                           placeholder="例如：週一班組">
                                </div>
                                
                                <div class="mb-3">
                                    <label for="weekday" class="form-label">星期 <span class="text-danger">*</span></label>
                                    <select class="form-control" id="weekday" required>
                                        <option value="">請選擇星期</option>
                                        <option value="0" ${isEdit && groupData.weekday === 0 ? 'selected' : ''}>星期日</option>
                                        <option value="1" ${isEdit && groupData.weekday === 1 ? 'selected' : ''}>星期一</option>
                                        <option value="2" ${isEdit && groupData.weekday === 2 ? 'selected' : ''}>星期二</option>
                                        <option value="3" ${isEdit && groupData.weekday === 3 ? 'selected' : ''}>星期三</option>
                                        <option value="4" ${isEdit && groupData.weekday === 4 ? 'selected' : ''}>星期四</option>
                                        <option value="5" ${isEdit && groupData.weekday === 5 ? 'selected' : ''}>星期五</option>
                                        <option value="6" ${isEdit && groupData.weekday === 6 ? 'selected' : ''}>星期六</option>
                                    </select>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="shiftId" class="form-label">班別 <span class="text-danger">*</span></label>
                                    <select class="form-control" id="shiftId" required>
                                        <option value="">請選擇班別</option>
                                        ${this.generateShiftTypeOptions(isEdit ? groupData.shift_id : '')}
                                    </select>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="amount" class="form-label">上班人數 <span class="text-danger">*</span></label>
                                    <input type="number" class="form-control" id="amount" required min="0"
                                           value="${isEdit ? groupData.amount : ''}" 
                                           placeholder="例如：3">
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" id="saveShiftGroupBtn">
                                ${isEdit ? '更新' : '新增'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 移除舊的 Modal（如果存在）
        const existingModal = document.getElementById('shiftGroupModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新的 Modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 初始化 Modal
        const modal = new bootstrap.Modal(document.getElementById('shiftGroupModal'));
        modal.show();

        // 綁定儲存按鈕事件
        document.getElementById('saveShiftGroupBtn').addEventListener('click', () => {
            this.saveShiftGroup();
        });

        // Modal 關閉時清理
        document.getElementById('shiftGroupModal').addEventListener('hidden.bs.modal', () => {
            this.currentEditGroupId = null;
        });
    }

    // 儲存班別群組
    async saveShiftGroup() {
        const form = document.getElementById('shiftGroupForm');
        
        const formData = {
            group_name: document.getElementById('groupName').value.trim(),
            weekday: parseInt(document.getElementById('weekday').value),
            shift_id: parseInt(document.getElementById('shiftId').value),
            amount: parseInt(document.getElementById('amount').value)
        };

        // 驗證必填欄位
        if (!formData.group_name || formData.weekday === null || !formData.shift_id || formData.amount === null) {
            this.showMessage('請填寫所有必填欄位', 'error');
            return;
        }

        try {
            const url = this.currentEditGroupId 
                ? `/api/shift-groups/${this.currentEditGroupId}` 
                : '/api/shift-groups';
            
            const method = this.currentEditGroupId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '操作失敗');
            }

            const result = await response.json();
            
            // 關閉 Modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('shiftGroupModal'));
            modal.hide();

            // 重新載入資料
            await this.loadShiftGroups();

            this.showMessage(
                this.currentEditGroupId ? '班別群組更新成功' : '班別群組新增成功', 
                'success'
            );

        } catch (error) {
            console.error('儲存班別群組時發生錯誤：', error);
            this.showMessage(error.message || '操作失敗', 'error');
        }
    }

    // 編輯班別群組
    editShiftGroup(groupId) {
        // 這裡可以實作編輯整個群組的功能
        // 目前先顯示訊息
        this.showMessage('群組編輯功能開發中', 'info');
    }

    // 刪除班別群組
    async deleteShiftGroup(groupId) {
        if (!confirm('確定要刪除這個班別群組嗎？此操作無法復原。')) {
            return;
        }

        try {
            // 刪除該群組下的所有項目
            const groupItems = this.shiftGroups.filter(group => group.group_name === groupId);
            
            for (const item of groupItems) {
                const response = await fetch(`/api/shift-groups/${item.uuid}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || '刪除失敗');
                }
            }

            // 重新載入資料
            await this.loadShiftGroups();
            this.showMessage('班別群組已刪除', 'success');

        } catch (error) {
            console.error('刪除班別群組時發生錯誤：', error);
            this.showMessage(error.message || '刪除失敗', 'error');
        }
    }

    // 生成班別類型選項
    generateShiftTypeOptions(selectedId = '') {
        let options = '';
        this.shiftTypes.forEach(shiftType => {
            const selected = selectedId === shiftType.id ? 'selected' : '';
            options += `<option value="${shiftType.id}" ${selected}>${shiftType.shift_name} (${shiftType.shift_subname})</option>`;
        });
        return options;
    }

    // 取得星期標籤
    getWeekdayLabel(weekday) {
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        return weekdays[weekday] || '未知';
    }

    // 編輯個別群組項目
    editShiftGroupItem(uuid) {
        const groupItem = this.shiftGroups.find(group => group.uuid === uuid);
        if (groupItem) {
            this.showShiftGroupModal(groupItem);
        }
    }

    // 刪除個別群組項目
    async deleteShiftGroupItem(uuid) {
        if (!confirm('確定要刪除這個群組項目嗎？此操作無法復原。')) {
            return;
        }

        try {
            const response = await fetch(`/api/shift-groups/${uuid}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '刪除失敗');
            }

            // 重新載入資料
            await this.loadShiftGroups();
            this.showMessage('群組項目已刪除', 'success');

        } catch (error) {
            console.error('刪除群組項目時發生錯誤：', error);
            this.showMessage(error.message || '刪除失敗', 'error');
        }
    }
}

// 建立全域實例
window.shiftTypeConfigManager = new ShiftTypeConfigManager();
