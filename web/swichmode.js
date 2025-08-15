// 功能：處理月曆模式、人員模式、每日上班人員模式之間的切換

class ModeSwitcher {
    constructor(reinitializeCalendar) {
        // 初始化變數
        this.currentMode = 'calendar'; // 預設為月曆模式
        this.contentNav = document.querySelector('nav.content');
        
        // 模式按鈕元素
        this.modeButtons = {
            calendar: document.querySelector('.mode-calendar'),
            employees: document.querySelector('.mode-employees'),
            dailyEmployees: document.querySelector('.mode-daily-employees'),
            shiftconfig: document.querySelector('.shifttype-config')
        };
        
        this.reinitializeCalendar = reinitializeCalendar;
        
        // 初始化
        this.init();
    }
    
    init() {
        // 綁定事件監聽器
        this.bindEvents();
        
        // 預設顯示月曆模式（不重新初始化，因為原本就有月曆）
        this.updateActiveButton('calendar');
    }
    
    bindEvents() {
        // 月曆模式按鈕點擊事件
        this.modeButtons.calendar.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToMode('calendar');
        });
        
        // 人員模式按鈕點擊事件
        this.modeButtons.employees.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToMode('employees');
        });
        
        // 每日上班人員模式按鈕點擊事件
        this.modeButtons.dailyEmployees.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToMode('dailyEmployees');
        });

        // 班別類型設定按鈕點擊事件
        this.modeButtons.shiftconfig.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToMode('shiftconfig');
        });

        // 使用事件委派來監聽暫存班表按鈕的點擊
        document.body.addEventListener('click', (e) => {
            const draftButton = e.target.closest('.draft-cycle-btn');
            if (draftButton) {
                e.preventDefault();
                const cycleData = {
                    cycle_id: draftButton.dataset.cycleId,
                    start_date: draftButton.dataset.startDate,
                    end_date: draftButton.dataset.endDate,
                    shift_group: draftButton.dataset.shiftGroup,
                };
                console.log(draftButton.dataset)
                this.switchToTempScheduleMode(cycleData);
            }
        });
    }
    
    // 切換到指定模式
    switchToMode(mode) {
        if (this.currentMode === mode) return; // 如果已經是當前模式，不執行切換
        
        // 先隱藏當前模式，並在回調中顯示新模式
        this.hideCurrentMode(() => {
            // 切換到新模式
            switch (mode) {
                case 'calendar':
                    this.showCalendarMode();
                    break;
                case 'employees':
                    this.showEmployeesMode();
                    break;
                case 'dailyEmployees':
                    this.showDailyEmployeesMode();
                    break;
                case 'shiftconfig':
                    this.showShiftConfigMode();
                    break;
            }
            
            this.currentMode = mode;
            this.updateActiveButton(mode);
        });
    }
    
    // 隱藏當前模式
    hideCurrentMode(callback) {
        // 添加淡出動畫
        this.contentNav.classList.add('fadeout');
        
        // 等待動畫完成後隱藏內容並執行回調
        setTimeout(() => {
            // 清空內容區域
            this.contentNav.innerHTML = '';
            this.contentNav.classList.remove('fadeout');
            if (callback) {
                callback();
            }
        }, 400);
    }
    
    // 顯示月曆模式
    showCalendarMode() {
        // 重新添加月曆容器（不重複載入腳本）
        this.contentNav.innerHTML = `
            <div id="calendar-container"></div>
        `;
        
        // 重新初始化月曆（如果需要的話）
        this.reinitializeCalendar();
        
        // 添加淡入動畫
        setTimeout(() => {
            this.contentNav.classList.add('fadein');
        }, 50);
    }
    
    // 顯示人員模式
    showEmployeesMode() {
        // 使用 employeesmode.js 的實例來顯示人員班表
        if (window.employeesMode) {
            window.employeesMode.show();
        } else {
            console.error('employeesMode 實例不存在');
            // 備用方案：顯示錯誤訊息
            this.contentNav.innerHTML = `
                <div class="employeesmode">
                    <div class="alert alert-danger">
                        無法載入人員班表模式，請重新整理頁面
                    </div>
                </div>
            `;
        }
    }
    
    // 顯示每日上班人員模式
    showDailyEmployeesMode() {
        // 創建每日上班人員容器
        this.contentNav.innerHTML = `
            <div class="daily-employees-mode">
                <h3>每日上班人員模式</h3>
                <p>此功能正在開發中...</p>
            </div>
        `;
        
        // 添加淡入動畫
        setTimeout(() => {
            this.contentNav.classList.add('fadein');
        }, 50);
    }
    
    // 新增：切換到暫存班表模式
    switchToTempScheduleMode(cycleData) {
        // 先隱藏當前模式，並在回調中顯示新模式
        this.hideCurrentMode(() => {
            if (window.tempScheduleMode) {
                window.tempScheduleMode.show(cycleData);
            } else {
                console.error('tempScheduleMode 實例不存在');
                this.contentNav.innerHTML = `
                    <div class="alert alert-danger">
                        無法載入暫存班表模式，請重新整理頁面。
                    </div>
                `;
            }
            
            // 將當前模式設為一個特殊值，並取消所有主要模式按鈕的 active 狀態
            this.currentMode = `temp-schedule-${cycleData.cycle_id}`;
            this.updateActiveButton(null);
        });
    }

    showShiftConfigMode() {
        // 使用 shifttype_config.js 的實例來顯示班別設定
        if (window.shiftTypeConfigManager) {
            window.shiftTypeConfigManager.show();
        } else {
            console.error('shiftTypeConfigManager 實例不存在');
            // 備用方案：顯示錯誤訊息
            this.contentNav.innerHTML = `
                <div class="shift-config-mode">
                    <div class="alert alert-danger">
                        無法載入班別設定模式，請重新整理頁面
                    </div>
                </div>
            `;
        }
        
        // 添加淡入動畫
        setTimeout(() => {
            this.contentNav.classList.add('fadein');
        }, 50);
    }
    
    // 更新活動按鈕狀態
    updateActiveButton(activeMode) {
        // 移除所有按鈕的活動狀態
        Object.values(this.modeButtons).forEach(button => {
            if (button) button.classList.remove('active');
        });
        
        // 移除所有模式容器的活動狀態
        const calendarmode = document.querySelector('.calendarmode');
        if (calendarmode) {
            calendarmode.classList.remove('mode-calendar-active', 'mode-employees-active', 'mode-daily-employees-active');
        }
        
        // 添加當前活動按鈕的狀態
        if (activeMode && this.modeButtons[activeMode]) {
            this.modeButtons[activeMode].classList.add('active');
        }
        
        // 為模式容器添加對應的活動狀態
        if (calendarmode) {
            switch (activeMode) {
                case 'calendar':
                    calendarmode.classList.add('mode-calendar-active');
                    break;
                case 'employees':
                    calendarmode.classList.add('mode-employees-active');
                    break;
                case 'dailyEmployees':
                    calendarmode.classList.add('mode-daily-employees-active');
                    break;
            }
        }
    }
}

// 當 DOM 載入完成後初始化模式切換器
// document.addEventListener('DOMContentLoaded', () => {
//     new ModeSwitcher();
// }); 