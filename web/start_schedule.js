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
                                </div>
                            </div>
                            
                            <!-- 員工人數顯示 -->
                            <div class="employee-count-section">
                                <label class="form-label">員工人數</label>
                                <div id="employeeCount" class="form-control-plaintext">0 人</div>
                            </div>
                            
                            <!-- 員工參數設定按鈕 -->
                            <div class="mb-3">
                                <button type="button" class="btn btn-outline-primary w-100" id="employeeConfigBtn">
                                    員工參數設定
                                </button>
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
            // 顯示員工人數
            updateEmployeeCount();
            // 重設表單
            document.getElementById('startScheduleForm').reset();
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

    // 顯示員工人數
    function updateEmployeeCount() {
        // 從全域變數 window.employeesResponse 取得員工數
        const count = Array.isArray(window.employeesResponse) ? window.employeesResponse.length : 0;
        document.getElementById('employeeCount').textContent = count + ' 人';
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
        // 取得日期
        const startDate = document.getElementById('scheduleStartDate').value;
        const endDate = document.getElementById('scheduleEndDate').value;
        if (!startDate || !endDate) {
            alert('請選擇開始與結束日期');
            return;
        }
        try {
            // 呼叫後端 API 建立新 cycle
            const resp = await fetch('/api/schedule-cycles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start_date: startDate, end_date: endDate })
            });
            const data = await resp.json();
            if (resp.ok) {
                alert('已建立新的排班週期！');
                startScheduleModal.hide();
                // 觸發 draft 班表重新載入
                if (window.loadDraftCycles) window.loadDraftCycles();
            } else {
                alert(data.error || '建立失敗');
            }
        } catch (err) {
            alert('建立排班週期時發生錯誤');
        }
    });
}); 