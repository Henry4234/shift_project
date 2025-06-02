// app.js
document.addEventListener('DOMContentLoaded', async () => {
  const memberListEl = document.getElementById('member-list');
  const loadingEl = document.createElement('div');
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
    const [employeesResponse, preferencesResponse, requirementsResponse] = await Promise.all([
      fetch('/api/employees'),
      fetch('/api/employee-preferences'),
      fetch('/api/shift-requirements')
    ]);

    if (!employeesResponse.ok || !preferencesResponse.ok || !requirementsResponse.ok) {
      throw new Error('資料請求失敗');
    }

    const [employees, preferences, requirements] = await Promise.all([
      employeesResponse.json(),
      preferencesResponse.json(),
      requirementsResponse.json()
    ]);

    console.log('成功從supabase中取得所有資料');
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
      div.className = 'form-check mb-2';
      
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
      preferencesContainer.className = 'preferences-container mt-2 d-none';
      preferencesContainer.innerHTML = `
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="pref-max-days-${employee.id}" 
            ${employeePreferences?.max_continuous_days ? 'checked' : ''}>
          <label class="form-check-label" for="pref-max-days-${employee.id}">
            最大連續工作天數限制
          </label>
        </div>
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="pref-continuous-c-${employee.id}"
            ${employeePreferences?.continuous_c ? 'checked' : ''}>
          <label class="form-check-label" for="pref-continuous-c-${employee.id}">
            連續 C 班限制
          </label>
        </div>
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="pref-double-off-${employee.id}"
            ${employeePreferences?.double_off_after_c ? 'checked' : ''}>
          <label class="form-check-label" for="pref-double-off-${employee.id}">
            C 班後需雙休
          </label>
        </div>
      `;
      
      div.innerHTML = `
        <button class="btn btn-outline-primary w-100 text-start" type="button" value="${employee.id}" id="member-${employee.id}">
          <div class="d-flex justify-content-between align-items-center">
            <span>${employee.name}</span>
            <small class="text-muted">
              ${setPreferencesCount} 個偏好設定
            </small>
          </div>
        </button>
      `;
      
      // 添加點擊事件
      const button = div.querySelector('button');
      button.addEventListener('click', () => {
        const container = div.querySelector('.preferences-container');
        if (container) {
          container.classList.toggle('d-none');
        }
      });

      div.appendChild(preferencesContainer);
      memberListEl.appendChild(div);
    });
  } catch (err) {
    console.error('取得資料時發生錯誤：', err.message);
    memberListEl.innerHTML = '<div class="text-danger">無法載入資料</div>';
  }
}); 