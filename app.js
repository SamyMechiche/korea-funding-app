// State and constants
const STORAGE_KEY = 'korea_trip_budget_v1';
const FALLBACK_RATE = 0.000666; // ~1 EUR = 1500 KRW

/** @type {{ budgetKrw: number, rate: number, rateUpdatedAt: number|null, transactions: Array<any> }} */
let state = {
  budgetKrw: 0,
  rate: FALLBACK_RATE,
  rateUpdatedAt: null,
  transactions: [] // { id, type: 'expense'|'income', amountKrw, category, notes, dateIso }
};

// Utilities
const byId = (id) => document.getElementById(id);
const parseNumberField = (value) => {
  if (typeof value !== 'string') value = String(value ?? '');
  // remove commas, spaces, underscores
  const cleaned = value.replace(/[,_\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};
const formatKRW = (n) => `₩${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const formatEUR = (n) => `€${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const toEUR = (krw) => (krw || 0) * (state.rate || FALLBACK_RATE);
const nowIso = () => new Date().toISOString();

// Storage
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (typeof parsed.budgetKrw === 'number') state.budgetKrw = parsed.budgetKrw;
    if (typeof parsed.rate === 'number') state.rate = parsed.rate;
    if (parsed.rateUpdatedAt) state.rateUpdatedAt = parsed.rateUpdatedAt;
    if (Array.isArray(parsed.transactions)) state.transactions = parsed.transactions;
  } catch (_) {}
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Rate fetching
async function refreshRate() {
  const btn = byId('refreshRateBtn');
  btn.disabled = true;
  btn.textContent = 'Refreshing…';
  try {
    // Use exchangerate.host (no key). Base KRW, target EUR
    const url = 'https://api.exchangerate.host/latest?base=KRW&symbols=EUR';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('rate http');
    const data = await res.json();
    const rate = data && data.rates && typeof data.rates.EUR === 'number' ? data.rates.EUR : null;
    if (!rate) throw new Error('rate json');
    state.rate = rate;
    state.rateUpdatedAt = Date.now();
    saveState();
    renderRate();
    renderStats();
    renderRows();
  } catch (err) {
    alert('Could not refresh rate. Using last saved/fallback rate.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Refresh';
  }
}

function applyManualRate() {
  const input = byId('manualRateInput');
  const val = Number(input.value);
  if (!val || val <= 0) {
    alert('Enter a valid positive rate.');
    return;
  }
  state.rate = val;
  state.rateUpdatedAt = Date.now();
  saveState();
  renderRate();
  renderStats();
  renderRows();
}

// Budget
function onBudgetSubmit(e) {
  e.preventDefault();
  const val = parseNumberField(byId('budgetInput').value);
  state.budgetKrw = Math.max(0, Math.floor(val || 0));
  saveState();
  renderStats();
  renderBudgetEur();
}

function renderBudgetEur() {
  byId('budgetEur').textContent = formatEUR(toEUR(state.budgetKrw));
}

// Transactions
function onTxnSubmit(e) {
  e.preventDefault();
  const type = byId('txnType').value;
  const amount = Math.floor(Number(byId('txnAmount').value || 0));
  if (!amount || amount <= 0) return alert('Enter a valid amount in KRW');
  const category = byId('txnCategory').value.trim();
  const notes = byId('txnNotes').value.trim();
  const dateInput = byId('txnDate').value;
  const dateIso = dateInput ? new Date(dateInput).toISOString() : nowIso();
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());

  state.transactions.unshift({ id, type, amountKrw: amount, category, notes, dateIso });
  saveState();
  renderStats();
  renderRows();
  e.target.reset();
}

function onDeleteTxn(id) {
  if (!confirm('Delete this transaction?')) return;
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveState();
  renderStats();
  renderRows();
}

function onEditTxn(id) {
  const txn = state.transactions.find(t => t.id === id);
  if (!txn) return;
  const amountStr = prompt('Amount in KRW:', String(txn.amountKrw));
  if (amountStr === null) return; // cancelled
  const amount = Math.floor(Number(amountStr));
  if (!amount || amount <= 0) return alert('Invalid amount');
  const category = prompt('Category:', txn.category || '') ?? txn.category;
  const notes = prompt('Notes:', txn.notes || '') ?? txn.notes;
  txn.amountKrw = amount;
  txn.category = category || '';
  txn.notes = notes || '';
  saveState();
  renderStats();
  renderRows();
}

function onClearAll() {
  if (!confirm('Clear ALL data (budget + transactions)?')) return;
  state = { budgetKrw: 0, rate: state.rate || FALLBACK_RATE, rateUpdatedAt: state.rateUpdatedAt, transactions: [] };
  saveState();
  renderAll();
}

// Rendering
function computeTotals() {
  let income = 0, expenses = 0;
  for (const t of state.transactions) {
    if (t.type === 'income') income += t.amountKrw;
    else expenses += t.amountKrw;
  }
  return { income, expenses, remaining: state.budgetKrw + income - expenses };
}

function renderRate() {
  byId('rateDisplay').textContent = `${state.rate.toFixed(6)} EUR per KRW`;
  const ts = state.rateUpdatedAt ? new Date(state.rateUpdatedAt).toLocaleString() : 'fallback';
  byId('rateUpdatedAt').textContent = `Updated: ${ts}`;
}

function renderStats() {
  const { income, expenses, remaining } = computeTotals();
  byId('totalIncomeKrw').textContent = formatKRW(income);
  byId('totalExpensesKrw').textContent = formatKRW(expenses);
  byId('remainingKrw').textContent = formatKRW(remaining);

  byId('totalIncomeEur').textContent = formatEUR(toEUR(income));
  byId('totalExpensesEur').textContent = formatEUR(toEUR(expenses));
  byId('remainingEur').textContent = formatEUR(toEUR(remaining));
}

function renderRows() {
  const tbody = byId('txnTbody');
  tbody.innerHTML = '';
  if (state.transactions.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.className = 'muted';
    td.textContent = 'No transactions yet';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  for (const t of state.transactions) {
    const tr = document.createElement('tr');
    const date = new Date(t.dateIso);
    const dateStr = date.toLocaleDateString();
    tr.innerHTML = `
      <td>${dateStr}</td>
      <td><span class="chip" style="border-color:${t.type==='income' ? '#22c55e' : '#ef4444'}">${t.type}</span></td>
      <td>${t.category ? `<span class="chip">${escapeHtml(t.category)}</span>` : ''}</td>
      <td class="right">${formatKRW(t.amountKrw)}</td>
      <td class="right">${formatEUR(toEUR(t.amountKrw))}</td>
      <td>${escapeHtml(t.notes || '')}</td>
      <td class="actions">
        <button class="link" data-action="edit" data-id="${t.id}">Edit</button>
        <button class="link" data-action="delete" data-id="${t.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Export CSV
function exportCsv() {
  const headers = ['date', 'type', 'category', 'amount_krw', 'amount_eur', 'notes'];
  const rows = state.transactions.map(t => [
    new Date(t.dateIso).toISOString().slice(0,10),
    t.type,
    t.category || '',
    t.amountKrw,
    (toEUR(t.amountKrw)).toFixed(2),
    (t.notes || '').replaceAll('"', '""')
  ]);
  const lines = [headers.join(','), ...rows.map(r => r.map(x => /,|\n|"/.test(String(x)) ? `"${String(x).replaceAll('"', '""')}"` : String(x)).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'korea_trip_budget.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// PDF Daily Report
function downloadDailyPdf() {
  const dateStr = byId('pdfDate').value || new Date().toISOString().slice(0,10);
  const dayStart = new Date(dateStr + 'T00:00:00');
  const dayEnd = new Date(dateStr + 'T23:59:59');

  const daily = state.transactions.filter(t => {
    const d = new Date(t.dateIso);
    return d >= dayStart && d <= dayEnd;
  });

  let income = 0, expenses = 0;
  for (const t of daily) {
    if (t.type === 'income') income += t.amountKrw; else expenses += t.amountKrw;
  }
  const totalEur = toEUR(expenses);

  // jsPDF
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    alert('PDF library failed to load. Please check your internet connection.');
    return;
  }
  const doc = new jsPDF();
  const margin = 14;
  let y = margin;

  doc.setFontSize(16);
  doc.text('Korea Trip Daily Report', margin, y);
  y += 8;
  doc.setFontSize(11);
  doc.text(`Date: ${dateStr}`, margin, y);
  y += 6;
  doc.text(`Rate: ${state.rate.toFixed(6)} EUR per KRW`, margin, y);
  y += 6;
  doc.text(`Income (KRW): ${income.toLocaleString()}`, margin, y);
  y += 6;
  doc.text(`Expenses (KRW): ${expenses.toLocaleString()}`, margin, y);
  y += 6;
  doc.text(`Expenses (EUR): ${totalEur.toFixed(2)}`, margin, y);
  y += 10;

  // table header
  doc.setFontSize(12);
  doc.text('Transactions', margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.text('Time', margin, y);
  doc.text('Type', margin + 30, y);
  doc.text('Category', margin + 60, y);
  doc.text('KRW', margin + 110, y, { align: 'right' });
  doc.text('EUR', margin + 180 - margin, y, { align: 'right' });
  y += 5;
  doc.line(margin, y, 180, y);
  y += 4;

  daily.sort((a,b) => new Date(a.dateIso) - new Date(b.dateIso));
  for (const t of daily) {
    const d = new Date(t.dateIso);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const krwStr = t.amountKrw.toLocaleString();
    const eurStr = toEUR(t.amountKrw).toFixed(2);

    if (y > 270) { doc.addPage(); y = margin; }
    doc.text(time, margin, y);
    doc.text(t.type, margin + 30, y);
    doc.text((t.category || '').substring(0, 20), margin + 60, y);
    doc.text(krwStr, 120 + 10, y, { align: 'right' });
    doc.text(eurStr, 180 - margin, y, { align: 'right' });
    y += 6;
  }

  doc.save(`korea_daily_${dateStr}.pdf`);
}

// Event delegation for table actions
function onTableClick(e) {
  const target = e.target.closest('button');
  if (!target) return;
  const id = target.getAttribute('data-id');
  const action = target.getAttribute('data-action');
  if (action === 'delete') return onDeleteTxn(id);
  if (action === 'edit') return onEditTxn(id);
}

// Init
function renderAll() {
  renderRate();
  renderStats();
  renderRows();
  renderBudgetEur();
}

function init() {
  loadState();
  // prefill budget input
  byId('budgetInput').value = state.budgetKrw ? String(state.budgetKrw) : '';
  // set default date to today
  const today = new Date().toISOString().slice(0,10);
  byId('txnDate').value = today;

  // listeners
  byId('budgetForm').addEventListener('submit', onBudgetSubmit);
  // Live update budget as you type
  byId('budgetInput').addEventListener('input', (e) => {
    const val = parseNumberField(e.target.value);
    state.budgetKrw = Math.max(0, Math.floor(val || 0));
    saveState();
    renderBudgetEur();
    renderStats();
  });
  byId('txnForm').addEventListener('submit', onTxnSubmit);
  byId('refreshRateBtn').addEventListener('click', refreshRate);
  byId('applyManualRateBtn').addEventListener('click', applyManualRate);
  byId('txnTbody').addEventListener('click', onTableClick);
  byId('clearBtn').addEventListener('click', onClearAll);
  byId('exportBtn').addEventListener('click', exportCsv);
  // PDF
  const pdfToday = new Date().toISOString().slice(0,10);
  const pdfDate = byId('pdfDate');
  if (pdfDate) pdfDate.value = pdfToday;
  const pdfBtn = byId('pdfBtn');
  if (pdfBtn) pdfBtn.addEventListener('click', downloadDailyPdf);

  renderAll();

  // Try fetch rate on first load if no timestamp yet
  if (!state.rateUpdatedAt) {
    refreshRate().catch(() => {});
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


