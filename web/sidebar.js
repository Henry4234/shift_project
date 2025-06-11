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
    setTimeout(() => calendar.updateSize(), 350);
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
    document.setI
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
document.addEventListener('click', (e) => {
    const personItem = e.target.closest('.person_items');
    if (personItem) {
        const container = personItem.nextElementSibling;
        if (container && container.classList.contains('preferences-container')) {
            // 如果有其他展開的容器，先收起它
            if (currentlyExpanded && currentlyExpanded !== container) {
                const expandedButton = currentlyExpanded.previousElementSibling;
                expandedButton.classList.remove('show_submenu');
                currentlyExpanded.classList.remove('show');
            }

            // 切換當前容器
            const isExpanding = !container.classList.contains('show');
            personItem.classList.toggle('show_submenu');
            container.classList.toggle('show');
            
            // 更新當前展開的容器
            currentlyExpanded = isExpanding ? container : null;
        }
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