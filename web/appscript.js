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

document.addEventListener('DOMContentLoaded', async () => {
    const memberListEl = document.getElementById('member-list');
    // 只顯示空內容或提示
    memberListEl.innerHTML = '<div class="text-muted">請透過「員工設定」進行管理</div>';
    // 初始化月曆
    window.initCalendar();
    // 初始化模式切換器，並傳入日曆初始化函數
    new ModeSwitcher(window.initCalendar);
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