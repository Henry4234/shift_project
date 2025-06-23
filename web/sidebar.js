const body = document.querySelector("body");
const darkLight = document.querySelector("#darkLight");
const sidebar = document.querySelector(".sidebar");
const submenuItems = document.querySelectorAll(".submenu_item");
const sidebarOpen = document.querySelector("#sidebarOpen");
const sidebarClose = document.querySelector(".collapse_sidebar");
const sidebarExpand = document.querySelector(".expand_sidebar");
const bottomContent = document.querySelector(".bottom_content");

// 用於追蹤當前展開的容器
let currentlyExpanded = null;

function refreshCalendar() {
    // 動畫 300 ms，保險多 50 ms
    setTimeout(() => {
        if (window.calendar) {
            window.calendar.updateSize();
        }
    }, 350);
}

sidebarOpen.addEventListener("click", () => sidebar.classList.toggle("close"));
sidebarClose.addEventListener("click", () => {
    sidebar.classList.add("close", "hoverable");
    refreshCalendar();
});
sidebarExpand.addEventListener("click", () => {
    sidebar.classList.remove("close", "hoverable");
    refreshCalendar();
});
sidebar.addEventListener("mouseenter", () => {
    if (sidebar.classList.contains("hoverable")) {
        sidebar.classList.remove("close");
        refreshCalendar();
    }
});
sidebar.addEventListener("mouseleave", () => {
    if (sidebar.classList.contains("hoverable")) {
        sidebar.classList.add("close");
        refreshCalendar();
    }
});
darkLight.addEventListener("click", () => {
  body.classList.toggle("dark");
  if (body.classList.contains("dark")) {
    darkLight.classList.replace("bx-sun", "bx-moon");
  } else {
    darkLight.classList.replace("bx-moon", "bx-sun");
  }
});

// 處理一般子選單的點擊事件
submenuItems.forEach((item, index) => {
    if (!item.classList.contains('person_items')) {
        item.addEventListener("click", () => {
            item.classList.toggle("show_submenu");
            submenuItems.forEach((item2, index2) => {
                if (index !== index2) {
                    item2.classList.remove("show_submenu");
                }
            });
        });
    }
});

// 處理員工偏好設定的點擊事件
document.addEventListener('click', async (e) => {
  // 顯示員工設定面板
  if (e.target.closest('.user-config')) {
    if (window.employeeConfigManager) {
      await window.employeeConfigManager.showEmployeeConfig();
    }
  }
  // 返回主選單
  if (e.target.closest('.back-to-menu')) {
    if (window.employeeConfigManager) {
      await window.employeeConfigManager.hideEmployeeConfig();
    }
  }
  // 展開/收起員工偏好設定（只能展開一個）
  if (e.target.closest('.person_items')) {
    const navLink = e.target.closest('.person_items');
    const preferencesContainer = navLink.parentElement.querySelector('.preferences-container');
    if (preferencesContainer) {
      const isExpanding = !preferencesContainer.classList.contains('show');
      // 收起所有已展開的偏好設定
      document.querySelectorAll('.preferences-container.show').forEach(container => {
        if (container !== preferencesContainer) {
          container.classList.remove('show');
          const otherNav = container.parentElement.querySelector('.person_items');
          if (otherNav) otherNav.classList.remove('show_submenu');
        }
      });
      // 切換當前
      preferencesContainer.classList.toggle('show', isExpanding);
      navLink.classList.toggle('show_submenu', isExpanding);
    }
  }
  // 更新班別需求
  if (e.target.classList.contains('update-shifts-btn')) {
    const btn = e.target;
    const employeeId = btn.dataset.employeeId;
    const container = btn.closest('.preferences-container');
    const shiftA = parseInt(container.querySelector(`#shift-a-${employeeId}`).value) || 0;
    const shiftB = parseInt(container.querySelector(`#shift-b-${employeeId}`).value) || 0;
    const shiftC = parseInt(container.querySelector(`#shift-c-${employeeId}`).value) || 0;
    try {
      const response = await fetch(`/api/employee-amount/${employeeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ A: shiftA, B: shiftB, C: shiftC })
      });
      if (!response.ok) throw new Error('更新失敗');
      window.employeeConfigManager.showToast('班別需求已更新', 'success');
    } catch (err) {
      window.employeeConfigManager.showToast('更新失敗，請稍後再試', 'danger');
    }
  }
});

document.addEventListener('change', async (e) => {
  if (e.target.classList.contains('preference-checkbox')) {
    const checkbox = e.target;
    const container = checkbox.closest('.preferences-container');
    const navLink = container.parentElement.querySelector('.person_items');
    const employeeId = checkbox.id.split('-').pop();
    const checkboxes = container.querySelectorAll('.preference-checkbox');
    const preferences = {
      max_continuous_days: false,
      continuous_c: false,
      double_off_after_c: false
    };
    checkboxes.forEach(cb => {
      preferences[cb.dataset.type] = cb.checked;
    });
    try {
      const response = await fetch(`/api/employee-preferences/${employeeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });
      if (!response.ok) throw new Error('更新失敗');
      const newCount = Object.values(preferences).filter(v => v === true).length;
      navLink.querySelector('.preferencetitle').textContent = `${newCount} 個偏好設定`;
      window.employeeConfigManager.showToast('偏好設定已更新', 'success');
    } catch (err) {
      checkbox.checked = !checkbox.checked;
      window.employeeConfigManager.showToast('更新失敗，請稍後再試', 'danger');
    }
  }
});

document.addEventListener('input', (e) => {
  if (e.target.classList.contains('shift-requirement')) {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value !== '') {
      let numValue = parseInt(value);
      if (numValue > 30) value = '30';
      if (numValue < 0) value = '0';
    }
    e.target.value = value;
  }
});

function handleResponsiveSidebar() {
    if (window.innerWidth < 768) {
        sidebar.classList.add("close");
        if (bottomContent) bottomContent.style.display = "none"; // 全隱藏
    } else {
        sidebar.classList.remove("close");
        if (bottomContent) bottomContent.style.display = "";     // 恢復
    }
}

// 頁面載入完成先判斷一次
handleResponsiveSidebar();

// 視窗大小變動時再判斷
window.addEventListener("resize", handleResponsiveSidebar);