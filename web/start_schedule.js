// start_schedule.js
// 這個檔案負責處理「開始排班」按鈕的彈窗與互動

// 監聽 DOM 載入完成
window.addEventListener('DOMContentLoaded', () => {
    // 建立 Modal HTML 結構
    const modalHTML = `
        <div class="modal fade" id="startScheduleModal" tabindex="-1" aria-labelledby="startScheduleModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <i class='bx bx-play-circle'></i>
                        <h5 class="modal-title" id="startScheduleModalLabel">開始排班設定</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="startScheduleForm">
                            <!-- 日期設定區域 -->
                            <div class="date-settings-container">
                                <div class="date-settings-row">
                                    <!-- 左側日期輸入區域 -->
                                    <div class="date-settings-cell date-inputs">
                                        <!-- 開始日期 -->
                                        <div class="mb-3">
                                            <label for="scheduleStartDate" class="form-label">開始日期</label>
                                            <input type="date" class="form-control" id="scheduleStartDate" required>
                                        </div>
                                        <!-- 結束日期 -->
                                        <div class="mb-3">
                                            <label for="scheduleEndDate" class="form-label">結束日期</label>
                                            <input type="date" class="form-control" id="scheduleEndDate" required>
                                        </div>
                                    </div>
                                    <!-- 右側天數顯示區域 -->
                                    <div class="date-settings-cell days-display">
                                        <label class="form-label">排班區間天數</label>
                                        <div id="scheduleDays">0 天</div>
                                    </div>
                                    <div class="date-settings-cell shift-select">
                                        <label class="form-label">選擇班別群組</label>
                                        <div id="ShiftListGroup" class="list-group">
                                            <!-- 班別列表將動態生成於此 -->
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 分隔線 -->
                            <hr class="my-3">

                            <!-- 員工設定區域 -->
                            <div class="employee-settings-container">
                                <div class="employee-settings-row">
                                    <!-- 左側區域 -->
                                    <div class="employee-settings-cell employee-inputs">
                                        <!-- 員工人數顯示 -->
                                        <div class="mb-3">
                                            <label class="form-label">已選擇員工人數</label>
                                            <div id="employeeCount" class="form-control-plaintext">0 人</div>
                                        </div>
                                        <!-- 員工參數設定按鈕 -->
                                        <div class="mb-3">
                                            <button type="button" class="btn btn-outline-primary w-100" id="employeeConfigBtn">
                                                員工參數設定
                                            </button>
                                        </div>
                                    </div>
                                    <!-- 右側員工列表 -->
                                    <div class="employee-settings-cell employee-list">
                                        <label class="form-label">選擇參與排班的員工</label>
                                        <div id="employeeListGroup" class="list-group">
                                            <!-- 員工列表將動態生成於此 -->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary" id="confirmStartSchedule">開始排班</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 將 Modal 插入 body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // 初始化 Bootstrap Modal
    const startScheduleModal = new bootstrap.Modal(document.getElementById('startScheduleModal'));

    // 監聽 .start-schedule 按鈕點擊事件
    document.addEventListener('click', (event) => {
        const startBtn = event.target.closest('.start-schedule');
        if (startBtn) {
            // 重設表單
            document.getElementById('startScheduleForm').reset();
            // 設定員工選擇列表並更新人數
            setupEmployeeSelection();
            // 設定班別群組選擇列表
            setupShiftGroupSelection();
            document.getElementById('scheduleDays').textContent = '0 天';
            startScheduleModal.show();
        }
    });

    // 監聽日期選擇自動計算天數
    const startDateInput = document.getElementById('scheduleStartDate');
    const endDateInput = document.getElementById('scheduleEndDate');
    startDateInput.addEventListener('change', updateDays);
    endDateInput.addEventListener('change', updateDays);

    // 計算區間天數並顯示
    function updateDays() {
        const start = startDateInput.value;
        const end = endDateInput.value;
        const daysDiv = document.getElementById('scheduleDays');
        if (start && end) {
            const startDate = new Date(start);
            const endDate = new Date(end);
            const diff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            daysDiv.textContent = (diff > 0 ? diff : 0) + ' 天';
        } else {
            daysDiv.textContent = '0 天';
        }
    }

    // 更新所選員工人數
    function updateEmployeeCount() {
        const selectedCount = document.querySelectorAll('#employeeListGroup .employee-checkbox:checked').length;
        document.getElementById('employeeCount').textContent = selectedCount + ' 人';

        // 更新全選 checkbox 狀態
        const employeeCheckboxes = document.querySelectorAll('#employeeListGroup .employee-checkbox');
        const selectAllCheckbox = document.getElementById('selectAllEmployees');
        if (selectAllCheckbox) {
            const totalEmployees = employeeCheckboxes.length;

            if (totalEmployees > 0 && selectedCount > 0 && selectedCount < totalEmployees) {
                // 部分選擇
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = true;
            } else {
                // 全選或全不選
                selectAllCheckbox.indeterminate = false;
                selectAllCheckbox.checked = totalEmployees > 0 && selectedCount === totalEmployees;
            }
        }
    }

    // 設定員工選擇列表
    function setupEmployeeSelection() {
        const listGroup = document.getElementById('employeeListGroup');
        const employees = window.employeesResponse || [];
        
        listGroup.innerHTML = ''; // 清空舊列表

        if (employees.length === 0) {
            listGroup.innerHTML = '<div class="list-group-item">沒有可選擇的員工。</div>';
            updateEmployeeCount();
            return;
        }

        // 建立 "全選" Checkbox
        const selectAllItem = document.createElement('div');
        selectAllItem.className = 'list-group-item';
        selectAllItem.innerHTML = `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" id="selectAllEmployees">
                <label class="form-check-label fw-bold" for="selectAllEmployees">全選/取消全選</label>
            </div>
        `;
        listGroup.appendChild(selectAllItem);

        // 建立員工 Checkbox 列表
        employees.forEach(employee => {
            const item = document.createElement('div');
            item.className = 'list-group-item';
            item.innerHTML = `
                <div class="form-check">
                    <input class="form-check-input employee-checkbox" type="checkbox" value="${employee.id}" id="employee-${employee.id}" checked>
                    <label class="form-check-label" for="employee-${employee.id}">${employee.name}</label>
                </div>
            `;
            listGroup.appendChild(item);
        });

        // 綁定事件監聽
        const selectAllCheckbox = document.getElementById('selectAllEmployees');
        const employeeCheckboxes = document.querySelectorAll('#employeeListGroup .employee-checkbox');

        selectAllCheckbox.addEventListener('change', (e) => {
            employeeCheckboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
            updateEmployeeCount();
        });

        employeeCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateEmployeeCount);
        });

        // 初始化人數
        updateEmployeeCount();
    }

    // 設定班別群組選擇列表
    async function setupShiftGroupSelection() {
        const listGroup = document.getElementById('ShiftListGroup');
        
        try {
            // 從 API 獲取班別群組名稱
            const response = await fetch('/api/shift-group-names');
            const groupNames = await response.json();
            
            if (!response.ok) {
                throw new Error(groupNames.error || '無法載入班別群組');
            }
            
            listGroup.innerHTML = ''; // 清空舊列表

            if (groupNames.length === 0) {
                listGroup.innerHTML = '<div class="list-group-item">沒有可選擇的班別群組。</div>';
                return;
            }

            // 建立班別群組選項
            groupNames.forEach((groupName, index) => {
                const item = document.createElement('div');
                item.className = 'list-group-item';
                item.innerHTML = `
                    <div class="form-check">
                        <input class="form-check-input shift-group-checkbox" type="radio" name="shiftGroup" value="${groupName}" id="shift-group-${index}" ${index === 0 ? 'checked' : ''}>
                        <label class="form-check-label" for="shift-group-${index}">${groupName}</label>
                    </div>
                `;
                listGroup.appendChild(item);
            });

        } catch (error) {
            console.error('載入班別群組時發生錯誤:', error);
            listGroup.innerHTML = '<div class="list-group-item text-danger">載入班別群組失敗</div>';
        }
    }

    // 監聽員工參數設定按鈕，跳轉到員工設定面板
    document.getElementById('employeeConfigBtn').addEventListener('click', () => {
        if (window.employeeConfigManager) {
            startScheduleModal.hide();
            window.employeeConfigManager.showEmployeeConfig();
        }
    });

    // 監聽確認按鈕
    document.getElementById('confirmStartSchedule').addEventListener('click', async () => {
        const startDate = document.getElementById('scheduleStartDate').value;
        const endDate = document.getElementById('scheduleEndDate').value;
        const selectedIds = Array.from(document.querySelectorAll('#employeeListGroup .employee-checkbox:checked'))
            .map(cb => parseInt(cb.value, 10));
        const selectedShiftGroup = document.querySelector('input[name="shiftGroup"]:checked')?.value;
        
        if (!startDate || !endDate || selectedIds.length === 0) {
            alert('請選擇日期與員工');
            return;
        }
        
        if (!selectedShiftGroup) {
            alert('請選擇班別群組');
            return;
        }
        
        try {
            // 1. 建立 cycle
            const resp1 = await fetch('/api/schedule-cycles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    start_date: startDate, 
                    end_date: endDate,
                    shift_group: selectedShiftGroup
                })
            });
            const data1 = await resp1.json();
            if (!resp1.ok) throw new Error(data1.error || '建立週期失敗');
            const cycle_id = data1.cycle_id;

            // 2. 取得員工快照
            const resp2 = await fetch('/api/shift-requirements-legacy?employee_ids=' + selectedIds.join(','));
            const members = await resp2.json();
            if (!resp2.ok) throw new Error(members.error || '取得員工快照失敗');

            // 3. 批次寫入 schedule_cycle_members
            const resp3 = await fetch('/api/schedule-cycle-members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cycle_id, members })
            });
            const data3 = await resp3.json();
            if (!resp3.ok) throw new Error(data3.error || '寫入成員失敗');

            alert('已建立新的排班週期!請點選左側週期進行畫假!');
            startScheduleModal.hide();
            if (window.loadDraftCycles) window.loadDraftCycles();
        } catch (err) {
            alert(err.message || '建立排班週期時發生錯誤');
        }
    });
}); 