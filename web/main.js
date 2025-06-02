// main.js
import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  const memberListEl = document.getElementById('member-list');

  try {
    const { data: members, error } = await supabase
      .from('employees') // 替換為您的資料表名稱
      .select('*');

    if (error) throw error;

    // 清空現有內容
    memberListEl.innerHTML = '';

    // 顯示每位人員
    members.forEach(member => {
      const div = document.createElement('div');
      div.className = 'form-check';
      div.innerHTML = `
        <input class="form-check-input" type="checkbox" value="${member.id}" id="member-${member.id}">
        <label class="form-check-label" for="member-${member.id}">
          ${member.name}
        </label>
      `;
      memberListEl.appendChild(div);
    });
  } catch (err) {
    console.error('取得人員資料時發生錯誤：', err.message);
    memberListEl.innerHTML = '<div class="text-danger">無法載入人員資料</div>';
  }
});