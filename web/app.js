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
      <div class="preference-box">
        <div class="form-check">
            <div class="preference-title">偏好設置</div>
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
          <button class="btn btn-sm btn-primary update-shifts-btn" data-employee-id="${employee.id}">
            更新班別需求
          </button>
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

      // 添加偏好設定變更事件
      const checkboxes = preferencesContainer.querySelectorAll('.preference-checkbox');
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
            const newCount = Object.values(result[0]).filter(v => v === true).length;
            const countEl = button.querySelector('small');
            countEl.textContent = `${newCount} 個偏好設定`;

            // 顯示成功提示
            const toast = document.createElement('div');
            toast.className = 'toast align-items-center text-white bg-success border-0 position-fixed bottom-0 end-0 m-3';
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
            document.body.appendChild(toast);
            const bsToast = new bootstrap.Toast(toast);
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

      // 添加班別需求更新事件
      const updateShiftsBtn = preferencesContainer.querySelector('.update-shifts-btn');
      const shiftInputs = preferencesContainer.querySelectorAll('.shift-requirement');

      // 為每個輸入框添加驗證
      shiftInputs.forEach(input => {
        input.addEventListener('input', (e) => {
          let value = e.target.value;
          
          // 移除非數字字符
          value = value.replace(/[^0-9]/g, '');
          
          // 確保數值在0-30之間
          if (value !== '') {
            const numValue = parseInt(value);
            if (numValue > 30) value = '30';
            if (numValue < 0) value = '0';
          }
          
          e.target.value = value;
        });
      });

      // 添加更新按鈕點擊事件
      updateShiftsBtn.addEventListener('click', async () => {
        try {
          // 收集所有班別需求
          const shiftRequirements = {
            A: parseInt(preferencesContainer.querySelector('#shift-a-' + employee.id).value) || 0,
            B: parseInt(preferencesContainer.querySelector('#shift-b-' + employee.id).value) || 0,
            C: parseInt(preferencesContainer.querySelector('#shift-c-' + employee.id).value) || 0
          };

          // 發送更新請求
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

          // 顯示成功提示
          const toast = document.createElement('div');
          toast.className = 'toast align-items-center text-white bg-success border-0 position-fixed bottom-0 end-0 m-3';
          toast.setAttribute('role', 'alert');
          toast.setAttribute('aria-live', 'assertive');
          toast.setAttribute('aria-atomic', 'true');
          toast.innerHTML = `
            <div class="d-flex">
              <div class="toast-body">
                班別需求已更新
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

        } catch (err) {
          console.error('更新班別需求時發生錯誤：', err);
          
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

      div.appendChild(preferencesContainer);
      memberListEl.appendChild(div);
    });
  } catch (err) {
    console.error('取得資料時發生錯誤：', err.message);
    memberListEl.innerHTML = '<div class="text-danger">無法載入資料</div>';
  }
}); 