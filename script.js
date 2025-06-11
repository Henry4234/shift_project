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
            const preferencesContainer = document.createElement('ul');
            preferencesContainer.className = 'menu_items submenu';
            preferencesContainer.innerHTML = `
                <div class="preference-box">
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
                <div class="preference-box mt-3">
                    <div class="preference-title">班別/數量</div>
                    <div class="shift-requirements-container">
                        <div class="shift-requirement-item">
                            <input type="number" class="form-control form-control-sm shift-requirement" 
                                id="shift-a-${employee.id}" 
                                min="0" max="30"
                                value="${employeeRequirements?.find(r => r.shift_type === 'A')?.required_days || 0}">
                            <span>天白班</span>
                        </div>
                        <div class="shift-requirement-item">
                            <input type="number" class="form-control form-control-sm shift-requirement" 
                                id="shift-b-${employee.id}" 
                                min="0" max="30"
                                value="${employeeRequirements?.find(r => r.shift_type === 'B')?.required_days || 0}">
                            <span>天小夜</span>
                        </div>
                        <div class="shift-requirement-item">
                            <input type="number" class="form-control form-control-sm shift-requirement" 
                                id="shift-c-${employee.id}" 
                                min="0" max="30"
                                value="${employeeRequirements?.find(r => r.shift_type === 'C')?.required_days || 0}">
                            <span>天大夜</span>
                        </div>
                    </div>
                </div>
            `;
            
            div.innerHTML = `
                <div href="#" class="nav_link menu_items submenu_item" id="member-${employee.id}">
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
            
            // 添加點擊事件
            const navLink = div.querySelector('.nav_link');
            navLink.addEventListener('click', () => {
                navLink.classList.toggle('show_submenu');
            });

            div.appendChild(preferencesContainer);
            memberListEl.appendChild(div);
        });

    } catch (err) {
        console.error('取得資料時發生錯誤：', err.message);
        memberListEl.innerHTML = '<div class="text-danger">無法載入資料</div>';
    }
});