/**
 * Weliza Admin Panel — Supabase Edition (Fixed)
 */

const SB = () => window.WelizaSupa;

let allClientsCache  = [];
let allDealersCache  = [];
let salesChartInst   = null;
let gstChartInst     = null;
let clientChartInst  = null;

// ─── PDF UPLOAD ZONE HELPERS ────────────────────────────────────
// Wires a file input inside an .upload-zone so it visibly shows
// "attached" state (green border + filename) once a PDF is chosen.
function setupPdfUploadZone(inputId, iconId, textId, nameDisplayId) {
  const input = document.getElementById(inputId);
  const zone  = document.getElementById(inputId.replace('File','Zone')) || input?.closest('.upload-zone');
  const icon  = document.getElementById(iconId);
  const text  = document.getElementById(textId);
  const nameDisplay = nameDisplayId ? document.getElementById(nameDisplayId) : null;
  if (!input || !zone) return;
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) { resetPdfUploadZone(inputId, iconId, textId, nameDisplayId); return; }
    zone.classList.add('upload-zone-attached');
    if (icon) icon.setAttribute('data-lucide', 'check-circle-2');
    if (text) text.textContent = 'PDF attached';
    if (nameDisplay) nameDisplay.textContent = file.name;
    if (window.lucide) window.lucide.createIcons();
  });
}

function resetPdfUploadZone(inputId, iconId, textId, nameDisplayId) {
  const input = document.getElementById(inputId);
  const zone  = document.getElementById(inputId.replace('File','Zone')) || input?.closest('.upload-zone');
  const icon  = document.getElementById(iconId);
  const text  = document.getElementById(textId);
  const nameDisplay = nameDisplayId ? document.getElementById(nameDisplayId) : null;
  if (input) input.value = '';
  if (zone) zone.classList.remove('upload-zone-attached');
  if (icon) icon.setAttribute('data-lucide', 'file-up');
  if (text) text.textContent = 'Click to upload PDF';
  if (nameDisplay) nameDisplay.textContent = '';
  if (window.lucide) window.lucide.createIcons();
}


// ─── AUTH ─────────────────────────────────────────────────────
const ADMIN_PASS  = 'weliz@123';
const SESSION_KEY = 'weliza_auth_v1';
const SESSION_VAL = 'ok_2024_weliza';
const FACEID_CRED_KEY = 'weliza_faceid_cred';

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) window.lucide.createIcons();
  checkSession();
});

function checkSession() {
  if (localStorage.getItem(SESSION_KEY) === SESSION_VAL) {
    if (localStorage.getItem(FACEID_CRED_KEY)) {
      showFaceIdLock();
    } else {
      showAdminPanel();
    }
  } else {
    showLoginScreen();
  }
}

// ─── FACE ID (WebAuthn) ─────────────────────────────────────────
function faceIdSupported() {
  return !!(window.PublicKeyCredential && navigator.credentials);
}

async function faceIdRegister() {
  if (!faceIdSupported()) { alert('Face ID / biometric unlock is not supported on this browser.'); return false; }
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Weliza Admin', id: location.hostname },
        user: { id: userId, name: 'weliza-admin', displayName: 'Weliza Admin' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
        attestation: 'none'
      }
    });
    const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
    localStorage.setItem(FACEID_CRED_KEY, credId);
    return true;
  } catch (e) {
    console.error('Face ID registration failed', e);
    return false;
  }
}

async function faceIdVerify() {
  const credId = localStorage.getItem(FACEID_CRED_KEY);
  if (!credId || !faceIdSupported()) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const idBytes = Uint8Array.from(atob(credId), c => c.charCodeAt(0));
    await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: idBytes, type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    return true;
  } catch (e) {
    console.error('Face ID verification failed', e);
    return false;
  }
}

function showFaceIdLock() {
  const lock  = document.getElementById('faceIdScreen');
  const panel = document.getElementById('adminPanel');
  const auth  = document.getElementById('authScreen');
  if (auth)  auth.style.display  = 'none';
  if (panel) panel.style.display = 'none';
  if (lock)  lock.style.display  = 'flex';
  if (window.lucide) window.lucide.createIcons();

  const err = document.getElementById('faceIdError');
  const attemptUnlock = async () => {
    if (err) err.style.display = 'none';
    const ok = await faceIdVerify();
    if (ok) {
      if (lock) lock.style.display = 'none';
      showAdminPanel();
    } else if (err) {
      err.style.display = 'block';
    }
  };

  const btn = document.getElementById('btnFaceIdUnlock');
  if (btn) btn.onclick = attemptUnlock;

  const usePw = document.getElementById('faceIdUsePassword');
  if (usePw) usePw.onclick = (e) => {
    e.preventDefault();
    if (lock) lock.style.display = 'none';
    localStorage.removeItem(SESSION_KEY);
    showLoginScreen();
  };

  // Auto-prompt Face ID immediately
  attemptUnlock();
}

function showLoginScreen() {
  const auth  = document.getElementById('authScreen');
  const panel = document.getElementById('adminPanel');
  if (auth)  auth.style.display = 'flex';
  if (panel) panel.style.display = 'none';
  const form = document.getElementById('authForm');
  if (!form) return;
  form.onsubmit = (e) => {
    e.preventDefault();
    const pw = document.getElementById('authPassword').value;
    if (pw === ADMIN_PASS) {
      localStorage.setItem(SESSION_KEY, SESSION_VAL);
      showAdminPanel();
    } else {
      const err = document.getElementById('authError');
      if (err) err.style.display = 'block';
      document.getElementById('authPassword').value = '';
      document.getElementById('authPassword').focus();
    }
  };
}

function showAdminPanel() {
  const auth  = document.getElementById('authScreen');
  const lock  = document.getElementById('faceIdScreen');
  const panel = document.getElementById('adminPanel');
  if (auth)  auth.style.display = 'none';
  if (lock)  lock.style.display = 'none';
  if (panel) panel.style.display = 'flex';
  initializeAdminWorkspace();
  setupFaceIdSettingsUI();
}

function setupFaceIdSettingsUI() {
  const badge   = document.getElementById('faceIdStatusBadge');
  const btnOn   = document.getElementById('btnEnableFaceId');
  const btnOff  = document.getElementById('btnDisableFaceId');
  if (!badge || !btnOn || !btnOff) return;

  const refresh = () => {
    const enabled = !!localStorage.getItem(FACEID_CRED_KEY);
    badge.textContent = enabled ? 'Face ID Lock: Enabled' : 'Face ID Lock: Disabled';
    badge.style.color = enabled ? 'var(--g)' : '#888';
    btnOn.style.display  = enabled ? 'none' : 'inline-flex';
    btnOff.style.display = enabled ? 'inline-flex' : 'none';
  };
  refresh();

  btnOn.onclick = async () => {
    const ok = await faceIdRegister();
    if (!ok) alert('Could not set up Face ID on this device/browser.');
    refresh();
  };
  btnOff.onclick = () => {
    localStorage.removeItem(FACEID_CRED_KEY);
    refresh();
  };
}

window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing-reports');
});

function checkAuthentication() {
  showAdminPanel();
}


// ─── INIT ─────────────────────────────────────────────────────
async function initializeAdminWorkspace() {
  setupTabs();
  setupHamburger();
  // Set today's date on date fields
  const today = new Date().toISOString().slice(0, 10);
  ['invDate','purDate','expDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });
  await reloadDashboardData();
  setupInvoiceCreator();
  setupPurchaseLog();
  setupClientCRM();
  setupDealers();
  setupWorkers();
  setupExpenses();
  setupInventory();
  setupSettings();
  setupAttachPdfModal();
  setupExternalInvoiceModal();
  FS.init();
  FS.checkMonthlyReminder();
  checkGSTReminders();
  document.getElementById('bannerExportBtn')?.addEventListener('click', () => {
    const btn = document.getElementById('btnExportAllData');
    FS.exportAll(btn);
  });
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    showLoginScreen();
  });
}

// ─── TABS ─────────────────────────────────────────────────────
const TAB_META = {
  'dashboard':       { title: 'Dashboard',           desc: 'Real-time business overview' },
  'invoice-creator': { title: 'New Invoice',          desc: 'Create and preview a new sales invoice' },
  'invoices-list':   { title: 'Sales & Invoices',     desc: 'All sales records' },
  'purchases':       { title: 'Purchases',            desc: 'Purchase invoices and bills' },
  'clients':         { title: 'Client CRM',           desc: 'Client profiles and history' },
  'dealers':         { title: 'Dealers & Suppliers',  desc: 'Supplier profiles' },
  'workers':         { title: 'Workers',              desc: 'Staff directory' },
  'expenses':        { title: 'Expenses',             desc: 'Salary, rent, electricity and more' },
  'inventory':       { title: 'Inventory',            desc: 'Stock levels and product catalog' },
  'reports':         { title: 'Reports',              desc: 'Monthly and yearly business reports' },
  'settings':        { title: 'Settings',             desc: 'Business and bank details' },
};

function setupTabs() {
  document.querySelectorAll('.nav-link[data-tab]').forEach(link => {
    link.addEventListener('click', () => goToTab(link.dataset.tab));
  });
}

function goToTab(tab) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const link = document.querySelector(`.nav-link[data-tab="${tab}"]`);
  if (link) link.classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const section = document.getElementById('tab-' + tab);
  if (section) section.classList.add('active');
  const meta = TAB_META[tab] || {};
  const t = document.getElementById('currentTabTitle');
  const d = document.getElementById('currentTabDesc');
  if (t) t.textContent = meta.title || tab;
  if (d) d.textContent = meta.desc  || '';
  if (tab === 'dashboard')     reloadDashboardData();
  if (tab === 'invoices-list') { loadInvoicesList(); loadOutstandingInvoices(); }
  if (tab === 'purchases')     { loadPurchasesList(); populateDealerSelect(); }
  if (tab === 'clients')       { loadClientsList(); populateClientDropdown(); }
  if (tab === 'dealers')       loadDealersList();
  if (tab === 'workers')       loadWorkersList();
  if (tab === 'expenses')      loadExpensesList();
  if (tab === 'inventory')     loadInventoryList();
  if (tab === 'reports')       loadReports();
  if (tab === 'settings')      loadSettingsForm();
  if (window.lucide) window.lucide.createIcons();
}

// ─── DASHBOARD ────────────────────────────────────────────────
async function reloadDashboardData() {
  try {
    const stats = await SB().getDashboardStats();
    setText('statGrossSales',    formatCurrency(stats.grossSales));
    setText('statGstOutput',     formatCurrency(stats.gstCollected));
    setText('statGrossPurchases',formatCurrency(stats.grossPurchases));
    setText('statTotalPurchase', formatCurrency(stats.grossPurchases));
    setText('statTotalSpend',    formatCurrency(stats.grossPurchases + stats.totalExpenses));
    setText('statGstInput',      formatCurrency(stats.gstPaid));
    setText('statGstNet',        formatCurrency(Math.max(0, stats.gstCollected - stats.gstPaid)));
    setText('statOutstanding',   formatCurrency(stats.outstanding));
    // Add net profit KPI if element exists
    setText('statNetProfit',     formatCurrency(stats.netProfit));
    setText('statTotalExpenses', formatCurrency(stats.totalExpenses));
    renderRecentInvoices(stats.invoices.slice(0, 8));
    renderSalesChart(stats.invoices, stats.purchases);
    renderGstChart(stats.invoices, stats.purchases);
    renderClientChart(stats.invoices);
  } catch(e) {
    console.error('Dashboard error:', e);
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val;
  if (el.classList.contains('kpi-value')) {
    el.classList.remove('kpi-value-pop');
    void el.offsetWidth; // restart animation
    el.classList.add('kpi-value-pop');
  }
}

function renderRecentInvoices(invoices) {
  const tbody = document.getElementById('recentInvoicesTableBody');
  if (!tbody) return;
  if (!invoices.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="tbl-empty">No invoices yet.</td></tr>';
    return;
  }
  tbody.innerHTML = invoices.map(inv => `
    <tr>
      <td><strong>${inv.invoice_number}</strong></td>
      <td>${inv.client_name || '—'}</td>
      <td>${inv.date}</td>
      <td><strong>${formatCurrency(inv.grand_total)}</strong></td>
      <td>${formatCurrency(inv.gst_total)}</td>
      <td><span class="badge ${inv.status === 'Paid' ? 'badge-g' : 'badge-y'}">${inv.status}</span></td>
    </tr>`).join('');
}

function renderSalesChart(invoices, purchases) {
  const ctx = document.getElementById('salesChart');
  if (!ctx) return;
  const months = {};
  invoices.forEach(inv => {
    const m = (inv.date || '').slice(0, 7);
    if (!months[m]) months[m] = { sales: 0, purchases: 0 };
    months[m].sales += parseFloat(inv.grand_total || 0);
  });
  purchases.forEach(p => {
    const m = (p.date || '').slice(0, 7);
    if (!months[m]) months[m] = { sales: 0, purchases: 0 };
    months[m].purchases += parseFloat(p.grand_total || 0);
  });
  let labels = Object.keys(months).sort().slice(-6);
  if (labels.length < 3) {
    const earliest = labels[0] || new Date().toISOString().slice(0,7);
    const [y, m] = earliest.split('-').map(Number);
    for (let i = 1; labels.length < 3; i++) {
      let pm = m - i; let py = y;
      if (pm < 1) { pm += 12; py -= 1; }
      const key = `${py}-${String(pm).padStart(2,'0')}`;
      if (!months[key]) months[key] = { sales: 0, purchases: 0 };
      labels.unshift(key);
    }
  }
  if (salesChartInst) salesChartInst.destroy();

  // Build gradient fills after canvas is sized
  const c = ctx.getContext('2d');
  const h = ctx.parentElement?.clientHeight || 240;
  const gradSales = c.createLinearGradient(0, 0, 0, h);
  gradSales.addColorStop(0,   'rgba(200,162,74,0.30)');
  gradSales.addColorStop(0.7, 'rgba(200,162,74,0.06)');
  gradSales.addColorStop(1,   'rgba(200,162,74,0)');
  const gradPurch = c.createLinearGradient(0, 0, 0, h);
  gradPurch.addColorStop(0,   'rgba(30,71,53,0.22)');
  gradPurch.addColorStop(0.7, 'rgba(30,71,53,0.05)');
  gradPurch.addColorStop(1,   'rgba(30,71,53,0)');

  salesChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Sales ₹',
          data: labels.map(l => months[l]?.sales || 0),
          borderColor: '#C09A59', borderWidth: 2.5,
          backgroundColor: gradSales, fill: true, tension: 0.42,
          pointRadius: 4, pointBackgroundColor: '#C09A59',
          pointBorderColor: '#fff', pointBorderWidth: 2, pointHoverRadius: 6
        },
        {
          label: 'Purchases ₹',
          data: labels.map(l => months[l]?.purchases || 0),
          borderColor: '#1F5138', borderWidth: 2.5,
          backgroundColor: gradPurch, fill: true, tension: 0.42,
          pointRadius: 4, pointBackgroundColor: '#1F5138',
          pointBorderColor: '#fff', pointBorderWidth: 2, pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } } },
        tooltip: { backgroundColor: '#fff', titleColor: '#111', bodyColor: '#555', borderColor: '#e0e0e0', borderWidth: 1, padding: 10 }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#888' } },
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, border: { dash: [4,4] }, ticks: { color: '#888', callback: v => '₹' + (v >= 1000 ? Math.round(v/1000)+'k' : v) } }
      }
    }
  });
}

function renderGstChart(invoices, purchases) {
  const ctx = document.getElementById('gstChart');
  if (!ctx) return;
  const months = {};
  invoices.forEach(inv => {
    const m = (inv.date || '').slice(0, 7);
    if (!months[m]) months[m] = { out: 0, in: 0 };
    months[m].out += parseFloat(inv.gst_total || 0);
  });
  purchases.forEach(p => {
    const m = (p.date || '').slice(0, 7);
    if (!months[m]) months[m] = { out: 0, in: 0 };
    months[m].in += parseFloat(p.gst_total || 0);
  });
  let labels = Object.keys(months).sort().slice(-6);
  if (labels.length < 3) {
    const earliest = labels[0] || new Date().toISOString().slice(0,7);
    const [y, m] = earliest.split('-').map(Number);
    for (let i = 1; labels.length < 3; i++) {
      let pm = m - i; let py = y;
      if (pm < 1) { pm += 12; py -= 1; }
      const key = `${py}-${String(pm).padStart(2,'0')}`;
      if (!months[key]) months[key] = { out: 0, in: 0 };
      labels.unshift(key);
    }
  }
  if (gstChartInst) gstChartInst.destroy();

  const c = ctx.getContext('2d');
  const h = ctx.parentElement?.clientHeight || 240;
  const gradOut = c.createLinearGradient(0, 0, 0, h);
  gradOut.addColorStop(0,   'rgba(200,162,74,0.30)');
  gradOut.addColorStop(0.7, 'rgba(200,162,74,0.06)');
  gradOut.addColorStop(1,   'rgba(200,162,74,0)');
  const gradIn = c.createLinearGradient(0, 0, 0, h);
  gradIn.addColorStop(0,   'rgba(30,71,53,0.22)');
  gradIn.addColorStop(0.7, 'rgba(30,71,53,0.05)');
  gradIn.addColorStop(1,   'rgba(30,71,53,0)');

  gstChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'GST Output',
          data: labels.map(l => months[l]?.out || 0),
          borderColor: '#C09A59', borderWidth: 2.5,
          backgroundColor: gradOut, fill: true, tension: 0.42,
          pointRadius: 4, pointBackgroundColor: '#C09A59',
          pointBorderColor: '#fff', pointBorderWidth: 2, pointHoverRadius: 6
        },
        {
          label: 'GST Input',
          data: labels.map(l => months[l]?.in || 0),
          borderColor: '#1F5138', borderWidth: 2.5,
          backgroundColor: gradIn, fill: true, tension: 0.42,
          pointRadius: 4, pointBackgroundColor: '#1F5138',
          pointBorderColor: '#fff', pointBorderWidth: 2, pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } } },
        tooltip: { backgroundColor: '#fff', titleColor: '#111', bodyColor: '#555', borderColor: '#e0e0e0', borderWidth: 1, padding: 10 }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#888' } },
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, border: { dash: [4,4] }, ticks: { color: '#888', callback: v => '₹' + (v >= 1000 ? Math.round(v/1000)+'k' : v) } }
      }
    }
  });
}

function renderClientChart(invoices) {
  const ctx = document.getElementById('clientChart');
  if (!ctx) return;
  const clients = {};
  invoices.forEach(inv => {
    const n = inv.client_name || 'Unknown';
    clients[n] = (clients[n] || 0) + parseFloat(inv.grand_total || 0);
  });
  const sorted = Object.entries(clients).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (clientChartInst) clientChartInst.destroy();
  clientChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(x => x[0]),
      datasets: [{ data: sorted.map(x => x[1]), backgroundColor: ['#C09A59','#1F5138','#3fb37e','#dcb87c','#296b4a','#8a6a3a'] }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
  });
}

// ─── INVOICE CREATOR ──────────────────────────────────────────
function setupInvoiceCreator() {
  populateClientDropdown();
  loadInventoryForInvoice();
  document.getElementById('btnAddItemRow')?.addEventListener('click', () => addInvoiceRow());
  document.getElementById('invoiceForm')?.addEventListener('input', updateInvoiceTotals);
  document.getElementById('invoiceForm')?.addEventListener('submit', saveInvoice);
  document.getElementById('btnPrintPreviewBtn')?.addEventListener('click', printInvoiceFromSheet);

  // + button → toggle custom client name input
  document.getElementById('btnAddNewClientInline')?.addEventListener('click', () => {
    toggleCustomClientInput();
  });

  const invNum = document.getElementById('invNumber');
  if (invNum && !invNum.value) {
    invNum.value = 'WEL-' + new Date().getFullYear() + '-001';
  }
  addInvoiceRow();
}

// Cache inventory for invoice row dropdowns
let inventoryCache = [];

async function loadInventoryForInvoice() {
  try {
    inventoryCache = await SB().getAllInventory();
    // Refresh existing rows' selects
    document.querySelectorAll('.item-inv-select').forEach(sel => {
      const currentVal = sel.value;
      sel.innerHTML = buildInventoryOptions();
      sel.value = currentVal;
    });
  } catch(e) { console.error('Inventory load error:', e); }
}

// Inventory names can use a slash to track variants for internal use,
// e.g. "prayerdress/shobika" or "prayerdress/family". Everything after the
// slash is for internal reference only and must never appear on an invoice
// preview, PDF, or saved invoice item description.
function getInvoiceDisplayName(inventoryName) {
  const base = String(inventoryName || '').split('/')[0].trim();
  return base.replace(/\b\w/g, c => c.toUpperCase());
}

function buildInventoryOptions() {
  return '<option value="">— custom item —</option>' +
    inventoryCache.map(item =>
      `<option value="${item.id}" data-sell="${item.sell_price||0}" data-cost="${item.cost_price||0}" data-gst="5" data-display="${getInvoiceDisplayName(item.name)}">${item.name} (Stock: ${item.stock} ${item.unit||'pcs'})</option>`
    ).join('');
}

function addInvoiceRow(desc='', qty='1', rate='', cost='', gst='5', invId='') {
  const tbody = document.getElementById('invoiceItemsTbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td style="min-width:220px;">
      <div style="display:flex;align-items:center;gap:5px;">
        <select class="field-input item-inv-select" style="flex:1;min-width:0;" onchange="onInventoryItemSelect(this)">
          ${buildInventoryOptions()}
        </select>
        <button type="button" class="btn btn-icon item-custom-toggle" title="Type a custom item name instead" onclick="toggleCustomItemInput(this)" style="flex-shrink:0;">
          <i data-lucide="corner-down-right" style="width:13px;height:13px;"></i>
        </button>
      </div>
      <input class="field-input item-desc" type="text" value="${desc}" placeholder="Custom item name…" style="margin-top:4px;font-size:0.78rem;display:${desc ? 'block' : 'none'};" oninput="updateInvoiceTotals()">
      <input type="hidden" class="item-cost" value="${cost}">
    </td>
    <td><input class="field-input item-qty"  type="number" value="${qty}"  min="0" step="0.01" oninput="updateInvoiceTotals()"></td>
    <td><input class="field-input item-rate" type="number" value="${rate}" min="0" step="0.01" placeholder="0.00" oninput="updateInvoiceTotals()"></td>
    <td><select class="field-input item-gst" onchange="updateInvoiceTotals()">
      ${['0','5','12','18','28'].map(r=>`<option value="${r}" ${r===String(gst)?'selected':''}>${r}%</option>`).join('')}
    </select></td>
    <td><button type="button" class="btn btn-action btn-action-del" onclick="this.closest('tr').remove();updateInvoiceTotals()">
      <i data-lucide="trash-2"></i></button></td>`;
  // Set inventory select if id provided
  if (invId) { setTimeout(() => { tr.querySelector('.item-inv-select').value = invId; }, 0); }
  tbody.appendChild(tr);
  if (window.lucide) window.lucide.createIcons();
}

window.toggleCustomClientInput = function() {
  const sel   = document.getElementById('invClientSelect');
  const input = document.getElementById('invClientCustomName');
  const btn   = document.getElementById('btnAddNewClientInline');
  if (!sel || !input) return;
  const isHidden = input.style.display === 'none';
  if (isHidden) {
    // Switch to typing a custom name
    sel.value = '';
    ['name','gstin','address','pan','phone'].forEach(k => delete sel.dataset[k]);
    sel.style.display = 'none';
    sel.required = false;
    input.style.display = 'block';
    input.required = true;
    input.focus();
    btn.title = 'Use a saved client instead';
    btn.querySelector('i')?.setAttribute('data-lucide', 'x');
  } else {
    // Switch back to the saved-client dropdown
    input.style.display = 'none';
    input.required = false;
    input.value = '';
    sel.style.display = '';
    sel.required = true;
    btn.title = 'Type a custom client name';
    btn.querySelector('i')?.setAttribute('data-lucide', 'plus');
  }
  if (window.lucide) window.lucide.createIcons();
  updateInvoiceTotals();
};

function toggleCustomClientInput() { window.toggleCustomClientInput(); }

window.toggleCustomItemInput = function(btn) {
  const row = btn.closest('tr');
  const customInput = row.querySelector('.item-desc');
  const isHidden = customInput.style.display === 'none';
  customInput.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    row.querySelector('.item-inv-select').value = '';
    customInput.focus();
  } else {
    customInput.value = '';
  }
  updateInvoiceTotals();
};

window.onInventoryItemSelect = function(sel) {
  const row  = sel.closest('tr');
  const opt  = sel.options[sel.selectedIndex];
  if (opt && opt.value) {
    const sellPrice = parseFloat(opt.dataset.sell || 0);
    const costPrice = parseFloat(opt.dataset.cost || 0);
    const gst       = opt.dataset.gst || '5';
    row.querySelector('.item-desc').value = opt.dataset.display || opt.text.split(' (Stock:')[0];
    row.querySelector('.item-rate').value = sellPrice;
    row.querySelector('.item-cost').value = costPrice;
    row.querySelector('.item-gst').value  = gst;
  } else {
    row.querySelector('.item-desc').value = '';
    row.querySelector('.item-rate').value = '';
    row.querySelector('.item-cost').value = '';
  }
  updateInvoiceTotals();
};

async function populateClientDropdown() {
  const sel = document.getElementById('invClientSelect');
  if (!sel) return;
  try {
    const clients = await SB().getAllClients();
    allClientsCache = clients;
    sel.innerHTML = '<option value="">Select client…</option>' +
      clients.map(c => `<option value="${c.id}" data-name="${c.name}" data-gstin="${c.gstin||''}" data-address="${c.address||''}" data-pan="${c.pan||''}" data-phone="${c.phone||''}">${c.name}</option>`).join('');
    sel.onchange = function() {
      const opt = sel.options[sel.selectedIndex];
      if (opt && opt.value) {
        sel.dataset.name    = opt.dataset.name    || '';
        sel.dataset.gstin   = opt.dataset.gstin   || '';
        sel.dataset.address = opt.dataset.address || '';
        sel.dataset.pan     = opt.dataset.pan     || '';
        sel.dataset.phone   = opt.dataset.phone   || '';
      }
      updateInvoiceTotals();
    };
  } catch(e) { console.error('Client dropdown error:', e); }
}

function updateInvoiceTotals() {
  const rows = document.querySelectorAll('#invoiceItemsTbody tr');
  let taxable = 0, gstAmt = 0, totalCost = 0;
  rows.forEach(row => {
    const q    = parseFloat(row.querySelector('.item-qty')?.value  || 0);
    const r    = parseFloat(row.querySelector('.item-rate')?.value || 0);
    const g    = parseFloat(row.querySelector('.item-gst')?.value  || 0);
    const cost = parseFloat(row.querySelector('.item-cost')?.value || 0);
    taxable   += q * r;
    gstAmt    += q * r * g / 100;
    totalCost += q * cost;
  });
  setText('summaryTaxable', formatCurrency(taxable));
  setText('summaryGst',     formatCurrency(gstAmt));
  setText('summaryGrand',   formatCurrency(taxable + gstAmt));
  renderLivePreview(taxable, gstAmt, totalCost);
}

let _settingsCache = null;
async function getSettingsCached() {
  if (_settingsCache) return _settingsCache;
  _settingsCache = await SB().getSettings().catch(() => ({}));
  // Expire after 60s
  setTimeout(() => { _settingsCache = null; }, 60000);
  return _settingsCache;
}

function buildInvoiceHTML(inv, biz, bank) {
  /* inv = { invoice_number, date, status, client_name, client_address, client_gstin, client_pan, client_phone, items, taxable_total, gst_total, grand_total }
     biz = { name, address, gstin, pan, email, phone }
     bank = { acc_name, acc_num, ifsc, acc_type, bank_name } */
  const G = '#1F5138';
  const items = inv.items || [];
  const cgst = parseFloat(inv.gst_total||0) / 2;
  const sgst = cgst;

  const itemRows = items.map((item, i) => {
    const taxable = parseFloat(item.taxable || (item.qty * item.rate) || 0);
    const cgstAmt = taxable * parseFloat(item.gst_rate||0) / 200;
    const sgstAmt = cgstAmt;
    const total   = taxable + cgstAmt + sgstAmt;
    return `<tr style="border-bottom:1px solid #e0ece6;">
      <td style="padding:8px 10px;">${i+1}.</td>
      <td style="padding:8px 10px;">${item.desc||''}</td>
      <td style="padding:8px 10px;text-align:center;">${item.gst_rate||0}%</td>
      <td style="padding:8px 10px;text-align:center;">${item.qty}</td>
      <td style="padding:8px 10px;text-align:right;">₹${parseFloat(item.rate||0).toFixed(0)}</td>
      <td style="padding:8px 10px;text-align:right;">₹${taxable.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
      <td style="padding:8px 10px;text-align:right;">₹${cgstAmt.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
      <td style="padding:8px 10px;text-align:right;">₹${sgstAmt.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
      <td style="padding:8px 10px;text-align:right;font-weight:600;">₹${total.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="9" style="padding:20px;text-align:center;color:#aaa;">Add line items</td></tr>`;

  const taxable   = parseFloat(inv.taxable_total||0);
  const gstTotal  = parseFloat(inv.gst_total||0);
  const grand     = parseFloat(inv.grand_total||0) || taxable + gstTotal;

  return `<div style="font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#222;font-size:12.5px;max-width:800px;margin:0 auto;padding:0 14px;box-sizing:border-box;">
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&display=swap" rel="stylesheet">

    <!-- Header -->
    <div style="background:${G};color:#fff;padding:20px 26px;display:flex;justify-content:space-between;align-items:center;margin:0 -14px;">
      <div>
        <div style="font-family:'Cormorant Garamond','Times New Roman',serif;font-size:2rem;font-weight:700;letter-spacing:2px;">${biz.name||'WELIZA'}</div>
        <div style="font-size:10px;opacity:0.8;margin-top:3px;letter-spacing:0.3px;">This is an electronically generated document, no signature is required.</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:1.1rem;font-weight:700;letter-spacing:1px;">Invoice</div>
        <div style="font-size:11px;margin-top:5px;">Invoice No # <strong>${inv.invoice_number||''}</strong></div>
        <div style="font-size:11px;margin-top:2px;">Invoice Date <strong>${inv.date||''}</strong></div>
      </div>
    </div>

    <!-- Space above line 2 (line 1 / top border removed) -->
    <div style="height:28px;"></div>

    <!-- Billed By / Billed To - separate rounded boxes -->
    <div style="display:flex;gap:12px;">
      <div style="flex:1;padding:14px 16px 16px 16px;background:#f2f8f5;border:1.5px solid #dceee4;border-radius:10px;">
        <div style="font-size:10px;font-weight:700;color:${G};text-transform:uppercase;margin-bottom:10px;letter-spacing:1.2px;">Billed By</div>
        <div style="font-weight:700;font-size:13px;color:#111;margin-bottom:6px;">${biz.name||''}</div>
        <div style="color:#444;margin-top:2px;line-height:1.6;">${(biz.address||'').replace(/,/g,',<br>')}</div>
        <div style="margin-top:8px;line-height:2.0;">
          ${biz.gstin ? `<span style="font-weight:700;">GSTIN:</span> ${biz.gstin}<br>` : ''}
          ${biz.pan   ? `<span style="font-weight:700;">PAN:</span> ${biz.pan}<br>` : ''}
          ${biz.email ? `<span style="font-weight:700;">Email:</span> ${biz.email}<br>` : ''}
          ${biz.phone ? `<span style="font-weight:700;">Phone:</span> ${biz.phone}` : ''}
        </div>
      </div>
      <div style="flex:1;padding:14px 16px 16px 16px;background:#f2f8f5;border:1.5px solid #dceee4;border-radius:10px;">
        <div style="font-size:10px;font-weight:700;color:${G};text-transform:uppercase;margin-bottom:10px;letter-spacing:1.2px;">Billed To</div>
        ${inv.client_name ? `<div style="font-weight:700;font-size:13px;color:#111;margin-bottom:6px;">${inv.client_name}</div>` : '<div style="color:#aaa;font-size:12px;">No client selected</div>'}
        ${inv.client_address ? `<div style="color:#444;margin-top:2px;line-height:1.6;">${inv.client_address}</div>` : ''}
        <div style="margin-top:8px;line-height:2.0;">
          ${inv.client_gstin ? `<span style="font-weight:700;">GSTIN:</span> ${inv.client_gstin}<br>` : ''}
          ${inv.client_pan   ? `<span style="font-weight:700;">PAN:</span> ${inv.client_pan}<br>` : ''}
          ${inv.client_phone ? `<span style="font-weight:700;">Phone:</span> ${inv.client_phone}` : ''}
        </div>
      </div>
    </div>
    ${inv.client_address ? `<div style="text-align:right;font-size:11px;color:#666;padding:8px 4px 0;">Country of Supply: India &nbsp;|&nbsp; Place of Supply: Kerala (32)</div>` : ''}

    <!-- Items Table (no top gap — line 2 closes the billed section) -->
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#e8f5e9;color:${G};font-size:11px;font-weight:700;text-transform:uppercase;">
          <th style="padding:10px 10px;text-align:left;">#</th>
          <th style="padding:10px 10px;text-align:left;">Description</th>
          <th style="padding:10px 10px;text-align:center;">GST%</th>
          <th style="padding:10px 10px;text-align:center;">Qty</th>
          <th style="padding:10px 10px;text-align:right;">Rate</th>
          <th style="padding:10px 10px;text-align:right;">Amount</th>
          <th style="padding:10px 10px;text-align:right;">CGST</th>
          <th style="padding:10px 10px;text-align:right;">SGST</th>
          <th style="padding:10px 10px;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- Line 3 + space after it -->
    <div style="border-top:2px solid ${G};"></div>
    <div style="height:32px;"></div>

    <!-- Bank + Totals -->
    <div style="display:flex;align-items:flex-start;gap:20px;padding-bottom:20px;">
      <div style="flex:1;margin-top:18px;">
        ${bank.acc_num ? `
        <div style="background:#f4fbf7;border:1.5px solid ${G};border-radius:8px;overflow:hidden;display:inline-block;min-width:270px;">
          <div style="background:${G};color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:10px 18px;">Bank Details</div>
          <table style="font-size:13px;border-collapse:collapse;width:100%;">
            <tr><td style="padding:8px 18px;color:#555;">Account Name</td><td style="font-weight:600;padding:8px 18px 8px 0;">${bank.acc_name||''}</td></tr>
            <tr style="background:#eef8f3;"><td style="padding:8px 18px;color:#555;">Account Number</td><td style="font-weight:600;padding:8px 18px 8px 0;">${bank.acc_num}</td></tr>
            <tr><td style="padding:8px 18px;color:#555;">IFSC</td><td style="font-weight:600;padding:8px 18px 8px 0;">${bank.ifsc||''}</td></tr>
            <tr style="background:#eef8f3;"><td style="padding:8px 18px;color:#555;">Account Type</td><td style="font-weight:600;padding:8px 18px 8px 0;">${bank.acc_type||''}</td></tr>
            <tr><td style="padding:8px 18px 12px;color:#555;">Bank</td><td style="font-weight:600;padding:8px 18px 12px 0;">${bank.bank_name||''}</td></tr>
          </table>
        </div>` : ''}
      </div>
      <div style="min-width:240px;background:#f2f8f5;border-radius:6px;overflow:hidden;">
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <tr><td style="padding:10px 16px;color:#555;">Amount</td><td style="text-align:right;padding:10px 16px;">₹${taxable.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>
          <tr style="background:#e8f5e9;"><td style="padding:10px 16px;color:#555;">CGST</td><td style="text-align:right;padding:10px 16px;">₹${cgst.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>
          <tr><td style="padding:10px 16px;color:#555;">SGST</td><td style="text-align:right;padding:10px 16px;">₹${sgst.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>
          <tr style="border-top:2px solid ${G};">
            <td style="padding:12px 16px;font-weight:700;font-size:14px;color:${G};">Total (INR)</td>
            <td style="text-align:right;font-weight:700;font-size:14px;color:${G};padding:12px 16px;">₹${grand.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
          </tr>
        </table>
      </div>
    </div>

    <div style="text-align:center;padding:14px;font-size:10px;color:#aaa;border-top:1px solid #e8ece8;">
      Thank you for your business! — ${biz.name||'WELIZA'}
    </div>
  </div>`;
}

async function renderLivePreview(taxableTotal, gstTotal, totalCost) {
  const sheet = document.getElementById('invoicePrintSheet');
  if (!sheet) return;
  const s    = await getSettingsCached();
  const biz  = { name: s.biz_name||'WELIZA', address: s.biz_address||'Kozhikode, Kerala', gstin: s.biz_gstin||'', pan: s.biz_pan||'', email: s.biz_email||'', phone: s.biz_phone||'' };
  const bank = { acc_name: s.bank_acc_name||'', acc_num: s.bank_acc_num||'', ifsc: s.bank_ifsc||'', acc_type: s.bank_acc_type||'', bank_name: s.bank_name||'' };

  const sel = document.getElementById('invClientSelect');
  const customNameInput = document.getElementById('invClientCustomName');
  const usingCustomClient = customNameInput && customNameInput.style.display !== 'none';
  const rows = [...document.querySelectorAll('#invoiceItemsTbody tr')];
  let tax = 0, gst = 0;
  const items = rows.map(row => {
    const desc    = row.querySelector('.item-desc')?.value || '';
    const qty     = parseFloat(row.querySelector('.item-qty')?.value  || 0);
    const rate    = parseFloat(row.querySelector('.item-rate')?.value || 0);
    const gstRate = parseFloat(row.querySelector('.item-gst')?.value  || 0);
    const cost    = parseFloat(row.querySelector('.item-cost')?.value || 0);
    const tx      = qty * rate;
    const ga      = tx * gstRate / 100;
    tax += tx; gst += ga;
    return { desc, qty, rate, gst_rate: gstRate, taxable: tx, total: tx+ga, cost_price: cost };
  });

  const inv = {
    invoice_number:  document.getElementById('invNumber')?.value || '',
    date:            document.getElementById('invDate')?.value   || '',
    status:          document.getElementById('invPaymentStatus')?.value || 'Pending',
    client_name:     usingCustomClient ? (customNameInput.value.trim() || '') : (sel?.dataset.name    || ''),
    client_address:  usingCustomClient ? '' : (sel?.dataset.address || ''),
    client_gstin:    usingCustomClient ? '' : (sel?.dataset.gstin   || ''),
    client_pan:      usingCustomClient ? '' : (sel?.dataset.pan     || ''),
    client_phone:    usingCustomClient ? '' : (sel?.dataset.phone   || ''),
    items,
    taxable_total: tax,
    gst_total: gst,
    grand_total: tax + gst
  };

  sheet.innerHTML = buildInvoiceHTML(inv, biz, bank);
}

async function saveInvoice(e) {
  if (e) e.preventDefault();
  const sel        = document.getElementById('invClientSelect');
  const customNameInput = document.getElementById('invClientCustomName');
  const usingCustomClient = customNameInput && customNameInput.style.display !== 'none';
  const clientId   = usingCustomClient ? null : sel?.value;
  const clientName = usingCustomClient ? (customNameInput.value.trim() || '') : (sel?.dataset.name || '');
  const invNum     = document.getElementById('invNumber')?.value?.trim();
  const invDate    = document.getElementById('invDate')?.value;
  const status     = document.getElementById('invPaymentStatus')?.value || 'Pending';
  const category   = document.getElementById('invBillCategory')?.value || 'Retail';

  if (!invNum) { showToast('Enter an invoice number'); return; }
  if (!clientName) { showToast(usingCustomClient ? 'Enter a client name' : 'Select a client'); return; }

  const rows = [...document.querySelectorAll('#invoiceItemsTbody tr')];
  let taxable = 0, gstTotal = 0, totalCost = 0;
  const items = rows.map(row => {
    const desc    = row.querySelector('.item-desc')?.value || '';
    const qty     = parseFloat(row.querySelector('.item-qty')?.value  || 0);
    const rate    = parseFloat(row.querySelector('.item-rate')?.value || 0);
    const gstRate = parseFloat(row.querySelector('.item-gst')?.value  || 0);
    const cost    = parseFloat(row.querySelector('.item-cost')?.value || 0);
    const tx      = qty * rate;
    const ga      = tx * gstRate / 100;
    taxable   += tx;
    gstTotal  += ga;
    totalCost += qty * cost;
    return { desc, qty, rate, gst_rate: gstRate, taxable: tx, total: tx+ga, cost_price: cost };
  });

  // Profit = taxable sales - cost of goods sold (from inventory cost price)
  const grossProfit = taxable - totalCost;

  const data = {
    invoice_number:  invNum,
    client_id:       clientId ? parseInt(clientId) : null,
    client_name:     clientName,
    client_gstin:    usingCustomClient ? '' : (sel?.dataset.gstin   || ''),
    client_address:  usingCustomClient ? '' : (sel?.dataset.address || ''),
    client_pan:      usingCustomClient ? '' : (sel?.dataset.pan     || ''),
    client_phone:    usingCustomClient ? '' : (sel?.dataset.phone   || ''),
    date:            invDate,
    items,
    taxable_total:   taxable,
    gst_total:       gstTotal,
    grand_total:     taxable + gstTotal,
    cost_total:      totalCost,
    gross_profit:    grossProfit,
    status,
    category
  };

  try {
    const saved = await SB().createInvoice(data);
    const savedId = Array.isArray(saved) ? saved[0]?.id : saved?.id;
    showToast('✓ Invoice saved!');

    document.getElementById('invNumber').value = 'WEL-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4);
    document.getElementById('invDate').value   = new Date().toISOString().slice(0,10);
    document.getElementById('invClientSelect').value = '';
    ['name','gstin','address','pan','phone'].forEach(k => delete document.getElementById('invClientSelect').dataset[k]);
    if (usingCustomClient) toggleCustomClientInput();
    document.getElementById('invBillCategory').value = 'Retail';
    document.getElementById('invoiceItemsTbody').innerHTML = '';
    addInvoiceRow();
    updateInvoiceTotals();
  } catch(err) { showToast('Error: ' + err.message); }
}


function printInvoiceFromSheet() {
  const content = document.getElementById('invoicePrintSheet')?.innerHTML;
  if (!content || content.includes('Add line items')) { showToast('Fill in invoice details first'); return; }
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>Invoice</title>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 16px; font-family: 'Segoe UI', Arial, sans-serif; background: #fff; }
      @media print {
        @page { size: A4 portrait; margin: 0; }
        body { margin: 0; padding: 10mm; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      }
    </style>
    </head><body>${content}<script>window.onload=()=>{ setTimeout(()=>{ window.print(); }, 300); }<\/script></body></html>`);
  w.document.close();
}

// ─── INVOICES LIST ────────────────────────────────────────────
async function loadInvoicesList() {
  const tbody = document.getElementById('invoicesTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="10" class="tbl-empty">Loading…</td></tr>';
  try {
    const status   = document.getElementById('filterInvoiceStatus')?.value || 'all';
    const category = document.getElementById('filterInvoiceCategory')?.value || 'all';
    const search   = document.getElementById('searchInvoicesInput')?.value.trim() || '';
    const sortBy   = document.getElementById('sortInvoicesBy')?.value || 'date';
    let invoices = await SB().getAllInvoices({ status, category, search });

    invoices = invoices.slice().sort((a, b) => {
      if (sortBy === 'client') {
        return String(a.client_name || '').localeCompare(String(b.client_name || ''));
      }
      if (sortBy === 'invoice_number') {
        return String(a.invoice_number || '').localeCompare(String(b.invoice_number || ''));
      }
      // Default: by date, newest first, oldest last
      return new Date(b.date) - new Date(a.date);
    });

    if (!invoices.length) { tbody.innerHTML = '<tr><td colspan="10" class="tbl-empty">No invoices found.</td></tr>'; return; }
    tbody.innerHTML = invoices.map(inv => `
      <tr>
        <td class="cb-col"><input type="checkbox" class="bulk-cb" data-id="${inv.id}"></td>
        <td><strong>${inv.invoice_number}</strong></td>
        <td>${inv.client_name || '—'}</td>
        <td>${inv.date}</td>
        <td>
          <select class="status-select-inline" onchange="toggleInvoiceCategory(${inv.id}, this.value)">
            <option ${(inv.category||'Retail')==='Retail'?'selected':''}>Retail</option>
            <option ${inv.category==='Wholesale'?'selected':''}>Wholesale</option>
            <option ${inv.category==='Stitching'?'selected':''}>Stitching</option>
          </select>
        </td>
        <td>${formatCurrency(inv.taxable_total)}</td>
        <td>${formatCurrency(inv.gst_total)}</td>
        <td><strong>${formatCurrency(inv.grand_total)}</strong></td>
        <td>
          <select class="status-select-inline" onchange="toggleInvoiceStatus(${inv.id}, this.value)">
            <option ${inv.status==='Paid'?'selected':''}>Paid</option>
            <option ${inv.status==='Pending'?'selected':''}>Pending</option>
          </select>
        </td>
        <td style="text-align:center;">
          ${inv.pdf_url
            ? `<a href="${inv.pdf_url}" target="_blank" class="btn btn-action" title="View / Print PDF"><i data-lucide="printer"></i></a>`
            : `<button class="btn btn-action" onclick="printSavedInvoice(${inv.id})" title="Print"><i data-lucide="printer"></i></button>`}
          <button class="btn btn-action btn-action-del" onclick="deleteInvoiceById(${inv.id})" title="Delete"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`).join('');
    if (window.lucide) window.lucide.createIcons();
    BULK.setup('invoicesTableBody', [
      { key:'paid',    label:'Mark Paid',    handler: async ids => { await Promise.all(ids.map(id => SB().updateInvoice(id,{status:'Paid'}))); showToast('Marked Paid'); loadInvoicesList(); } },
      { key:'pending', label:'Mark Pending', handler: async ids => { await Promise.all(ids.map(id => SB().updateInvoice(id,{status:'Pending'}))); showToast('Marked Pending'); loadInvoicesList(); } },
      { key:'delete',  label:'Delete',       danger: true, handler: async ids => { if(!confirm(`Delete ${ids.length} invoice(s)?`)) return; await Promise.all(ids.map(id => SB().deleteInvoice(id))); showToast('Deleted'); loadInvoicesList(); } },
    ]);
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="10" class="tbl-empty">Error: ${e.message}</td></tr>`;
  }
}

window.toggleInvoiceStatus = async (id, status) => {
  await SB().updateInvoice(id, { status });
  showToast('Status updated');
};

window.toggleInvoiceCategory = async (id, category) => {
  await SB().updateInvoice(id, { category });
  showToast('Category updated');
};

window.attachInvoicePdf = async (id, input) => {
  const file = input.files[0];
  if (!file || file.size > 5*1024*1024) { showToast('PDF must be under 5MB'); return; }
  showToast('Uploading…');
  const url = await SB().uploadPdf(file, 'sales');
  await SB().updateInvoice(id, { pdf_url: url });
  showToast('PDF attached!');
  loadInvoicesList();
};

window.removeInvoicePdf = async (id) => {
  if (!confirm('Remove this PDF?')) return;
  await SB().updateInvoice(id, { pdf_url: null });
  showToast('PDF removed');
  loadInvoicesList();
};

window.deleteInvoiceById = async (id) => {
  if (!confirm('Delete this invoice?')) return;
  await SB().deleteInvoice(id);
  showToast('Deleted');
  loadInvoicesList();
};

window.printSavedInvoice = async (id) => {
  const inv = await SB().getInvoiceById(id);
  if (!inv) return;
  const s    = await SB().getSettings().catch(() => ({}));
  const biz  = { name: s.biz_name||'WELIZA', address: s.biz_address||'', gstin: s.biz_gstin||'', pan: s.biz_pan||'', email: s.biz_email||'', phone: s.biz_phone||'' };
  const bank = { acc_name: s.bank_acc_name||'', acc_num: s.bank_acc_num||'', ifsc: s.bank_ifsc||'', acc_type: s.bank_acc_type||'', bank_name: s.bank_name||'' };
  const html = buildInvoiceHTML(inv, biz, bank);
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${inv.invoice_number}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 16px; font-family: 'Segoe UI', Arial, sans-serif; background: #fff; }
      @media print {
        @page { size: A4 portrait; margin: 0; }
        body { margin: 0; padding: 10mm; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      }
    </style>
    </head><body>${html}<script>window.onload=()=>{ setTimeout(()=>{ window.print(); }, 300); }<\/script></body></html>`);
  w.document.close();
};
// Filter/search in invoices list
document.getElementById('filterInvoiceStatus')?.addEventListener('change', loadInvoicesList);
document.getElementById('filterInvoiceCategory')?.addEventListener('change', loadInvoicesList);
document.getElementById('sortInvoicesBy')?.addEventListener('change', loadInvoicesList);
document.getElementById('searchInvoicesInput')?.addEventListener('input', loadInvoicesList);

// ─── PURCHASES ────────────────────────────────────────────────
function setupPurchaseLog() {
  const form = document.getElementById('purchaseForm');
  if (!form) return;

  populateDealerSelect();
  setupPdfUploadZone('purPdfFile', 'purPdfZoneIcon', 'purPdfZoneText', 'pdfFileNameDisplay');

  // Jump to Dealers tab to quickly add a new one
  document.getElementById('btnGoToDealers')?.addEventListener('click', () => {
    document.querySelector('.nav-link[data-tab="dealers"]')?.click();
  });

  // Auto-fill GSTIN when a dealer is selected
  document.getElementById('purSupplier')?.addEventListener('change', (e) => {
    const opt = e.target.options[e.target.selectedIndex];
    const gstinEl = document.getElementById('purSupplierGstin');
    if (gstinEl) gstinEl.value = opt?.dataset.gstin || '';
  });

  // Auto-calculate GST and total
  const taxableEl = document.getElementById('purTaxable');
  const gstRateEl = document.getElementById('purGstRate');
  const gstAmtEl  = document.getElementById('purGstAmount');
  const totalEl   = document.getElementById('purTotal');

  function calcPurchaseTotals() {
    const taxable = parseFloat(taxableEl?.value || 0);
    const rate    = parseFloat(gstRateEl?.value  || 0);
    const gst     = taxable * rate / 100;
    if (gstAmtEl) gstAmtEl.value = gst.toFixed(2);
    if (totalEl)  totalEl.value  = (taxable + gst).toFixed(2);
  }

  taxableEl?.addEventListener('input', calcPurchaseTotals);
  gstRateEl?.addEventListener('change', calcPurchaseTotals);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const taxable = parseFloat(taxableEl?.value || 0);
    const gstAmt  = parseFloat(gstAmtEl?.value  || 0);
    const data = {
      dealer_name:    document.getElementById('purSupplier')?.value?.trim()     || '',
      dealer_gstin:   document.getElementById('purSupplierGstin')?.value?.trim()|| '',
      invoice_number: document.getElementById('purBillNumber')?.value?.trim()   || '',
      date:           document.getElementById('purDate')?.value || new Date().toISOString().slice(0,10),
      taxable_total:  taxable,
      gst_total:      gstAmt,
      grand_total:    taxable + gstAmt,
      status:         'Paid'
    };
    if (!data.dealer_name)    { showToast('Enter supplier name'); return; }
    if (!data.invoice_number) { showToast('Enter bill number');   return; }

    try {
      // Upload PDF if attached
      const pdfFile = document.getElementById('purPdfFile')?.files[0];
      if (pdfFile) {
        showToast('Uploading PDF…');
        data.pdf_url = await SB().uploadPdf(pdfFile, 'purchases');
      }
      await SB().createPurchase(data);
      showToast('✓ Purchase saved!');
      form.reset();
      document.getElementById('purDate').value = new Date().toISOString().slice(0,10);
      resetPdfUploadZone('purPdfFile', 'purPdfZoneIcon', 'purPdfZoneText', 'pdfFileNameDisplay');
      loadPurchasesList();
    } catch(err) { showToast('Error: ' + err.message); }
  });

  document.getElementById('searchPurchasesInput')?.addEventListener('input', loadPurchasesList);
}

async function populateDealerSelect() {
  const sel = document.getElementById('purSupplier');
  if (!sel) return;
  try {
    const dealers = await SB().getAllDealers();
    const current = sel.value;
    sel.innerHTML = '<option value="">Select dealer…</option>' +
      dealers.map(d => `<option value="${d.name}" data-gstin="${d.gstin||''}">${d.name}</option>`).join('');
    if (current) sel.value = current;
  } catch(e) { console.error('Dealer dropdown load error:', e); }
}

async function loadPurchasesList() {
  const tbody = document.getElementById('purchasesTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="tbl-empty">Loading…</td></tr>';
  try {
    const purchases = await SB().getAllPurchases();
    if (!purchases.length) { tbody.innerHTML = '<tr><td colspan="9" class="tbl-empty">No purchases yet.</td></tr>'; return; }
    tbody.innerHTML = purchases.map(p => `
      <tr>
        <td class="cb-col"><input type="checkbox" class="bulk-cb" data-id="${p.id}"></td>
        <td><strong>${p.dealer_name||'—'}</strong></td>
        <td>${p.invoice_number||'—'}</td>
        <td>${p.date}</td>
        <td>${formatCurrency(p.taxable_total)}</td>
        <td>${formatCurrency(p.gst_total)}</td>
        <td><strong>${formatCurrency(p.grand_total)}</strong></td>
        <td style="text-align:center;">
          ${p.pdf_url
            ? `<a href="${p.pdf_url}" target="_blank" class="btn btn-action" title="View"><i data-lucide="eye"></i></a>`
            : `<label class="btn btn-action" title="Upload PDF" style="cursor:pointer;">
                 <i data-lucide="upload"></i>
                 <input type="file" accept="application/pdf" style="display:none;" onchange="attachPurchasePdf(${p.id},this)">
               </label>`}
        </td>
        <td style="text-align:center;">
          <button class="btn btn-action btn-action-del" onclick="deletePurchaseById(${p.id})"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`).join('');
    if (window.lucide) window.lucide.createIcons();
    BULK.setup('purchasesTableBody', [
      { key:'delete', label:'Delete', danger:true, handler: async ids => { if(!confirm(`Delete ${ids.length} purchase(s)?`)) return; await Promise.all(ids.map(id => SB().deletePurchase(id))); showToast('Deleted'); loadPurchasesList(); } },
    ]);
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="8" class="tbl-empty">Error: ${e.message}</td></tr>`;
  }
}

window.attachPurchasePdf = async (id, input) => {
  const file = input.files[0]; if (!file) return;
  showToast('Uploading…');
  const url = await SB().uploadPdf(file, 'purchases');
  await SB().updatePurchase(id, { pdf_url: url });
  showToast('PDF attached!'); loadPurchasesList();
};

window.deletePurchaseById = async (id) => {
  if (!confirm('Delete this purchase?')) return;
  await SB().deletePurchase(id); showToast('Deleted'); loadPurchasesList();
};

// ─── CLIENTS ──────────────────────────────────────────────────
function setupClientCRM() {
  const form = document.getElementById('clientForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name:    document.getElementById('cliName')?.value?.trim(),
      gstin:   document.getElementById('cliGstin')?.value?.trim(),
      pan:     document.getElementById('cliPan')?.value?.trim(),
      phone:   document.getElementById('cliPhone')?.value?.trim(),
      email:   document.getElementById('cliEmail')?.value?.trim(),
      address: [
        document.getElementById('cliAddress')?.value?.trim(),
        document.getElementById('cliCity')?.value?.trim(),
        document.getElementById('cliState')?.value?.trim(),
        document.getElementById('cliPostalCode')?.value?.trim(),
        document.getElementById('cliCountry')?.value?.trim()
      ].filter(Boolean).join(', ')
    };
    if (!data.name) { showToast('Enter client name'); return; }
    const editId = document.getElementById('clientIdHidden')?.value;
    try {
      if (editId) { await SB().updateClient(parseInt(editId), data); showToast('Client updated'); }
      else        { await SB().createClient(data); showToast('Client added'); }
      form.reset();
      document.getElementById('clientIdHidden').value = '';
      document.getElementById('cliCountry').value = 'India';
      document.getElementById('crmFormHeading').textContent = 'Add Client';
      document.getElementById('btnCancelClientEdit').style.display = 'none';
      loadClientsList();
      populateClientDropdown();
    } catch(err) { showToast('Error: ' + err.message); }
  });

  document.getElementById('btnCancelClientEdit')?.addEventListener('click', () => {
    document.getElementById('clientForm').reset();
    document.getElementById('clientIdHidden').value = '';
    document.getElementById('cliCountry').value = 'India';
    document.getElementById('crmFormHeading').textContent = 'Add Client';
    document.getElementById('btnCancelClientEdit').style.display = 'none';
  });

  document.getElementById('searchClientsInput')?.addEventListener('input', loadClientsList);
}

async function loadClientsList() {
  const tbody  = document.getElementById('clientsTableBody');
  if (!tbody) return;
  const search = document.getElementById('searchClientsInput')?.value?.trim() || '';
  tbody.innerHTML = '<tr><td colspan="7" class="tbl-empty">Loading…</td></tr>';
  try {
    const clients = await SB().getAllClients(search);
    allClientsCache = clients;
    if (!clients.length) { tbody.innerHTML = '<tr><td colspan="7" class="tbl-empty">No clients yet.</td></tr>'; return; }
    tbody.innerHTML = clients.map(c => `
      <tr>
        <td class="cb-col"><input type="checkbox" class="bulk-cb" data-id="${c.id}"></td>
        <td><strong>${c.name}</strong></td>
        <td>${c.gstin||'—'}</td>
        <td>${c.phone||'—'}</td>
        <td>${c.address||'—'}</td>
        <td>—</td>
        <td style="text-align:center;">
          <button class="btn btn-action" onclick="editClient(${c.id})" title="Edit"><i data-lucide="pencil"></i></button>
          <button class="btn btn-action btn-action-del" onclick="deleteClientById(${c.id})" title="Delete"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`).join('');
    if (window.lucide) window.lucide.createIcons();
    BULK.setup('clientsTableBody', [
      { key:'delete', label:'Delete', danger:true, handler: async ids => {
          if(!confirm(`Delete ${ids.length} client(s)?`)) return;
          await Promise.all(ids.map(id => SB().deleteClient(id)));
          showToast('Deleted'); loadClientsList();
        } },
    ]);
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="7" class="tbl-empty">Error: ${e.message}</td></tr>`;
  }
}

window.editClient = (id) => {
  const c = allClientsCache.find(x => x.id === id);
  if (!c) return;
  document.getElementById('clientIdHidden').value = id;
  document.getElementById('cliName').value  = c.name    || '';
  document.getElementById('cliGstin').value = c.gstin   || '';
  document.getElementById('cliPan').value   = c.pan     || '';
  document.getElementById('cliPhone').value = c.phone   || '';
  document.getElementById('cliEmail').value = c.email   || '';
  document.getElementById('cliAddress').value = c.address || '';
  document.getElementById('crmFormHeading').textContent = 'Edit Client';
  document.getElementById('btnCancelClientEdit').style.display = 'block';
  document.getElementById('cliName').scrollIntoView({ behavior: 'smooth' });
};

window.deleteClientById = async (id) => {
  if (!confirm('Delete this client?')) return;
  await SB().deleteClient(id); showToast('Deleted'); loadClientsList();
};

// ─── DEALERS ──────────────────────────────────────────────────
function setupDealers() {
  const form = document.getElementById('dealerForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name:     document.getElementById('dName')?.value?.trim(),
      phone:    document.getElementById('dPhone')?.value?.trim(),
      email:    document.getElementById('dEmail')?.value?.trim(),
      address:  document.getElementById('dAddress')?.value?.trim(),
      gstin:    document.getElementById('dGstin')?.value?.trim(),
      category: document.getElementById('dCategory')?.value?.trim(),
      notes:    document.getElementById('dNotes')?.value?.trim()
    };
    if (!data.name) { showToast('Enter dealer name'); return; }
    const editId = form.dataset.editId;
    try {
      if (editId) { await SB().updateDealer(parseInt(editId), data); showToast('Dealer updated'); delete form.dataset.editId; }
      else        { await SB().createDealer(data); showToast('Dealer added'); }
      form.reset(); loadDealersList();
    } catch(err) { showToast('Error: ' + err.message); }
  });
  document.getElementById('searchDealersInput')?.addEventListener('input', loadDealersList);
}

async function loadDealersList() {
  const tbody  = document.getElementById('dealersTableBody');
  if (!tbody) return;
  const search = document.getElementById('searchDealersInput')?.value?.trim() || '';
  tbody.innerHTML = '<tr><td colspan="6" class="tbl-empty">Loading…</td></tr>';
  try {
    const dealers = await SB().getAllDealers(search);
    allDealersCache = dealers;
    if (!dealers.length) { tbody.innerHTML = '<tr><td colspan="6" class="tbl-empty">No dealers yet.</td></tr>'; return; }
    tbody.innerHTML = dealers.map(d => `
      <tr>
        <td class="cb-col"><input type="checkbox" class="bulk-cb" data-id="${d.id}"></td>
        <td><strong>${d.name}</strong></td>
        <td>${d.phone||'—'}</td>
        <td>${d.category||'—'}</td>
        <td>${d.gstin||'—'}</td>
        <td style="text-align:center;">
          <button class="btn btn-action" onclick="editDealer(${d.id})"><i data-lucide="pencil"></i></button>
          <button class="btn btn-action btn-action-del" onclick="deleteDealerById(${d.id})"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`).join('');
    if (window.lucide) window.lucide.createIcons();
    BULK.setup('dealersTableBody', [
      { key:'delete', label:'Delete', danger:true, handler: async ids => {
          if(!confirm(`Delete ${ids.length} dealer(s)?`)) return;
          await Promise.all(ids.map(id => SB().deleteDealer(id)));
          showToast('Deleted'); loadDealersList();
        } },
    ]);
  } catch(e) { tbody.innerHTML = `<tr><td colspan="6" class="tbl-empty">Error: ${e.message}</td></tr>`; }
}

window.editDealer = (id) => {
  const d = allDealersCache.find(x => x.id === id);
  if (!d) return;
  document.getElementById('dealerForm').dataset.editId = id;
  document.getElementById('dName').value     = d.name     || '';
  document.getElementById('dPhone').value    = d.phone    || '';
  document.getElementById('dEmail').value    = d.email    || '';
  document.getElementById('dAddress').value  = d.address  || '';
  document.getElementById('dGstin').value    = d.gstin    || '';
  document.getElementById('dCategory').value = d.category || '';
  document.getElementById('dNotes').value    = d.notes    || '';
  document.getElementById('dName').scrollIntoView({ behavior:'smooth' });
};

window.deleteDealerById = async (id) => {
  if (!confirm('Delete this dealer?')) return;
  await SB().deleteDealer(id); showToast('Deleted'); loadDealersList();
};

// ─── EXPENSES ─────────────────────────────────────────────────
function setupExpenses() {
  const form = document.getElementById('expenseForm');
  if (!form) return;

  setupPdfUploadZone('expPdfFile', 'expPdfZoneIcon', 'expPdfZoneText', 'expPdfFileNameDisplay');

  // Show worker dropdown when Salary selected
  document.getElementById('expCategory')?.addEventListener('change', (e) => {
    const row = document.getElementById('workerSelectRow');
    if (row) row.style.display = e.target.value === 'Salary' ? '' : 'none';
    if (e.target.value === 'Salary') populateWorkerDropdown();
  });

  // Auto-calculate GST and total
  function recalcExpGst() {
    const amount = parseFloat(document.getElementById('expAmount')?.value || 0);
    const rate   = parseFloat(document.getElementById('expGstRate')?.value || 0);
    const gst    = parseFloat((amount * rate / 100).toFixed(2));
    const el = document.getElementById('expGstAmount');
    if (el) el.value = rate > 0 ? gst.toFixed(2) : '';
    const totalEl = document.getElementById('expTotalAmount');
    if (totalEl) totalEl.value = amount ? (amount + gst).toFixed(2) : '';
  }
  document.getElementById('expAmount')?.addEventListener('input', recalcExpGst);
  document.getElementById('expGstRate')?.addEventListener('change', recalcExpGst);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const gstRate = parseFloat(document.getElementById('expGstRate')?.value || 0);
    const amount  = parseFloat(document.getElementById('expAmount')?.value || 0);
    const data = {
      category:     document.getElementById('expCategory')?.value,
      description:  document.getElementById('expDescription')?.value?.trim(),
      amount,
      gst_rate:     gstRate,
      gst_amount:   gstRate > 0 ? parseFloat((amount * gstRate / 100).toFixed(2)) : 0,
      worker_id:    document.getElementById('expWorkerSelect')?.value ? parseInt(document.getElementById('expWorkerSelect').value) : null,
      date:         document.getElementById('expDate')?.value || new Date().toISOString().slice(0,10),
      paid_to:      document.getElementById('expPaidTo')?.value?.trim(),
      payment_mode: document.getElementById('expPaymentMode')?.value,
      notes:        document.getElementById('expNotes')?.value?.trim()
    };
    if (!data.category) { showToast('Select a category'); return; }
    if (!data.amount)   { showToast('Enter an amount');   return; }
    try {
      const pdfFile = document.getElementById('expPdfFile')?.files[0];
      if (pdfFile) {
        showToast('Uploading PDF…');
        data.pdf_url = await SB().uploadPdf(pdfFile, 'expenses');
      }
      await SB().createExpense(data);
      showToast('✓ Expense saved!');
      form.reset();
      document.getElementById('expDate').value = new Date().toISOString().slice(0,10);
      document.getElementById('workerSelectRow').style.display = 'none';
      resetPdfUploadZone('expPdfFile', 'expPdfZoneIcon', 'expPdfZoneText', 'expPdfFileNameDisplay');
      loadExpensesList();
    } catch(err) { showToast('Error: ' + err.message); }
  });
  document.getElementById('filterExpenseCategory')?.addEventListener('change', loadExpensesList);
}

async function loadExpensesList() {
  const tbody    = document.getElementById('expensesTableBody');
  if (!tbody) return;
  const category = document.getElementById('filterExpenseCategory')?.value || 'all';
  tbody.innerHTML = '<tr><td colspan="8" class="tbl-empty">Loading…</td></tr>';
  try {
    const expenses = await SB().getAllExpenses({ category });
    if (!expenses.length) { tbody.innerHTML = '<tr><td colspan="8" class="tbl-empty">No expenses yet.</td></tr>'; return; }
    const total = expenses.reduce((s, e) => s + parseFloat(e.amount||0), 0);
    tbody.innerHTML = expenses.map(exp => `
      <tr>
        <td class="cb-col"><input type="checkbox" class="bulk-cb" data-id="${exp.id}"></td>
        <td>${exp.date}</td>
        <td><strong>${exp.category}</strong></td>
        <td>${exp.description||'—'}</td>
        <td>${exp.paid_to||'—'}</td>
        <td><strong>${formatCurrency(exp.amount)}</strong></td>
        <td style="text-align:center;">
          ${exp.pdf_url
            ? `<a href="${exp.pdf_url}" target="_blank" class="btn btn-action" title="View Invoice"><i data-lucide="eye"></i></a>`
            : `<label class="btn btn-action" title="Upload Invoice PDF" style="cursor:pointer;">
                 <i data-lucide="upload"></i>
                 <input type="file" accept="application/pdf" style="display:none;" onchange="attachExpensePdf(${exp.id},this)">
               </label>`}
        </td>
        <td style="text-align:center;">
          <button class="btn btn-action btn-action-del" onclick="deleteExpenseById(${exp.id})"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`).join('') +
      `<tr style="background:var(--s2);font-weight:700;">
        <td></td><td colspan="4" style="padding:10px 14px;">Total</td>
        <td>${formatCurrency(total)}</td><td colspan="2"></td>
      </tr>`;
    if (window.lucide) window.lucide.createIcons();
    BULK.setup('expensesTableBody', [
      { key:'delete', label:'Delete', danger:true, handler: async ids => {
          if(!confirm(`Delete ${ids.length} expense(s)?`)) return;
          await Promise.all(ids.map(id => SB().deleteExpense(id)));
          showToast('Deleted'); loadExpensesList();
        } },
    ]);
  } catch(e) { tbody.innerHTML = `<tr><td colspan="8" class="tbl-empty">Error: ${e.message}</td></tr>`; }
}

window.attachExpensePdf = async (id, input) => {
  const file = input.files[0]; if (!file) return;
  showToast('Uploading…');
  const url = await SB().uploadPdf(file, 'expenses');
  await SB().updateExpense(id, { pdf_url: url });
  showToast('PDF attached!'); loadExpensesList();
};

window.deleteExpenseById = async (id) => {
  if (!confirm('Delete this expense?')) return;
  await SB().deleteExpense(id); showToast('Deleted'); loadExpensesList();
};

// ─── INVENTORY ────────────────────────────────────────────────
function setupInventory() {
  const form = document.getElementById('inventoryForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name:            document.getElementById('invName')?.value?.trim(),
      sku:             document.getElementById('invSku')?.value?.trim(),
      category:        document.getElementById('invCategory')?.value?.trim(),
      unit:            document.getElementById('invUnit')?.value || 'pcs',
      stock:           parseFloat(document.getElementById('invStock')?.value    || 0),
      cost_price:      parseFloat(document.getElementById('invCostPrice')?.value || 0),
      sell_price:      parseFloat(document.getElementById('invSellPrice')?.value || 0),
      low_stock_alert: parseFloat(document.getElementById('invLowStock')?.value  || 5)
    };
    if (!data.name) { showToast('Enter item name'); return; }
    const editId = form.dataset.editId;
    try {
      if (editId) { await SB().updateInventoryItem(parseInt(editId), data); showToast('Updated'); delete form.dataset.editId; }
      else        { await SB().createInventoryItem(data); showToast('✓ Item added'); }
      form.reset();
      document.getElementById('invLowStock').value = '5';
      loadInventoryList();
    } catch(err) { showToast('Error: ' + err.message); }
  });
  document.getElementById('searchInventoryInput')?.addEventListener('input', loadInventoryList);
}

async function loadInventoryList() {
  const tbody  = document.getElementById('inventoryTableBody');
  if (!tbody) return;
  const search = document.getElementById('searchInventoryInput')?.value?.trim() || '';
  tbody.innerHTML = '<tr><td colspan="8" class="tbl-empty">Loading…</td></tr>';
  try {
    const items = await SB().getAllInventory(search);
    if (!items.length) { tbody.innerHTML = '<tr><td colspan="8" class="tbl-empty">No items yet.</td></tr>'; return; }
    tbody.innerHTML = items.map(item => {
      const low = item.stock <= item.low_stock_alert;
      return `<tr ${low?'style="background:#fff5f5;"':''}>
        <td class="cb-col"><input type="checkbox" class="bulk-cb" data-id="${item.id}"></td>
        <td><strong>${item.name}</strong>${item.sku?` <small style="color:#888;">${item.sku}</small>`:''}</td>
        <td>${item.category||'—'}</td>
        <td>${item.unit||'pcs'}</td>
        <td style="font-weight:700;color:${low?'#c0392b':'inherit'};">${item.stock} ${low?'⚠️':''}</td>
        <td>${formatCurrency(item.cost_price)}</td>
        <td>${formatCurrency(item.sell_price)}</td>
        <td style="text-align:center;">
          <button class="btn btn-action btn-action-del" onclick="deleteInventoryById(${item.id})"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`;
    }).join('');
    if (window.lucide) window.lucide.createIcons();
    BULK.setup('inventoryTableBody', [
      { key:'delete', label:'Delete', danger:true, handler: async ids => {
          if(!confirm(`Delete ${ids.length} item(s)?`)) return;
          await Promise.all(ids.map(id => SB().deleteInventoryItem(id)));
          showToast('Deleted'); loadInventoryList();
        } },
    ]);
  } catch(e) { tbody.innerHTML = `<tr><td colspan="8" class="tbl-empty">Error: ${e.message}</td></tr>`; }
}

window.deleteInventoryById = async (id) => {
  if (!confirm('Delete this item?')) return;
  await SB().deleteInventoryItem(id); showToast('Deleted'); loadInventoryList();
};

// ─── REPORTS ──────────────────────────────────────────────────
let reportTrendChartInst = null;
let reportExpensePieInst = null;

async function loadReports() {
  const container = document.getElementById('reportsContainer');
  if (!container) return;
  container.innerHTML = '<p style="padding:20px;color:#888;">Loading reports…</p>';
  try {
    const stats = await SB().getDashboardStats();
    const invoices  = stats.invoices;
    const purchases = stats.purchases;
    const expenses  = stats.expenses;

    // Group by month
    const months = {};
    invoices.forEach(inv => {
      const m = (inv.date||'').slice(0,7);
      if (!months[m]) months[m] = { sales:0, gstOut:0, purchases:0, gstIn:0, expenses:0 };
      months[m].sales   += parseFloat(inv.grand_total||0);
      months[m].gstOut  += parseFloat(inv.gst_total||0);
    });
    purchases.forEach(p => {
      const m = (p.date||'').slice(0,7);
      if (!months[m]) months[m] = { sales:0, gstOut:0, purchases:0, gstIn:0, expenses:0 };
      months[m].purchases += parseFloat(p.grand_total||0);
      months[m].gstIn     += parseFloat(p.gst_total||0);
    });
    expenses.forEach(exp => {
      const m = (exp.date||'').slice(0,7);
      if (!months[m]) months[m] = { sales:0, gstOut:0, purchases:0, gstIn:0, expenses:0 };
      months[m].expenses += parseFloat(exp.amount||0);
    });

    const sortedMonthsAsc = Object.keys(months).sort(); // oldest → newest
    const sortedMonthsDesc = [...sortedMonthsAsc].reverse(); // newest → oldest

    // Profit per month
    const profitByMonth = {};
    sortedMonthsAsc.forEach(m => {
      const d = months[m];
      profitByMonth[m] = d.sales - d.purchases - d.expenses;
    });

    // ── Business Health: compare last 3 months avg profit vs previous 3 months avg profit
    const last3 = sortedMonthsDesc.slice(0, 3);
    const prev3 = sortedMonthsDesc.slice(3, 6);
    const avg = (arr) => arr.length ? arr.reduce((s,m) => s + profitByMonth[m], 0) / arr.length : 0;
    const last3Avg = avg(last3);
    const prev3Avg = avg(prev3);
    let healthPct = 0, healthLabel = 'Not enough data yet', healthIcon = '➡️', healthColor = '#888';
    if (prev3.length > 0 && prev3Avg !== 0) {
      healthPct = ((last3Avg - prev3Avg) / Math.abs(prev3Avg)) * 100;
    } else if (prev3.length > 0) {
      healthPct = last3Avg > 0 ? 100 : (last3Avg < 0 ? -100 : 0);
    }
    if (prev3.length > 0) {
      if (healthPct > 5)       { healthLabel = 'Growing';  healthIcon = '📈'; healthColor = '#1e7a45'; }
      else if (healthPct < -5) { healthLabel = 'Shrinking'; healthIcon = '📉'; healthColor = '#c0392b'; }
      else                     { healthLabel = 'Stable';    healthIcon = '➡️'; healthColor = '#C09A59'; }
    }
    const healthSummary = prev3.length > 0
      ? `Average monthly profit ${healthPct >= 0 ? 'grew' : 'dropped'} <strong>${Math.abs(healthPct).toFixed(0)}%</strong> compared to the previous 3 months.`
      : `Once you have a few more months of data, we'll show you the trend here.`;

    // ── KPI strip values
    const thisMonthKey = sortedMonthsDesc[0];
    const lastMonthKey = sortedMonthsDesc[1];
    const thisMonthProfit = thisMonthKey ? profitByMonth[thisMonthKey] : 0;
    const lastMonthProfit = lastMonthKey ? profitByMonth[lastMonthKey] : 0;
    const momChange = lastMonthKey && lastMonthProfit !== 0
      ? ((thisMonthProfit - lastMonthProfit) / Math.abs(lastMonthProfit)) * 100
      : null;

    let bestMonth = null, bestProfit = -Infinity;
    sortedMonthsAsc.forEach(m => { if (profitByMonth[m] > bestProfit) { bestProfit = profitByMonth[m]; bestMonth = m; } });

    // Year totals
    const years = {};
    sortedMonthsAsc.forEach(m => {
      const y = m.slice(0,4);
      if (!years[y]) years[y] = { sales:0, purchases:0, expenses:0, profit:0 };
      years[y].sales     += months[m].sales;
      years[y].purchases += months[m].purchases;
      years[y].expenses  += months[m].expenses;
      years[y].profit    += profitByMonth[m];
    });
    const yearKeys = Object.keys(years).sort();
    const thisYear = yearKeys[yearKeys.length - 1];
    const lastYear  = yearKeys[yearKeys.length - 2];
    const yoyChange = (thisYear && lastYear && years[lastYear].profit !== 0)
      ? ((years[thisYear].profit - years[lastYear].profit) / Math.abs(years[lastYear].profit)) * 100
      : null;

    // ── Rank months by profit for medal badges
    const rankedByProfit = [...sortedMonthsAsc].sort((a,b) => profitByMonth[b] - profitByMonth[a]);
    const medal = (m) => {
      const rank = rankedByProfit.indexOf(m);
      return rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : '';
    };

    // ── Monthly analysis table rows (newest first) with MoM% vs the month before it
    const monthRows = sortedMonthsDesc.map((m, idx) => {
      const d = months[m];
      const profit = profitByMonth[m];
      const prevMonthKey = sortedMonthsDesc[idx + 1]; // chronologically previous month
      let momArrow = '';
      if (prevMonthKey) {
        const prevProfit = profitByMonth[prevMonthKey];
        if (prevProfit !== 0) {
          const chg = ((profit - prevProfit) / Math.abs(prevProfit)) * 100;
          momArrow = chg >= 0
            ? `<span style="color:#1e7a45;font-size:0.78rem;">▲ ${chg.toFixed(0)}%</span>`
            : `<span style="color:#c0392b;font-size:0.78rem;">▼ ${Math.abs(chg).toFixed(0)}%</span>`;
        }
      }
      return `<tr>
        <td><strong>${m}</strong> ${medal(m)}</td>
        <td>${formatCurrency(d.sales)}</td>
        <td>${formatCurrency(d.purchases)}</td>
        <td>${formatCurrency(d.expenses)}</td>
        <td style="color:${profit>=0?'#1F5138':'#c0392b'};font-weight:700;">${formatCurrency(profit)}</td>
        <td>${momArrow}</td>
      </tr>`;
    }).join('');

    // ── Expense breakdown by category (all-time)
    const expenseByCategory = {};
    expenses.forEach(exp => {
      const cat = exp.category || 'Other';
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + parseFloat(exp.amount || 0);
    });
    const totalExpenseAmt = Object.values(expenseByCategory).reduce((a,b)=>a+b, 0);
    const expenseCatLabels = Object.keys(expenseByCategory);
    const expenseCatValues = expenseCatLabels.map(c => expenseByCategory[c]);
    const expenseColors = ['#2a78d6','#1baf7a','#eda100','#888780','#d85a30','#9085e9'];

    // ── Money in vs money out (all-time)
    const totalSalesAll = stats.grossSales;
    const totalPurchasesAll = stats.grossPurchases;
    const totalExpensesAll = stats.totalExpenses;
    const moneyTotal = totalSalesAll + totalPurchasesAll + totalExpensesAll || 1;
    const salesPct = (totalSalesAll / moneyTotal) * 100;
    const purchasesPct = (totalPurchasesAll / moneyTotal) * 100;
    const expensesPct = (totalExpensesAll / moneyTotal) * 100;

    // ── Net profit margin & GST health
    const margin = totalSalesAll > 0 ? (stats.netProfit / totalSalesAll) * 100 : 0;
    const gstNet = stats.gstCollected - stats.gstPaid;

    // ── Insights feed (plain-language bullets)
    const insights = [];
    if (prev3.length > 0) {
      insights.push({
        icon: healthPct >= 0 ? 'trending-up' : 'trending-down',
        color: healthPct >= 0 ? '#1e7a45' : '#c0392b',
        text: `Profit ${healthPct >= 0 ? 'grew' : 'dropped'} <strong>${Math.abs(healthPct).toFixed(0)}%</strong> compared to the previous quarter.`
      });
    }
    if (bestMonth) {
      insights.push({
        icon: 'calendar',
        color: '#888',
        text: `<strong>${bestMonth}</strong> was your best month so far, with ${formatCurrency(bestProfit)} net profit.`
      });
    }
    if (gstNet > 0) {
      insights.push({
        icon: 'alert-triangle',
        color: '#C09A59',
        text: `GST payable right now is <strong>${formatCurrency(gstNet)}</strong>.`
      });
    }
    if (stats.outstanding > 0) {
      insights.push({
        icon: 'wallet',
        color: '#1F5138',
        text: `You have <strong>${formatCurrency(stats.outstanding)}</strong> in unpaid invoices outstanding.`
      });
    }

    // ── Story paragraph (plain language summary)
    const topCategory = expenseCatLabels.length
      ? expenseCatLabels[expenseCatValues.indexOf(Math.max(...expenseCatValues))]
      : null;
    const topCategoryPct = topCategory ? (expenseByCategory[topCategory] / totalExpenseAmt * 100) : 0;
    let story = '';
    if (sortedMonthsAsc.length === 0) {
      story = `Once you log a few invoices, purchases, and expenses, this space will summarise your business in plain language — no charts to squint at, just what's happening and what to watch.`;
    } else {
      story += bestMonth
        ? `<strong>${bestMonth}</strong> was Weliza's best month yet — ${formatCurrency(bestProfit)} in profit. `
        : '';
      story += topCategory
        ? `You're spending ${topCategoryPct.toFixed(0)}% of expenses on <strong>${topCategory}</strong>. `
        : '';
      story += stats.outstanding > 0
        ? `You're on track to collect ${formatCurrency(stats.outstanding)} more from outstanding invoices. `
        : '';
      story += gstNet > 0
        ? `Keep an eye on GST — <strong>${formatCurrency(gstNet)}</strong> is currently payable.`
        : `Your GST position is currently balanced.`;
    }

    container.innerHTML = `
      <!-- Header with Export -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-size:0.85rem;color:#888;">An at-a-glance look at how Weliza is doing.</div>
        <button class="btn btn-outline btn-sm" id="btnExportReportPdf">
          <i data-lucide="download"></i> Export PDF
        </button>
      </div>

      <!-- Insights Feed -->
      <div class="panel" style="margin-bottom:16px;">
        <div class="panel-head">Insights</div>
        <div style="padding:14px 18px;display:flex;flex-direction:column;gap:8px;">
          ${insights.length ? insights.map(i => `
            <div style="font-size:0.88rem;display:flex;align-items:flex-start;gap:8px;">
              <i data-lucide="${i.icon}" style="width:15px;height:15px;color:${i.color};margin-top:2px;flex-shrink:0;"></i>
              <span>${i.text}</span>
            </div>`).join('') : '<div style="font-size:0.85rem;color:#888;">Not enough data yet for insights.</div>'}
        </div>
      </div>

      <!-- Money In vs Money Out -->
      <div class="panel" style="margin-bottom:16px;">
        <div class="panel-head">Money In vs Money Out</div>
        <div style="padding:16px 18px;">
          <div style="display:flex;height:26px;border-radius:6px;overflow:hidden;width:100%;">
            <div style="width:${salesPct}%;background:#1e7a45;"></div>
            <div style="width:${purchasesPct}%;background:#d85a30;"></div>
            <div style="width:${expensesPct}%;background:#888;"></div>
          </div>
          <div style="display:flex;gap:16px;margin-top:10px;font-size:0.78rem;color:#999;flex-wrap:wrap;">
            <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#1e7a45;margin-right:4px;"></span>Sales ${formatCurrency(totalSalesAll)}</span>
            <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#d85a30;margin-right:4px;"></span>Purchases ${formatCurrency(totalPurchasesAll)}</span>
            <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#888;margin-right:4px;"></span>Expenses ${formatCurrency(totalExpensesAll)}</span>
          </div>
        </div>
      </div>

      <!-- KPI Strip -->
      <div class="kpi-row" style="margin-bottom:16px;">
        <div class="kpi ${stats.netProfit>=0?'accent-g':'accent-r'}">
          <div class="kpi-label">Net Profit / Margin</div>
          <div class="kpi-value">${formatCurrency(stats.netProfit)}</div>
          <div style="font-size:0.72rem;color:${margin>=0?'#1e7a45':'#c0392b'};margin-top:2px;">${margin.toFixed(0)}% margin</div>
        </div>
        <div class="kpi ${gstNet>0?'accent-y':'accent-g'}">
          <div class="kpi-label">GST Health</div>
          <div class="kpi-value">${formatCurrency(Math.abs(gstNet))}</div>
          <div style="font-size:0.72rem;color:#999;margin-top:2px;">${gstNet>0?'Payable now':'Balanced'}</div>
        </div>
        <div class="kpi accent-p">
          <div class="kpi-label">Best Month Ever 🥇</div>
          <div class="kpi-value" style="font-size:1.05rem;">${bestMonth ? formatCurrency(bestProfit) : '—'}</div>
          <div style="font-size:0.72rem;color:#999;margin-top:2px;">${bestMonth || ''}</div>
        </div>
        <div class="kpi accent-b">
          <div class="kpi-label">Expected in 30 Days</div>
          <div class="kpi-value" style="font-size:1.05rem;">${formatCurrency(stats.outstanding)}</div>
          <div style="font-size:0.72rem;color:#999;margin-top:2px;">from outstanding invoices</div>
        </div>
      </div>

      <!-- Net Profit Trend Chart -->
      <div class="panel" style="margin-bottom:16px;">
        <div class="panel-head">Net Profit Trend</div>
        <div class="chart-box" style="height:240px;"><canvas id="reportTrendChart"></canvas></div>
      </div>

      <!-- Expense Breakdown + Story, side by side -->
      <div class="panel" style="margin-bottom:16px;">
        <div style="display:flex;flex-wrap:wrap;">
          <div style="flex:1;min-width:280px;border-right:1px solid var(--border);">
            <div class="panel-head">Where Expenses Go</div>
            <div style="padding:16px 18px;display:flex;gap:24px;align-items:center;flex-wrap:wrap;">
              <div style="position:relative;width:160px;height:160px;flex-shrink:0;">
                ${expenseCatLabels.length ? '<canvas id="reportExpensePie"></canvas>' : '<div style="font-size:0.82rem;color:#888;">No expenses logged yet</div>'}
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;font-size:0.82rem;">
                ${expenseCatLabels.map((c,i) => `<span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${expenseColors[i%expenseColors.length]};margin-right:6px;"></span>${c} — ${((expenseByCategory[c]/totalExpenseAmt)*100).toFixed(0)}%</span>`).join('')}
              </div>
            </div>
          </div>
          <div style="flex:1;min-width:280px;">
            <div class="panel-head">Your Month, In Plain Words</div>
            <div style="padding:16px 18px;">
              <p style="font-size:0.95rem;line-height:1.7;margin:0;color:#ddd;">${story}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Monthly Analysis -->
      <div class="panel">
        <div class="panel-head">Monthly Analysis <span style="font-size:0.7rem;color:#999;font-weight:400;text-transform:none;">— ranked months get 🥇🥈🥉</span></div>
        <div class="panel-table-wrap">
          <table class="tbl">
            <thead><tr>
              <th>Month</th><th>Sales</th><th>Purchases</th><th>Expenses</th>
              <th>Net Profit</th><th>vs Prev. Month</th>
            </tr></thead>
            <tbody>${monthRows || '<tr><td colspan="6" class="tbl-empty">No data yet</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;

    if (window.lucide) window.lucide.createIcons();

    document.getElementById('btnExportReportPdf')?.addEventListener('click', () => {
      document.body.classList.add('printing-reports');
      window.print();
    });

    // Render the profit trend chart (oldest → newest)
    const trendCtx = document.getElementById('reportTrendChart');
    if (trendCtx) {
      if (reportTrendChartInst) reportTrendChartInst.destroy();
      const trendLabels = sortedMonthsAsc;
      const trendData = trendLabels.map(m => profitByMonth[m]);
      reportTrendChartInst = new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: trendLabels,
          datasets: [{
            label: 'Net Profit ₹',
            data: trendData,
            borderColor: '#1F5138',
            backgroundColor: 'rgba(30,71,53,0.10)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: trendData.map(v => v >= 0 ? '#1F5138' : '#c0392b')
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: false } }
        }
      });
    }

    // Render the expense breakdown donut
    const pieCtx = document.getElementById('reportExpensePie');
    if (pieCtx && expenseCatLabels.length) {
      if (reportExpensePieInst) reportExpensePieInst.destroy();
      reportExpensePieInst = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
          labels: expenseCatLabels,
          datasets: [{
            data: expenseCatValues,
            backgroundColor: expenseCatLabels.map((_,i) => expenseColors[i % expenseColors.length]),
            borderWidth: 2,
            borderColor: '#1a1a1a'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          cutout: '65%'
        }
      });
    }
  } catch(e) {
    container.innerHTML = `<p style="padding:20px;color:#c0392b;">Error loading reports: ${e.message}</p>`;
  }
}

// ─── SETTINGS ─────────────────────────────────────────────────
function setupSettings() {
  document.getElementById('billedFromForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pairs = [
      ['biz_name',    document.getElementById('setBizName')?.value],
      ['biz_address', document.getElementById('setBizAddress')?.value],
      ['biz_gstin',   document.getElementById('setBizGstin')?.value],
      ['biz_pan',     document.getElementById('setBizPan')?.value],
      ['biz_email',   document.getElementById('setBizEmail')?.value],
      ['biz_phone',   document.getElementById('setBizPhone')?.value],
    ];
    try {
      await Promise.all(pairs.map(([k,v]) => SB().saveSetting(k, v?.trim()||'')));
      showToast('✓ Business details saved!');
    } catch(err) { showToast('Error: ' + err.message); }
  });

  document.getElementById('bankDetailsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pairs = [
      ['bank_acc_name', document.getElementById('setBankAccName')?.value],
      ['bank_acc_num',  document.getElementById('setBankAccNum')?.value],
      ['bank_ifsc',     document.getElementById('setBankIfsc')?.value],
      ['bank_acc_type', document.getElementById('setBankAccType')?.value],
      ['bank_name',     document.getElementById('setBankName')?.value],
    ];
    try {
      await Promise.all(pairs.map(([k,v]) => SB().saveSetting(k, v?.trim()||'')));
      showToast('✓ Bank details saved!');
    } catch(err) { showToast('Error: ' + err.message); }
  });

  document.getElementById('btnChooseFolder')?.addEventListener('click', () => FS.choose());
  document.getElementById('btnCreateSubfolders')?.addEventListener('click', () => FS.createSubfolders());
  const exportBtn = document.getElementById('btnExportAllData');
  exportBtn?.addEventListener('click', () => FS.exportAll(exportBtn));
  FS.updateLastExportNote();
}

async function loadSettingsForm() {
  try {
    const s = await SB().getSettings();
    const map = {
      setBizName:'biz_name', setBizAddress:'biz_address', setBizGstin:'biz_gstin',
      setBizPan:'biz_pan',   setBizEmail:'biz_email',     setBizPhone:'biz_phone',
      setBankAccName:'bank_acc_name', setBankAccNum:'bank_acc_num',
      setBankIfsc:'bank_ifsc', setBankAccType:'bank_acc_type', setBankName:'bank_name'
    };
    Object.entries(map).forEach(([elId, key]) => {
      const el = document.getElementById(elId);
      if (el && s[key]) el.value = s[key];
    });
  } catch(e) { console.error('Settings load error:', e); }
}

// ─── ATTACH PDF MODAL ─────────────────────────────────────────
function setupAttachPdfModal() {
  const openBtn   = document.getElementById('btnAttachPdfBtn');
  const modal     = document.getElementById('attachPdfModal');
  const closeBtn  = document.getElementById('attachPdfModalClose');
  const select    = document.getElementById('attachPdfInvoiceSelect');
  const fileInput = document.getElementById('attachPdfFileInput');
  const fileLabel = document.getElementById('attachPdfFileName');
  const saveBtn   = document.getElementById('attachPdfSaveBtn');
  const errDiv    = document.getElementById('attachPdfError');
  if (!openBtn || !modal) return;

  let pendingFile = null;

  openBtn.addEventListener('click', async () => {
    const invoices = await SB().getAllInvoices();
    select.innerHTML = invoices.length
      ? `<option value="">— Select invoice —</option>` + invoices.map(inv =>
          `<option value="${inv.id}">${inv.invoice_number} · ${inv.client_name||''} · ${inv.date}${inv.pdf_url?' 📎':''}</option>`).join('')
      : '<option value="">No invoices</option>';
    pendingFile = null;
    if (fileLabel) fileLabel.textContent = 'Click to choose a PDF…';
    fileInput.value = '';
    if (errDiv) errDiv.style.display = 'none';
    modal.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons();
  });

  closeBtn?.addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

  fileInput?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (errDiv) errDiv.style.display = 'none';
    if (!file) return;
    if (file.size > 5*1024*1024) { if(errDiv){errDiv.textContent='Max 5MB';errDiv.style.display='block';} return; }
    pendingFile = file;
    if (fileLabel) fileLabel.textContent = '✓ ' + file.name;
  });

  saveBtn?.addEventListener('click', async () => {
    if (errDiv) errDiv.style.display = 'none';
    const invId = parseInt(select?.value);
    if (!invId)       { if(errDiv){errDiv.textContent='Select an invoice';errDiv.style.display='block';} return; }
    if (!pendingFile) { if(errDiv){errDiv.textContent='Choose a PDF';errDiv.style.display='block';} return; }
    saveBtn.disabled = true; saveBtn.textContent = 'Uploading…';
    try {
      const url = await SB().uploadPdf(pendingFile, 'sales');
      await SB().updateInvoice(invId, { pdf_url: url });
      modal.style.display = 'none';
      showToast('PDF attached!');
      loadInvoicesList();
    } catch(err) {
      if(errDiv){errDiv.textContent='Failed: '+err.message;errDiv.style.display='block';}
    }
    saveBtn.disabled = false; saveBtn.innerHTML = '<i data-lucide="paperclip"></i> Attach PDF';
    if (window.lucide) window.lucide.createIcons();
  });
}

// ─── EXTERNAL INVOICE MODAL ───────────────────────────────────
function setupExternalInvoiceModal() {
  const openBtn  = document.getElementById('openExternalInvoiceBtn');
  const modal    = document.getElementById('externalInvoiceModal');
  const closeBtn = document.getElementById('extInvModalClose');
  const pdfInput = document.getElementById('extInvPdfInput');
  const pdfName  = document.getElementById('extInvPdfName');
  const pdfZone  = document.getElementById('extInvPdfZone');
  const saveBtn  = document.getElementById('extInvSaveBtn');
  const errDiv   = document.getElementById('extInvError');
  if (!openBtn || !modal) return;

  document.getElementById('extInvDate').value = new Date().toISOString().slice(0,10);

  // Auto-calculate GST when taxable or rate changes
  function recalcGst() {
    const taxable = parseFloat(document.getElementById('extInvTaxable').value || 0);
    const rate    = parseFloat(document.getElementById('extInvGstRate').value || 0);
    const gst     = parseFloat((taxable * rate / 100).toFixed(2));
    document.getElementById('extInvGst').value   = gst.toFixed(2);
    document.getElementById('extInvTotal').value = (taxable + gst).toFixed(2);
  }
  document.getElementById('extInvTaxable')?.addEventListener('input', recalcGst);
  document.getElementById('extInvGstRate')?.addEventListener('change', recalcGst);

  // Populate client dropdown on open
  openBtn.addEventListener('click', async () => {
    const sel = document.getElementById('extInvClientSelect');
    if (sel && sel.options.length <= 1) {
      try {
        const clients = await SB().getAllClients('');
        clients.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          opt.dataset.name = c.name;
          sel.appendChild(opt);
        });
      } catch(e) {}
    }
    modal.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons();
  });

  closeBtn?.addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

  pdfZone?.addEventListener('click', () => pdfInput?.click());
  pdfInput?.addEventListener('change', () => {
    pdfName.textContent = pdfInput.files[0]?.name || 'Click to choose a PDF…';
  });

  function resetForm() {
    document.getElementById('extInvNumber').value  = '';
    document.getElementById('extInvClientSelect').value = '';
    document.getElementById('extInvDate').value    = new Date().toISOString().slice(0,10);
    document.getElementById('extInvTaxable').value = '';
    document.getElementById('extInvGstRate').value = '5';
    document.getElementById('extInvGst').value     = '';
    document.getElementById('extInvTotal').value   = '';
    document.getElementById('extInvStatus').value  = 'Paid';
    pdfInput.value = '';
    pdfName.textContent = 'Click to choose a PDF…';
  }

  saveBtn?.addEventListener('click', async () => {
    errDiv.style.display = 'none';
    const invNum     = document.getElementById('extInvNumber').value.trim();
    const clientSel  = document.getElementById('extInvClientSelect');
    const clientName = clientSel.options[clientSel.selectedIndex]?.dataset.name || '';
    const clientId   = clientSel.value ? parseInt(clientSel.value) : null;
    const date       = document.getElementById('extInvDate').value;
    const taxable    = parseFloat(document.getElementById('extInvTaxable').value || 0);
    const gst        = parseFloat(document.getElementById('extInvGst').value || 0);
    const status     = document.getElementById('extInvStatus').value;
    const file       = pdfInput?.files[0];

    if (!invNum)     { errDiv.textContent = 'Invoice number is required.'; errDiv.style.display='block'; return; }
    if (!clientName) { errDiv.textContent = 'Please select a client.'; errDiv.style.display='block'; return; }
    if (!date)       { errDiv.textContent = 'Date is required.'; errDiv.style.display='block'; return; }
    if (!taxable)    { errDiv.textContent = 'Taxable amount is required.'; errDiv.style.display='block'; return; }
    if (!file)       { errDiv.textContent = 'Please upload the invoice PDF.'; errDiv.style.display='block'; return; }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const pdfUrl = await SB().uploadPdf(file, 'sales');
      await SB().createInvoice({
        invoice_number: invNum,
        client_id:      clientId,
        client_name:    clientName,
        date,
        taxable_total:  taxable,
        gst_total:      gst,
        grand_total:    taxable + gst,
        status,
        pdf_url:        pdfUrl,
        items:          [],
        cost_total:     0,
        gross_profit:   0
      });
      showToast('✓ External invoice saved!');
      modal.style.display = 'none';
      resetForm();
      loadInvoicesList();
    } catch(err) {
      errDiv.textContent = 'Error: ' + err.message;
      errDiv.style.display = 'block';
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i data-lucide="save"></i> Save External Invoice';
      if (window.lucide) window.lucide.createIcons();
    }
  });
}

// ─── LOCAL FOLDER SYSTEM ──────────────────────────────────────
const FS = (() => {
  let _root = null; // root FileSystemDirectoryHandle
  const DIRS = ['Invoices','Purchases','Clients','Dealers','Workers','Expenses'];
  const IDB_KEY = 'weliza_folder_handle';

  // Persist handle to IndexedDB
  async function saveHandle(h) {
    return new Promise((res, rej) => {
      const req = indexedDB.open('weliza_fs', 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('handles');
      req.onsuccess = e => {
        const tx = e.target.result.transaction('handles','readwrite');
        tx.objectStore('handles').put(h, IDB_KEY);
        tx.oncomplete = res; tx.onerror = rej;
      };
      req.onerror = rej;
    });
  }

  async function loadHandle() {
    return new Promise((res) => {
      const req = indexedDB.open('weliza_fs', 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('handles');
      req.onsuccess = e => {
        const tx = e.target.result.transaction('handles','readonly');
        const r = tx.objectStore('handles').get(IDB_KEY);
        r.onsuccess = () => res(r.result || null);
        r.onerror   = () => res(null);
      };
      req.onerror = () => res(null);
    });
  }

  async function verifyPermission(h) {
    const opts = { mode: 'readwrite' };
    if ((await h.queryPermission(opts)) === 'granted') return true;
    if ((await h.requestPermission(opts)) === 'granted') return true;
    return false;
  }

  async function init() {
    try {
      const h = await loadHandle();
      if (h && await verifyPermission(h)) {
        _root = h;
        updateFolderUI(h.name);
        return true;
      }
    } catch(e) {}
    updateFolderUI(null);
    return false;
  }

  async function choose() {
    if (!('showDirectoryPicker' in window)) {
      alert('Folder access requires Chrome or Edge browser.');
      return false;
    }
    try {
      const h = await window.showDirectoryPicker({ mode: 'readwrite' });
      await saveHandle(h);
      _root = h;
      updateFolderUI(h.name);
      showToast('✓ Folder selected: ' + h.name);
      return true;
    } catch(e) {
      if (e.name !== 'AbortError') showToast('Error: ' + e.message);
      return false;
    }
  }

  async function createSubfolders() {
    if (!_root) { showToast('Please choose a folder first'); return; }
    for (const d of DIRS) {
      await _root.getDirectoryHandle(d, { create: true });
    }
    showToast('✓ Subfolders created!');
  }

  function updateFolderUI(name) {
    const badge = document.getElementById('folderStatusBadge');
    const subfBtn = document.getElementById('btnCreateSubfolders');
    if (!badge) return;
    if (name) {
      badge.textContent = '✓ ' + name;
      badge.style.background = '#1F5138';
      badge.style.color = '#fff';
      if (subfBtn) subfBtn.style.display = '';
    } else {
      badge.textContent = 'No folder selected';
      badge.style.background = '#2a2a2a';
      badge.style.color = '#888';
      if (subfBtn) subfBtn.style.display = 'none';
    }
  }

  async function getDir(name) {
    if (!_root) return null;
    try { return await _root.getDirectoryHandle(name, { create: true }); }
    catch(e) { return null; }
  }

  async function writeFile(dirName, filename, blob) {
    const dir = await getDir(dirName);
    if (!dir) return false;
    try {
      const fh = await dir.getFileHandle(filename, { create: true });
      const w  = await fh.createWritable();
      await w.write(blob);
      await w.close();
      return true;
    } catch(e) { console.warn('FS write error:', e); return false; }
  }

  // Build XLSX blob from array of objects
  function buildXlsx(rows, sheetName) {
    if (!rows.length) return null;
    const cols = Object.keys(rows[0]);
    const escape = v => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? '"' + s.replace(/"/g,'""') + '"' : s;
    };
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => escape(r[c])).join(','))].join('\r\n');
    return new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  }

  // Save purchases master file
  async function savePurchases() {
    try {
      const purchases = await SB().getAllPurchases({});
      const rows = purchases.map(p => ({
        Date: p.date, Supplier: p.supplier_name||'', Category: p.category||'',
        Taxable: p.taxable_total||0, GST: p.gst_total||0, Total: p.grand_total||0, Notes: p.notes||''
      }));
      const blob = buildXlsx(rows, 'Purchases');
      if (blob) await writeFile('Purchases', 'purchases.csv', blob);
    } catch(e) { console.warn('savePurchases error:', e); }
  }

  async function saveClients() {
    try {
      const clients = await SB().getAllClients('');
      const rows = clients.map(c => ({
        Name: c.name||'', Phone: c.phone||'', Email: c.email||'',
        GSTIN: c.gstin||'', PAN: c.pan||'', Address: c.address||''
      }));
      const blob = buildXlsx(rows, 'Clients');
      if (blob) await writeFile('Clients', 'clients.csv', blob);
    } catch(e) { console.warn('saveClients error:', e); }
  }

  async function saveDealers() {
    try {
      const dealers = await SB().getAllDealers('');
      const rows = dealers.map(d => ({
        Name: d.name||'', Phone: d.phone||'', Email: d.email||'',
        GSTIN: d.gstin||'', Address: d.address||''
      }));
      const blob = buildXlsx(rows, 'Dealers');
      if (blob) await writeFile('Dealers', 'dealers.csv', blob);
    } catch(e) { console.warn('saveDealers error:', e); }
  }

  async function saveExpenses() {
    try {
      const expenses = await SB().getAllExpenses({});
      const rows = expenses.map(ex => ({
        Date: ex.date, Category: ex.category||'', Amount: ex.amount||0, Description: ex.description||''
      }));
      const blob = buildXlsx(rows, 'Expenses');
      if (blob) await writeFile('Expenses', 'expenses.csv', blob);
    } catch(e) { console.warn('saveExpenses error:', e); }
  }

  async function saveInvoices() {
    try {
      const invoices = await SB().getAllInvoices({ status: 'all', search: '' });
      const rows = invoices.map(inv => ({
        'Invoice No':   inv.invoice_number||'',
        'Client':       inv.client_name||'',
        'Date':         inv.date||'',
        'Taxable':      inv.taxable_total||0,
        'GST':          inv.gst_total||0,
        'Total':        inv.grand_total||0,
        'Status':       inv.status||''
      }));
      const blob = buildXlsx(rows, 'Invoices');
      if (blob) await writeFile('Invoices', 'invoices.csv', blob);
    } catch(e) { console.warn('saveInvoices error:', e); }
  }

  async function saveWorkers() {
    try {
      const workers = await SB().getAllWorkers('');
      const rows = workers.map(w => ({
        'Name': w.name||'', 'Phone': w.phone||'', 'Gender': w.gender||'',
        'Role': w.role||'', 'Join Date': w.join_date||''
      }));
      const blob = buildXlsx(rows, 'Workers');
      if (blob) await writeFile('Workers', 'workers.csv', blob);
    } catch(e) { console.warn('saveWorkers error:', e); }
  }

  async function exportAll(btn) {
    if (!_root) { showToast('Please choose a base folder first in Settings.'); return; }
    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader"></i> Exporting…'; if(window.lucide) window.lucide.createIcons(); }
    try {
      showToast('Exporting data…');
      await Promise.all([savePurchases(), saveClients(), saveDealers(), saveExpenses(), saveInvoices(), saveWorkers()]);
      // Save last export date
      const now = new Date();
      localStorage.setItem('weliza_last_export', now.toISOString());
      updateLastExportNote();
      showToast('✓ All data exported to your folder!');
      // Hide reminder banner if showing
      const banner = document.getElementById('exportReminderBanner');
      if (banner) banner.style.display = 'none';
    } catch(e) {
      showToast('Export error: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="download"></i> Export All Data Now'; if(window.lucide) window.lucide.createIcons(); }
    }
  }

  function updateLastExportNote() {
    const el = document.getElementById('lastExportNote');
    if (!el) return;
    const last = localStorage.getItem('weliza_last_export');
    if (last) {
      const d = new Date(last);
      el.textContent = 'Last exported: ' + d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    } else {
      el.textContent = 'Never exported yet.';
    }
  }

  function checkMonthlyReminder() {
    const last = localStorage.getItem('weliza_last_export');
    const banner = document.getElementById('exportReminderBanner');
    if (!banner) return;
    if (!last) { banner.style.display = 'flex'; return; }
    const lastDate = new Date(last);
    const now = new Date();
    // Show reminder if last export was in a previous month
    if (lastDate.getMonth() !== now.getMonth() || lastDate.getFullYear() !== now.getFullYear()) {
      banner.style.display = 'flex';
    }
  }

  return { init, choose, createSubfolders, exportAll, updateLastExportNote, checkMonthlyReminder, savePurchases, saveClients, saveDealers, saveExpenses, saveInvoices, saveWorkers };
})();

// ─── BULK ACTION SYSTEM ───────────────────────────────────────
const BULK = (() => {
  let _currentTable = null;
  let _actions = [];

  const bar     = () => document.getElementById('bulkBar');
  const countEl = () => document.getElementById('bulkCount');
  const actEl   = () => document.getElementById('bulkActions');

  function getChecked(tbodyId) {
    return [...document.querySelectorAll(`#${tbodyId} input.bulk-cb:checked`)]
      .map(cb => parseInt(cb.dataset.id));
  }

  function updateBar(tbodyId) {
    const ids = getChecked(tbodyId);
    const b = bar();
    if (!b) return;
    if (!ids.length) { b.style.display = 'none'; return; }
    b.style.display = 'flex';
    countEl().textContent = `${ids.length} selected`;
    if (window.lucide) window.lucide.createIcons();
  }

  function setup(tbodyId, actions) {
    _currentTable = tbodyId;
    _actions = actions;

    // Wire select-all
    const selectAll = document.getElementById('selectAll_' + tbodyId);
    if (selectAll) {
      selectAll.checked = false;
      selectAll.onchange = () => {
        document.querySelectorAll(`#${tbodyId} input.bulk-cb`)
          .forEach(cb => cb.checked = selectAll.checked);
        updateBar(tbodyId);
      };
    }

    // Wire row checkboxes
    document.querySelectorAll(`#${tbodyId} input.bulk-cb`).forEach(cb => {
      cb.onchange = () => {
        const all = document.querySelectorAll(`#${tbodyId} input.bulk-cb`);
        const checked = document.querySelectorAll(`#${tbodyId} input.bulk-cb:checked`);
        if (selectAll) selectAll.checked = all.length === checked.length;
        updateBar(tbodyId);
      };
    });

    // Build action buttons
    const actDiv = actEl();
    if (actDiv) {
      actDiv.innerHTML = actions.map(a =>
        `<button class="btn btn-sm ${a.danger?'btn-danger-sm':''}" data-bulk-action="${a.key}">${a.label}</button>`
      ).join('');
      actDiv.querySelectorAll('[data-bulk-action]').forEach(btn => {
        btn.onclick = async () => {
          const ids = getChecked(tbodyId);
          if (!ids.length) return;
          const action = actions.find(a => a.key === btn.dataset.bulkAction);
          if (action) await action.handler(ids);
        };
      });
    }

    // Close button
    document.getElementById('bulkBarClose').onclick = () => {
      document.querySelectorAll(`#${tbodyId} input.bulk-cb`).forEach(cb => cb.checked = false);
      if (selectAll) selectAll.checked = false;
      bar().style.display = 'none';
    };

    updateBar(tbodyId);
    if (window.lucide) window.lucide.createIcons();
  }

  return { setup, getChecked, updateBar };
})();

// Bulk action CSS helper for danger button
document.addEventListener('DOMContentLoaded', () => {
  const s = document.createElement('style');
  s.textContent = '.btn-danger-sm{background:#c0392b!important;color:#fff!important;border-color:#c0392b!important;}';
  document.head.appendChild(s);
});

// ─── WORKERS ──────────────────────────────────────────────────
function setupWorkers() {
  const form = document.getElementById('workerForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('workerIdHidden')?.value;
    const data = {
      name:      document.getElementById('workerName')?.value?.trim(),
      phone:     document.getElementById('workerPhone')?.value?.trim(),
      gender:    document.getElementById('workerGender')?.value,
      role:      document.getElementById('workerRole')?.value?.trim(),
      join_date: document.getElementById('workerJoinDate')?.value,
    };
    if (!data.name) { showToast('Enter worker name'); return; }
    try {
      if (editId) { await SB().updateWorker(parseInt(editId), data); showToast('Worker updated'); }
      else        { await SB().createWorker(data); showToast('✓ Worker added'); }
      form.reset();
      document.getElementById('workerIdHidden').value = '';
      document.getElementById('workerFormHeading').textContent = 'Add Worker';
      document.getElementById('btnCancelWorkerEdit').style.display = 'none';
      loadWorkersList();
      populateWorkerDropdown();
      FS.saveWorkers();
    } catch(err) { showToast('Error: ' + err.message); }
  });
  document.getElementById('btnCancelWorkerEdit')?.addEventListener('click', () => {
    form.reset();
    document.getElementById('workerIdHidden').value = '';
    document.getElementById('workerFormHeading').textContent = 'Add Worker';
    document.getElementById('btnCancelWorkerEdit').style.display = 'none';
  });
  document.getElementById('searchWorkersInput')?.addEventListener('input', loadWorkersList);
}

async function loadWorkersList() {
  const tbody = document.getElementById('workersTableBody');
  if (!tbody) return;
  const search = document.getElementById('searchWorkersInput')?.value || '';
  tbody.innerHTML = '<tr><td colspan="7" class="tbl-empty">Loading…</td></tr>';
  try {
    const workers = await SB().getAllWorkers(search);
    if (!workers.length) { tbody.innerHTML = '<tr><td colspan="7" class="tbl-empty">No workers yet.</td></tr>'; return; }
    tbody.innerHTML = workers.map(w => `
      <tr>
        <td class="cb-col"><input type="checkbox" class="bulk-cb" data-id="${w.id}"></td>
        <td><strong>${w.name}</strong></td>
        <td>${w.phone||'—'}</td>
        <td>${w.gender||'—'}</td>
        <td>${w.role||'—'}</td>
        <td>${w.join_date||'—'}</td>
        <td style="text-align:center;">
          <button class="btn btn-action" onclick="editWorker(${w.id})" title="Edit"><i data-lucide="pencil"></i></button>
          <button class="btn btn-action btn-action-del" onclick="deleteWorkerById(${w.id})" title="Delete"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`).join('');
    if (window.lucide) window.lucide.createIcons();
    BULK.setup('workersTableBody', [
      { key:'delete', label:'Delete', danger:true, handler: async ids => {
          if(!confirm(`Delete ${ids.length} worker(s)?`)) return;
          await Promise.all(ids.map(id => SB().deleteWorker(id)));
          showToast('Deleted'); loadWorkersList(); populateWorkerDropdown();
        } },
    ]);
  } catch(e) { tbody.innerHTML = `<tr><td colspan="7" class="tbl-empty">Error: ${e.message}</td></tr>`; }
}

window.editWorker = async (id) => {
  const workers = await SB().getAllWorkers('');
  const w = workers.find(x => x.id === id);
  if (!w) return;
  document.getElementById('workerIdHidden').value  = w.id;
  document.getElementById('workerName').value       = w.name||'';
  document.getElementById('workerPhone').value      = w.phone||'';
  document.getElementById('workerGender').value     = w.gender||'';
  document.getElementById('workerRole').value       = w.role||'';
  document.getElementById('workerJoinDate').value   = w.join_date||'';
  document.getElementById('workerFormHeading').textContent = 'Edit Worker';
  document.getElementById('btnCancelWorkerEdit').style.display = '';
  document.querySelector('#tab-workers .side-form-col')?.scrollIntoView({ behavior:'smooth' });
};

window.deleteWorkerById = async (id) => {
  if (!confirm('Delete this worker?')) return;
  await SB().deleteWorker(id); showToast('Deleted'); loadWorkersList(); populateWorkerDropdown();
};

async function populateWorkerDropdown() {
  const sel = document.getElementById('expWorkerSelect');
  if (!sel) return;
  try {
    const workers = await SB().getAllWorkers('');
    sel.innerHTML = '<option value="">Select worker…</option>' +
      workers.map(w => `<option value="${w.id}">${w.name}${w.role ? ' ('+w.role+')' : ''}</option>`).join('');
  } catch(e) {}
}

// ─── GST REMINDER SYSTEM ──────────────────────────────────────
function checkGSTReminders() {
  const now   = new Date();
  const day   = now.getDate();
  const month = now.getMonth(); // 0-indexed
  const year  = now.getFullYear();
  const monthKey = `${year}-${month}`;

  const gstr1Filed  = localStorage.getItem(`gstr1_filed_${monthKey}`);
  const gstr3bFiled = localStorage.getItem(`gstr3b_filed_${monthKey}`);

  // GSTR-1 due 11th — remind from 1st (10 days before)
  const showGstr1 = !gstr1Filed && day >= 1 && day <= 11;
  // GSTR-3B due 20th — remind from 10th, BUT also show if GSTR-1 is showing
  const showGstr3b = !gstr3bFiled && day >= 10 && day <= 20;

  const gstr1Due  = new Date(year, month, 11);
  const gstr3bDue = new Date(year, month, 20);
  const monthName = gstr1Due.toLocaleDateString('en-IN', { day:'numeric', month:'long' });
  const monthName3b = gstr3bDue.toLocaleDateString('en-IN', { day:'numeric', month:'long' });

  const daysLeft1  = Math.max(0, Math.ceil((gstr1Due - now) / 86400000));
  const daysLeft3b = Math.max(0, Math.ceil((gstr3bDue - now) / 86400000));

  const b1 = document.getElementById('gstr1Banner');
  const b3 = document.getElementById('gstr3bBanner');
  const t1 = document.getElementById('gstr1DueText');
  const t3 = document.getElementById('gstr3bDueText');

  if (b1 && showGstr1) {
    if (t1) t1.textContent = `${monthName} — ${daysLeft1} day${daysLeft1!==1?'s':''} left`;
    b1.style.display = 'flex';
  }
  if (b3 && showGstr3b) {
    if (t3) t3.textContent = `${monthName3b} — ${daysLeft3b} day${daysLeft3b!==1?'s':''} left`;
    b3.style.display = 'flex';
  }

  document.getElementById('gstr1FiledBtn')?.addEventListener('click', () => {
    localStorage.setItem(`gstr1_filed_${monthKey}`, '1');
    if (b1) b1.style.display = 'none';
  });
  document.getElementById('gstr3bFiledBtn')?.addEventListener('click', () => {
    localStorage.setItem(`gstr3b_filed_${monthKey}`, '1');
    if (b3) b3.style.display = 'none';
  });

  if (window.lucide) window.lucide.createIcons();
}

// ─── OUTSTANDING INVOICES ─────────────────────────────────────
async function loadOutstandingInvoices() {
  const tbody = document.getElementById('outstandingTableBody');
  const totalEl = document.getElementById('totalDueAmount');
  if (!tbody) return;
  try {
    const all = await SB().getAllInvoices({ status: 'all', search: '' });
    const pending = all.filter(inv => inv.status === 'Pending');
    if (!pending.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">No outstanding invoices</td></tr>';
      if (totalEl) totalEl.textContent = '₹0.00';
      return;
    }
    const now = new Date();
    let total = 0;
    tbody.innerHTML = pending.map(inv => {
      const days = Math.floor((now - new Date(inv.date)) / 86400000);
      total += parseFloat(inv.grand_total||0);
      const overdue = days > 0 ? `<span style="color:#e74c3c;font-weight:600;">${days}d overdue</span>` : `<span style="color:#888;">Today</span>`;
      return `<tr>
        <td><strong>${inv.invoice_number}</strong></td>
        <td>${inv.client_name||'—'}</td>
        <td>${inv.date||'—'}</td>
        <td><strong>${formatCurrency(inv.grand_total)}</strong></td>
        <td style="text-align:center;">${overdue}</td>
      </tr>`;
    }).join('');
    if (totalEl) totalEl.textContent = formatCurrency(total);
  } catch(e) { tbody.innerHTML = `<tr><td colspan="5" class="tbl-empty">Error: ${e.message}</td></tr>`; }
}

// ─── HAMBURGER ────────────────────────────────────────────────
function setupHamburger() {
  const btn     = document.getElementById('hamburgerBtn');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!btn || !sidebar || !overlay) return;
  let scrollY = 0;
  const open  = () => {
    scrollY = window.scrollY;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overscrollBehavior = 'none';
    sidebar.classList.add('open'); overlay.classList.add('active');
  };
  const close = () => {
    sidebar.classList.remove('open'); overlay.classList.remove('active');
    document.documentElement.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overscrollBehavior = '';
    window.scrollTo(0, scrollY);
  };
  btn.addEventListener('click', open);
  overlay.addEventListener('click', close);
  overlay.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => { if(window.innerWidth<=680) close(); }));
  window.addEventListener('resize', () => { if(window.innerWidth>680) close(); });
}

// ─── UTILS ────────────────────────────────────────────────────
function formatCurrency(v) {
  return '₹' + parseFloat(v||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function showToast(msg) {
  let t = document.getElementById('welizaToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'welizaToast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1F5138;color:#FCFBFB;padding:12px 20px;border-radius:8px;font-size:0.9rem;z-index:9999;box-shadow:0 10px 28px rgba(0,0,0,0.35);border-left:3px solid #C09A59;transition:opacity 0.3s ease, transform 0.3s cubic-bezier(.22,1,.36,1);pointer-events:none;transform:translateY(12px);opacity:0;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(12px)'; }, 3000);
}

