// 員工設定面板管理
class EmployeeConfigManager {
    constructor() {
        this.sidebarContent = document.querySelector('.menu_content');
        this.initUserConfigPanel();
        // 不再自動綁定事件，事件交由 sidebar.js 控制
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

        // 新增員工按鈕（插入於返回選單之後）
        const addMemberBtn = document.createElement('div');
        addMemberBtn.className = 'nav_link add_member';
        addMemberBtn.innerHTML = `
            <span class="navlink_icon">
                <i class="bx bx-user-plus"></i>
            </span>
            <span class="navlink">新增員工</span>
        `;
        panel.appendChild(addMemberBtn);

        this.sidebarContent.appendChild(panel);
        
        this.panel = panel;
        this.backButton = backButton;
        this.addMemberBtn = addMemberBtn;
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
            // 先清空面板內容，只保留返回按鈕與新增員工按鈕
            while (this.panel.childNodes.length > 2) {
                this.panel.removeChild(this.panel.lastChild);
            }
            // 顯示 loading 畫面
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'employee-loading';
            loadingDiv.style.padding = '32px 0';
            loadingDiv.style.textAlign = 'center';
            loadingDiv.innerHTML = `<div class="spinner-border text-primary" role="status" style="width:2.5rem;height:2.5rem;"></div><div class="loading-title" style="margin-top:12px;">正在讀取員工資料...</div>`;
            this.panel.appendChild(loadingDiv);
            // 從本地 JSON 檔案讀取資料
            // const [employeesResponse, preferencesResponse, requirementsResponse] = await Promise.all([
            //     fetch('./simulate_employees.json'),
            //     fetch('./simulate_employeepreferences.json'),
            //     fetch('./simulate_shiftrequirements.json')
            // ]);
            const [employeesResponse, preferencesResponse, requirementsResponse] = await Promise.all([
              fetch('/api/employees'),
              fetch('/api/employee-preferences'),
              fetch('/api/shift-requirements')
            ]);


            const [employees, preferences, requirements] = await Promise.all([
                employeesResponse.json(),
                preferencesResponse.json(),
                requirementsResponse.json()
            ]);

            // 移除 loading 畫面
            if (loadingDiv.parentNode) loadingDiv.parentNode.removeChild(loadingDiv);
            
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
            });

            // 將內容添加到面板（在返回按鈕後面）
            this.panel.appendChild(contentContainer);

        } catch (err) {
            console.error('渲染員工設定面板時發生錯誤：', err);
            this.panel.innerHTML = '<div class="text-danger">無法載入資料</div>';
        }
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

    // 重新載入員工資料並更新全域變數
    async reloadEmployeesData() {
        try {
            console.log('重新載入員工資料...');
            const response = await fetch('/api/employees');
            
            if (!response.ok) {
                throw new Error(`HTTP 錯誤! 狀態: ${response.status}`);
            }
            
            const employees = await response.json();
            window.employeesResponse = employees;
            console.log('成功重新載入員工資料：', employees);
            
            // 如果 employeesMode 已存在，更新其員工資料
            if (window.employeesMode) {
                window.employeesMode.updateEmployeesData();
            }
            
            return employees;
        } catch (error) {
            console.error('重新載入員工資料時發生錯誤：', error);
            this.showToast('重新載入員工資料失敗', 'danger');
            return null;
        }
    }
}

// 當 DOM 載入完成後初始化，並掛到 window 方便 sidebar.js 調用
window.addEventListener('DOMContentLoaded', () => {
    window.employeeConfigManager = new EmployeeConfigManager();
}); 