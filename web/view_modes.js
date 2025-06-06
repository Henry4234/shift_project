/**
 * 排班系統視圖模式控制器
 */

class ScheduleViewController {
  constructor() {
    this.calendarEl = document.getElementById('calendar-container');
    this.rosterEl = document.getElementById('roster-container');
    this.dailyEl = document.getElementById('daily-container');
    this.viewModeSelect = document.getElementById('view-mode');
    
    // 初始化 FullCalendar 實例
    this.calendar = new FullCalendar.Calendar(this.calendarEl, {
      locale: 'zh-tw',
      initialView: 'dayGridMonth',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth'
      },
      titleFormat: { year: 'numeric', month: 'numeric' }
    });

    // 綁定視圖切換事件
    this.viewModeSelect.addEventListener('change', this.handleViewModeChange.bind(this));
    
    // 初始化視圖
    this.initializeView();
  }

  /**
   * 初始化視圖
   */
  initializeView() {
    // 根據選擇的模式初始化視圖
    const currentMode = this.viewModeSelect.value;
    this.switchView(currentMode);
  }

  /**
   * 處理視圖模式變更
   * @param {Event} event - 變更事件
   */
  handleViewModeChange(event) {
    const newMode = event.target.value;
    this.switchView(newMode);
  }

  /**
   * 切換視圖模式
   * @param {string} mode - 視圖模式
   */
  switchView(mode) {
    // 隱藏所有容器
    this.hideAllContainers();

    switch (mode) {
      case 'calendar':
        this.showCalendarView();
        break;
      case 'roster':
        this.showRosterView();
        break;
      case 'daily':
        this.showDailyView();
        break;
    }
  }

  /**
   * 隱藏所有容器
   */
  hideAllContainers() {
    this.calendarEl.style.display = 'none';
    this.rosterEl.style.display = 'none';
    this.dailyEl.style.display = 'none';
  }

  /**
   * 顯示月曆視圖
   */
  showCalendarView() {
    this.calendarEl.style.display = 'block';
    this.calendar.render();
  }

  /**
   * 顯示人員排班表視圖
   */
  showRosterView() {
    this.rosterEl.style.display = 'block';
    this.renderRosterView();
  }

  /**
   * 顯示每日上班人員視圖
   */
  showDailyView() {
    this.dailyEl.style.display = 'block';
    this.calendar.render();
    // TODO: 加入從 Supabase 擷取的資料
  }

  /**
   * 渲染人員排班表視圖
   */
  renderRosterView() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // 取得當月天數
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // 建立表格標題
    let tableHTML = `
      <table class="table table-bordered roster-table">
        <thead>
          <tr>
            <th>員工姓名</th>
    `;
    
    // 加入日期欄位
    for (let day = 1; day <= daysInMonth; day++) {
      tableHTML += `<th>${day}日</th>`;
    }
    
    tableHTML += `
        </tr>
        </thead>
        <tbody>
          <!-- TODO: 從 Supabase 獲取員工資料並填入 -->
        </tbody>
      </table>
    `;
    
    this.rosterEl.innerHTML = tableHTML;
  }
}

// 當 DOM 載入完成後初始化視圖控制器
document.addEventListener('DOMContentLoaded', () => {
  new ScheduleViewController();
}); 