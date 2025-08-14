// 班別類型設定管理模組
class ShiftTypeConfigManager {
    constructor() {
        this.container = document.querySelector('nav.content');
        this.shiftTypes = [];
        this.currentEditId = null;
    }

    // 顯示班別設定模式
    show() {
        this.renderShiftTypeConfigPanel();
        this.loadShiftTypes();
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

        // 使用事件委派處理表格內的按鈕
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-shift-btn')) {
                const shiftId = e.target.dataset.shiftId;
                this.editShiftType(shiftId);
            } else if (e.target.classList.contains('delete-shift-btn')) {
                const shiftId = e.target.dataset.shiftId;
                this.deleteShiftType(shiftId);
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
}

// 建立全域實例
window.shiftTypeConfigManager = new ShiftTypeConfigManager();
