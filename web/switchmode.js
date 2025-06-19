// swichmode.js
// 功能：切換月曆/人員/每日上班人員模式，並動態顯示對應內容

document.addEventListener('DOMContentLoaded', function () {
    // 取得模式切換按鈕
    const calendarBtn = document.querySelector('.mode-calendar');
    const employeesBtn = document.querySelector('.mode-employees');
    const dailyEmployeesBtn = document.querySelector('.mode-daily-employees .navlink');
    // 內容區
    const contentNav = document.querySelector('nav.content');
    // 人員班表容器
    let employeesModeDiv = null;

    // 預設顯示月曆模式
    showCalendarMode();

    // 月曆模式
    calendarBtn.addEventListener('click', function (e) {
        
        e.preventDefault();
        console.log('點擊月曆模式');
        showCalendarMode();
    });

    // 人員模式
    employeesBtn.addEventListener('click', function (e) {
        
        e.preventDefault();
        console.log('點擊人員模式');
        showEmployeesMode();
    });

    // 每日上班人員模式（可擴充）
    dailyEmployeesBtn.addEventListener('click', function (e) {
        
        e.preventDefault();
        // 目前僅顯示提示
        alert('每日上班人員模式尚未實作');
    });

    // 顯示月曆模式
    function showCalendarMode() {
        // 顯示月曆
        contentNav.classList.remove('fadeout');
        contentNav.classList.add('fadein');
        contentNav.style.display = '';
        // 移除人員班表
        if (employeesModeDiv) {
            employeesModeDiv.classList.remove('fadein');
            employeesModeDiv.classList.add('fadeout');
            setTimeout(() => {
                if (employeesModeDiv) employeesModeDiv.remove();
                employeesModeDiv = null;
            }, 400);
        }
    }

    // 顯示人員模式
    function showEmployeesMode() {
        // 隱藏月曆
        contentNav.classList.remove('fadein');
        contentNav.classList.add('fadeout');
        setTimeout(() => {
            contentNav.style.display = 'none';
        }, 400);

        // 若已存在則不重複建立
        if (employeesModeDiv) {
            employeesModeDiv.classList.remove('fadeout');
            employeesModeDiv.classList.add('fadein');
            employeesModeDiv.style.display = '';
            return;
        }

        // 建立人員班表主體
        employeesModeDiv = document.createElement('div');
        employeesModeDiv.className = 'employeesmode fadein';
        employeesModeDiv.innerHTML = generateEmployeesTable();
        // 插入於 contentNav 之後
        contentNav.parentNode.insertBefore(employeesModeDiv, contentNav.nextSibling);
    }

    // 產生人員班表 HTML
    function generateEmployeesTable() {
        // 假設員工名單（可串接API取得）
        const employees = ['王小明', '陳美麗', '李大華', '張三', '林小強'];
        // 取得本月天數
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // 產生表頭
        let table = `<div class="employees-table-outer"><table class="employees-table"><thead><tr><th>姓名</th>`;
        for (let d = 1; d <= daysInMonth; d++) {
            table += `<th>${d}</th>`;
        }
        table += `</tr></thead><tbody>`;
        // 產生每位員工的班表列
        employees.forEach(name => {
            table += `<tr><td>${name}</td>`;
            for (let d = 1; d <= daysInMonth; d++) {
                table += `<td></td>`;
            }
            table += `</tr>`;
        });
        table += `</tbody></table></div>`;
        return table;
    }
});