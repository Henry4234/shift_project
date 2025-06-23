// 員工設定面板管理
class EmployeeConfigManager {
    constructor() {
        this.sidebarContent = document.querySelector('.menu_content');
        this.initUserConfigPanel();
        this.bindEvents();
    }

    // 初始化用戶配置面板
    initUserConfigPanel() {
        // 創建用戶配置面板容器
        const panel = document.createElement('div');
        panel.id = 'user-config-panel';
        panel.style.display = 'none';
        
        // 創建返回按鈕
        const backButton = document.createElement('div');
        backButton.className = 'nav_link back-to-menu';
        backButton.innerHTML = `
            <span class="navlink_icon">
                <i class="bx bx-arrow-back"></i>
            </span>
            <span class="navlink">返回選單</span>
        `;
        
        panel.appendChild(backButton);
        this.sidebarContent.appendChild(panel);
        
        this.panel = panel;
        this.backButton = backButton;
    }

    // 綁定事件
    bindEvents() {
        // 監聽員工設定按鈕點擊
        const userConfigBtn = document.querySelector('.user-config');
        userConfigBtn.addEventListener('click', () => this.showEmployeeConfig());

        // 監聽返回按鈕點擊
        this.backButton.addEventListener('click', () => this.hideEmployeeConfig());
    }

    // 顯示員工設定面板
    async showEmployeeConfig() {
        // 淡出當前內容
        Array.from(this.sidebarContent.children).forEach(child => {
            if (child !== this.panel) {
                child.classList.add('fadeout');
            }
        });

        // 等待淡出動畫完成
        await new Promise(resolve => setTimeout(resolve, 400));

        // 隱藏其他元素
        Array.from(this.sidebarContent.children).forEach(child => {
            if (child !== this.panel) {
                child.style.display = 'none';
            }
        });

        // 顯示並淡入配置面板
        this.panel.style.display = 'block';
        await this.renderEmployeeConfigPanel();
        this.panel.classList.add('fadein');
    }

    // 隱藏員工設定面板
    async hideEmployeeConfig() {
        // 淡出配置面板
        this.panel.classList.remove('fadein');
        this.panel.classList.add('fadeout');

        // 等待淡出動畫完成
        await new Promise(resolve => setTimeout(resolve, 400));

        // 隱藏配置面板
        this.panel.style.display = 'none';
        this.panel.classList.remove('fadeout');

        // 顯示並淡入其他元素
        Array.from(this.sidebarContent.children).forEach(child => {
            if (child !== this.panel) {
                child.style.display = '';
                child.classList.remove('fadeout');
                child.classList.add('fadein');
            }
        });

        // 清理淡入動畫
        setTimeout(() => {
            Array.from(this.sidebarContent.children).forEach(child => {
                child.classList.remove('fadein');
            });
        }, 400);
    }

    // 渲染員工設定面板內容
    async renderEmployeeConfigPanel() {
        try {
            // 先清空面板內容，只保留返回按鈕
            while (this.panel.childNodes.length > 1) {
                this.panel.removeChild(this.panel.lastChild);
            }
            // 從本地 JSON 檔案讀取資料
            const [employeesResponse, preferencesResponse, requirementsResponse] = await Promise.all([
                fetch('./simulate_employees.json'),
                fetch('./simulate_employeepreferences.json'),
                fetch('./simulate_shiftrequirements.json')
            ]);
            // const [employeesResponse, preferencesResponse, requirementsResponse] = await Promise.all([
            //   fetch('/api/employees'),
            //   fetch('/api/employee-preferences'),
            //   fetch('/api/shift-requirements')
            // ]);


            const [employees, preferences, requirements] = await Promise.all([
                employeesResponse.json(),
                preferencesResponse.json(),
                requirementsResponse.json()
            ]);

            // 清空面板內容（保留返回按鈕）
            const contentContainer = document.createElement('div');
            contentContainer.className = 'employee-config-content';
            
            if (!employees || employees.length === 0) {
                contentContainer.innerHTML = '<div class="text-warning">目前沒有員工資料</div>';
                this.panel.appendChild(contentContainer);
                return;
            }

            // 顯示每位人員
            employees.forEach(employee => {
                const div = document.createElement('div');
                div.className = 'item';
                
                // 獲取該員工的偏好設定
                const employeePreferences = preferences.find(p => p.employee_id === employee.id);
                // 獲取該員工的班表需求
                const employeeRequirements = requirements.filter(r => r.employee_id === employee.id);
                
                // 計算已設定的偏好數量
                let setPreferencesCount = 0;
                if (employeePreferences) {
                    if (employeePreferences.max_continuous_days) setPreferencesCount++;
                    if (employeePreferences.continuous_c) setPreferencesCount++;
                    if (employeePreferences.double_off_after_c) setPreferencesCount++;
                }

                // 創建偏好設定容器
                const preferencesContainer = document.createElement('div');
                preferencesContainer.className = 'preferences-container';
                preferencesContainer.innerHTML = `
                    <div class="preference-box mt-2">
                        <div class="preference-title">偏好設置</div>
                        <div class="form-check">
                            <input class="form-check-input preference-checkbox" type="checkbox" 
                                id="pref-max-days-${employee.id}" 
                                data-type="max_continuous_days"
                                ${employeePreferences?.max_continuous_days ? 'checked' : ''}>
                            <label class="form-check-label" for="pref-max-days-${employee.id}">
                                最大連續工作天數限制
                            </label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input preference-checkbox" type="checkbox" 
                                id="pref-continuous-c-${employee.id}"
                                data-type="continuous_c"
                                ${employeePreferences?.continuous_c ? 'checked' : ''}>
                            <label class="form-check-label" for="pref-continuous-c-${employee.id}">
                                連續 C 班限制
                            </label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input preference-checkbox" type="checkbox" 
                                id="pref-double-off-${employee.id}"
                                data-type="double_off_after_c"
                                ${employeePreferences?.double_off_after_c ? 'checked' : ''}>
                            <label class="form-check-label" for="pref-double-off-${employee.id}">
                                C 班後需雙休
                            </label>
                        </div>
                    </div>
                    <div class="preference-box mt-2">
                        <div class="preference-title">班別/數量</div>
                        <div class="shift-requirements-container">
                            <div class="shift-requirement-item">
                                <input type="number" class="form-control form-control-sm shift-requirement" 
                                    id="shift-a-${employee.id}" 
                                    min="0" max="30"
                                    value="${employeeRequirements?.find(r => r.shift_type === 'A')?.required_days || 0}">
                                <span class="shift-label">天白班</span>
                            </div>
                            <div class="shift-requirement-item">
                                <input type="number" class="form-control form-control-sm shift-requirement" 
                                    id="shift-b-${employee.id}" 
                                    min="0" max="30"
                                    value="${employeeRequirements?.find(r => r.shift_type === 'B')?.required_days || 0}">
                                <span class="shift-label">天小夜</span>
                            </div>
                            <div class="shift-requirement-item">
                                <input type="number" class="form-control form-control-sm shift-requirement" 
                                    id="shift-c-${employee.id}" 
                                    min="0" max="30"
                                    value="${employeeRequirements?.find(r => r.shift_type === 'C')?.required_days || 0}">
                                <span class="shift-label">天大夜</span>
                            </div>
                            <button class="update-shifts-btn" data-employee-id="${employee.id}">
                                更新班別需求
                            </button>
                        </div>
                    </div>
                `;
                
                div.innerHTML = `
                    <div class="person_items nav_link submenu_item" id="member-${employee.id}">
                        <span class="navlink_icon">
                            <i class="bx bx-user"></i>
                        </span>
                        <span class="navlink">${employee.name}</span>
                        <span class="preferencetitle">
                            ${setPreferencesCount} 個偏好設定
                        </span>
                        <i class="bx bx-chevron-right arrow-left"></i>
                    </div>
                `;
                
                div.appendChild(preferencesContainer);
                contentContainer.appendChild(div);

                // 為當前員工的偏好設定添加事件監聽器
                this.bindEmployeeEvents(div, employee, preferencesContainer);
            });

            // 將內容添加到面板（在返回按鈕後面）
            this.panel.appendChild(contentContainer);

        } catch (err) {
            console.error('渲染員工設定面板時發生錯誤：', err);
            this.panel.innerHTML = '<div class="text-danger">無法載入資料</div>';
        }
    }

    // 綁定員工相關事件
    bindEmployeeEvents(container, employee, preferencesContainer) {
        const checkboxes = preferencesContainer.querySelectorAll('.preference-checkbox');
        const navLink = container.querySelector('.person_items');
        const updateShiftsBtn = preferencesContainer.querySelector('.update-shifts-btn');
        const shiftInputs = preferencesContainer.querySelectorAll('.shift-requirement');

        // 展開/收起偏好設定
        navLink.addEventListener('click', () => {
            const isExpanding = !preferencesContainer.classList.contains('show');
            preferencesContainer.classList.toggle('show');
            navLink.classList.toggle('show_submenu');
        });

        // 偏好設定 checkbox 事件
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
                const preferenceType = e.target.dataset.type;
                const isChecked = e.target.checked;
                
                try {
                    // 收集所有偏好設定
                    const preferences = {
                        max_continuous_days: false,
                        continuous_c: false,
                        double_off_after_c: false
                    };
                    
                    // 更新當前變更的偏好
                    preferences[preferenceType] = isChecked;
                    
                    // 從其他 checkbox 獲取現有值
                    checkboxes.forEach(cb => {
                        if (cb !== e.target) {
                            preferences[cb.dataset.type] = cb.checked;
                        }
                    });

                    // 發送更新請求
                    const response = await fetch(`/api/employee-preferences/${employee.id}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(preferences)
                    });

                    if (!response.ok) {
                        throw new Error('更新失敗');
                    }

                    // 更新成功後更新計數
                    const result = await response.json();
                    console.log('更新成功：', result);

                    // 更新 UI 顯示
                    const newCount = Object.values(preferences).filter(v => v === true).length;
                    const countEl = navLink.querySelector('.preferencetitle');
                    countEl.textContent = `${newCount} 個偏好設定`;

                    this.showToast('偏好設定已更新', 'success');

                } catch (err) {
                    console.error('更新偏好設定時發生錯誤：', err);
                    // 恢復 checkbox 狀態
                    e.target.checked = !isChecked;
                    this.showToast('更新失敗，請稍後再試', 'danger');
                }
            });
        });

        // 班別需求輸入驗證
        shiftInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                let value = e.target.value;
                value = value.replace(/[^0-9]/g, '');
                if (value !== '') {
                    const numValue = parseInt(value);
                    if (numValue > 30) value = '30';
                    if (numValue < 0) value = '0';
                }
                e.target.value = value;
            });
        });

        // 更新班別需求按鈕事件
        updateShiftsBtn.addEventListener('click', async () => {
            try {
                const shiftRequirements = {
                    A: parseInt(preferencesContainer.querySelector('#shift-a-' + employee.id).value) || 0,
                    B: parseInt(preferencesContainer.querySelector('#shift-b-' + employee.id).value) || 0,
                    C: parseInt(preferencesContainer.querySelector('#shift-c-' + employee.id).value) || 0
                };

                const response = await fetch(`/api/employee-amount/${employee.id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(shiftRequirements)
                });

                if (!response.ok) {
                    throw new Error('更新失敗');
                }

                this.showToast('班別需求已更新', 'success');

            } catch (err) {
                console.error('更新班別需求時發生錯誤：', err);
                this.showToast('更新失敗，請稍後再試', 'danger');
            }
        });
    }

    // 顯示提示訊息
    showToast(message, type = 'success') {
        const toastContainer = document.querySelector('.toast-container');
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        toastContainer.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: 3000
        });
        bsToast.show();
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// 當 DOM 載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    new EmployeeConfigManager();
}); 