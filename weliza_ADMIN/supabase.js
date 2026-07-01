/**
 * Weliza — Supabase Data Layer
 * Replaces IndexedDB/localStorage with Supabase cloud database.
 */

const SUPA_URL = 'https://gnvmqtoakysrhfetwnra.supabase.co';
const SUPA_KEY = 'sb_publishable__OycmvH5Og0XZ-jrco2o2A_BbZ_Usje';

const HEADERS = {
  'apikey': SUPA_KEY,
  'Authorization': 'Bearer ' + SUPA_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// ─── CORE HELPERS ─────────────────────────────────────────────

async function sbGet(table, params = '', orderBy = 'created_at.desc') {
  const orderParam = orderBy ? `&order=${orderBy}` : '';
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}${orderParam}`, { headers: HEADERS });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sbGetOne(table, id) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, { headers: HEADERS });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return rows[0] || null;
}

async function sbInsert(table, data) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return rows[0];
}

async function sbUpdate(table, id, data) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH', headers: HEADERS, body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return rows[0];
}

async function sbDelete(table, id) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE', headers: HEADERS
  });
  if (!res.ok) throw new Error(await res.text());
  return true;
}

// ─── UPLOAD PDF TO SUPABASE STORAGE ───────────────────────────

async function uploadPdf(file, folder = 'invoices') {
  const ext  = file.name.split('.').pop();
  const name = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const res  = await fetch(`${SUPA_URL}/storage/v1/object/weliza-files/${name}`, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY, 'Content-Type': file.type },
    body: file
  });
  if (!res.ok) throw new Error(await res.text());
  return `${SUPA_URL}/storage/v1/object/public/weliza-files/${name}`;
}

// ─── SETTINGS ─────────────────────────────────────────────────

async function getSettings() {
  const rows = await sbGet('settings', 'select=key,value', '');
  const obj  = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  return obj;
}

async function saveSetting(key, value) {
  const res = await fetch(`${SUPA_URL}/rest/v1/settings?on_conflict=key`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
  });
  if (!res.ok) throw new Error(await res.text());
}

// ─── SALES INVOICES ───────────────────────────────────────────

async function getAllInvoices(filters = {}) {
  let params = 'select=*';
  if (filters.status && filters.status !== 'all') params += `&status=eq.${filters.status}`;
  if (filters.search) params += `&client_name=ilike.*${filters.search}*`;
  return sbGet('sales_invoices', params);
}

async function getInvoiceById(id) {
  return sbGetOne('sales_invoices', id);
}

async function createInvoice(data) {
  return sbInsert('sales_invoices', data);
}

async function updateInvoice(id, data) {
  return sbUpdate('sales_invoices', id, data);
}

async function deleteInvoice(id) {
  return sbDelete('sales_invoices', id);
}

// ─── PURCHASE INVOICES ────────────────────────────────────────

async function getAllPurchases(filters = {}) {
  let params = 'select=*';
  if (filters.status && filters.status !== 'all') params += `&status=eq.${filters.status}`;
  return sbGet('purchase_invoices', params);
}

async function getPurchaseById(id) {
  return sbGetOne('purchase_invoices', id);
}

async function createPurchase(data) {
  return sbInsert('purchase_invoices', data);
}

async function updatePurchase(id, data) {
  return sbUpdate('purchase_invoices', id, data);
}

async function deletePurchase(id) {
  return sbDelete('purchase_invoices', id);
}

// ─── CLIENTS ──────────────────────────────────────────────────

async function getAllClients(search = '') {
  let params = 'select=*';
  if (search) params += `&name=ilike.*${search}*`;
  return sbGet('clients', params);
}

async function getClientById(id) {
  return sbGetOne('clients', id);
}

async function createClient(data) {
  return sbInsert('clients', data);
}

async function updateClient(id, data) {
  return sbUpdate('clients', id, data);
}

async function deleteClient(id) {
  return sbDelete('clients', id);
}

// ─── DEALERS ──────────────────────────────────────────────────

async function getAllDealers(search = '') {
  let params = 'select=*';
  if (search) params += `&name=ilike.*${search}*`;
  return sbGet('dealers', params);
}

async function createDealer(data) {
  return sbInsert('dealers', data);
}

async function updateDealer(id, data) {
  return sbUpdate('dealers', id, data);
}

async function deleteDealer(id) {
  return sbDelete('dealers', id);
}

// ─── EXPENSES ─────────────────────────────────────────────────

async function getAllExpenses(filters = {}) {
  let params = 'select=*';
  if (filters.category && filters.category !== 'all') params += `&category=eq.${filters.category}`;
  return sbGet('expenses', params);
}

async function createExpense(data) {
  return sbInsert('expenses', data);
}

async function updateExpense(id, data) {
  return sbUpdate('expenses', id, data);
}

async function deleteExpense(id) {
  return sbDelete('expenses', id);
}

// ─── INVENTORY ────────────────────────────────────────────────

async function getAllInventory(search = '') {
  let params = 'select=*';
  if (search) params += `&name=ilike.*${search}*`;
  return sbGet('inventory', params);
}

async function createInventoryItem(data) {
  return sbInsert('inventory', data);
}

async function updateInventoryItem(id, data) {
  return sbUpdate('inventory', id, data);
}

async function deleteInventoryItem(id) {
  return sbDelete('inventory', id);
}

// ─── DASHBOARD STATS ──────────────────────────────────────────

async function getDashboardStats() {
  const [invoices, purchases, expenses, clients] = await Promise.all([
    sbGet('sales_invoices', 'select=*'),
    sbGet('purchase_invoices', 'select=*'),
    sbGet('expenses', 'select=amount,category,date'),
    sbGet('clients', 'select=id')
  ]);

  const grossSales     = invoices.reduce((s, i) => s + parseFloat(i.grand_total    || 0), 0);
  const gstCollected   = invoices.reduce((s, i) => s + parseFloat(i.gst_total      || 0), 0);
  const taxableSales   = invoices.reduce((s, i) => s + parseFloat(i.taxable_total  || 0), 0);
  const totalCogs      = invoices.reduce((s, i) => s + parseFloat(i.cost_total     || 0), 0); // cost of goods sold
  const grossPurchases = purchases.reduce((s, i) => s + parseFloat(i.grand_total   || 0), 0);
  const gstPaid        = purchases.reduce((s, i) => s + parseFloat(i.gst_total     || 0), 0);
  const totalExpenses  = expenses.reduce((s, e) => s + parseFloat(e.amount         || 0), 0);
  const outstanding    = invoices.filter(i => i.status === 'Pending')
                                 .reduce((s, i) => s + parseFloat(i.grand_total    || 0), 0);

  // Profit = Taxable Sales - Cost of Goods (from inventory cost price) - Purchases - Expenses
  // If items have cost_total stored, use that; otherwise fall back to purchase total
  const cogsForProfit  = totalCogs > 0 ? totalCogs : grossPurchases;
  const netProfit      = taxableSales - cogsForProfit - totalExpenses;

  const paidCount    = invoices.filter(i => i.status === 'Paid').length;
  const pendingCount = invoices.filter(i => i.status === 'Pending').length;

  return {
    grossSales, gstCollected, taxableSales,
    grossPurchases, gstPaid,
    totalExpenses, netProfit, outstanding,
    totalCogs, cogsForProfit,
    totalInvoices: invoices.length,
    paidCount, pendingCount,
    totalClients: clients.length,
    invoices, purchases, expenses
  };
}

// Export everything to window for use in admin.js
window.WelizaSupa = {
  uploadPdf,
  getSettings, saveSetting,
  getAllInvoices, getInvoiceById, createInvoice, updateInvoice, deleteInvoice,
  getAllPurchases, getPurchaseById, createPurchase, updatePurchase, deletePurchase,
  getAllClients, getClientById, createClient, updateClient, deleteClient,
  getAllDealers, createDealer, updateDealer, deleteDealer,
  getAllExpenses, createExpense, updateExpense, deleteExpense,
  getAllInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem,
  getDashboardStats
};

console.log('✅ Weliza Supabase layer loaded');
