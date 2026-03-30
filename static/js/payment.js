/**
 * 支付页面 JavaScript
 */

let selectedPlan = 'plus';
let generatedLink = '';
let countryCurrencyMap = {};  // 动态从接口加载

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadAccounts();
    loadCountries();
});

// 加载国家/货币列表
async function loadCountries() {
    const sel = document.getElementById('country-select');
    try {
        const resp = await fetch('/api/payment/countries');
        const data = await resp.json();
        const countries = data.countries || [];

        // 重建映射表
        countryCurrencyMap = {};
        countries.forEach(c => {
            countryCurrencyMap[c.country_code] = c.currency;
        });

        // 记住当前选中值
        const current = sel.value;

        // 渲染选项
        sel.innerHTML = countries.map(c =>
            `<option value="${c.country_code}">${c.country_name} (${c.currency})</option>`
        ).join('');

        // 恢复选中或默认 SG
        sel.value = current && countryCurrencyMap[current] ? current : 'SG';
        onCountryChange();

        if (!data.success) {
            console.warn('国家列表使用内置 fallback:', data.error);
        }
    } catch (e) {
        console.error('加载国家列表失败:', e);
        sel.innerHTML = '<option value="SG">Singapore (SGD)</option>';
        countryCurrencyMap = { SG: 'SGD' };
        onCountryChange();
    }
}

// 加载账号列表
async function loadAccounts() {
    try {
        const resp = await fetch('/api/accounts?page=1&page_size=100&status=active');
        const data = await resp.json();
        const sel = document.getElementById('account-select');
        sel.innerHTML = '<option value="">-- Vui lòng chọn tài khoản --</option>';
        (data.accounts || []).forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = acc.email;
            sel.appendChild(opt);
        });
    } catch (e) {
        console.error('Tải tài khoản thất bại:', e);
    }
}

// 国家切换
function onCountryChange() {
    const country = document.getElementById('country-select').value;
    const currency = countryCurrencyMap[country] || '';
    document.getElementById('currency-display').value = currency;
}

// 选择套餐
function selectPlan(plan) {
    selectedPlan = plan;
    document.getElementById('plan-plus').classList.toggle('selected', plan === 'plus');
    document.getElementById('plan-team').classList.toggle('selected', plan === 'team');
    document.getElementById('team-options').classList.toggle('show', plan === 'team');
    // 隐藏已生成的链接
    document.getElementById('link-box').classList.remove('show');
    generatedLink = '';
}

// Tạo liên kết thanh toán
async function generateLink() {
    const accountId = document.getElementById('account-select').value;
    if (!accountId) {
        toast.warning('Vui lòng chọn tài khoản trước');
        return;
    }

    const country = document.getElementById('country-select').value || 'SG';

    const currency = countryCurrencyMap[country] || '';
    const body = {
        account_id: parseInt(accountId),
        plan_type: selectedPlan,
        country: country,
        currency: currency,
    };

    if (selectedPlan === 'team') {
        body.workspace_name = document.getElementById('workspace-name').value || 'MyTeam';
        body.seat_quantity = parseInt(document.getElementById('seat-quantity').value) || 5;
        body.price_interval = document.getElementById('price-interval').value;
    }

    const btn = document.querySelector('.form-actions .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang tạo...'; }

    try {
        const resp = await fetch('/api/payment/generate-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await resp.json();
        if (data.success && data.link) {
            generatedLink = data.link;
            document.getElementById('link-text').value = data.link;
            document.getElementById('link-box').classList.add('show');
            document.getElementById('open-status').textContent = '';
            toast.success('Tạo liên kết thanh toán thành công');
        } else {
            toast.error(data.detail || 'Tạo liên kết thất bại');
        }
    } catch (e) {
        toast.error('Yêu cầu thất bại: ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Tạo liên kết thanh toán'; }
    }
}

// 复制链接
function copyLink() {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink).then(() => {
        toast.success('Đã sao chép vào khay nhớ tạm');
    }).catch(() => {
        const ta = document.getElementById('link-text');
        ta.select();
        document.execCommand('copy');
        toast.success('Đã sao chép vào khay nhớ tạm');
    });
}

// 无痕打开浏览器（携带账号 cookie）
async function openIncognito() {
    if (!generatedLink) {
        toast.warning('Vui lòng tạo liên kết trước');
        return;
    }
    const accountId = document.getElementById('account-select').value;
    const statusEl = document.getElementById('open-status');
    statusEl.textContent = 'Đang mở...';
    try {
        const body = { url: generatedLink };
        if (accountId) body.account_id = parseInt(accountId);

        const resp = await fetch('/api/payment/open-incognito', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await resp.json();
        if (data.success) {
            statusEl.textContent = 'Đã mở trình duyệt ở chế độ ẩn danh';
            toast.success('Trình duyệt ẩn danh đã được mở');
        } else {
            statusEl.textContent = data.message || 'Không tìm thấy trình duyệt khả dụng, vui lòng sao chép liên kết thủ công';
            toast.warning(data.message || 'Không tìm thấy trình duyệt');
        }
    } catch (e) {
        statusEl.textContent = 'Yêu cầu thất bại: ' + e.message;
        toast.error('Yêu cầu thất bại');
    }
}
