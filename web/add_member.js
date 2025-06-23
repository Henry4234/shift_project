// 監聽新增員工按鈕點擊事件
document.addEventListener('DOMContentLoaded', () => {
    // 只監聽員工設定面板中的新增員工按鈕
    const panel = document.getElementById('user-config-panel');
    let addMemberBtn = null;
    if (panel) {
        addMemberBtn = panel.querySelector('.add_member');
    } else {
        // fallback: 仍保留原本 sidebar 的按鈕（兼容性）
        addMemberBtn = document.querySelector('.add_member');
    }
    
    // 創建 Modal HTML
    const modalHTML = `
        <div class="modal fade" id="addMemberModal" tabindex="-1" aria-labelledby="addMemberModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <i class='bx  bx-user-plus'></i> 
                        <h5 class="modal-title" id="addMemberModalLabel">新增員工</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="addMemberForm">
                            <!-- 員工姓名 -->
                            <div class="mb-3">
                                <label for="employeeName" class="form-label">員工姓名</label>
                                <input type="text" class="form-control" id="employeeName" required>
                            </div>
                            
                            <!-- 班別天數設定 -->
                            <div class="mb-3">
                                <label class="form-label">班別天數設定</label>
                                <div class="row g-0">
                                    <div class="col">
                                        <input type="number" class="form-control input-day" id="shiftA" placeholder="白班天數" min="0" max="30" value="0">
                                    </div>
                                    <div class="col day-label">天白班</div>
                                    <div class="col">
                                        <input type="number" class="form-control input-day" id="shiftB" placeholder="小夜天數" min="0" max="30" value="0">
                                    </div>
                                    <div class="col day-label">天小夜</div>
                                    <div class="col">
                                        <input type="number" class="form-control input-day" id="shiftC" placeholder="大夜天數" min="0" max="30" value="0">
                                    </div>
                                    <div class="col day-label">天大夜</div>

                                </div>
                            </div>
                            
                            <!-- 偏好設定 -->
                            <div class="mb-3">
                                <label class="form-label">偏好設定</label>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="maxContinuousDays">
                                    <label class="form-check-label" for="maxContinuousDays">
                                        最大連續工作天數限制
                                    </label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="continuousC">
                                    <label class="form-check-label" for="continuousC">
                                        連續 C 班限制
                                    </label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="doubleOffAfterC">
                                    <label class="form-check-label" for="doubleOffAfterC">
                                        C 班後需雙休
                                    </label>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary" id="confirmAddMember">確認新增</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 將 Modal 添加到 body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // 初始化 Modal
    const addMemberModal = new bootstrap.Modal(document.getElementById('addMemberModal'));

    // 監聽新增員工按鈕點擊
    if (addMemberBtn) {
        addMemberBtn.addEventListener('click', () => {
            addMemberModal.show();
        });
    }

    // 監聽確認新增按鈕點擊
    document.getElementById('confirmAddMember').addEventListener('click', async () => {
        const form = document.getElementById('addMemberForm');
        const nameInput = document.getElementById('employeeName');
        const shiftAInput = document.getElementById('shiftA');
        const shiftBInput = document.getElementById('shiftB');
        const shiftCInput = document.getElementById('shiftC');
        
        // 驗證姓名
        if (!nameInput.value.trim()) {
            showToast('請輸入員工姓名', 'danger');
            return;
        }

        // 驗證班別天數
        const validateShiftDays = (input) => {
            const value = parseInt(input.value);
            if (isNaN(value) || !Number.isInteger(value) || value < 0 || value > 30) {
                input.classList.add('is-invalid');
                return false;
            }
            input.classList.remove('is-invalid');
            return true;
        };

        if (!validateShiftDays(shiftAInput) || 
            !validateShiftDays(shiftBInput) || 
            !validateShiftDays(shiftCInput)) {
            showToast('班別天數必須是 0-30 之間的整數', 'danger');
            return;
        }

        try {
            // 收集表單資料
            const employeeData = {
                name: nameInput.value.trim(),
                shift_requirements: {
                    A: parseInt(shiftAInput.value),
                    B: parseInt(shiftBInput.value),
                    C: parseInt(shiftCInput.value)
                },
                preferences: {
                    max_continuous_days: document.getElementById('maxContinuousDays').checked,
                    continuous_c: document.getElementById('continuousC').checked,
                    double_off_after_c: document.getElementById('doubleOffAfterC').checked
                }
            };

            // 發送新增請求
            const response = await fetch('/api/employees', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(employeeData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '新增員工失敗');
            }

            // 關閉 Modal
            addMemberModal.hide();
            
            // 顯示成功提示
            showToast('員工新增成功', 'success');
            
            // 重新載入頁面以更新員工列表
            window.location.reload();

        } catch (error) {
            console.error('新增員工時發生錯誤：', error);
            showToast(error.message || '新增員工失敗，請稍後再試', 'danger');
        }
    });

    // 顯示提示訊息的函數
    function showToast(message, type = 'success') {
        const toastContainer = document.querySelector('.toast-container');
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        toastContainer.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // 3秒後移除提示
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}); 