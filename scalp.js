// ===================== Scalping mode (scalp.js) =====================
// Release switch: FEATURES.scalp.on (globals.js). Test per browser with ?scalp=on / ?scalp=off.
// With the feature on:
//  - Sidebar: Normal / Scalp. Scalp = violet line, "Quick trade" button, list view and the
//    Quick trade popup (symbol from the previous trade, direction ↑↓, setup 1–9, result W/L/B, Auto-Capture).
//  - Day bar above the trades of the day, in Normal and Scalp mode, from the first trade.
//    Click a square to open that trade (a quick trade opens as Complete trade).
//  - Max losses per day (Settings › Journal): a calm message, never blocks.
//  - Quick trades get "Complete trade" (row tile + button, card pill); saving in the full form completes them.
//  - Auto-Capture (or Connect window): C in Quick trade and in Add Trade (not while typing).
// Data: trade.quick = true (gone once saved in the full form), settings.scalpMode,
// settings.viewModeBeforeScalp, settings.limits.maxLosses. Nothing to migrate.

const SCALP_FEATURE_ENABLED = !!(FEATURES.scalp && FEATURES.scalp.on);
const SCALP_FEATURE_KEY = 'vws-scalp-feature';
const scalpFeatureOn = (() => {
    let override = null;
    try {
        const params = new URLSearchParams(window.location.search);
        const asked = (params.get('scalp') || '').toLowerCase();
        if (asked === 'on' || asked === 'off') {
            localStorage.setItem(SCALP_FEATURE_KEY, asked);
            params.delete('scalp');
            const rest = params.toString();
            history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
        }
        override = localStorage.getItem(SCALP_FEATURE_KEY);
    } catch (e) { /* storage blocked: use the default */ }
    if (override === 'on') return true;
    if (override === 'off') return false;
    return SCALP_FEATURE_ENABLED;
})();

const SCALP_ICONS = {
    bolt: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/></svg>',
    bolt20: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/></svg>',
    pen: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    img: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    warn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
};
const SCALP_RESULT_LABEL = { WIN: 'Win', LOST: 'Loss', 'B/E': 'Break-even' };
const scalpAlt = () => (typeof keysAlt === 'function' ? keysAlt() : 'Alt');
const scalpCtrl = () => (scalpAlt() === 'Option' ? 'Cmd' : 'Ctrl');
const scalpAltKey = () => typeof keysAlt === 'function' ? keysAlt() : 'Alt';
const scalpKbd = (k, primary) => `<kbd class="keys-kbd is-inline${primary ? ' is-on-primary' : ''}">${escapeHTML(k)}</kbd>`;
const scalpTradeKey = t => String(t.date || '') + String(parseInt(t.number, 10) || 0).padStart(5, '0');

// ---------- mode ----------
function scalpModeOn() { return scalpFeatureOn && !!(appData.settings && appData.settings.scalpMode); }

function scalpSet(on, toast) {
    if (!scalpFeatureOn || on === scalpModeOn()) return;
    const s = appData.settings;
    s.scalpMode = on;
    if (on) { s.viewModeBeforeScalp = s.viewMode || 'card'; s.viewMode = 'table'; }
    else { if (s.viewModeBeforeScalp === 'card' || s.viewModeBeforeScalp === 'table') s.viewMode = s.viewModeBeforeScalp; delete s.viewModeBeforeScalp; }
    scalpApply();
    renderDashboard();
    autoSave();
    if (toast) showToast(on ? 'Scalping mode on: Quick trade opens a short form.' : 'Normal mode: the full Add Trade form is back.', 'success');
}

function scalpSidebarEl() {
    let w = document.getElementById('scalp-mode');
    if (w) return w;
    const keys = document.getElementById('btn-keys'); if (!keys) return null;
    w = document.createElement('div');
    w.id = 'scalp-mode'; w.className = 'scalp-mode';
    w.innerHTML = `<div class="scalp-mode-seg" role="group" aria-label="Logging mode"><span class="scalp-mode-ind" aria-hidden="true"></span>
        <button type="button" class="scalp-mode-opt" data-scalp-mode="off" aria-label="Normal mode: full Add Trade form">${SCALP_ICONS.pen}</button>
        <button type="button" class="scalp-mode-opt" data-scalp-mode="on" aria-label="Scalping mode: Quick trade form">${SCALP_ICONS.bolt20}</button></div>
        <span class="scalp-mode-name" aria-hidden="true"></span>`;
    keys.parentNode.insertBefore(w, keys);
    w.querySelectorAll('[data-scalp-mode]').forEach(b => b.addEventListener('click', () => scalpSet(b.dataset.scalpMode === 'on', true)));
    return w;
}

function scalpApply() {
    if (!scalpFeatureOn) return;
    const on = scalpModeOn();
    document.documentElement.classList.toggle('scalp-on', on);
    const w = scalpSidebarEl();
    if (w) {
        w.classList.toggle('is-on', on);
        w.title = on ? 'Scalping mode: on · click Normal to switch off' : 'Scalping mode: off · click the bolt to switch on';
        w.querySelectorAll('[data-scalp-mode]').forEach(b => { const a = (b.dataset.scalpMode === 'on') === on; b.setAttribute('aria-pressed', String(a)); b.classList.toggle('is-active', a); });
        w.querySelector('.scalp-mode-name').textContent = on ? 'Scalp' : 'Normal';
    }
    if (btnNewTrade) btnNewTrade.innerHTML = on ? `${SCALP_ICONS.bolt}Quick trade` : 'Add Trade';
}

// "Add Trade" button and Alt N: the Quick trade popup while scalping mode is on
function scalpNewTrade() {
    if (scalpModeOn()) { scalpQuickOpen(); return true; }
    return false;
}

// ---------- day bar ----------
function scalpLimits() {
    const l = (appData.settings && appData.settings.limits) || {};
    const n = parseInt(l.maxLosses, 10);
    return { maxLosses: n > 0 ? n : 0 };
}
function scalpDayTrades(date) { return appData.trades.filter(t => t.date === date).sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0)); }
function scalpWarning(date) {
    if (!scalpFeatureOn || !date) return '';
    const lim = scalpLimits(); if (!lim.maxLosses) return '';
    const lost = appData.trades.filter(t => t.date === date && t.result === 'LOST').length;
    if (lost < lim.maxLosses) return '';
    return `<strong>${lost} ${lost === 1 ? 'loss' : 'losses'} today.</strong> Your limit is ${lim.maxLosses} a day. A good moment to stop for today.`;
}
function scalpRulesOn() { return typeof rulesActive === 'function' && rulesActive() && typeof rulesTradeScore === 'function'; }

function scalpDayBar() {
    const toolbar = document.getElementById('dashboard-toolbar');
    let bar = document.getElementById('scalp-day-bar');
    const date = datePicker.value, ts = scalpDayTrades(date);
    if (!scalpFeatureOn || !toolbar || !ts.length || toolbar.style.display === 'none') { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'scalp-day-bar'; bar.className = 'scalp-day-bar'; }
    if (bar.previousElementSibling !== toolbar) toolbar.after(bar);
    const w = ts.filter(t => t.result === 'WIN').length, l = ts.filter(t => t.result === 'LOST').length, be = ts.length - w - l;
    const rulesOn = scalpRulesOn();
    let ok = 0, rated = 0;
    if (rulesOn) ts.forEach(t => { const s = rulesTradeScore(t); ok += s.ok; rated += s.rated; });
    const tag = r => r === 'WIN' ? 'win' : r === 'LOST' ? 'lost' : 'be';
    const open = ts.filter(t => t.quick);
    const warn = scalpWarning(date);
    bar.innerHTML = `
        <div class="scalp-day-nums"><strong>${ts.length} ${ts.length === 1 ? 'trade' : 'trades'}</strong><span class="scalp-n win">${w} won</span><span class="scalp-n lost">${l} lost</span>${be ? `<span class="scalp-n">${be} break-even</span>` : ''}<span class="scalp-sep" aria-hidden="true"></span><span>${w + l ? Math.round(100 * w / (w + l)) : 0}% won</span>${rulesOn && rated ? `<span>${Math.round(100 * ok / rated)}% rules followed</span>` : ''}
            ${open.length ? `<span class="scalp-todo"><span>${open.length} quick ${open.length === 1 ? 'trade' : 'trades'} to complete</span><button type="button" class="btn-secondary btn-sm" data-scalp-next>Complete next</button></span>` : ''}</div>
        <div class="scalp-seq" role="group" aria-label="Trades of the day in order">${ts.map(t => {
            const s = rulesOn ? rulesTradeScore(t) : { no: 0 };
            const label = [`Trade ${t.number}`, t.setup, SCALP_RESULT_LABEL[t.result] || t.result, s.no ? `${s.no} ${s.no === 1 ? 'rule' : 'rules'} broken` : '', t.quick ? 'to complete' : ''].filter(Boolean).join(' · ');
            return `<button type="button" class="scalp-sq ${tag(t.result)}${s.no ? ' is-broken' : ''}${t.quick ? ' is-quick' : ''}" data-scalp-trade="${escapeHTML(t.id)}" title="${escapeHTML(label)}" aria-label="${escapeHTML('Open ' + label.charAt(0).toLowerCase() + label.slice(1))}">${escapeHTML(String(t.number || ''))}</button>`;
        }).join('')}</div>
        ${warn ? `<div class="scalp-warn" role="status">${SCALP_ICONS.warn}<span>${warn}</span></div>` : ''}`;
    // Click a square: open the trade (a quick trade opens as Complete trade, like its button)
    bar.querySelectorAll('[data-scalp-trade]').forEach(b => b.addEventListener('click', () => {
        const t = appData.trades.find(x => x.id === b.dataset.scalpTrade); if (!t) return;
        if (t.quick) scalpComplete(t.id); else openTradeModal(t.id);
    }));
    const next = bar.querySelector('[data-scalp-next]');
    if (next) next.addEventListener('click', () => scalpComplete(open[0].id));
}

// ---------- quick trades in the list: Complete trade ----------
function scalpDecorateTrades() {
    const rows = [...document.querySelectorAll('#trades-list .trade-row[data-trade-id]')];
    const find = id => appData.trades.find(t => t.id === id);
    const anyQuick = rows.some(r => { const t = find(r.dataset.tradeId); return t && t.quick; });
    const title = 'Complete trade: add market condition, location, evidence, psychology, notes or a screenshot';
    const gradeOn = typeof rulesGradeOn === 'function' && rulesGradeOn(), rulesOn = scalpRulesOn();
    rows.forEach(row => {
        const t = find(row.dataset.tradeId); if (!t) return;
        const res = row.querySelector('.row-col-res'), result = res && res.querySelector('.badge');
        // Fixed places for grade and rules badge, so the badges line up when one is missing
        // (a quick trade has no locations yet, so no grade: its Complete trade button takes that space)
        if (result) {
            if (gradeOn && !t.quick && !res.querySelector('.rules-grade')) result.insertAdjacentHTML('beforebegin', '<span class="rules-grade is-small scalp-slot" aria-hidden="true"></span>');
            if (rulesOn && !res.querySelector('.rules-badge')) result.insertAdjacentHTML('beforebegin', '<span class="rules-badge scalp-slot" aria-hidden="true">Rules 0/0</span>');
        }
        if (t.quick) {
            const empty = row.querySelector('.row-no-thumb');
            if (empty) empty.outerHTML = `<button type="button" class="scalp-thumb" data-scalp-complete="${escapeHTML(t.id)}" title="${title}" aria-label="Complete trade ${escapeHTML(String(t.number))}">${SCALP_ICONS.pen}</button>`;
        }
        if (anyQuick && res) res.insertAdjacentHTML('beforebegin', `<div class="scalp-col">${t.quick ? `<button type="button" class="scalp-complete" data-scalp-complete="${escapeHTML(t.id)}" title="${title}">Complete trade</button>` : ''}</div>`);
    });
    document.querySelectorAll('#trades-list .trade-card[data-trade-id]').forEach(card => {
        const t = find(card.dataset.tradeId); if (!t || !t.quick) return;
        const id = card.querySelector('.card-trade-id'); if (!id) return;
        const html = `<button type="button" class="scalp-complete is-card" data-scalp-complete="${escapeHTML(t.id)}" title="${title}">Complete trade</button>`;
        const sym = id.querySelector('.symbol-tag');
        if (sym) sym.insertAdjacentHTML('afterend', html); else id.insertAdjacentHTML('beforeend', html);
    });
    document.querySelectorAll('#trades-list [data-scalp-complete]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); scalpComplete(b.dataset.scalpComplete); }));
}

async function scalpComplete(id) {
    const t = appData.trades.find(x => x.id === id); if (!t) return;
    await openTradeModal(id);
    const body = document.querySelector('#trade-modal .modal-body'); if (!body) return;
    const left = appData.trades.filter(x => x.date === t.date && x.quick).length;
    let n = document.getElementById('scalp-complete-note');
    if (!n) { n = document.createElement('div'); n.id = 'scalp-complete-note'; n.className = 'scalp-note is-complete'; body.prepend(n); }
    n.innerHTML = `${SCALP_ICONS.bolt}<span><strong>Complete this quick trade.</strong> Add the market condition and location, and anything else you want: evidence, psychology, notes or a screenshot. Saving marks it complete.${left > 1 ? ` <span class="scalp-left">${left - 1} more to complete on this day.</span>` : ''}</span>`;
}

// Called at the end of every renderDashboard()
function scalpAfterDashboard() {
    if (!scalpFeatureOn) return;
    scalpApply();
    scalpDayBar();
    scalpDecorateTrades();
    if (typeof shotsDecorate === 'function') shotsDecorate(); // multiple screenshots (shots.js)
    const first = document.getElementById('btn-add-first-trade');
    if (first && scalpModeOn()) {
        const b = first.cloneNode(false); b.innerHTML = `${SCALP_ICONS.bolt}Quick trade`; b.classList.add('scalp-first');
        b.addEventListener('click', () => scalpQuickOpen());
        first.replaceWith(b);
    }
}

// ---------- Add Trade: max losses message, quick trade note, Save & next ----------
let scalpSaveNextPending = false;
let scalpNextFrom = null;
function scalpFormOpened(tradeId) {
    if (!scalpFeatureOn) return;
    scalpSaveNextPending = false;
    const body = document.querySelector('#trade-modal .modal-body'); if (!body) return;
    ['scalp-form-warn', 'scalp-complete-note', 'scalp-copy-note'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
    const isNew = !tradeId;
    const warn = isNew ? scalpWarning(document.getElementById('t-date').value || datePicker.value) : '';
    if (warn) { const w = document.createElement('div'); w.id = 'scalp-form-warn'; w.className = 'scalp-warn is-form'; w.setAttribute('role', 'status'); w.innerHTML = `${SCALP_ICONS.warn}<span>${warn}</span>`; body.prepend(w); }
    if (isNew && scalpNextFrom) {
        const c = document.createElement('div'); c.id = 'scalp-copy-note'; c.className = 'scalp-note';
        c.innerHTML = `${SCALP_ICONS.copy}<span><strong>Symbol ${escapeHTML(scalpNextFrom.symbol || '')}</strong> from trade ${escapeHTML(String(scalpNextFrom.number))}. The rest is empty for the new trade.</span>`;
        body.prepend(c);
    }
    let next = document.getElementById('btn-save-next');
    if (isNew && scalpModeOn()) {
        if (!next) {
            next = document.createElement('button'); next.type = 'button'; next.id = 'btn-save-next'; next.className = 'btn-secondary'; next.textContent = 'Save & next';
            next.title = 'Save and start the next trade with the same symbol';
            next.addEventListener('click', () => { if (btnSaveTrade.disabled) return; scalpSaveNextPending = true; btnSaveTrade.click(); });
            btnCancelModal.after(next);
        }
        next.hidden = false;
        scalpSyncSaveNext();
    } else if (next) next.hidden = true;
}
function scalpSyncSaveNext() {
    const next = document.getElementById('btn-save-next');
    if (next) next.disabled = btnSaveTrade.disabled;
}
function scalpFormClosed() { scalpNextFrom = null; }
// Called by the Save handler after a trade was saved (and the form closed)
async function scalpAfterSave(trade) {
    if (!scalpSaveNextPending) return;
    scalpSaveNextPending = false;
    if (!scalpModeOn() || !trade) return;
    await openTradeModal(null);
    if (tfState) { tfState.symbol = trade.symbol || ''; tfRenderAll(); tfUpdateSaveState(); }
    scalpNextFrom = trade;
    scalpFormOpened(null);
}

// ---------- Quick trade popup ----------
let scalpQ = null; // { id, date, number, symbol, direction, setup, setupCategory, result, rules, broken:Set, from, shots: [{ blob, url }] }
function scalpPrevious(date) {
    const day = appData.trades.filter(t => t.date === date).sort((a, b) => (parseInt(b.number, 10) || 0) - (parseInt(a.number, 10) || 0));
    if (day[0]) return day[0];
    return appData.trades.slice().sort((a, b) => scalpTradeKey(b).localeCompare(scalpTradeKey(a)))[0] || null;
}
// All setups in the order of Settings, so the keys 1 to 9 always mean the same setup
function scalpSetups() {
    const all = typeof tfAllSetups === 'function' ? tfAllSetups().map(s => s.item) : [];
    return all.filter((s, i) => s && all.indexOf(s) === i);
}
function scalpNumber(date) { const n = appData.trades.filter(t => t.date === date).map(t => parseInt(t.number, 10) || 0); return (n.length ? Math.max(...n) : 0) + 1; }
function scalpQuickInit(symbol, from) {
    const date = datePicker.value, p = scalpPrevious(date), syms = appData.settings.symbol || [];
    let sym = symbol !== undefined ? symbol : (p && p.symbol) || '';
    if (sym && !syms.includes(sym)) sym = '';
    if (!sym && syms.length === 1) sym = syms[0];
    scalpQ = { id: crypto.randomUUID(), date, number: scalpNumber(date), symbol: sym, direction: '', setup: '', setupCategory: '', result: '',
        rules: null, broken: new Set(), from: from !== undefined ? from : (p && sym && p.symbol === sym ? p.number : null), shots: [] };
}
function scalpQuickMissing() {
    const q = scalpQ, s = appData.settings, miss = [];
    if ((s.symbol || []).length && !q.symbol) miss.push('Symbol');
    if ((s.direction || []).length && !q.direction) miss.push('Direction');
    if (scalpSetups().length && !q.setup) miss.push('Setup');
    if (!q.result) miss.push('Result');
    return miss;
}
function scalpCaptureState() {
    const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    const connected = !!(activeMediaStream && activeMediaStream.active);
    return { supported, connected };
}
function scalpQuickShotHtml() {
    const q = scalpQ, c = scalpCaptureState();
    // Several screenshots per trade (shots.js): C adds one more, Remove takes the latest away
    const n = q.shots.length;
    if (n) {
        const shown = q.shots.slice(-3);
        const thumbs = shown.map((s, i) => `<img class="scalp-q-shot-img" src="${s.url}" alt="Screenshot ${n - shown.length + i + 1} for trade ${q.number}">`).join('');
        const full = n >= (typeof SHOTS_MAX !== 'undefined' ? SHOTS_MAX : 10);
        return `<div class="scalp-q-shot has-shot"><span class="scalp-q-thumbs">${thumbs}${n > 3 ? `<span class="scalp-q-more">+${n - 3}</span>` : ''}</span><span><strong>${n === 1 ? 'Screenshot added' : `${n} screenshots`}</strong></span>${c.supported && !full ? `<button type="button" class="btn-secondary btn-sm" data-scalp-capture>Add another ${scalpKbd('C')}</button>` : ''}<button type="button" class="scalp-q-link" data-scalp-shot-remove>${n > 1 ? 'Remove last' : 'Remove'}</button></div>`;
    }
    const btn = c.connected ? `<button type="button" class="btn-primary btn-sm scalp-q-capture" data-scalp-capture>Auto-Capture ${scalpKbd('C', true)}</button>`
        : c.supported ? `<button type="button" class="btn-secondary btn-sm scalp-q-capture" data-scalp-capture>Connect window ${scalpKbd('C')}</button>` : '';
    return `<div class="scalp-q-shot">${SCALP_ICONS.img}<span>Screenshot <span class="scalp-q-note">optional</span></span>${btn}<span class="scalp-q-or">${btn ? 'or paste' : 'Paste'} ${scalpKbd(scalpCtrl())} ${scalpKbd('V')}</span></div>`;
}
function scalpQuickRender() {
    const box = document.getElementById('scalp-q-dialog'); if (!box || !scalpQ) return;
    const q = scalpQ, S = appData.settings;
    const chip = (field, v, label, extra = '') => `<button type="button" class="scalp-q-chip${q[field] === v ? ' is-on' : ''}" data-scalp-q="${field}" data-v="${escapeHTML(v)}" aria-pressed="${q[field] === v}">${label !== undefined ? label : escapeHTML(v)}${extra}</button>`;
    const setups = scalpSetups();
    const dirs = S.direction || [];
    const dirKey = v => v === 'Long' ? scalpKbd('↑') : v === 'Short' ? scalpKbd('↓') : '';
    const rulesOn = scalpRulesOn() && q.setup && typeof rulesForSetup === 'function';
    const rlist = rulesOn ? rulesForSetup(q.setup) : [];
    const warn = scalpWarning(q.date);
    box.querySelector('.scalp-q-sub').textContent = `Trade ${q.number} · ${parseLocalDate(q.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
    box.querySelector('.scalp-q-body').innerHTML = `
        ${warn ? `<div class="scalp-warn" role="status">${SCALP_ICONS.warn}<span>${warn}</span></div>` : ''}
        ${(S.symbol || []).length ? `<div class="scalp-q-row"><span class="scalp-q-label">Symbol</span><div class="scalp-q-chips" role="group" aria-label="Symbol">${S.symbol.map(v => chip('symbol', v)).join('')}</div>${q.from && q.symbol ? `<span class="scalp-q-note">From trade ${escapeHTML(String(q.from))}</span>` : ''}</div>` : ''}
        ${dirs.length ? `<div class="scalp-q-row"><span class="scalp-q-label">Direction</span><div class="scalp-q-chips is-big" role="group" aria-label="Direction">${dirs.map(v => chip('direction', v, undefined, dirKey(v))).join('')}</div></div>` : ''}
        ${setups.length ? `<div class="scalp-q-row"><span class="scalp-q-label">Setup</span><div class="scalp-q-chips" role="group" aria-label="Setup">${setups.map((v, i) => chip('setup', v, undefined, i < 9 ? scalpKbd(String(i + 1)) : '')).join('')}</div></div>` : ''}
        <div class="scalp-q-row"><span class="scalp-q-label">Result</span><div class="scalp-q-chips is-big" role="group" aria-label="Result">
            ${chip('result', 'WIN', 'Win', scalpKbd('W'))}${chip('result', 'LOST', 'Loss', scalpKbd('L'))}${chip('result', 'B/E', 'Break-even', scalpKbd('B'))}</div></div>
        ${rulesOn && rlist.length ? `<div class="scalp-q-row"><span class="scalp-q-label">Rules</span><div class="scalp-q-chips" role="group" aria-label="Rules">
            <button type="button" class="scalp-q-chip${q.rules === 'ok' ? ' is-on is-ok' : ''}" data-scalp-rules="ok" aria-pressed="${q.rules === 'ok'}">All followed${scalpKbd('A')}</button>
            <button type="button" class="scalp-q-chip${q.rules === 'broken' ? ' is-on is-broken' : ''}" data-scalp-rules="broken" aria-pressed="${q.rules === 'broken'}">Broke a rule</button></div><span class="scalp-q-note">optional</span></div>
            ${q.rules === 'broken' ? `<div class="scalp-q-broken" role="group" aria-label="Which rule">${rlist.map(r => `<button type="button" class="scalp-q-chip is-small${q.broken.has(r.id) ? ' is-on is-broken' : ''}" data-scalp-broke="${escapeHTML(r.id)}" aria-pressed="${q.broken.has(r.id)}">${escapeHTML(r.key)}</button>`).join('')}</div>` : ''}` : ''}
        ${scalpQuickShotHtml()}`;
    const miss = scalpQuickMissing();
    box.querySelectorAll('[data-scalp-save]').forEach(b => { b.disabled = miss.length > 0; });
    box.querySelector('.scalp-q-hint').textContent = miss.length ? `Still needed: ${miss.join(', ')}` : 'Ready · Enter saves, then the next trade';
    if (!box.contains(document.activeElement)) box.focus({ preventScroll: true }); // a re-render must not drop the keys
}
function scalpQuickOpen() {
    if (!scalpModeOn() || document.getElementById('app-dialog') || tradeModal.classList.contains('active')) return;
    if (!dirHandle || !fileConnected) return;
    scalpQuickInit();
    const ov = document.createElement('div'); ov.id = 'app-dialog'; ov.className = 'app-dialog-overlay';
    ov.innerHTML = `<div class="app-dialog scalp-q-dialog" id="scalp-q-dialog" role="dialog" aria-modal="true" aria-labelledby="scalp-q-title" tabindex="-1">
        <button type="button" class="rules-code-close" data-scalp-close aria-label="Close">&times;</button>
        <div class="scalp-q-head"><span class="scalp-q-icon">${SCALP_ICONS.bolt}</span><div><h2 id="scalp-q-title">Quick trade</h2><span class="scalp-q-sub"></span></div></div>
        <div class="scalp-q-body"></div>
        <div class="scalp-q-foot">
            <button type="button" class="btn-primary" data-scalp-save="next" title="Save &amp; next (Enter or ${scalpAltKey()} S)">Save &amp; next ${scalpKbd('Enter', true)}</button>
            <button type="button" class="btn-secondary" data-scalp-save="close" title="Save &amp; close (Shift Enter or ${scalpAltKey()} Shift S)">Save &amp; close</button>
            <span class="scalp-q-hint help-text" aria-live="polite"></span>
            <button type="button" class="scalp-q-link" data-scalp-full>Full form</button>
        </div></div>`;
    document.body.appendChild(ov);
    const box = ov.querySelector('.scalp-q-dialog');
    let release = null;
    const close = () => { if (scalpQ) scalpQ.shots.forEach(s => URL.revokeObjectURL(s.url)); scalpQ = null; ov.remove(); if (release) release(); };
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    ov.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b || !scalpQ) return;
        const q = scalpQ;
        if (b.dataset.scalpClose !== undefined) return close();
        if (b.dataset.scalpQ) {
            const f = b.dataset.scalpQ, v = b.dataset.v;
            q[f] = q[f] === v && f !== 'symbol' ? '' : v;
            if (f === 'symbol') q.from = null;
            if (f === 'setup') { q.setupCategory = typeof tfFindSetupCategory === 'function' ? tfFindSetupCategory(q.setup) : ''; q.rules = null; q.broken.clear(); }
            return scalpQuickRender();
        }
        if (b.dataset.scalpRules) { q.rules = q.rules === b.dataset.scalpRules ? null : b.dataset.scalpRules; if (q.rules !== 'broken') q.broken.clear(); return scalpQuickRender(); }
        if (b.dataset.scalpBroke) { q.broken.has(b.dataset.scalpBroke) ? q.broken.delete(b.dataset.scalpBroke) : q.broken.add(b.dataset.scalpBroke); return scalpQuickRender(); }
        if (b.dataset.scalpCapture !== undefined) return scalpQuickCapture();
        if (b.dataset.scalpShotRemove !== undefined) { const s = q.shots.pop(); if (s) URL.revokeObjectURL(s.url); return scalpQuickRender(); }
        if (b.dataset.scalpSave) return scalpQuickSave(b.dataset.scalpSave === 'close', close);
        if (b.dataset.scalpFull !== undefined) return scalpQuickFull(close);
    });
    box.addEventListener('keydown', e => {
        if (!scalpQ) return;
        const k = e.key, q = scalpQ;
        // Alt S = save & next, Alt Shift S = save & close (same as Enter / Shift Enter)
        if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyS') {
            e.preventDefault();
            if (e.repeat) return;
            if (!scalpQuickMissing().length) scalpQuickSave(e.shiftKey, close);
            else showToast(`Still needed: ${scalpQuickMissing().join(', ')}`, 'error');
            return;
        }
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (k === 'c' || k === 'C') { e.preventDefault(); scalpQuickCapture(); return; } // C = Auto-Capture (or connect the window)
        const set = (f, v) => { e.preventDefault(); q[f] = v; scalpQuickRender(); };
        const dirs = appData.settings.direction || [];
        if (k === 'ArrowUp' && dirs.includes('Long')) return set('direction', 'Long');
        if (k === 'ArrowDown' && dirs.includes('Short')) return set('direction', 'Short');
        if (/^[1-9]$/.test(k)) {
            const v = scalpSetups()[Number(k) - 1];
            if (v) { e.preventDefault(); q.setup = v; q.setupCategory = typeof tfFindSetupCategory === 'function' ? tfFindSetupCategory(v) : ''; q.rules = null; q.broken.clear(); scalpQuickRender(); }
            return;
        }
        if (k === 'w' || k === 'W') return set('result', 'WIN');
        if (k === 'l' || k === 'L') return set('result', 'LOST');
        if (k === 'b' || k === 'B') return set('result', 'B/E');
        if ((k === 'a' || k === 'A') && scalpRulesOn() && q.setup) { e.preventDefault(); q.rules = 'ok'; q.broken.clear(); return scalpQuickRender(); }
        if (k === 'Enter' && !e.isComposing) {
            const onButton = e.target.closest && e.target.closest('button');
            if (!scalpQuickMissing().length) { e.preventDefault(); scalpQuickSave(e.shiftKey, close); }
            else if (!onButton) { e.preventDefault(); showToast(`Still needed: ${scalpQuickMissing().join(', ')}`, 'error'); }
        }
    });
    box.addEventListener('paste', e => {
        const items = [...((e.clipboardData && e.clipboardData.items) || [])];
        const it = items.find(i => i.kind === 'file' && i.type && i.type.startsWith('image/'));
        if (it) { e.preventDefault(); scalpQuickSetShot(it.getAsFile()); }
    });
    release = appDialogTrap(box, { onEscape: close, initialFocus: box });
    scalpQuickRender();
}
async function scalpQuickSetShot(fileOrBlob) {
    if (!scalpQ || !fileOrBlob) return;
    try {
        const blob = await compressImage(fileOrBlob);
        if (!scalpQ || !blob) return;
        const max = typeof SHOTS_MAX !== 'undefined' ? SHOTS_MAX : 10;
        if (scalpQ.shots.length >= max) { showToast(`A trade holds up to ${max} screenshots. Remove one to add another.`, 'error'); return false; }
        scalpQ.shots.push({ blob, url: URL.createObjectURL(blob) });
        scalpQuickRender();
        return true;
    } catch (e) { console.error(e); showToast('Could not read that image', 'error'); }
}
let scalpCapturing = false;
async function scalpQuickCapture() {
    if (!scalpQ || scalpCapturing) return;
    const c = scalpCaptureState(); if (!c.supported) return;
    scalpCapturing = true;
    try {
        if (!c.connected) { await connectScreenshotWindow(); if (!scalpQ) return; scalpQuickRender(); if (!scalpCaptureState().connected) return; }
        const canvas = await captureConnectedWindow();
        const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.9));
        if (!blob) throw new Error('Could not create the image');
        const added = await scalpQuickSetShot(blob);
        if (scalpQ && added) showToast(scalpQ.shots.length > 1 ? `Screenshot ${scalpQ.shots.length} captured!` : 'Screenshot captured!', 'success');
    } catch (e) {
        console.error('Auto-Capture failed:', e);
        showToast(`Capture failed: ${e.message}`, 'error');
    } finally { scalpCapturing = false; }
}
async function scalpQuickSave(andClose, close) {
    const q = scalpQ;
    if (!q || q.saving || scalpQuickMissing().length) return;
    q.saving = true;
    const names = [];
    let failed = 0;
    for (let k = 0; k < q.shots.length; k++) {
        const name = `trade_${q.id}_${Date.now()}${k ? `_${k}` : ''}.webp`;
        try { await saveImageToDir(q.shots[k].blob, name); names.push(name); } catch (e) { console.error(e); failed++; }
    }
    if (failed) showToast(failed === q.shots.length && failed === 1 ? 'The screenshot could not be saved; the trade is saved without it.' : `${failed} screenshot${failed === 1 ? '' : 's'} could not be saved; the trade is saved without ${failed === 1 ? 'it' : 'them'}.`, 'error');
    const screenshot = names.length ? names[names.length - 1] : null;
    const t = { id: q.id, date: q.date, number: String(q.number), result: q.result, symbol: q.symbol, locations: [], marketCondition: '', setup: q.setup, setupCategory: q.setup ? (q.setupCategory || (typeof tfFindSetupCategory === 'function' ? tfFindSetupCategory(q.setup) : '')) : '',
        direction: q.direction, evidences: [], invalidations: [], target: '', targetSub1: '', targetSub2: '', psychology: [], notes: '', screenshot, quick: true };
    if (names.length > 1) t.screenshots = names;
    if (q.rules && scalpRulesOn() && typeof rulesForSetup === 'function') {
        t.ruleChecks = rulesForSetup(q.setup).map(r => ({ id: r.id, phase: r.phase, key: r.key, detail: r.detail, ok: q.rules === 'ok' ? true : !q.broken.has(r.id) }));
    }
    appData.trades.push(t);
    await renderDashboard();
    autoSave();
    showToast(`Trade ${t.number} saved · ${SCALP_RESULT_LABEL[t.result]}`, 'success');
    if (andClose || !scalpQ) return close();
    // Next trade: only the symbol stays
    q.shots.forEach(s => URL.revokeObjectURL(s.url));
    scalpQuickInit(t.symbol, t.number);
    scalpQuickRender();
}
async function scalpQuickFull(close) {
    const q = scalpQ; if (!q) return;
    const keep = { symbol: q.symbol, direction: q.direction, setup: q.setup, setupCategory: q.setupCategory, result: q.result }, blobs = q.shots.map(s => s.blob);
    close();
    await openTradeModal(null);
    if (tfState) {
        Object.keys(keep).forEach(k => { if (keep[k]) tfState[k] = keep[k]; });
        tfRenderAll(); tfUpdateSaveState();
    }
    for (const blob of blobs) await handleImageFile(new File([blob], `quick_${Date.now()}.webp`, { type: 'image/webp' }));
}

// ---------- Settings › Journal (top): Show max losses per day message ----------
function scalpSettingsEl() {
    const el = document.createElement('div');
    el.className = 'setting-category-card scalp-limits';
    const cur = scalpLimits().maxLosses;
    const opts = [[0, 'Off'], [2, '2'], [3, '3'], [4, '4'], [5, '5']];
    el.innerHTML = `<h2 class="setting-cat-title">Show max losses per day message</h2>
        <div class="scalp-limit-row"><div><strong>Losses per day</strong><span class="help-text">When you reach it, the day bar, Add Trade and Quick trade show a calm message. It never stops you from logging. Works in Normal and Scalp mode.</span></div>
        <div class="cc-seg" role="group" aria-label="Max losses per day">${opts.map(([v, t]) => `<button type="button" class="cc-seg-btn${cur === v ? ' is-selected' : ''}" data-scalp-limit="${v}" aria-pressed="${cur === v}">${t}</button>`).join('')}</div></div>`;
    el.querySelectorAll('[data-scalp-limit]').forEach(b => b.addEventListener('click', () => {
        const v = Number(b.dataset.scalpLimit);
        if (v) appData.settings.limits = { ...(appData.settings.limits || {}), maxLosses: v };
        else if (appData.settings.limits) { delete appData.settings.limits.maxLosses; if (!Object.keys(appData.settings.limits).length) delete appData.settings.limits; }
        autoSave(); renderSettingsUI();
    }));
    return el;
}

// ---------- C: Auto-Capture in Add Trade (app.js) ----------
function scalpCaptureShortcut() {
    if (!scalpFeatureOn) return false;
    const cap = document.getElementById('btn-auto-screenshot'), con = document.getElementById('btn-connect-window');
    if (cap && cap.style.display !== 'none') { cap.click(); return true; }
    if (con && con.style.display !== 'none') { con.click(); return true; }
    return false;
}

// ---------- start ----------
document.addEventListener('DOMContentLoaded', () => {
    if (!scalpFeatureOn) return;
    document.documentElement.classList.add('scalp-feature');
    scalpSidebarEl();
    scalpApply();
});
