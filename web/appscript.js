// 將 calendar 設為全局變數
window.calendar;

// 將員工資料設為全域變數
window.employeesResponse = null;

// 全局初始化日曆函數
window.initCalendar = function() {
    const el = document.getElementById('calendar-container');
    if (!el) {
        console.error("找不到日曆容器 #calendar-container");
        return;
    }

    // 如果已有日曆實例，先銷毀
    if (window.calendar) {
        window.calendar.destroy();
    }

    window.calendar = new FullCalendar.Calendar(el, {
        locale: 'zh-tw',
        initialView: 'dayGridMonth',
        themeSystem: 'bootstrap5',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth'
        },
        titleFormat: { year: 'numeric', month: 'numeric' },
        events: [
            {
                title: '開國紀念日',
                start: '2025-01-01'
            },
            {
                title: '小年夜',
                start: '2025-01-27'
            },
            {
                title: '農曆除夕',
                start: '2025-01-28'
            },
            {
                title: '春節',
                start: '2025-01-29'
            },
            {
                title: '春節',
                start: '2025-01-30'
            },
            {
                title: '春節',
                start: '2025-01-31'
            },
            {
                title: '和平紀念日',
                start: '2025-02-28'
            },
            {
                title: '補假',
                start: '2025-04-03'
            },
            {
                title: '兒童節及民族掃墓節',
                start: '2025-04-04'
            },
            {
                title: '補假',
                start: '2025-05-30'
            },
            {
                title: '端午節',
                start: '2025-05-31'
            },
            {
                title: '中秋節',
                start: '2025-10-06'
            },
            {
                title: '國慶日',
                start: '2025-10-10'
            }
        ],
        eventColor: '#ff5f2e'
    });
    window.calendar.render();
};

// 獲取員工資料並設定到全域變數
async function loadEmployeesData() {
    try {
        console.log('開始從 API 獲取員工資料...');
        const response = await fetch('/api/employees');
        // const response = await fetch('./simulate_employees.json');
        if (!response.ok) {
            throw new Error(`HTTP 錯誤! 狀態: ${response.status}`);
        }
        
        const employees = await response.json();
        window.employeesResponse = employees;
        console.log('成功獲取員工資料並設定到全域變數：', employees);
        
        // 如果 employeesMode 已存在，更新其員工資料
        if (window.employeesMode) {
            window.employeesMode.updateEmployeesData();
        }
        
        return employees;
    } catch (error) {
        console.error('獲取員工資料時發生錯誤：', error);
        // 設定預設資料作為備用
        window.employeesResponse = [
            { id: 1, name: '張小明' },
            { id: 2, name: '李小華' },
            { id: 3, name: '王小美' },
            { id: 4, name: '陳小強' },
            { id: 5, name: '林小芳' }
        ];
        console.warn('使用預設員工資料作為備用');
        return window.employeesResponse;
    }
}

// 新增：載入 draft 班表
window.loadDraftCycles = async function() {
    const menuTempt = document.querySelector('.menu_tempt');
    let draftDiv = document.getElementById('draft-cycles-list');
    if (!draftDiv) {
        draftDiv = document.createElement('div');
        draftDiv.id = 'draft-cycles-list';
        menuTempt.parentNode.insertBefore(draftDiv, menuTempt.nextSibling);
    }
    draftDiv.innerHTML = '<div class="spinner-border text-primary" role="status" style="width:2.5rem;height:2.5rem;"></div><div class="loadingtitle text-muted">載入中...</div>';
    try {
        const resp = await fetch('/api/schedule-cycles?status=draft');
        const data = await resp.json();
        if (resp.ok) {
            if (data.length === 0) {
                draftDiv.innerHTML = '<div class="text-muted" style="padding: 0 20px;">目前沒有暫存班表</div>';
            } else {
                draftDiv.innerHTML = data.map(c => `
                    <li class="item">
                        <div class="nav_link draft-cycle-btn" 
                                role="button"
                                tabindex="0"
                                data-cycle-id="${c.cycle_id}" 
                                data-start-date="${c.start_date}" 
                                data-end-date="${c.end_date}">
                            <span class="navlink_icon">
                                <i class='bx bx-list-ul'></i>
                            </span>
                            <span class="navlink">週期 #${c.cycle_id}</span>
                        </div>
                    </li>
                `).join('');
            }
        } else {
            draftDiv.innerHTML = `<div class="text-danger" style="padding: 0 20px;">載入失敗：${data.error}</div>`;
        }
    } catch (err) {
        draftDiv.innerHTML = `<div class="text-danger" style="padding: 0 20px;">載入失敗</div>`;
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    const memberListEl = document.getElementById('member-list');
    // 只顯示空內容或提示
    // memberListEl.innerHTML = '<div class="text-muted">請透過「員工設定」進行管理</div>';
    
    // 先獲取員工資料
    await loadEmployeesData();
    
    // 初始化月曆
    window.initCalendar();
    // 初始化模式切換器，並傳入日曆初始化函數
    new ModeSwitcher(window.initCalendar);
    // 新增：載入暫存班表
    window.loadDraftCycles();
});

// 處理開始生成按鈕點擊事件
document.querySelector('.start-cal-btn').addEventListener('click', async function(e) {
    e.preventDefault();
    
    // 顯示載入中的提示
    const toastContainer = document.querySelector('.toast-container');
    const loadingToast = document.createElement('div');
    loadingToast.className = 'toast';
    loadingToast.innerHTML = `
        <div class="toast-header">
            <strong class="me-auto">系統訊息</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            正在生成排班表，請稍候...
        </div>
    `;
    toastContainer.appendChild(loadingToast);
    const bsLoadingToast = new bootstrap.Toast(loadingToast);
    bsLoadingToast.show();

    try {
        const response = await fetch('http://localhost:5000/api/run-schedule', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        // 移除載入中的提示
        bsLoadingToast.hide();
        loadingToast.remove();

        // 顯示結果提示
        const resultToast = document.createElement('div');
        resultToast.className = 'toast';
        resultToast.innerHTML = `
            <div class="toast-header">
                <strong class="me-auto">系統訊息</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${data.message}
            </div>
        `;
        toastContainer.appendChild(resultToast);
        const bsResultToast = new bootstrap.Toast(resultToast);
        bsResultToast.show();

        // 如果成功，更新日曆顯示
        if (data.status === 'success') {
            // 清除現有事件
            window.calendar.removeAllEvents();
            
            // 添加新的排班事件
            const events = [];
            Object.entries(data.data.schedules).forEach(([employee, schedule]) => {
                schedule.forEach((shift, index) => {
                    if (shift !== 'O') {  // 只顯示非休息的班次
                        const date = new Date(2025, 2, index + 1);  // 2025年3月
                        events.push({
                            title: `${employee} - ${shift}班`,
                            start: date,
                            backgroundColor: getShiftColor(shift),
                            borderColor: getShiftColor(shift)
                        });
                    }
                });
            });
            
            // 添加事件到日曆
            window.calendar.addEventSource(events);
            
            // 顯示懲罰分數
            const penaltyToast = document.createElement('div');
            penaltyToast.className = 'toast';
            penaltyToast.innerHTML = `
                <div class="toast-header">
                    <strong class="me-auto">排班品質</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    總懲罰分數：${data.data.penalty}（越低越好）
                </div>
            `;
            toastContainer.appendChild(penaltyToast);
            const bsPenaltyToast = new bootstrap.Toast(penaltyToast);
            bsPenaltyToast.show();
        }

    } catch (error) {
        // 移除載入中的提示
        bsLoadingToast.hide();
        loadingToast.remove();

        // 顯示錯誤提示
        const errorToast = document.createElement('div');
        errorToast.className = 'toast';
        errorToast.innerHTML = `
            <div class="toast-header">
                <strong class="me-auto">錯誤訊息</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                發生錯誤：${error.message}
            </div>
        `;
        toastContainer.appendChild(errorToast);
        const bsErrorToast = new bootstrap.Toast(errorToast);
        bsErrorToast.show();
    }
});

// 根據班次類型返回顏色
function getShiftColor(shift) {
    switch(shift) {
        case 'A': return '#4CAF50';  // 綠色
        case 'B': return '#2196F3';  // 藍色
        case 'C': return '#9C27B0';  // 紫色
        default: return '#757575';   // 灰色
    }
}