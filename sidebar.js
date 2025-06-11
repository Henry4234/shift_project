

const body = document.querySelector("body");
const darkLight = document.querySelector("#darkLight");
const sidebar = document.querySelector(".sidebar");
const submenuItems = document.querySelectorAll(".submenu_item");
const sidebarOpen = document.querySelector("#sidebarOpen");
const sidebarClose = document.querySelector(".collapse_sidebar");
const sidebarExpand = document.querySelector(".expand_sidebar");
const bottomContent = document.querySelector(".bottom_content");


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
submenuItems.forEach((item, index) => {
  item.addEventListener("click", () => {
    item.classList.toggle("show_submenu");
    submenuItems.forEach((item2, index2) => {
      if (index !== index2) {
        item2.classList.remove("show_submenu");
      }
    });
  });
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