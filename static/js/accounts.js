/**
 * 账号管理页面 JavaScript
 * 使用 utils.js 中的工具库
 */

// Trạng thái
let currentPage = 1;
let pageSize = 20;
let totalAccounts = 0;
let selectedAccounts = new Set();
let isLoading = false;
let selectAllPages = false;  // 是否选中了全部页
let currentFilters = { status: '', email_service: '', search: '' };  // 当前筛选条件
const refreshingAccountIds = new Set();
let isBatchValidating = false;

// DOM 元素
const elements = {
    table: document.getElementById('accounts-table'),
    totalAccounts: document.getElementById('total-accounts'),
    activeAccounts: document.getElementById('active-accounts'),
    expiredAccounts: document.getElementById('expired-accounts'),
    failedAccounts: document.getElementById('failed-accounts'),
    filterStatus: document.getElementById('filter-status'),
    filterService: document.getElementById('filter-service'),
    searchInput: document.getElementById('search-input'),
    refreshBtn: document.getElementById('refresh-btn'),
    batchRefreshBtn: document.getElementById('batch-refresh-btn'),
    batchValidateBtn: document.getElementById('batch-validate-btn'),
    batchUploadBtn: document.getElementById('batch-upload-btn'),
    batchCheckSubBtn: document.getElementById('batch-check-sub-btn'),
    batchDeleteBtn: document.getElementById('batch-delete-btn'),
    exportBtn: document.getElementById('export-btn'),
    exportMenu: document.getElementById('export-menu'),
    selectAll: document.getElementById('select-all'),
    prevPage: document.getElementById('prev-page'),
    nextPage: document.getElementById('next-page'),
    pageInfo: document.getElementById('page-info'),
    detailModal: document.getElementById('detail-modal'),
    modalBody: document.getElementById('modal-body'),
    closeModal: document.getElementById('close-modal')
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadAccounts();
    initEventListeners();
    updateBatchButtons();  // 初始化按钮Trạng thái
    renderSelectAllBanner();
});

// 事件监听
function initEventListeners() {
    // 筛选
    elements.filterStatus.addEventListener('change', () => {
        currentPage = 1;
        resetSelectAllPages();
        loadAccounts();
    });

    elements.filterService.addEventListener('change', () => {
        currentPage = 1;
        resetSelectAllPages();
        loadAccounts();
    });

    // 搜索（防抖）
    elements.searchInput.addEventListener('input', debounce(() => {
        currentPage = 1;
        resetSelectAllPages();
        loadAccounts();
    }, 300));

    // 快捷键聚焦搜索
    elements.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            elements.searchInput.blur();
            elements.searchInput.value = '';
            resetSelectAllPages();
            loadAccounts();
        }
    });

    // Làm mới
    elements.refreshBtn.addEventListener('click', () => {
        loadStats();
        loadAccounts();
        toast.info('Đã làm mới');
    });

    // 批量Làm mớiToken
    elements.batchRefreshBtn.addEventListener('click', handleBatchRefresh);

    // 批量验证Token
    elements.batchValidateBtn.addEventListener('click', handleBatchValidate);

    // 批量检测订阅
    elements.batchCheckSubBtn.addEventListener('click', handleBatchCheckSubscription);

    // Tải lên下拉菜单
    const uploadMenu = document.getElementById('upload-menu');
    elements.batchUploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadMenu.classList.toggle('active');
    });
    document.getElementById('batch-upload-cpa-item').addEventListener('click', (e) => { e.preventDefault(); uploadMenu.classList.remove('active'); handleBatchUploadCpa(); });
    document.getElementById('batch-upload-sub2api-item').addEventListener('click', (e) => { e.preventDefault(); uploadMenu.classList.remove('active'); handleBatchUploadSub2Api(); });
    document.getElementById('batch-upload-tm-item').addEventListener('click', (e) => { e.preventDefault(); uploadMenu.classList.remove('active'); handleBatchUploadTm(); });
    document.getElementById('batch-upload-newapi-item').addEventListener('click', (e) => { e.preventDefault(); uploadMenu.classList.remove('active'); handleBatchUploadNewapi(); });

    // 批量Xóa
    elements.batchDeleteBtn.addEventListener('click', handleBatchDelete);

    // Codex Auth 登录
    const codexAuthBtn = document.getElementById('codex-auth-login-btn');
    if (codexAuthBtn) {
        codexAuthBtn.addEventListener('click', handleCodexAuthLogin);
    }
    const closeCodexAuthModal = document.getElementById('close-codex-auth-modal');
    if (closeCodexAuthModal) {
        closeCodexAuthModal.addEventListener('click', () => {
            document.getElementById('codex-auth-modal').classList.remove('active');
        });
    }
    const closeCodexAuthModalBtn = document.getElementById('close-codex-auth-modal-btn');
    if (closeCodexAuthModalBtn) {
        closeCodexAuthModalBtn.addEventListener('click', () => {
            document.getElementById('codex-auth-modal').classList.remove('active');
        });
    }

    // 全选（当前页）
    elements.selectAll.addEventListener('change', (e) => {
        const checkboxes = elements.table.querySelectorAll('input[type="checkbox"][data-id]');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            const id = parseInt(cb.dataset.id);
            if (e.target.checked) {
                selectedAccounts.add(id);
            } else {
                selectedAccounts.delete(id);
            }
        });
        if (!e.target.checked) {
            selectAllPages = false;
        }
        updateBatchButtons();
        renderSelectAllBanner();
    });

    // 分页
    elements.prevPage.addEventListener('click', () => {
        if (currentPage > 1 && !isLoading) {
            currentPage--;
            loadAccounts();
        }
    });

    elements.nextPage.addEventListener('click', () => {
        const totalPages = Math.ceil(totalAccounts / pageSize);
        if (currentPage < totalPages && !isLoading) {
            currentPage++;
            loadAccounts();
        }
    });

    // 导出
    elements.exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.exportMenu.classList.toggle('active');
    });

    delegate(elements.exportMenu, 'click', '.dropdown-item', (e, target) => {
        e.preventDefault();
        const format = target.dataset.format;
        exportAccounts(format);
        elements.exportMenu.classList.remove('active');
    });

    // 关闭模态框
    elements.closeModal.addEventListener('click', () => {
        elements.detailModal.classList.remove('active');
    });

    elements.detailModal.addEventListener('click', (e) => {
        if (e.target === elements.detailModal) {
            elements.detailModal.classList.remove('active');
        }
    });

    // 点击其他地方关闭下拉菜单
    document.addEventListener('click', () => {
        elements.exportMenu.classList.remove('active');
        uploadMenu.classList.remove('active');
        document.querySelectorAll('#accounts-table .dropdown-menu.active').forEach(m => m.classList.remove('active'));
    });
}

// 加载统计信息
async function loadStats() {
    try {
        const data = await api.get('/accounts/stats/summary');

        elements.totalAccounts.textContent = format.number(data.total || 0);
        elements.activeAccounts.textContent = format.number(data.by_status?.active || 0);
        elements.expiredAccounts.textContent = format.number(data.by_status?.expired || 0);
        elements.failedAccounts.textContent = format.number(data.by_status?.failed || 0);

        // 添加动画效果
        animateValue(elements.totalAccounts, data.total || 0);
    } catch (error) {
        console.error('Tải thống kê thất bại:', error);
    }
}

// 数字动画
function animateValue(element, value) {
    element.style.transition = 'transform 0.2s ease';
    element.style.transform = 'scale(1.1)';
    setTimeout(() => {
        element.style.transform = 'scale(1)';
    }, 200);
}

// 加载账号列表
async function loadAccounts() {
    if (isLoading) return;
    isLoading = true;

    // 显示加载Trạng thái
    elements.table.innerHTML = `
        <tr>
            <td colspan="9">
                <div class="empty-state">
                    <div class="skeleton skeleton-text" style="width: 60%;"></div>
                    <div class="skeleton skeleton-text" style="width: 80%;"></div>
                    <div class="skeleton skeleton-text" style="width: 40%;"></div>
                </div>
            </td>
        </tr>
    `;

    // 记录当前筛选条件
    currentFilters.status = elements.filterStatus.value;
    currentFilters.email_service = elements.filterService.value;
    currentFilters.search = elements.searchInput.value.trim();

    const params = new URLSearchParams({
        page: currentPage,
        page_size: pageSize,
    });

    if (currentFilters.status) {
        params.append('status', currentFilters.status);
    }

    if (currentFilters.email_service) {
        params.append('email_service', currentFilters.email_service);
    }

    if (currentFilters.search) {
        params.append('search', currentFilters.search);
    }

    try {
        const data = await api.get(`/accounts?${params}`);
        totalAccounts = data.total;
        renderAccounts(data.accounts);
        updatePagination();
    } catch (error) {
        console.error('Tải danh sách tài khoản thất bại:', error);
        elements.table.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <div class="empty-state-icon">❌</div>
                        <div class="empty-state-title">Tải thất bại</div>
                        <div class="empty-state-description">Vui lòng kiểm tra kết nối mạng rồi thử lại</div>
                    </div>
                </td>
            </tr>
        `;
    } finally {
        isLoading = false;
    }
}

// 渲染账号列表
function renderAccounts(accounts) {
    if (accounts.length === 0) {
        elements.table.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <div class="empty-state-icon">📭</div>
                        <div class="empty-state-title">Không có dữ liệu</div>
                        <div class="empty-state-description">Không tìm thấy tài khoản nào phù hợp</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    elements.table.innerHTML = accounts.map(account => `
        <tr data-id="${account.id}">
            <td>
                <input type="checkbox" data-id="${account.id}"
                    ${selectedAccounts.has(account.id) ? 'checked' : ''}>
            </td>
            <td>${account.id}</td>
            <td>
                <span style="display:inline-flex;align-items:center;gap:4px;">
                    <span class="email-cell" title="${escapeHtml(account.email)}">${escapeHtml(account.email)}</span>
                    <button class="btn-copy-icon copy-email-btn" data-email="${escapeHtml(account.email)}" title="Sao chép email">📋</button>
                </span>
            </td>
            <td class="password-cell">
                ${account.password
                    ? `<span style="display:inline-flex;align-items:center;gap:4px;">
                        <span class="password-hidden" data-pwd="${escapeHtml(account.password)}" onclick="togglePassword(this, this.dataset.pwd)" title="Nhấn để xem">${escapeHtml(account.password.substring(0, 4) + '****')}</span>
                        <button class="btn-copy-icon copy-pwd-btn" data-pwd="${escapeHtml(account.password)}" title="Sao chép mật khẩu">📋</button>
                       </span>`
                    : '-'}
            </td>
            <td>${getServiceTypeText(account.email_service)}</td>
            <td>${getStatusIcon(account.status)}</td>
            <td>
                <div class="cpa-status">
                    ${account.cpa_uploaded
                        ? `<span class="badge uploaded" title="Đã tải lên lúc ${format.date(account.cpa_uploaded_at)}">✓</span>`
                        : `<span class="badge pending">-</span>`}
                </div>
            </td>
            <td>
                <div class="cpa-status">
                    ${account.newapi_uploaded
                        ? `<span class="badge uploaded" title="Đã tải lên lúc ${format.date(account.newapi_uploaded_at)}">✓</span>`
                        : `<span class="badge pending">-</span>`}
                </div>
            </td>
            <td>
                <div class="cpa-status">
                    ${account.subscription_type
                        ? `<span class="badge uploaded" title="${account.subscription_type}">${account.subscription_type}</span>`
                        : `<span class="badge pending">-</span>`}
                </div>
            </td>
            <td>${format.date(account.last_refresh) || '-'}</td>
            <td>
                <div style="display:flex;gap:4px;align-items:center;white-space:nowrap;">
                    <button class="btn btn-secondary btn-sm" onclick="viewAccount(${account.id})">Chi tiết</button>
                    <div class="dropdown" style="position:relative;">
                        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();toggleMoreMenu(this)">Thêm</button>
                        <div class="dropdown-menu" style="min-width:100px;">
                            <a href="#" class="dropdown-item" onclick="event.preventDefault();closeMoreMenu(this);refreshToken(${account.id})">Làm mới</a>
                            <a href="#" class="dropdown-item" onclick="event.preventDefault();closeMoreMenu(this);uploadAccount(${account.id})">Tải lên</a>
                            <a href="#" class="dropdown-item" onclick="event.preventDefault();closeMoreMenu(this);markSubscription(${account.id})">Đánh dấu</a>
                            <a href="#" class="dropdown-item" onclick="event.preventDefault();closeMoreMenu(this);checkInboxCode(${account.id})">Hộp thư đến</a>
                        </div>
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="deleteAccount(${account.id}, '${escapeHtml(account.email)}')">Xóa</button>
                </div>
            </td>
        </tr>
    `).join('');

    // 绑定复选框事件
    elements.table.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            if (e.target.checked) {
                selectedAccounts.add(id);
            } else {
                selectedAccounts.delete(id);
                selectAllPages = false;
            }
            // 同步全选框Trạng thái
            const allChecked = elements.table.querySelectorAll('input[type="checkbox"][data-id]');
            const checkedCount = elements.table.querySelectorAll('input[type="checkbox"][data-id]:checked').length;
            elements.selectAll.checked = allChecked.length > 0 && checkedCount === allChecked.length;
            elements.selectAll.indeterminate = checkedCount > 0 && checkedCount < allChecked.length;
            updateBatchButtons();
            renderSelectAllBanner();
        });
    });

    // 绑定Sao chép email按钮
    elements.table.querySelectorAll('.copy-email-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(btn.dataset.email);
        });
    });

    // 绑定Sao chép mật khẩu按钮
    elements.table.querySelectorAll('.copy-pwd-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(btn.dataset.pwd);
        });
    });

    // 渲染后同步全选框Trạng thái
    const allCbs = elements.table.querySelectorAll('input[type="checkbox"][data-id]');
    const checkedCbs = elements.table.querySelectorAll('input[type="checkbox"][data-id]:checked');
    elements.selectAll.checked = allCbs.length > 0 && checkedCbs.length === allCbs.length;
    elements.selectAll.indeterminate = checkedCbs.length > 0 && checkedCbs.length < allCbs.length;
    renderSelectAllBanner();
}

// 切换Mật khẩu显示
function togglePassword(element, password) {
    if (element.dataset.revealed === 'true') {
        element.textContent = password.substring(0, 4) + '****';
        element.classList.add('password-hidden');
        element.dataset.revealed = 'false';
    } else {
        element.textContent = password;
        element.classList.remove('password-hidden');
        element.dataset.revealed = 'true';
    }
}

// 更新分页
function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(totalAccounts / pageSize));

    elements.prevPage.disabled = currentPage <= 1;
    elements.nextPage.disabled = currentPage >= totalPages;

    elements.pageInfo.textContent = `Trang ${currentPage} / ${totalPages}`;
}

// 重置全选所有页Trạng thái
function resetSelectAllPages() {
    selectAllPages = false;
    selectedAccounts.clear();
    updateBatchButtons();
    renderSelectAllBanner();
}

// 构建批量请求体（含 select_all 和筛选参数）
function buildBatchPayload(extraFields = {}) {
    if (selectAllPages) {
        return {
            ids: [],
            select_all: true,
            status_filter: currentFilters.status || null,
            email_service_filter: currentFilters.email_service || null,
            search_filter: currentFilters.search || null,
            ...extraFields
        };
    }
    return { ids: Array.from(selectedAccounts), ...extraFields };
}

// 获取有效选中数量（select_all 时用总数）
function getEffectiveCount() {
    return selectAllPages ? totalAccounts : selectedAccounts.size;
}

// 渲染全选横幅
function renderSelectAllBanner() {
    let banner = document.getElementById('select-all-banner');
    const totalPages = Math.ceil(totalAccounts / pageSize);
    const currentPageSize = elements.table.querySelectorAll('input[type="checkbox"][data-id]').length;
    const checkedOnPage = elements.table.querySelectorAll('input[type="checkbox"][data-id]:checked').length;
    const allPageSelected = currentPageSize > 0 && checkedOnPage === currentPageSize;

    // 只在全选了当前页且有多页时显示横幅
    if (!allPageSelected || totalPages <= 1 || totalAccounts <= pageSize) {
        if (banner) banner.remove();
        return;
    }

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'select-all-banner';
        banner.style.cssText = 'background:var(--primary-light,#e8f0fe);color:var(--primary-color,#1a73e8);padding:8px 16px;text-align:center;font-size:0.875rem;border-bottom:1px solid var(--border-color);';
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) tableContainer.insertAdjacentElement('beforebegin', banner);
    }

    if (selectAllPages) {
        banner.innerHTML = `Đã chọn tất cả <strong>${totalAccounts}</strong> bản ghi.<button onclick="resetSelectAllPages()" style="margin-left:8px;color:var(--primary-color,#1a73e8);background:none;border:none;cursor:pointer;text-decoration:underline;">Bỏ chọn tất cả</button>`;
    } else {
        banner.innerHTML = `Đã chọn toàn bộ <strong>${checkedOnPage}</strong> mục trên trang hiện tại.<button onclick="selectAllPagesAction()" style="margin-left:8px;color:var(--primary-color,#1a73e8);background:none;border:none;cursor:pointer;text-decoration:underline;">Chọn toàn bộ ${totalAccounts} mục</button>`;
    }
}

// 选中所有页
function selectAllPagesAction() {
    selectAllPages = true;
    updateBatchButtons();
    renderSelectAllBanner();
}

// 更新批量操作按钮
function updateBatchButtons() {
    const count = getEffectiveCount();
    elements.batchDeleteBtn.disabled = count === 0;
    elements.batchRefreshBtn.disabled = count === 0;
    elements.batchValidateBtn.disabled = count === 0;
    elements.batchUploadBtn.disabled = count === 0;
    elements.batchCheckSubBtn.disabled = count === 0;
    elements.exportBtn.disabled = count === 0;

    const codexAuthBtn = document.getElementById('codex-auth-login-btn');
    if (codexAuthBtn) codexAuthBtn.disabled = count === 0;

    elements.batchDeleteBtn.textContent = count > 0 ? `Xóa (${count})` : 'Xóa';
    elements.batchRefreshBtn.textContent = count > 0 ? `🔄 Làm mới (${count})` : '🔄 Làm mớiToken';
    elements.batchValidateBtn.textContent = count > 0 ? `✅ Xác minh (${count})` : '✅ Xác minh token';
    elements.batchUploadBtn.textContent = count > 0 ? `☁️ Tải lên (${count})` : '☁️ Tải lên';
    elements.batchCheckSubBtn.textContent = count > 0 ? `🔍 Kiểm tra (${count})` : '🔍 Kiểm tra gói';
}

// Làm mới单个账号Token
async function refreshToken(id) {
    if (refreshingAccountIds.has(id)) {
        toast.info('Tài khoản này đang được làm mới, vui lòng chờ...');
        return;
    }
    refreshingAccountIds.add(id);

    try {
        toast.info('Đang làm mới token...');
        const result = await api.post(`/accounts/${id}/refresh`);

        if (result.success) {
            toast.success('Làm mới token thành công');
            loadAccounts();
        } else {
            toast.error('Làm mới thất bại: ' + (result.error || 'Lỗi không xác định'));
        }
    } catch (error) {
        toast.error('Làm mới thất bại: ' + error.message);
    } finally {
        refreshingAccountIds.delete(id);
    }
}

// 批量Làm mớiToken
async function handleBatchRefresh() {
    const count = getEffectiveCount();
    if (count === 0) return;

    const confirmed = await confirm(`Bạn có chắc muốn làm mới token cho ${count} tài khoản đã chọn không?`);
    if (!confirmed) return;

    elements.batchRefreshBtn.disabled = true;
    elements.batchRefreshBtn.textContent = 'Đang làm mới...';

    try {
        const result = await api.post('/accounts/batch-refresh', buildBatchPayload());
        toast.success(`Làm mới thành công ${result.success_count} tài khoản, thất bại ${result.failed_count} tài khoản`);
        loadAccounts();
    } catch (error) {
        toast.error('Làm mới hàng loạt thất bại: ' + error.message);
    } finally {
        updateBatchButtons();
    }
}

// 批量验证Token
async function handleBatchValidate() {
    if (getEffectiveCount() === 0) return;
    if (isBatchValidating) {
        toast.info('Đang xác minh hàng loạt, vui lòng chờ...');
        return;
    }

    isBatchValidating = true;

    elements.batchValidateBtn.disabled = true;
    elements.batchValidateBtn.textContent = 'Đang xác minh...';

    try {
        const result = await api.post('/accounts/batch-validate', buildBatchPayload(), { timeoutMs: 120000 });
        toast.info(`Hợp lệ: ${result.valid_count}, không hợp lệ: ${result.invalid_count}`);
        loadAccounts();
    } catch (error) {
        toast.error('Xác minh hàng loạt thất bại: ' + error.message);
    } finally {
        isBatchValidating = false;
        updateBatchButtons();
    }
}

// 查看账号Chi tiết
async function viewAccount(id) {
    try {
        const account = await api.get(`/accounts/${id}`);
        const tokens = await api.get(`/accounts/${id}/tokens`);

        elements.modalBody.innerHTML = `
            <div class="info-grid">
                <div class="info-item">
                    <span class="label">Email</span>
                    <span class="value">
                        ${escapeHtml(account.email)}
                        <button class="btn btn-ghost btn-sm" onclick="copyToClipboard('${escapeHtml(account.email)}')" title="Sao chép">
                            📋
                        </button>
                    </span>
                </div>
                <div class="info-item">
                    <span class="label">Mật khẩu</span>
                    <span class="value">
                        ${account.password
                            ? `<code style="font-size: 0.75rem;">${escapeHtml(account.password)}</code>
                               <button class="btn btn-ghost btn-sm" onclick="copyToClipboard('${escapeHtml(account.password)}')" title="Sao chép">📋</button>`
                            : '-'}
                    </span>
                </div>
                <div class="info-item">
                    <span class="label">Dịch vụ email</span>
                    <span class="value">${getServiceTypeText(account.email_service)}</span>
                </div>
                <div class="info-item">
                    <span class="label">Trạng thái</span>
                    <span class="value">
                        <span class="status-badge ${getStatusClass('account', account.status)}">
                            ${getStatusText('account', account.status)}
                        </span>
                    </span>
                </div>
                <div class="info-item">
                    <span class="label">Thời điểm đăng ký</span>
                    <span class="value">${format.date(account.registered_at)}</span>
                </div>
                <div class="info-item">
                    <span class="label">Làm mới lần cuối</span>
                    <span class="value">${format.date(account.last_refresh) || '-'}</span>
                </div>
                <div class="info-item" style="grid-column: span 2;">
                    <span class="label">Account ID</span>
                    <span class="value" style="font-size: 0.75rem; word-break: break-all;">
                        ${escapeHtml(account.account_id || '-')}
                    </span>
                </div>
                <div class="info-item" style="grid-column: span 2;">
                    <span class="label">Workspace ID</span>
                    <span class="value" style="font-size: 0.75rem; word-break: break-all;">
                        ${escapeHtml(account.workspace_id || '-')}
                    </span>
                </div>
                <div class="info-item" style="grid-column: span 2;">
                    <span class="label">Client ID</span>
                    <span class="value" style="font-size: 0.75rem; word-break: break-all;">
                        ${escapeHtml(account.client_id || '-')}
                    </span>
                </div>
                <div class="info-item" style="grid-column: span 2;">
                    <span class="label">Access Token</span>
                    <div class="value" style="font-size: 0.7rem; word-break: break-all; font-family: var(--font-mono); background: var(--surface-hover); padding: 8px; border-radius: 4px;">
                        ${escapeHtml(tokens.access_token || '-')}
                        ${tokens.access_token ? `<button class="btn btn-ghost btn-sm" onclick="copyToClipboard('${escapeHtml(tokens.access_token)}')" style="margin-left: 8px;">📋</button>` : ''}
                    </div>
                </div>
                <div class="info-item" style="grid-column: span 2;">
                    <span class="label">Refresh Token</span>
                    <div class="value" style="font-size: 0.7rem; word-break: break-all; font-family: var(--font-mono); background: var(--surface-hover); padding: 8px; border-radius: 4px;">
                        ${escapeHtml(tokens.refresh_token || '-')}
                        ${tokens.refresh_token ? `<button class="btn btn-ghost btn-sm" onclick="copyToClipboard('${escapeHtml(tokens.refresh_token)}')" style="margin-left: 8px;">📋</button>` : ''}
                    </div>
                </div>
                <div class="info-item" style="grid-column: span 2;">
                    <span class="label">Cookies (dùng cho thanh toán)</span>
                    <div class="value">
                        <textarea id="cookies-input-${id}" rows="3"
                            style="width:100%;font-size:0.7rem;font-family:var(--font-mono);background:var(--surface-hover);border:1px solid var(--border);border-radius:4px;padding:6px;color:var(--text-primary);resize:vertical;"
                            placeholder="Dán toàn bộ chuỗi cookie; để trống để xóa">${escapeHtml(account.cookies || '')}</textarea>
                        <button class="btn btn-secondary btn-sm" style="margin-top:4px" onclick="saveCookies(${id})">
                            Lưu cookies
                        </button>
                    </div>
                </div>
            </div>
            <div style="margin-top: var(--spacing-lg); display: flex; gap: var(--spacing-sm);">
                <button class="btn btn-primary" onclick="refreshToken(${id}); elements.detailModal.classList.remove('active');">
                    🔄 Làm mớiToken
                </button>
            </div>
        `;

        elements.detailModal.classList.add('active');
    } catch (error) {
        toast.error('Tải chi tiết tài khoản thất bại: ' + error.message);
    }
}

// Sao chép email
function copyEmail(email) {
    copyToClipboard(email);
}

// Xóa账号
async function deleteAccount(id, email) {
    const confirmed = await confirm(`Bạn có chắc muốn xóa tài khoản ${email} không? Hành động này không thể hoàn tác.`);
    if (!confirmed) return;

    try {
        await api.delete(`/accounts/${id}`);
        toast.success('Tài khoản đã được xóa');
        selectedAccounts.delete(id);
        loadStats();
        loadAccounts();
    } catch (error) {
        toast.error('Xóa thất bại: ' + error.message);
    }
}

// 批量Xóa
async function handleBatchDelete() {
    const count = getEffectiveCount();
    if (count === 0) return;

    const confirmed = await confirm(`Bạn có chắc muốn xóa ${count} tài khoản đã chọn không? Hành động này không thể hoàn tác.`);
    if (!confirmed) return;

    try {
        const result = await api.post('/accounts/batch-delete', buildBatchPayload());
        toast.success(`Xóa thành công ${result.deleted_count} tài khoản`);
        selectedAccounts.clear();
        selectAllPages = false;
        loadStats();
        loadAccounts();
    } catch (error) {
        toast.error('Xóa thất bại: ' + error.message);
    }
}

// 导出账号
async function exportAccounts(format) {
    const count = getEffectiveCount();
    if (count === 0) {
        toast.warning('Vui lòng chọn tài khoản cần xuất trước');
        return;
    }

    toast.info(`Đang xuất ${count} tài khoản...`);

    try {
        const response = await fetch('/api/accounts/export/' + format, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(buildBatchPayload())
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch (parseError) {
                // ignore non-JSON error bodies and fall back to status text
            }
            throw new Error(errorMessage);
        }

        // 获取文件内容
        const blob = await response.blob();

        // 从 Content-Disposition 获取文件名
        const disposition = response.headers.get('Content-Disposition');
        let filename = `accounts_${Date.now()}.${(format === 'cpa' || format === 'sub2api' || format === 'codex_auth') ? 'json' : format}`;
        if (disposition) {
            const match = disposition.match(/filename=(.+)/);
            if (match) {
                filename = match[1];
            }
        }

        // 创建下载链接
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        toast.success('Xuất thành công');
    } catch (error) {
        console.error('Xuất thất bại:', error);
        toast.error('Xuất thất bại: ' + error.message);
    }
}

// HTML 转义
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============== CPA 服务Chọn ==============

// 弹出 CPA 服务Chọn框，返回 Promise<{cpa_service_id: number|null}|null>
// null 表示用户取消，{cpa_service_id: null} 表示使用全局配置
function selectCpaService() {
    return new Promise(async (resolve) => {
        const modal = document.getElementById('cpa-service-modal');
        const listEl = document.getElementById('cpa-service-list');
        const closeBtn = document.getElementById('close-cpa-modal');
        const cancelBtn = document.getElementById('cancel-cpa-modal-btn');
        const globalBtn = document.getElementById('cpa-use-global-btn');

        // 加载服务列表
        listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted)">Đang tải...</div>';
        modal.classList.add('active');

        let services = [];
        try {
            services = await api.get('/cpa-services?enabled=true');
        } catch (e) {
            services = [];
        }

        if (services.length === 0) {
            listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:12px;">Không có dịch vụ CPA nào đang bật, sẽ dùng cấu hình toàn cục</div>';
        } else {
            listEl.innerHTML = services.map(s => `
                <div class="cpa-service-item" data-id="${s.id}" style="
                    padding: 10px 14px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.15s;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <div style="font-weight:500;">${escapeHtml(s.name)}</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);">${escapeHtml(s.api_url)}</div>
                    </div>
                    <span class="badge" style="background:var(--success-color);color:#fff;font-size:0.7rem;padding:2px 8px;border-radius:10px;">Chọn</span>
                </div>
            `).join('');

            listEl.querySelectorAll('.cpa-service-item').forEach(item => {
                item.addEventListener('mouseenter', () => item.style.background = 'var(--surface-hover)');
                item.addEventListener('mouseleave', () => item.style.background = '');
                item.addEventListener('click', () => {
                    cleanup();
                    resolve({ cpa_service_id: parseInt(item.dataset.id) });
                });
            });
        }

        function cleanup() {
            modal.classList.remove('active');
            closeBtn.removeEventListener('click', onCancel);
            cancelBtn.removeEventListener('click', onCancel);
            globalBtn.removeEventListener('click', onGlobal);
        }
        function onCancel() { cleanup(); resolve(null); }
        function onGlobal() { cleanup(); resolve({ cpa_service_id: null }); }

        closeBtn.addEventListener('click', onCancel);
        cancelBtn.addEventListener('click', onCancel);
        globalBtn.addEventListener('click', onGlobal);
    });
}

// 统一Tải lên入口：弹出目标Chọn
async function uploadAccount(id) {
    const targets = [
        { label: '☁️ Tải lên CPA', value: 'cpa' },
        { label: '🔗 Tải lên Sub2API', value: 'sub2api' },
        { label: '🚀 Tải lên Team Manager', value: 'tm' },
        { label: '🧩 Tải lên NEWAPI', value: 'newapi' },
    ];

    const choice = await new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:360px;">
                <div class="modal-header">
                    <h3>☁️ Chọn đích tải lên</h3>
                    <button class="modal-close" id="_upload-close">&times;</button>
                </div>
                <div class="modal-body" style="display:flex;flex-direction:column;gap:8px;">
                    ${targets.map(t => `
                        <button class="btn btn-secondary" data-val="${t.value}" style="text-align:left;">${t.label}</button>
                    `).join('')}
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.querySelector('#_upload-close').addEventListener('click', () => { modal.remove(); resolve(null); });
        modal.addEventListener('click', (e) => { if (e.target === modal) { modal.remove(); resolve(null); } });
        modal.querySelectorAll('button[data-val]').forEach(btn => {
            btn.addEventListener('click', () => { modal.remove(); resolve(btn.dataset.val); });
        });
    });

    if (!choice) return;
    if (choice === 'cpa') return uploadToCpa(id);
    if (choice === 'sub2api') return uploadToSub2Api(id);
    if (choice === 'tm') return uploadToTm(id);
    if (choice === 'newapi') return uploadToNewapi(id);
}

// Tải lên单个账号到CPA
async function uploadToCpa(id) {
    const choice = await selectCpaService();
    if (choice === null) return;  // 用户取消

    try {
        toast.info('Đang tải lên CPA...');
        const payload = {};
        if (choice.cpa_service_id != null) payload.cpa_service_id = choice.cpa_service_id;
        const result = await api.post(`/accounts/${id}/upload-cpa`, payload);

        if (result.success) {
            toast.success('Tải lên thành công');
            loadAccounts();
        } else {
            toast.error('Tải lên thất bại: ' + (result.error || 'Lỗi không xác định'));
        }
    } catch (error) {
        toast.error('Tải lên thất bại: ' + error.message);
    }
}

// 批量Tải lên到CPA
async function handleBatchUploadCpa() {
    const count = getEffectiveCount();
    if (count === 0) return;

    const choice = await selectCpaService();
    if (choice === null) return;  // 用户取消

    const confirmed = await confirm(`Bạn có chắc muốn tải lên CPA cho ${count} tài khoản đã chọn không?`);
    if (!confirmed) return;

    elements.batchUploadBtn.disabled = true;
    elements.batchUploadBtn.textContent = 'Đang tải lên...';

    try {
        const payload = buildBatchPayload();
        if (choice.cpa_service_id != null) payload.cpa_service_id = choice.cpa_service_id;
        const result = await api.post('/accounts/batch-upload-cpa', payload);

        let message = `Thành công: ${result.success_count}`;
        if (result.failed_count > 0) message += `, thất bại: ${result.failed_count}`;
        if (result.skipped_count > 0) message += `, bỏ qua: ${result.skipped_count}`;

        toast.success(message);
        loadAccounts();
    } catch (error) {
        toast.error('Tải lên hàng loạt thất bại: ' + error.message);
    } finally {
        updateBatchButtons();
    }
}

// ============== 订阅Trạng thái ==============

// 手动Đánh dấu订阅类型
async function markSubscription(id) {
    const type = prompt('Nhập loại gói (plus / team / free):', 'plus');
    if (!type) return;
    if (!['plus', 'team', 'free'].includes(type.trim().toLowerCase())) {
        toast.error('Loại gói không hợp lệ, vui lòng nhập plus, team hoặc free');
        return;
    }
    try {
        await api.post(`/payment/accounts/${id}/mark-subscription`, {
            subscription_type: type.trim().toLowerCase()
        });
        toast.success('Trạng thái gói đã được cập nhật');
        loadAccounts();
    } catch (e) {
        toast.error('Đánh dấu thất bại: ' + e.message);
    }
}

// 批量检测订阅Trạng thái
async function handleBatchCheckSubscription() {
    const count = getEffectiveCount();
    if (count === 0) return;
    const confirmed = await confirm(`Bạn có chắc muốn kiểm tra trạng thái gói của ${count} tài khoản đã chọn không?`);
    if (!confirmed) return;

    elements.batchCheckSubBtn.disabled = true;
    elements.batchCheckSubBtn.textContent = 'Đang kiểm tra...';

    try {
        const result = await api.post('/payment/accounts/batch-check-subscription', buildBatchPayload());
        let message = `Thành công: ${result.success_count}`;
        if (result.failed_count > 0) message += `, thất bại: ${result.failed_count}`;
        toast.success(message);
        loadAccounts();
    } catch (e) {
        toast.error('Kiểm tra hàng loạt thất bại: ' + e.message);
    } finally {
        updateBatchButtons();
    }
}

// ============== Sub2API Tải lên ==============

// 弹出 Sub2API 服务Chọn框，返回 Promise<{service_id: number|null}|null>
// null 表示用户取消，{service_id: null} 表示自动Chọn
function selectSub2ApiService() {
    return new Promise(async (resolve) => {
        const modal = document.getElementById('sub2api-service-modal');
        const listEl = document.getElementById('sub2api-service-list');
        const closeBtn = document.getElementById('close-sub2api-modal');
        const cancelBtn = document.getElementById('cancel-sub2api-modal-btn');
        const autoBtn = document.getElementById('sub2api-use-auto-btn');

        listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted)">Đang tải...</div>';
        modal.classList.add('active');

        let services = [];
        try {
            services = await api.get('/sub2api-services?enabled=true');
        } catch (e) {
            services = [];
        }

        if (services.length === 0) {
            listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:12px;">Không có dịch vụ Sub2API nào đang bật, sẽ tự động chọn dịch vụ đầu tiên</div>';
        } else {
            listEl.innerHTML = services.map(s => `
                <div class="sub2api-service-item" data-id="${s.id}" style="
                    padding: 10px 14px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.15s;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <div style="font-weight:500;">${escapeHtml(s.name)}</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);">${escapeHtml(s.api_url)}</div>
                    </div>
                    <span class="badge" style="background:var(--primary);color:#fff;font-size:0.7rem;padding:2px 8px;border-radius:10px;">Chọn</span>
                </div>
            `).join('');

            listEl.querySelectorAll('.sub2api-service-item').forEach(item => {
                item.addEventListener('mouseenter', () => item.style.background = 'var(--surface-hover)');
                item.addEventListener('mouseleave', () => item.style.background = '');
                item.addEventListener('click', () => {
                    cleanup();
                    resolve({ service_id: parseInt(item.dataset.id) });
                });
            });
        }

        function cleanup() {
            modal.classList.remove('active');
            closeBtn.removeEventListener('click', onCancel);
            cancelBtn.removeEventListener('click', onCancel);
            autoBtn.removeEventListener('click', onAuto);
        }
        function onCancel() { cleanup(); resolve(null); }
        function onAuto() { cleanup(); resolve({ service_id: null }); }

        closeBtn.addEventListener('click', onCancel);
        cancelBtn.addEventListener('click', onCancel);
        autoBtn.addEventListener('click', onAuto);
    });
}

// 批量Tải lên到 Sub2API
async function handleBatchUploadSub2Api() {
    const count = getEffectiveCount();
    if (count === 0) return;

    const choice = await selectSub2ApiService();
    if (choice === null) return;  // 用户取消

    const confirmed = await confirm(`Bạn có chắc muốn tải lên Sub2API cho ${count} tài khoản đã chọn không?`);
    if (!confirmed) return;

    elements.batchUploadBtn.disabled = true;
    elements.batchUploadBtn.textContent = 'Đang tải lên...';

    try {
        const payload = buildBatchPayload();
        if (choice.service_id != null) payload.service_id = choice.service_id;
        const result = await api.post('/accounts/batch-upload-sub2api', payload);

        let message = `Thành công: ${result.success_count}`;
        if (result.failed_count > 0) message += `, thất bại: ${result.failed_count}`;
        if (result.skipped_count > 0) message += `, bỏ qua: ${result.skipped_count}`;

        toast.success(message);
        loadAccounts();
    } catch (error) {
        toast.error('Tải lên hàng loạt thất bại: ' + error.message);
    } finally {
        updateBatchButtons();
    }
}

// ============== Team Manager Tải lên ==============

// Tải lên单账号到 Sub2API
async function uploadToSub2Api(id) {
    const choice = await selectSub2ApiService();
    if (choice === null) return;
    try {
        toast.info('Đang tải lên Sub2API...');
        const payload = {};
        if (choice.service_id != null) payload.service_id = choice.service_id;
        const result = await api.post(`/accounts/${id}/upload-sub2api`, payload);
        if (result.success) {
            toast.success('Tải lên thành công');
            loadAccounts();
        } else {
            toast.error('Tải lên thất bại: ' + (result.error || result.message || 'Lỗi không xác định'));
        }
    } catch (e) {
        toast.error('Tải lên thất bại: ' + e.message);
    }
}

// 弹出 Team Manager 服务Chọn框，返回 Promise<{service_id: number|null}|null>
// null 表示用户取消，{service_id: null} 表示自动Chọn
function selectTmService() {
    return new Promise(async (resolve) => {
        const modal = document.getElementById('tm-service-modal');
        const listEl = document.getElementById('tm-service-list');
        const closeBtn = document.getElementById('close-tm-modal');
        const cancelBtn = document.getElementById('cancel-tm-modal-btn');
        const autoBtn = document.getElementById('tm-use-auto-btn');

        listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted)">Đang tải...</div>';
        modal.classList.add('active');

        let services = [];
        try {
            services = await api.get('/tm-services?enabled=true');
        } catch (e) {
            services = [];
        }

        if (services.length === 0) {
            listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:12px;">Không có dịch vụ Team Manager nào đang bật, sẽ tự động chọn dịch vụ đầu tiên</div>';
        } else {
            listEl.innerHTML = services.map(s => `
                <div class="tm-service-item" data-id="${s.id}" style="
                    padding: 10px 14px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.15s;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <div style="font-weight:500;">${escapeHtml(s.name)}</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);">${escapeHtml(s.api_url)}</div>
                    </div>
                    <span class="badge" style="background:var(--primary);color:#fff;font-size:0.7rem;padding:2px 8px;border-radius:10px;">Chọn</span>
                </div>
            `).join('');

            listEl.querySelectorAll('.tm-service-item').forEach(item => {
                item.addEventListener('mouseenter', () => item.style.background = 'var(--surface-hover)');
                item.addEventListener('mouseleave', () => item.style.background = '');
                item.addEventListener('click', () => {
                    cleanup();
                    resolve({ service_id: parseInt(item.dataset.id) });
                });
            });
        }

        function cleanup() {
            modal.classList.remove('active');
            closeBtn.removeEventListener('click', onCancel);
            cancelBtn.removeEventListener('click', onCancel);
            autoBtn.removeEventListener('click', onAuto);
        }
        function onCancel() { cleanup(); resolve(null); }
        function onAuto() { cleanup(); resolve({ service_id: null }); }

        closeBtn.addEventListener('click', onCancel);
        cancelBtn.addEventListener('click', onCancel);
        autoBtn.addEventListener('click', onAuto);
    });
}

// Tải lên单账号到 Team Manager
async function uploadToTm(id) {
    const choice = await selectTmService();
    if (choice === null) return;
    try {
        toast.info('Đang tải lên Team Manager...');
        const payload = {};
        if (choice.service_id != null) payload.service_id = choice.service_id;
        const result = await api.post(`/accounts/${id}/upload-tm`, payload);
        if (result.success) {
            toast.success('Tải lên thành công');
        } else {
            toast.error('Tải lên thất bại: ' + (result.message || 'Lỗi không xác định'));
        }
    } catch (e) {
        toast.error('Tải lên thất bại: ' + e.message);
    }
}

// 批量Tải lên到 Team Manager
async function handleBatchUploadTm() {
    const count = getEffectiveCount();
    if (count === 0) return;

    const choice = await selectTmService();
    if (choice === null) return;  // 用户取消

    const confirmed = await confirm(`Bạn có chắc muốn tải lên Team Manager cho ${count} tài khoản đã chọn không?`);
    if (!confirmed) return;

    elements.batchUploadBtn.disabled = true;
    elements.batchUploadBtn.textContent = 'Đang tải lên...';

    try {
        const payload = buildBatchPayload();
        if (choice.service_id != null) payload.service_id = choice.service_id;
        const result = await api.post('/accounts/batch-upload-tm', payload);
        let message = `Thành công: ${result.success_count}`;
        if (result.failed_count > 0) message += `, thất bại: ${result.failed_count}`;
        if (result.skipped_count > 0) message += `, bỏ qua: ${result.skipped_count}`;
        toast.success(message);
        loadAccounts();
    } catch (e) {
        toast.error('Tải lên hàng loạt thất bại: ' + e.message);
    } finally {
        updateBatchButtons();
    }
}

// ============== NEWAPI Tải lên ==============

function selectNewapiService() {
    return new Promise(async (resolve) => {
        const modal = document.getElementById('newapi-service-modal');
        const listEl = document.getElementById('newapi-service-list');
        const closeBtn = document.getElementById('close-newapi-modal');
        const cancelBtn = document.getElementById('cancel-newapi-modal-btn');
        const autoBtn = document.getElementById('newapi-use-auto-btn');

        listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted)">Đang tải...</div>';
        modal.classList.add('active');

        let services = [];
        try {
            services = await api.get('/newapi-services?enabled=true');
        } catch (e) {
            services = [];
        }

        if (services.length === 0) {
            listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:12px;">Không có dịch vụ NEWAPI nào đang bật, sẽ tự động chọn dịch vụ đầu tiên</div>';
        } else {
            listEl.innerHTML = services.map(s => `
                <div class="newapi-service-item" data-id="${s.id}" style="
                    padding: 10px 14px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.15s;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <div style="font-weight:500;">${escapeHtml(s.name)}</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);">${escapeHtml(s.api_url)}</div>
                    </div>
                    <span class="badge" style="background:var(--primary);color:#fff;font-size:0.7rem;padding:2px 8px;border-radius:10px;">Chọn</span>
                </div>
            `).join('');

            listEl.querySelectorAll('.newapi-service-item').forEach(item => {
                item.addEventListener('mouseenter', () => item.style.background = 'var(--surface-hover)');
                item.addEventListener('mouseleave', () => item.style.background = '');
                item.addEventListener('click', () => {
                    cleanup();
                    resolve({ service_id: parseInt(item.dataset.id) });
                });
            });
        }

        function cleanup() {
            modal.classList.remove('active');
            closeBtn.removeEventListener('click', onCancel);
            cancelBtn.removeEventListener('click', onCancel);
            autoBtn.removeEventListener('click', onAuto);
        }
        function onCancel() { cleanup(); resolve(null); }
        function onAuto() { cleanup(); resolve({ service_id: null }); }

        closeBtn.addEventListener('click', onCancel);
        cancelBtn.addEventListener('click', onCancel);
        autoBtn.addEventListener('click', onAuto);
    });
}

async function uploadToNewapi(id) {
    const choice = await selectNewapiService();
    if (choice === null) return;
    try {
        toast.info('Đang tải lên NEWAPI...');
        const payload = {};
        if (choice.service_id != null) payload.service_id = choice.service_id;
        const result = await api.post(`/accounts/${id}/upload-newapi`, payload);
        if (result.success) {
            toast.success('Tải lên thành công');
        } else {
            toast.error('Tải lên thất bại: ' + (result.message || 'Lỗi không xác định'));
        }
    } catch (e) {
        toast.error('Tải lên thất bại: ' + e.message);
    }
}

async function handleBatchUploadNewapi() {
    const count = getEffectiveCount();
    if (count === 0) return;

    const choice = await selectNewapiService();
    if (choice === null) return;

    const confirmed = await confirm(`Bạn có chắc muốn tải lên NEWAPI cho ${count} tài khoản đã chọn không?`);
    if (!confirmed) return;

    elements.batchUploadBtn.disabled = true;
    elements.batchUploadBtn.textContent = 'Đang tải lên...';

    try {
        const payload = buildBatchPayload();
        if (choice.service_id != null) payload.service_id = choice.service_id;
        const result = await api.post('/accounts/batch-upload-newapi', payload);
        let message = `Thành công: ${result.success_count}`;
        if (result.failed_count > 0) message += `, thất bại: ${result.failed_count}`;
        if (result.skipped_count > 0) message += `, bỏ qua: ${result.skipped_count}`;
        toast.success(message);
        loadAccounts();
    } catch (e) {
        toast.error('Tải lên hàng loạt thất bại: ' + e.message);
    } finally {
        updateBatchButtons();
    }
}

// Thêm菜单切换
function toggleMoreMenu(btn) {
    const menu = btn.nextElementSibling;
    const isActive = menu.classList.contains('active');
    // 关闭所有其他Thêm菜单
    document.querySelectorAll('.dropdown-menu.active').forEach(m => m.classList.remove('active'));
    if (!isActive) menu.classList.add('active');
}

function closeMoreMenu(el) {
    const menu = el.closest('.dropdown-menu');
    if (menu) menu.classList.remove('active');
}

// 保存账号 Cookies
async function saveCookies(id) {
    const textarea = document.getElementById(`cookies-input-${id}`);
    if (!textarea) return;
    const cookiesValue = textarea.value.trim();
    try {
        await api.patch(`/accounts/${id}`, { cookies: cookiesValue });
        toast.success('Cookies đã được lưu');
    } catch (e) {
        toast.error('Lưu cookies thất bại: ' + e.message);
    }
}

// 查询Hộp thư đến验证码
async function checkInboxCode(id) {
    toast.info('Đang kiểm tra hộp thư đến...');
    try {
        const result = await api.post(`/accounts/${id}/inbox-code`);
        if (result.success) {
            showInboxCodeResult(result.code, result.email);
        } else {
            toast.error('Truy vấn thất bại: ' + (result.error || 'Chưa nhận được mã xác minh'));
        }
    } catch (error) {
        toast.error('Truy vấn thất bại: ' + error.message);
    }
}

function showInboxCodeResult(code, email) {
    elements.modalBody.innerHTML = `
        <div style="text-align:center; padding:24px 16px;">
            <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">
                ${escapeHtml(email)} - mã xác minh mới nhất
            </div>
            <div style="font-size:36px;font-weight:700;letter-spacing:8px;
                        color:var(--primary);font-family:monospace;margin-bottom:20px;">
                ${escapeHtml(code)}
            </div>
            <button class="btn btn-primary" onclick="copyToClipboard('${escapeHtml(code)}')">Sao chép mã xác minh</button>
        </div>
    `;
    elements.detailModal.classList.add('active');
}

// ============== Codex Auth 登录 ==============

let codexAuthResults = [];

async function handleCodexAuthLogin() {
    const count = getEffectiveCount();
    if (count === 0) {
        toast.warning('Vui lòng chọn tài khoản cần đăng nhập trước');
        return;
    }

    const confirmed = await confirm(`Bạn sẽ chạy đăng nhập Codex Auth cho ${count} tài khoản đã chọn (cần nhận mã xác minh qua email). Bạn có muốn tiếp tục không?`);
    if (!confirmed) return;

    const modal = document.getElementById('codex-auth-modal');
    const logsEl = document.getElementById('codex-auth-logs');
    const statusEl = document.getElementById('codex-auth-status');
    const downloadBtn = document.getElementById('codex-auth-download-btn');

    logsEl.textContent = '';
    statusEl.textContent = 'Đang khởi chạy đăng nhập Codex Auth...';
    downloadBtn.style.display = 'none';
    codexAuthResults = [];
    modal.classList.add('active');

    if (count === 1 && !selectAllPages) {
        // 单账号登录
        const accountId = [...selectedAccounts][0];
        await codexAuthLoginSingle(accountId, logsEl, statusEl, downloadBtn);
    } else {
        // 批量登录
        await codexAuthLoginBatch(logsEl, statusEl, downloadBtn);
    }
}

async function codexAuthLoginSingle(accountId, logsEl, statusEl, downloadBtn) {
    try {
        const response = await fetch('/api/accounts/codex-auth-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account_id: accountId }),
        });

        if (!response.ok) {
            const err = await response.json();
            statusEl.textContent = 'Đăng nhập thất bại: ' + (err.detail || response.statusText);
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'log') {
                        logsEl.textContent += data.message + '\n';
                        logsEl.scrollTop = logsEl.scrollHeight;
                    } else if (data.type === 'result') {
                        if (data.success && data.auth_json) {
                            statusEl.textContent = 'Đăng nhập Codex Auth thành công!';
                            codexAuthResults = [{ email: data.email, auth_json: data.auth_json }];
                            downloadBtn.style.display = 'inline-block';
                            downloadBtn.onclick = () => downloadCodexAuthResults();
                            loadAccounts();
                        } else {
                            statusEl.textContent = 'Đăng nhập thất bại: ' + (data.error_message || 'Lỗi không xác định');
                        }
                    }
                } catch (e) { /* ignore parse errors */ }
            }
        }
    } catch (error) {
        statusEl.textContent = 'Đăng nhập thất bại: ' + error.message;
    }
}

async function codexAuthLoginBatch(logsEl, statusEl, downloadBtn) {
    try {
        const payload = buildBatchPayload();
        const response = await fetch('/api/accounts/codex-auth-login/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const err = await response.json();
            statusEl.textContent = 'Đăng nhập hàng loạt thất bại: ' + (err.detail || response.statusText);
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let successCount = 0;
        let failCount = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'log') {
                        logsEl.textContent += data.message + '\n';
                        logsEl.scrollTop = logsEl.scrollHeight;
                    } else if (data.type === 'progress') {
                        statusEl.textContent = `Đang xử lý ${data.current}/${data.total}: ${data.email}`;
                    } else if (data.type === 'account_result') {
                        if (data.success) {
                            successCount++;
                            logsEl.textContent += `[${data.email}] Đăng nhập thành công\n`;
                        } else {
                            failCount++;
                            logsEl.textContent += `[${data.email}] Đăng nhập thất bại: ${data.error || 'Lỗi không xác định'}\n`;
                        }
                        logsEl.scrollTop = logsEl.scrollHeight;
                    } else if (data.type === 'batch_done') {
                        codexAuthResults = data.results || [];
                        statusEl.textContent = `Đăng nhập hàng loạt hoàn tất: thành công ${successCount}, thất bại ${failCount}`;
                        if (codexAuthResults.length > 0) {
                            downloadBtn.style.display = 'inline-block';
                            downloadBtn.onclick = () => downloadCodexAuthResults();
                        }
                        loadAccounts();
                    }
                } catch (e) { /* ignore parse errors */ }
            }
        }
    } catch (error) {
        statusEl.textContent = 'Đăng nhập hàng loạt thất bại: ' + error.message;
    }
}

function downloadCodexAuthResults() {
    if (codexAuthResults.length === 0) return;

    if (codexAuthResults.length === 1) {
        // 单个直接下载 auth.json
        const item = codexAuthResults[0];
        const blob = new Blob([JSON.stringify(item.auth_json, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'auth.json';
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    } else {
        // 多个：逐个下载（浏览器端无法打 ZIP，逐个下载）
        codexAuthResults.forEach((item, i) => {
            setTimeout(() => {
                const blob = new Blob([JSON.stringify(item.auth_json, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${item.email}_auth.json`;
                document.body.appendChild(a);
                a.click();
                URL.revokeObjectURL(url);
                a.remove();
            }, i * 300);
        });
    }
    toast.success(`Đã tải xuống ${codexAuthResults.length} tài khoản auth.json`);
}
