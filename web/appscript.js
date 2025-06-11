let calendar;

// Create a single supabase client for interacting with your database
// 

document.addEventListener('DOMContentLoaded', async () => {
    const memberListEl = document.getElementById('member-list');
    const loadingEl = document.createElement('div');
    const el = document.getElementById('calendar-container');
    
    // 初始化月曆
    calendar = new FullCalendar.Calendar(el, {
        locale: 'zh-tw',
        initialView: 'dayGridMonth',
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth'
        },
        titleFormat: { year: 'numeric', month: 'numeric' },
        events: [
          {
            title: '示例事件',
            start: '2025-06-15'
          }
        ]
    });
    calendar.render();

    // 顯示載入中提示
    loadingEl.className = 'text-center p-3';
    loadingEl.innerHTML = `
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">載入中...</span>
      </div>
      <div class="mt-2">正在載入資料...</div>
    `;

    try {
        // 顯示載入中
        memberListEl.innerHTML = '';
        memberListEl.appendChild(loadingEl);
    
        console.log('開始請求所有資料...');
        // 並行請求所有資料
        // const [employeesResponse, preferencesResponse, requirementsResponse] = await Promise.all([
        //   fetch('/api/employees'),
        //   fetch('/api/employee-preferences'),
        //   fetch('/api/shift-requirements')
        // ]);
        // 從本地 JSON 檔案讀取資料
        const [employeesResponse, preferencesResponse, requirementsResponse] = await Promise.all([
            fetch('./simulate_employees.json'),
            fetch('./simulate_employeepreferences.json'),
            fetch('./simulate_shiftrequirements.json')
        ]);

        const [employees, preferences, requirements] = await Promise.all([
            employeesResponse.json(),
            preferencesResponse.json(),
            requirementsResponse.json()
        ]);
    
        console.log('成功從本地檔案中取得所有資料');
        console.log('員工資料：', employees);
        console.log('員工偏好設定：', preferences);
        console.log('班表需求：', requirements);
    
        // 清空載入中提示
        memberListEl.innerHTML = '';
    
        if (!employees || employees.length === 0) {
            console.log('警告：沒有找到任何員工資料');
            memberListEl.innerHTML = '<div class="text-warning">目前沒有員工資料</div>';
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
                    <small class="text-muted navlink">
                        ${setPreferencesCount} 個偏好設定
                    </small>
                    <i class="bx bx-chevron-right arrow-left"></i>
                </div>
            `;
            
            div.appendChild(preferencesContainer);
            memberListEl.appendChild(div);

            // 為當前員工的偏好設定添加事件監聽器
            const checkboxes = preferencesContainer.querySelectorAll('.preference-checkbox');
            const navLink = div.querySelector('.person_items');
            
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
                        
                        // // 更新本地資料
                        // const updatedPreferences = preferences.find(p => p.employee_id === employee.id);
                        // if (updatedPreferences) {
                        //     updatedPreferences[preferenceType] = isChecked;
                        // }

                        // 更新 UI 顯示
                        const newCount = Object.values(preferences).filter(v => v === true).length;
                        const countEl = navLink.querySelector('small');
                        countEl.textContent = `${newCount} 個偏好設定`;

                        // 更新 checkbox 狀態
                        const checkbox = preferencesContainer.querySelector(`#pref-${preferenceType}-${employee.id}`);
                        if (checkbox) {
                            checkbox.checked = isChecked;
                        }

                        // 顯示成功提示
                        const toastContainer = document.querySelector('.toast-container');
                        const toast = document.createElement('div');
                        toast.className = 'toast align-items-center text-white bg-success border-0';
                        toast.setAttribute('role', 'alert');
                        toast.setAttribute('aria-live', 'assertive');
                        toast.setAttribute('aria-atomic', 'true');
                        toast.innerHTML = `
                            <div class="d-flex">
                                <div class="toast-body">
                                    偏好設定已更新
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
                        
                        // 3秒後移除提示
                        setTimeout(() => {
                            toast.remove();
                        }, 3000);

                    } catch (err) {
                        console.error('更新偏好設定時發生錯誤：', err);
                        // 恢復 checkbox 狀態
                        e.target.checked = !isChecked;
                        
                        // 顯示錯誤提示
                        const toast = document.createElement('div');
                        toast.className = 'toast align-items-center text-white bg-danger border-0 position-fixed bottom-0 end-0 m-3';
                        toast.setAttribute('role', 'alert');
                        toast.setAttribute('aria-live', 'assertive');
                        toast.setAttribute('aria-atomic', 'true');
                        toast.innerHTML = `
                            <div class="d-flex">
                                <div class="toast-body">
                                    更新失敗，請稍後再試
                                </div>
                                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                            </div>
                        `;
                        document.body.appendChild(toast);
                        const bsToast = new bootstrap.Toast(toast);
                        bsToast.show();
                        
                        // 3秒後移除提示
                        setTimeout(() => {
                            toast.remove();
                        }, 3000);
                    }
                });
            });
        });

    } catch (err) {
        console.error('取得資料時發生錯誤：', err.message);
        memberListEl.innerHTML = '<div class="text-danger">無法載入資料</div>';
    }
});