// --- Tags: add, rename, merge, move and remove list items (2026-11-15) ---
// One place for every change to the lists in Settings › Journal (symbol, market
// condition, location, setup, direction, evidence, invalidation, target, psychology),
// used by Add Trade (+ chip, Find or add, pencil edit mode) and by Settings.
// A rename or merge goes through to the trades that use the tag, to the custom chart
// filters and to the setup rules, with one Undo. settings.json keeps its shape.
// Part 1: data (no DOM). Part 2: the shared pieces of the page (editor, + chip, hover label).

// ---------- The lists ----------
// flat: settings[key] = [names] · group: settings[key] = { Category: [names] }
// tree: settings[key] = { Category: { sub1: [names], sub2: [names] } }
const TAGS_KINDS = {
    symbol: { type: 'flat', label: 'symbol', fields: ['symbol'] },
    marketCondition: { type: 'flat', label: 'market condition', fields: ['marketCondition'] },
    direction: { type: 'flat', label: 'direction', fields: ['direction'] },
    psychology: { type: 'flat', multi: true, label: 'psychology', fields: ['psychology'] },
    setup: { type: 'group', label: 'setup', fields: ['setup', 'setupCategory'] },
    evidence: { type: 'group', arr: 'evidences', label: 'evidence', fields: ['evidences'] },
    invalidation: { type: 'group', arr: 'invalidations', label: 'invalidation', fields: ['invalidations'] },
    location: { type: 'tree', arr: 'locations', label: 'location', fields: ['locations'] },
    target: { type: 'tree', label: 'target', fields: ['target', 'targetSub1', 'targetSub2'] }
};
const TAGS_FIND_FROM = 7; // Find or add shows from this many tags in a section
const TAGS_UNDO_MS = 10000;

// An address: { key, level, cat }
//  level 'item' (flat list) · 'cat' (category of a group / tree) · 'gitem' (item of a group category)
//  'sub1' / 'sub2' (level 1 / level 2 list of a tree category)

function tagsIsObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function tagsSettings() { return appData.settings; }

function tagsConfig(key) {
    const s = tagsSettings(), k = TAGS_KINDS[key];
    if (k.type === 'flat') { if (!Array.isArray(s[key])) s[key] = []; return s[key]; }
    if (!tagsIsObj(s[key])) s[key] = {};
    return s[key];
}

// The array of names an address points to (a copy for 'cat', the real array otherwise)
function tagsList(a) {
    const k = TAGS_KINDS[a.key];
    if (k.type === 'flat') return tagsConfig(a.key);
    const cfg = tagsConfig(a.key);
    if (a.level === 'cat') return Object.keys(cfg);
    if (k.type === 'group') {
        if (!Array.isArray(cfg[a.cat])) cfg[a.cat] = [];
        return cfg[a.cat];
    }
    if (!tagsIsObj(cfg[a.cat])) cfg[a.cat] = { sub1: [], sub2: [] };
    const node = cfg[a.cat];
    if (!Array.isArray(node[a.level])) node[a.level] = [];
    return node[a.level];
}

function tagsClean(name) { return String(name == null ? '' : name).replace(/\s+/g, ' ').trim(); }
function tagsSame(a, b) { return String(a).toLocaleLowerCase() === String(b).toLocaleLowerCase(); }
function tagsFindIn(list, name) { return list.find(x => tagsSame(x, name)) || null; }

// Number of tags in a section (all categories and levels together)
function tagsCount(key) {
    const k = TAGS_KINDS[key], cfg = tagsConfig(key);
    if (k.type === 'flat') return cfg.length;
    return Object.keys(cfg).reduce((n, c) => {
        if (k.type === 'group') return n + Math.max(1, (Array.isArray(cfg[c]) ? cfg[c] : []).length);
        const node = tagsIsObj(cfg[c]) ? cfg[c] : {};
        return n + 1 + (node.sub1 || []).length + (node.sub2 || []).length;
    }, 0);
}

// Where an address lives, in words: “Orderflow”, “VWAP, level 1”
function tagsWhere(a) {
    const k = TAGS_KINDS[a.key];
    if (k.type === 'flat' || a.level === 'cat') return '';
    if (a.level === 'gitem') return a.cat;
    return `${a.cat}, level ${a.level === 'sub1' ? 1 : 2}`;
}

// ---------- Matching a tag on a trade ----------
// Returns { has(trade), map(trade, newName) } for one tag at an address.

function tagsMatcher(a, name) {
    const k = TAGS_KINDS[a.key];
    const T = (t, f) => (Array.isArray(t[f]) ? t[f] : []);
    if (k.type === 'flat') {
        if (k.multi) return {
            has: t => T(t, a.key).includes(name),
            map: (t, n) => { t[a.key] = [...new Set(T(t, a.key).map(v => v === name ? n : v))]; }
        };
        return { has: t => t[a.key] === name, map: (t, n) => { t[a.key] = n; } };
    }
    if (a.key === 'setup') {
        if (a.level === 'cat') return {
            has: t => !!t.setup && (t.setupCategory || tagsSetupCategoryOf(t.setup)) === name,
            map: (t, n) => { if (t.setup) t.setupCategory = n; }
        };
        return {
            has: t => t.setup === name && (!t.setupCategory || t.setupCategory === a.cat),
            map: (t, n) => { t.setup = n; }
        };
    }
    if (k.type === 'group') {
        const dedupe = arr => { const seen = new Set(); return arr.filter(e => { const id = e.primary + '\u0000' + (e.sub || ''); if (seen.has(id)) return false; seen.add(id); return true; }); };
        if (a.level === 'cat') return {
            has: t => T(t, k.arr).some(e => e && e.primary === name),
            map: (t, n) => { t[k.arr] = dedupe(T(t, k.arr).map(e => e && e.primary === name ? { ...e, primary: n } : e)); }
        };
        return {
            has: t => T(t, k.arr).some(e => e && e.primary === a.cat && (e.sub || '') === name),
            map: (t, n) => { t[k.arr] = dedupe(T(t, k.arr).map(e => e && e.primary === a.cat && (e.sub || '') === name ? { ...e, sub: n } : e)); }
        };
    }
    // tree
    if (k.arr) {
        const dedupe = arr => { const seen = new Set(); return arr.filter(l => { const id = [l.primary, l.sub1 || '', l.sub2 || ''].join('\u0000'); if (seen.has(id)) return false; seen.add(id); return true; }); };
        const is = l => l && (a.level === 'cat' ? l.primary === name : l.primary === a.cat && (l[a.level] || '') === name);
        return {
            has: t => T(t, k.arr).some(is),
            map: (t, n) => { t[k.arr] = dedupe(T(t, k.arr).map(l => is(l) ? (a.level === 'cat' ? { ...l, primary: n } : { ...l, [a.level]: n }) : l)); }
        };
    }
    const f = a.level === 'cat' ? 'target' : a.level === 'sub1' ? 'targetSub1' : 'targetSub2';
    const is = t => a.level === 'cat' ? t.target === name : t.target === a.cat && t[f] === name;
    return { has: is, map: (t, n) => { if (is(t)) t[f] = n; } };
}

function tagsSetupCategoryOf(setup) {
    const cfg = tagsConfig('setup');
    return Object.keys(cfg).find(c => Array.isArray(cfg[c]) && cfg[c].includes(setup)) || '';
}

// How many trades use a tag (category: anything in it)
function tagsUsage(a, name) {
    const m = tagsMatcher(a, name);
    return (appData.trades || []).reduce((n, t) => n + (t && m.has(t) ? 1 : 0), 0);
}

// All usage numbers of one list in one pass over the trades (for the editor's labels)
function tagsUsageIndex(key) {
    const k = TAGS_KINDS[key], map = new Map();
    const bump = id => map.set(id, (map.get(id) || 0) + 1);
    (appData.trades || []).forEach(t => {
        if (!t) return;
        const ids = new Set();
        if (k.type === 'flat') (k.multi ? (Array.isArray(t[key]) ? t[key] : []) : [t[key]]).forEach(v => { if (v) ids.add(`item||${v}`); });
        else if (key === 'setup') { if (t.setup) { const c = t.setupCategory || tagsSetupCategoryOf(t.setup); ids.add(`cat||${c}`); ids.add(`gitem|${c}|${t.setup}`); if (!t.setupCategory) Object.keys(tagsConfig('setup')).forEach(cc => ids.add(`gitem|${cc}|${t.setup}`)); } }
        else if (k.type === 'group') (Array.isArray(t[k.arr]) ? t[k.arr] : []).forEach(e => { if (!e) return; ids.add(`cat||${e.primary}`); ids.add(`gitem|${e.primary}|${e.sub || ''}`); });
        else if (k.arr) (Array.isArray(t[k.arr]) ? t[k.arr] : []).forEach(l => { if (!l) return; ids.add(`cat||${l.primary}`); if (l.sub1) ids.add(`sub1|${l.primary}|${l.sub1}`); if (l.sub2) ids.add(`sub2|${l.primary}|${l.sub2}`); });
        else if (t.target) { ids.add(`cat||${t.target}`); if (t.targetSub1) ids.add(`sub1|${t.target}|${t.targetSub1}`); if (t.targetSub2) ids.add(`sub2|${t.target}|${t.targetSub2}`); }
        ids.forEach(bump);
    });
    return (a, name) => map.get(`${a.level}|${a.level === 'cat' || a.level === 'item' ? '' : a.cat}|${name}`) || 0;
}

function tagsTradesText(n) { return n === 0 ? 'Not used in any trade' : n === 1 ? '1 trade' : `${n} trades`; }

// ---------- The form that is open (Add / Edit Trade) ----------
// tradeform.js registers get/set so a rename also reaches the trade you are logging.
let tagsForm = null; // { get: () => trade-shaped copy, set: obj => void }

// ---------- Undo ----------
let tagsUndoState = null;

function tagsSnapshot(key, withTrades) {
    const s = tagsSettings();
    const snap = {
        key,
        list: JSON.stringify(s[key] === undefined ? null : s[key]),
        rules: JSON.stringify(s.rules === undefined ? null : s.rules),
        charts: JSON.stringify(s.customCharts === undefined ? null : s.customCharts),
        trades: null, form: null
    };
    if (withTrades) {
        const fields = TAGS_KINDS[key].fields;
        snap.trades = (appData.trades || []).map(t => [t.id, fields.map(f => [f, f in t, JSON.stringify(t[f] === undefined ? null : t[f])])]);
    }
    const form = tagsForm && tagsForm.get();
    if (form) snap.form = JSON.stringify(form);
    return snap;
}

function tagsRestore(snap) {
    const s = tagsSettings();
    const put = (k, json) => { const v = JSON.parse(json); if (v === null) delete s[k]; else s[k] = v; };
    put(snap.key, snap.list);
    put('rules', snap.rules);
    put('customCharts', snap.charts);
    if (snap.trades) {
        const byId = new Map(snap.trades);
        (appData.trades || []).forEach(t => {
            const saved = byId.get(t.id);
            if (!saved) return;
            saved.forEach(([f, had, json]) => { if (had) t[f] = JSON.parse(json); else delete t[f]; });
        });
    }
    if (snap.form && tagsForm && tagsForm.get()) tagsForm.set(JSON.parse(snap.form));
}

// Saves, re-renders what shows the lists, and offers Undo in one message (one tags message at a time)
let tagsToastEl = null;
async function tagsDone(snap, message, opts = {}) {
    if (opts.tradesChanged && typeof renderDashboard === 'function') { try { renderDashboard(); } catch (e) { /* keep going */ } }
    tagsRefresh();
    if (typeof autoSave === 'function') await autoSave();
    if (!message) return;
    if (tagsToastEl && tagsToastEl.isConnected) tagsToastEl.remove();
    const token = {};
    tagsUndoState = { snap, token, tradesChanged: !!opts.tradesChanged };
    tagsToastEl = showToast(message, 'success', {
        duration: TAGS_UNDO_MS,
        action: { label: 'Undo', onClick: () => tagsUndo(token) }
    });
    setTimeout(() => { if (tagsUndoState && tagsUndoState.token === token) tagsUndoState = null; }, TAGS_UNDO_MS);
}

async function tagsUndo(token) {
    const u = tagsUndoState;
    if (!u || (token && u.token !== token)) return false;
    tagsUndoState = null;
    if (tagsToastEl && tagsToastEl.isConnected) tagsToastEl.remove();
    tagsRestore(u.snap);
    if (u.tradesChanged && typeof renderDashboard === 'function') { try { renderDashboard(); } catch (e) { /* keep going */ } }
    tagsRefresh();
    if (typeof autoSave === 'function') await autoSave();
    showToast('Undone.', 'success');
    return true;
}

// Ctrl / Cmd + Z while the message shows (not while typing in a field)
document.addEventListener('keydown', e => {
    if (!tagsUndoState || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || String(e.key).toLowerCase() !== 'z') return;
    const a = document.activeElement;
    if (a && (['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) || a.isContentEditable)) return;
    if (document.getElementById('app-dialog')) return;
    e.preventDefault();
    tagsUndo();
});

// Re-render everything that shows the lists (set by tradeform.js and ui-settings.js)
const tagsRefreshers = new Set();
function tagsRefresh() { tagsRefreshers.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }

// ---------- Changes ----------

// Custom chart filters keep pointing at the renamed tag
function tagsChartsRename(a, oldName, newName) {
    const charts = tagsSettings().customCharts;
    if (!Array.isArray(charts)) return;
    const k = TAGS_KINDS[a.key];
    const fieldsFor = () => {
        if (k.type === 'flat') return [a.key];
        if (a.key === 'setup') return a.level === 'cat' ? ['setupCategory'] : ['setup'];
        if (k.type === 'group') return [a.key]; // evidence / invalidation filter on the tag (or the category without tags)
        if (a.key === 'location') return a.level === 'cat' ? ['locationType', 'location'] : ['location'];
        return ['target'];
    };
    const fields = fieldsFor();
    const pathRename = v => {
        const parts = String(v).split(' › ');
        const at = a.level === 'cat' ? 0 : a.level === 'sub1' ? 1 : 2;
        if (parts[at] === oldName && (at === 0 || parts[0] === a.cat)) parts[at] = newName;
        return parts.join(' › ');
    };
    charts.forEach(c => (Array.isArray(c && c.filters) ? c.filters : []).forEach(f => {
        if (!f || !fields.includes(f.field) || !Array.isArray(f.values)) return;
        const path = f.field === 'location' || f.field === 'target';
        f.values = [...new Set(f.values.map(v => path ? pathRename(v) : (v === oldName ? newName : v)))];
    }));
}

// Add a name to a list. Returns { name, added } (an existing name, upper / lower case ignored, is not added twice)
function tagsAdd(a, rawName) {
    const name = tagsClean(rawName);
    if (!name) return { name: '', added: false };
    const k = TAGS_KINDS[a.key];
    const list = tagsList(a);
    const existing = tagsFindIn(list, name);
    if (existing) return { name: existing, added: false };
    if (a.level === 'cat') tagsConfig(a.key)[name] = k.type === 'group' ? [] : { sub1: [], sub2: [] };
    else list.push(name);
    return { name, added: true };
}

// Several names at once (“a, b, c”)
function tagsSplit(raw) { return String(raw || '').split(',').map(tagsClean).filter(Boolean); }

// Rename. Returns { ok } · { conflict: existingName } (then ask to merge) · { same } (nothing to do)
function tagsRenameCheck(a, oldName, rawNew) {
    const name = tagsClean(rawNew);
    if (!name || name === oldName) return { same: true };
    const other = tagsList(a).find(x => x !== oldName && tagsSame(x, name));
    if (other) return { conflict: other };
    return { ok: true, name };
}

function tagsRenameNow(a, oldName, newName) {
    const list = tagsList(a);
    if (a.level === 'cat') {
        const cfg = tagsConfig(a.key);
        const keys = Object.keys(cfg), copy = {};
        keys.forEach(c => { copy[c === oldName ? newName : c] = cfg[c]; });
        keys.forEach(c => delete cfg[c]);
        Object.assign(cfg, copy);
    } else {
        const i = list.indexOf(oldName);
        if (i < 0) return;
        list[i] = newName;
    }
    const m = tagsMatcher(a, oldName);
    (appData.trades || []).forEach(t => { if (t && m.has(t)) m.map(t, newName); });
    if (tagsForm) { const f = tagsForm.get(); if (f && m.has(f)) { m.map(f, newName); tagsForm.set(f); } }
    tagsChartsRename(a, oldName, newName);
    if (a.key === 'setup' && a.level === 'gitem' && typeof rulesOnListRename === 'function') rulesOnListRename(list, oldName, newName);
}

async function tagsRename(a, oldName, rawNew) {
    const check = tagsRenameCheck(a, oldName, rawNew);
    if (!check.ok) return check;
    const n = tagsUsage(a, oldName);
    const snap = tagsSnapshot(a.key, true);
    tagsRenameNow(a, oldName, check.name);
    await tagsDone(snap, n ? `Renamed to “${check.name}” in your list and in ${n} trade${n === 1 ? '' : 's'}.` : `Renamed to “${check.name}”.`, { tradesChanged: n > 0 });
    return { ok: true, name: check.name };
}

// Merge `from` into `into` (both in the same list): trades with `from` get `into`
async function tagsMerge(a, from, into) {
    const n = tagsUsage(a, from);
    const snap = tagsSnapshot(a.key, true);
    const k = TAGS_KINDS[a.key];
    if (a.level === 'cat') {
        const cfg = tagsConfig(a.key);
        if (k.type === 'group') {
            const items = Array.isArray(cfg[into]) ? cfg[into] : (cfg[into] = []);
            (cfg[from] || []).forEach(x => { if (!items.includes(x)) items.push(x); });
        } else {
            const node = tagsIsObj(cfg[into]) ? cfg[into] : (cfg[into] = { sub1: [], sub2: [] });
            ['sub1', 'sub2'].forEach(l => { node[l] = node[l] || []; ((cfg[from] || {})[l] || []).forEach(x => { if (!node[l].includes(x)) node[l].push(x); }); });
        }
        delete cfg[from];
    } else {
        const list = tagsList(a);
        const i = list.indexOf(from);
        if (i >= 0) list.splice(i, 1);
    }
    const m = tagsMatcher(a, from);
    (appData.trades || []).forEach(t => { if (t && m.has(t)) m.map(t, into); });
    if (tagsForm) { const f = tagsForm.get(); if (f && m.has(f)) { m.map(f, into); tagsForm.set(f); } }
    tagsChartsRename(a, from, into);
    await tagsDone(snap, n ? `Merged “${from}” into ${into} in ${n} trade${n === 1 ? '' : 's'}.` : `Merged “${from}” into ${into}.`, { tradesChanged: n > 0 });
    return { ok: true };
}

// Remove from the list; trades keep what they have
async function tagsRemove(a, name) {
    const n = tagsUsage(a, name);
    const snap = tagsSnapshot(a.key, false);
    const k = TAGS_KINDS[a.key];
    let what = `“${name}”`;
    if (a.level === 'cat') {
        const cfg = tagsConfig(a.key);
        const inside = k.type === 'group' ? (cfg[name] || []).length : ((cfg[name] || {}).sub1 || []).length + ((cfg[name] || {}).sub2 || []).length;
        if (inside) what += ` and its ${inside} tag${inside === 1 ? '' : 's'}`;
        delete cfg[name];
    } else {
        const list = tagsList(a);
        const i = list.indexOf(name);
        if (i >= 0) list.splice(i, 1);
    }
    const where = tagsWhere(a);
    const keep = n ? ` ${n} trade${n === 1 ? ' keeps' : 's keep'} ${a.level === 'cat' && what.includes(' and its ') ? 'them' : 'it'}.` : '';
    await tagsDone(snap, `${what} removed${where ? ` from ${where}` : ''}.${keep}`);
}

// Reorder within a list (or the categories), to index `to`
async function tagsReorder(a, name, to) {
    const snap = tagsSnapshot(a.key, false);
    if (a.level === 'cat') {
        const cfg = tagsConfig(a.key), keys = Object.keys(cfg);
        const from = keys.indexOf(name);
        if (from < 0) return;
        keys.splice(from, 1);
        keys.splice(Math.max(0, Math.min(to, keys.length)), 0, name);
        const copy = {};
        keys.forEach(c => { copy[c] = cfg[c]; });
        Object.keys(cfg).forEach(c => delete cfg[c]);
        Object.assign(cfg, copy);
    } else {
        const list = tagsList(a), from = list.indexOf(name);
        if (from < 0) return;
        list.splice(from, 1);
        list.splice(Math.max(0, Math.min(to, list.length)), 0, name);
    }
    await tagsDone(snap, '');
}

// Move a tag to another category of a group (evidence, invalidation, setup); its trades move along
async function tagsMoveToCategory(key, name, fromCat, toCat, to) {
    if (fromCat === toCat) return tagsReorder({ key, level: 'gitem', cat: fromCat }, name, to);
    const cfg = tagsConfig(key);
    const target = Array.isArray(cfg[toCat]) ? cfg[toCat] : null;
    if (!target) return;
    if (tagsFindIn(target, name)) { showToast(`“${name}” is already in ${toCat}.`, 'error'); return; }
    const snap = tagsSnapshot(key, true);
    const src = cfg[fromCat] || [];
    const i = src.indexOf(name);
    if (i >= 0) src.splice(i, 1);
    target.splice(Math.max(0, Math.min(to == null ? target.length : to, target.length)), 0, name);
    const k = TAGS_KINDS[key];
    let n = 0;
    const move = t => {
        if (key === 'setup') {
            if (t.setup === name && (!t.setupCategory || t.setupCategory === fromCat)) { t.setupCategory = toCat; return true; }
            return false;
        }
        let hit = false;
        t[k.arr] = (Array.isArray(t[k.arr]) ? t[k.arr] : []).map(e => { if (e && e.primary === fromCat && (e.sub || '') === name) { hit = true; return { ...e, primary: toCat }; } return e; });
        return hit;
    };
    (appData.trades || []).forEach(t => { if (t && move(t)) n++; });
    if (tagsForm) { const f = tagsForm.get(); if (f && move(f)) tagsForm.set(f); }
    await tagsDone(snap, `“${name}” moved to ${toCat}${n ? ` with its ${n} trade${n === 1 ? '' : 's'}` : ''}.`, { tradesChanged: n > 0 });
}

// ---------- Tags that only live in older trades (Settings, 2026-11-15) ----------
// Values your trades use that are not in the list any more (removed, typos, older names).
// Nothing is stored: worked out from the trades. Entries: { a, name, label, n, id }

// The names at an address, without creating a missing category (tagsList would)
function tagsPeek(a) {
    const k = TAGS_KINDS[a.key], cfg = tagsSettings()[a.key];
    if (k.type === 'flat') return Array.isArray(cfg) ? cfg : [];
    if (!tagsIsObj(cfg)) return [];
    if (a.level === 'cat') return Object.keys(cfg);
    if (k.type === 'group') return Array.isArray(cfg[a.cat]) ? cfg[a.cat] : [];
    const node = cfg[a.cat];
    return tagsIsObj(node) && Array.isArray(node[a.level]) ? node[a.level] : [];
}

function tagsOldValues(key) {
    const k = TAGS_KINDS[key];
    const found = new Map();
    const has = (a, name) => tagsPeek(a).includes(name) && (a.level === 'cat' || a.level === 'item' || tagsPeek({ key, level: 'cat' }).includes(a.cat));
    const add = (t, a, name, label, seen) => {
        if (!name || has(a, name)) return;
        const id = `${a.level}|${a.cat || ''}|${name}`;
        if (seen.has(id)) return;
        seen.add(id);
        const e = found.get(id) || { a, name, label, n: 0, id };
        e.n++;
        found.set(id, e);
    };
    (appData.trades || []).forEach(t => {
        if (!t) return;
        const seen = new Set();
        if (k.type === 'flat') {
            (k.multi ? (Array.isArray(t[key]) ? t[key] : []) : [t[key]]).forEach(v => { if (typeof v === 'string') add(t, { key, level: 'item' }, v, v, seen); });
        } else if (key === 'setup') {
            if (!t.setup) return;
            const c = t.setupCategory || tagsSetupCategoryOf(t.setup);
            add(t, { key, level: 'gitem', cat: c }, t.setup, c ? `${c} › ${t.setup}` : t.setup, seen);
        } else if (k.type === 'group') {
            (Array.isArray(t[k.arr]) ? t[k.arr] : []).forEach(e => {
                if (!e || !e.primary) return;
                if (e.sub) add(t, { key, level: 'gitem', cat: e.primary }, e.sub, `${e.primary} › ${e.sub}`, seen);
                else add(t, { key, level: 'cat' }, e.primary, e.primary, seen);
            });
        } else {
            const paths = k.arr ? (Array.isArray(t[k.arr]) ? t[k.arr] : []).map(l => l && [l.primary, l.sub1, l.sub2]) : [[t.target, t.targetSub1, t.targetSub2]];
            paths.forEach(path => {
                if (!path || !path[0]) return;
                const [p, s1, s2] = path;
                if (!s1 && !s2) add(t, { key, level: 'cat' }, p, p, seen);
                if (s1) add(t, { key, level: 'sub1', cat: p }, s1, `${p} › ${s1}`, seen);
                if (s2) add(t, { key, level: 'sub2', cat: p }, s2, `${p} › ${s2}`, seen);
            });
        }
    });
    return [...found.values()].sort((x, y) => (y.n - x.n) || x.label.localeCompare(y.label));
}

// Put an old tag back in its list (its category comes back too when it is gone)
async function tagsAddBack(e) {
    const k = TAGS_KINDS[e.a.key];
    // Only the upper / lower case differs from a tag in the list: fold it into that one
    const twin = (e.a.level === 'cat' || e.a.level === 'item' || tagsPeek({ key: e.a.key, level: 'cat' }).includes(e.a.cat)) && tagsPeek(e.a).find(x => tagsSame(x, e.name));
    if (twin) return tagsMerge(e.a, e.name, twin);
    const snap = tagsSnapshot(e.a.key, false);
    let a = e.a;
    if (k.type !== 'flat' && a.level !== 'cat') {
        let cat = a.cat;
        if (!cat) { // a setup without any category: the first one, or a new “Setups”
            const cats = Object.keys(tagsConfig(a.key));
            cat = cats[0] || 'Setups';
        }
        cat = tagsAdd({ key: a.key, level: 'cat' }, cat).name || cat;
        a = { ...a, cat };
    }
    tagsAdd(a, e.name);
    const where = a.level === 'cat' ? '' : (k.type === 'flat' ? (k.label.charAt(0).toUpperCase() + k.label.slice(1)) : tagsWhere(a));
    await tagsDone(snap, `“${e.name}” is back${where ? ` in ${where}` : ' in your list'}.`);
}

// Rename an old tag in the trades only (it stays out of the list)
async function tagsRenameOld(e, rawNew) {
    const name = tagsClean(rawNew);
    if (!name || name === e.name) return { same: true };
    const into = tagsPeek(e.a).find(x => tagsSame(x, name));
    if (into && (e.a.level === 'cat' || e.a.level === 'item' || tagsPeek({ key: e.a.key, level: 'cat' }).includes(e.a.cat))) return { conflict: into };
    const snap = tagsSnapshot(e.a.key, true);
    const m = tagsMatcher(e.a, e.name);
    let n = 0;
    (appData.trades || []).forEach(t => { if (t && m.has(t)) { m.map(t, name); n++; } });
    if (tagsForm) { const f = tagsForm.get(); if (f && m.has(f)) { m.map(f, name); tagsForm.set(f); } }
    tagsChartsRename(e.a, e.name, name);
    await tagsDone(snap, `Renamed “${e.name}” to “${name}” in ${n} trade${n === 1 ? '' : 's'}.`, { tradesChanged: n > 0 });
    return { ok: true };
}

// ---------- Find ----------
// The words of a label start with the typed letters (“fr” finds Tilted / Frustrated)
function tagsMatches(label, q) {
    q = tagsClean(q).toLocaleLowerCase();
    if (!q) return 0;
    const l = String(label).toLocaleLowerCase();
    if (l.startsWith(q)) return 2;
    const words = l.split(/[\s/›\-–(),.+]+/).filter(Boolean);
    if (words.some(w => w.startsWith(q))) return 1;
    return l.includes(' ' + q) || l.includes('/' + q) ? 1 : 0;
}

// ======================================================================
// Part 2: shared pieces of the page
// ======================================================================

const TAGS_ICONS = {
    plus: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    pen: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    search: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    x: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>'
};

function tagsEl(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
}

// ---------- Hover label: how many trades use a tag ----------
let tagsTipEl = null, tagsTipTimer = null, tagsTipFor = null;
function tagsTipHide() {
    clearTimeout(tagsTipTimer);
    tagsTipFor = null;
    if (tagsTipEl) tagsTipEl.classList.remove('is-on');
}
function tagsTipShow(target, text) {
    if (!target.isConnected) return;
    if (!tagsTipEl) {
        tagsTipEl = tagsEl('div', 'tags-tip');
        tagsTipEl.setAttribute('role', 'tooltip');
        tagsTipEl.id = 'tags-tip';
        document.body.appendChild(tagsTipEl);
    }
    tagsTipEl.textContent = text;
    tagsTipEl.classList.add('is-on');
    const r = target.getBoundingClientRect(), w = tagsTipEl.offsetWidth, h = tagsTipEl.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const top = r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8;
    tagsTipEl.style.left = `${left}px`;
    tagsTipEl.style.top = `${top}px`;
    tagsTipEl.classList.toggle('is-below', r.top - h - 8 < 8);
    tagsTipEl.style.setProperty('--tip-x', `${r.left + r.width / 2 - left}px`);
}
// el shows the label after 0.3 s on hover or keyboard focus; textFn() is asked each time
function tagsTipAttach(el, textFn) {
    const show = () => {
        clearTimeout(tagsTipTimer);
        tagsTipFor = el;
        tagsTipTimer = setTimeout(() => { if (tagsTipFor === el && !document.querySelector('.tags-dragging')) tagsTipShow(el, textFn()); }, 300);
    };
    el.addEventListener('mouseenter', show);
    el.addEventListener('focus', () => { if (el.matches(':focus-visible')) show(); });
    ['mouseleave', 'blur', 'mousedown', 'dragstart', 'keydown'].forEach(ev => el.addEventListener(ev, tagsTipHide));
}
window.addEventListener('scroll', tagsTipHide, true);

// ---------- + chip that opens a field in its row ----------
// opts: { label (aria), onAdd(names[], how) → Promise, keepOpen (Enter keeps the field open), placeholder }
function tagsAddChip(opts) {
    const wrap = tagsEl('span', 'tags-add-wrap');
    const btn = tagsEl('button', 'tags-add');
    btn.type = 'button';
    btn.innerHTML = TAGS_ICONS.plus;
    btn.setAttribute('aria-label', opts.label);
    btn.title = opts.label;
    if (opts.focusId) { btn.dataset.tagsFocus = opts.focusId; btn.dataset.chipId = opts.focusId; }
    wrap.appendChild(btn);
    let field = null;
    const close = (refocus) => {
        if (!field) return;
        field.remove(); field = null;
        btn.hidden = false;
        if (refocus) btn.focus();
    };
    const open = () => {
        if (field) return;
        btn.hidden = true;
        field = tagsField({
            placeholder: opts.placeholder || 'New tag',
            label: opts.label,
            focusId: opts.focusId ? opts.focusId + '::field' : '',
            onCommit: async (value, how) => {
                const names = tagsSplit(value);
                if (!names.length) { if (how === 'enter') close(true); return; }
                const keep = how === 'comma' || opts.keepOpen;
                await opts.onAdd(names, how);
                if (keep && field && field.isConnected) { field.querySelector('input').value = ''; field.querySelector('input').focus(); }
            },
            onCancel: () => close(true),
            onBlur: () => close(false)
        });
        wrap.appendChild(field);
        field.querySelector('input').focus();
    };
    btn.addEventListener('click', open);
    wrap.tagsOpen = open;
    return wrap;
}

// A pill-shaped text field with an Enter key hint
// opts: { value, placeholder, label, onCommit(value, 'enter'|'comma'|'blur'), onCancel(), onBlur(), commitOnBlur, focusId, width }
function tagsField(opts) {
    const box = tagsEl('span', 'tags-field');
    const input = tagsEl('input');
    input.type = 'text';
    input.value = opts.value || '';
    input.placeholder = opts.placeholder || '';
    input.setAttribute('aria-label', opts.label || opts.placeholder || 'Name');
    input.autocomplete = 'off';
    input.spellcheck = false;
    if (opts.focusId) { input.dataset.tagsFocus = opts.focusId; input.dataset.chipId = opts.focusId; }
    input.size = Math.max(8, Math.min(28, (opts.value || opts.placeholder || '').length + 2));
    const hint = tagsEl('span', 'tags-key', 'Enter');
    box.appendChild(input);
    box.appendChild(hint);
    let busy = false, done = false;
    const commit = async (value, how) => {
        if (busy || done) return;
        busy = true;
        try { await opts.onCommit(value, how); } finally { busy = false; }
    };
    input.addEventListener('input', e => {
        e.stopPropagation(); // typing a name is not a change to the trade
        input.size = Math.max(8, Math.min(28, input.value.length + 2));
        if (opts.noComma || !input.value.includes(',')) return;
        // Comma adds what is before it; a pasted “a, b, c” adds all of it
        const v = input.value;
        const pasted = e.inputType === 'insertFromPaste';
        const cut = pasted ? v.length : v.lastIndexOf(',');
        const now = v.slice(0, cut), rest = pasted ? '' : v.slice(cut + 1);
        input.value = rest.trimStart();
        if (tagsClean(now.replace(/,/g, ''))) commit(now, 'comma');
    });
    input.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.isComposing) return;
        if (e.key === 'Enter') { e.preventDefault(); commit(input.value, 'enter'); }
        else if (e.key === 'Escape') { e.preventDefault(); done = true; opts.onCancel && opts.onCancel(); }
    });
    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (done || !box.isConnected || box.contains(document.activeElement)) return;
            if (opts.commitOnBlur && input.value.trim()) { commit(input.value, 'blur'); return; }
            done = true;
            opts.onBlur && opts.onBlur();
        }, 0);
    });
    box.tagsInput = input;
    box.tagsFinish = () => { done = true; };
    box.tagsCancel = () => { if (done) return; done = true; opts.onCancel && opts.onCancel(); };
    return box;
}

// The question inside a section (no popup)
function tagsConfirm(text, yesText, onYes, onNo, opts = {}) {
    const box = tagsEl('div', 'tags-confirm');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', text);
    box.appendChild(tagsEl('span', 'tags-confirm-text', text));
    const yes = tagsEl('button', opts.primary ? 'btn-primary btn-sm' : 'tags-danger btn-sm', yesText);
    yes.type = 'button';
    const no = tagsEl('button', 'btn-secondary btn-sm', opts.noText || 'Keep');
    no.type = 'button';
    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
    box.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onNo(); } });
    box.appendChild(yes);
    box.appendChild(no);
    box.tagsYes = yes;
    return box;
}

// ---------- The editor (Settings, and Add Trade after the pencil) ----------
// Renders every list of one section with chips you can rename, drag and remove.
// opts: { query, place: 'settings' | 'form', onChange() }

const tagsEditorState = new WeakMap(); // container → { renaming: {id}, confirm: {id}, catField }

function tagsEditor(container, key, opts = {}) {
    const k = TAGS_KINDS[key];
    const st = tagsEditorState.get(container) || {};
    tagsEditorState.set(container, st);
    const rerender = () => tagsEditor(container, key, opts);
    const active = document.activeElement;
    const focusId = active && container.contains(active) ? active.dataset.tagsFocus : null;
    container.innerHTML = '';
    container.classList.add('tags-editor');
    const q = tagsClean(opts.query || '');
    const used = tagsUsageIndex(key);

    let drag = null; // { a, name }

    const chip = (a, name) => {
        const id = `${a.key}|${a.level}|${a.cat || ''}|${name}`;
        const wrap = tagsEl('span', 'tags-chip');
        wrap.dataset.tagName = name;
        if (q && !tagsMatches(name, q) && !(a.cat && tagsMatches(a.cat, q))) wrap.hidden = true;
        if (st.renaming === id) {
            const n = tagsUsage(a, name);
            const f = tagsField({
                value: name, label: `Rename ${name}`, focusId: id + '::rename', commitOnBlur: true, noComma: true,
                onCommit: async (value) => {
                    const check = tagsRenameCheck(a, name, value);
                    if (check.same) { st.renaming = null; f.tagsFinish(); rerender(); focusBack(id); return; }
                    if (check.conflict) { st.confirm = { id, a, from: name, into: check.conflict }; f.tagsFinish(); rerender(); return; }
                    st.renaming = null; f.tagsFinish();
                    await tagsRename(a, name, value);
                    focusBack(`${a.key}|${a.level}|${a.cat || ''}|${check.name}`);
                },
                onCancel: () => { st.renaming = null; rerender(); focusBack(id); },
                onBlur: () => { st.renaming = null; rerender(); }
            });
            wrap.appendChild(f);
            if (n) {
                const h = tagsEl('span', 'tags-rename-hint', `Also renamed in the ${n} trade${n === 1 ? '' : 's'} that use${n === 1 ? 's' : ''} it`);
                wrap.appendChild(h);
                wrap.classList.add('has-hint');
            }
            return wrap;
        }
        const grip = tagsEl('span', 'tags-grip');
        grip.innerHTML = typeof DRAG_ICON_SVG !== 'undefined' ? DRAG_ICON_SVG : '⋮⋮';
        grip.setAttribute('aria-hidden', 'true');
        grip.title = 'Drag to move';
        const nameBtn = tagsEl('button', 'tags-chip-name', name);
        nameBtn.type = 'button';
        nameBtn.dataset.tagsFocus = id;
        nameBtn.setAttribute('aria-label', `${name}, ${tagsTradesText(used(a, name)).replace('Not used in any trade', 'not used yet')}. Enter to rename, Delete to remove`);
        nameBtn.title = 'Click to rename';
        const rm = tagsEl('button', 'tags-chip-x');
        rm.type = 'button';
        rm.innerHTML = TAGS_ICONS.x;
        rm.setAttribute('aria-label', `Remove ${name} from the list`);
        rm.dataset.tagsFocus = id + '::x';
        wrap.append(grip, nameBtn, rm);
        tagsTipAttach(nameBtn, () => tagsTradesText(tagsUsage(a, name)));
        nameBtn.addEventListener('click', () => { st.renaming = id; st.confirm = null; rerender(); });
        rm.addEventListener('click', () => removeTag(a, name, id));
        nameBtn.addEventListener('keydown', e => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); e.stopPropagation(); removeTag(a, name, id); }
            else if (e.altKey && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
                e.preventDefault(); e.stopPropagation();
                const list = tagsList(a), i = list.indexOf(name), to = i + (e.code === 'ArrowLeft' ? -1 : 1);
                if (i < 0 || to < 0 || to >= list.length) return;
                tagsReorder(a, name, to).then(() => focusBack(id));
            }
        });
        // Drag by the grip
        grip.addEventListener('mousedown', () => { wrap.draggable = true; });
        wrap.addEventListener('mouseup', () => { wrap.draggable = false; });
        wrap.addEventListener('dragstart', e => {
            drag = { a, name };
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', name); } catch (err) { /* ok */ }
            tagsTipHide();
            setTimeout(() => wrap.classList.add('tags-dragging'), 0);
        });
        wrap.addEventListener('dragend', () => { wrap.draggable = false; drag = null; wrap.classList.remove('tags-dragging'); container.querySelectorAll('.tags-drop').forEach(x => x.classList.remove('tags-drop')); });
        wrap.addEventListener('dragover', e => {
            if (!drag || drag.name === name && drag.a.cat === a.cat) return;
            if (!sameList(drag.a, a) && !canMoveTo(drag.a, a)) return;
            e.preventDefault();
            wrap.classList.add('tags-drop');
        });
        wrap.addEventListener('dragleave', () => wrap.classList.remove('tags-drop'));
        wrap.addEventListener('drop', e => {
            wrap.classList.remove('tags-drop');
            if (!drag || !(sameList(drag.a, a) || canMoveTo(drag.a, a))) return;
            e.preventDefault(); e.stopPropagation();
            const d = drag; drag = null;
            const to = tagsList(a).indexOf(name);
            if (sameList(d.a, a)) { if (d.name !== name) tagsReorder(d.a, d.name, to); }
            else tagsMoveToCategory(key, d.name, d.a.cat, a.cat, to);
        });
        return wrap;
    };
    const sameList = (x, y) => x.level === y.level && (x.cat || '') === (y.cat || '');
    const canMoveTo = (x, y) => k.type === 'group' && x.level === 'gitem' && y.level === 'gitem' && x.cat !== y.cat;
    const focusBack = id => {
        setTimeout(() => {
            const el = container.querySelector(`[data-tags-focus="${CSS.escape(id)}"]`);
            if (el) el.focus();
        }, 0);
    };

    const removeTag = async (a, name, id) => {
        const list = tagsList(a);
        const i = list.indexOf(name);
        const next = list[i + 1] || list[i - 1];
        await tagsRemove(a, name);
        if (next) focusBack(`${a.key}|${a.level}|${a.cat || ''}|${next}`);
    };

    const addChip = (a, label) => tagsAddChip({
        label, keepOpen: true, placeholder: a.level === 'cat' ? 'Category name' : 'New tag', focusId: `add|${a.key}|${a.level}|${a.cat || ''}`,
        onAdd: async names => {
            const snap = tagsSnapshot(key, false);
            const added = [], existing = [];
            names.forEach(n => { const r = tagsAdd(a, n); (r.added ? added : existing).push(r.name); });
            if (existing.length && !added.length) {
                await tagsDone(snap, '');
                existing.forEach(n => { const el = container.querySelector(`[data-tag-name="${CSS.escape(n)}"]`); if (el) { el.classList.remove('tags-blink'); void el.offsetWidth; el.classList.add('tags-blink'); } });
                return;
            }
            const where = tagsWhere(a);
            await tagsDone(snap, added.length === 1 ? `“${added[0]}” added${where ? ` to ${where}` : ''}.` : `${added.length} tags added${where ? ` to ${where}` : ''}.`);
            const again = container.querySelector(`[data-tags-focus="${CSS.escape(`add|${a.key}|${a.level}|${a.cat || ''}`)}"]`);
            if (again && again.parentElement && again.parentElement.tagsOpen) again.parentElement.tagsOpen();
        }
    });

    const row = (a, names, label) => {
        const r = tagsEl('div', 'tags-row');
        r.dataset.tagsRow = `${a.level}|${a.cat || ''}`;
        names.forEach(n => r.appendChild(chip(a, n)));
        r.appendChild(addChip(a, label));
        // Drop on the empty part of a row: to the end
        r.addEventListener('dragover', e => { if (drag && (sameList(drag.a, a) || canMoveTo(drag.a, a))) e.preventDefault(); });
        r.addEventListener('drop', e => {
            if (!drag || !(sameList(drag.a, a) || canMoveTo(drag.a, a))) return;
            e.preventDefault(); e.stopPropagation();
            const d = drag; drag = null;
            if (sameList(d.a, a)) tagsReorder(d.a, d.name, tagsList(a).length - 1);
            else if (canMoveTo(d.a, a)) tagsMoveToCategory(key, d.name, d.a.cat, a.cat, null);
        });
        return r;
    };

    const catChip = (cat) => {
        const a = { key, level: 'cat' };
        const id = `${key}|cat||${cat}`;
        const box = tagsEl('div', 'tags-cat');
        box.dataset.tagName = cat;
        if (st.renaming === id) {
            const n = tagsUsage(a, cat);
            const f = tagsField({
                value: cat, label: `Rename the category ${cat}`, focusId: id + '::rename', commitOnBlur: true, noComma: true,
                onCommit: async value => {
                    const check = tagsRenameCheck(a, cat, value);
                    if (check.same) { st.renaming = null; f.tagsFinish(); rerender(); focusBack(id); return; }
                    if (check.conflict) { st.confirm = { id, a, from: cat, into: check.conflict }; f.tagsFinish(); rerender(); return; }
                    st.renaming = null; f.tagsFinish();
                    await tagsRename(a, cat, value);
                    focusBack(`${key}|cat||${check.name}`);
                },
                onCancel: () => { st.renaming = null; rerender(); focusBack(id); },
                onBlur: () => { st.renaming = null; rerender(); }
            });
            box.appendChild(f);
            if (n) box.appendChild(tagsEl('span', 'tags-rename-hint', `Also renamed in the ${n} trade${n === 1 ? '' : 's'} that use${n === 1 ? 's' : ''} it`));
            return box;
        }
        const grip = tagsEl('span', 'tags-grip');
        grip.innerHTML = typeof DRAG_ICON_SVG !== 'undefined' ? DRAG_ICON_SVG : '⋮⋮';
        grip.setAttribute('aria-hidden', 'true');
        grip.title = 'Drag to reorder';
        const nameBtn = tagsEl('button', 'tags-cat-name', cat);
        nameBtn.type = 'button';
        nameBtn.dataset.tagsFocus = id;
        nameBtn.title = 'Click to rename';
        nameBtn.setAttribute('aria-label', `Category ${cat}. Enter to rename, Delete to remove`);
        const rm = tagsEl('button', 'tags-chip-x delete-level-1');
        rm.type = 'button';
        rm.innerHTML = TAGS_ICONS.x;
        rm.setAttribute('aria-label', `Remove the category ${cat}`);
        box.append(grip, nameBtn, rm);
        tagsTipAttach(nameBtn, () => { const n = tagsUsage(a, cat); return n ? `${tagsTradesText(n)} use this category` : 'Not used in any trade'; });
        nameBtn.addEventListener('click', () => { st.renaming = id; st.confirm = null; rerender(); });
        const askRemove = () => {
            const cfg = tagsConfig(key);
            const inside = k.type === 'group' ? (cfg[cat] || []).length : ((cfg[cat] || {}).sub1 || []).length + ((cfg[cat] || {}).sub2 || []).length;
            if (!inside) { tagsRemove(a, cat); return; }
            st.confirm = { id, a, remove: cat };
            rerender();
        };
        rm.addEventListener('click', askRemove);
        nameBtn.addEventListener('keydown', e => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); e.stopPropagation(); askRemove(); }
            else if (e.altKey && (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
                e.preventDefault(); e.stopPropagation();
                const keys = Object.keys(tagsConfig(key)), i = keys.indexOf(cat), to = i + (e.code === 'ArrowUp' || e.code === 'ArrowLeft' ? -1 : 1);
                if (i < 0 || to < 0 || to >= keys.length) return;
                tagsReorder(a, cat, to).then(() => focusBack(id));
            }
        });
        grip.addEventListener('mousedown', () => { box.closest('.tags-group').draggable = true; });
        return box;
    };

    const confirmFor = (id) => {
        const c = st.confirm;
        if (!c || c.id !== id) return null;
        const close = () => { st.confirm = null; rerender(); focusBack(id); };
        if (c.remove) {
            const cfg = tagsConfig(key), a = c.a, name = c.remove;
            const n = tagsUsage(a, name);
            let text;
            if (k.type === 'group') {
                const m = (cfg[name] || []).length;
                text = `Remove ${name} and its ${m} tag${m === 1 ? '' : 's'} from the list?`;
            } else {
                const s1 = ((cfg[name] || {}).sub1 || []).length, s2 = ((cfg[name] || {}).sub2 || []).length;
                text = `Remove ${name} and its ${s1 + s2} level item${s1 + s2 === 1 ? '' : 's'} (${s1} on level 1, ${s2} on level 2) from the list?`;
            }
            if (n) text += ` The ${n} trade${n === 1 ? '' : 's'} that use${n === 1 ? 's' : ''} ${k.type === 'group' ? 'them keep them' : 'them keep them'}.`;
            const box = tagsConfirm(text, 'Remove', async () => { st.confirm = null; await tagsRemove(a, name); }, close);
            setTimeout(() => box.tagsYes.focus(), 0);
            return box;
        }
        const n = tagsUsage(c.a, c.from);
        const text = `“${c.into}” already exists. Merge “${c.from}” into ${c.into}?${n ? ` The ${n} trade${n === 1 ? '' : 's'} with ${c.from} get${n === 1 ? 's' : ''} ${c.into}.` : ''}`;
        const box = tagsConfirm(text, 'Merge', async () => { st.confirm = null; await tagsMerge(c.a, c.from, c.into); focusBack(`${c.a.key}|${c.a.level}|${c.a.cat || ''}|${c.into}`); }, close, { primary: true, noText: 'Cancel' });
        setTimeout(() => box.tagsYes.focus(), 0);
        return box;
    };

    const label = TAGS_KINDS[key].label;
    if (k.type === 'flat') {
        const a = { key, level: 'item' };
        const names = tagsList(a);
        container.appendChild(row(a, names, `Add a ${label}`));
        names.forEach(n => { const c = confirmFor(`${key}|item||${n}`); if (c) container.appendChild(c); });
    } else {
        const cfg = tagsConfig(key);
        Object.keys(cfg).forEach(cat => {
            const g = tagsEl('div', 'tags-group' + (k.type === 'tree' ? ' is-tree' : ''));
            g.dataset.tagsCat = cat;
            const catHit = !q || tagsMatches(cat, q);
            const left = tagsEl('div', 'tags-group-cat');
            left.appendChild(catChip(cat));
            g.appendChild(left);
            const right = tagsEl('div', 'tags-group-items');
            let anyHit = catHit;
            if (k.type === 'group') {
                const a = { key, level: 'gitem', cat };
                const names = tagsList(a);
                if (q && names.some(n => tagsMatches(n, q))) anyHit = true;
                right.appendChild(row(a, names, `Add to ${cat}`));
                names.forEach(n => { const c = confirmFor(`${key}|gitem|${cat}|${n}`); if (c) right.appendChild(c); });
            } else {
                ['sub1', 'sub2'].forEach(level => {
                    const a = { key, level, cat };
                    const names = tagsList(a);
                    if (q && names.some(n => tagsMatches(n, q))) anyHit = true;
                    const lv = tagsEl('div', 'tags-level');
                    lv.appendChild(tagsEl('span', 'tags-level-label', level === 'sub1' ? 'Level 1' : 'Level 2'));
                    lv.appendChild(row(a, names, `Add to ${cat}, level ${level === 'sub1' ? 1 : 2}`));
                    right.appendChild(lv);
                    names.forEach(n => { const c = confirmFor(`${key}|${level}|${cat}|${n}`); if (c) right.appendChild(c); });
                });
            }
            const cc = confirmFor(`${key}|cat||${cat}`);
            if (cc) right.appendChild(cc);
            g.appendChild(right);
            if (q && !anyHit) g.hidden = true;
            // Drag a category by its grip
            g.addEventListener('dragstart', e => {
                if (!g.draggable) return;
                drag = { a: { key, level: 'cat' }, name: cat };
                e.dataTransfer.effectAllowed = 'move';
                try { e.dataTransfer.setData('text/plain', cat); } catch (err) { /* ok */ }
                tagsTipHide();
                setTimeout(() => g.classList.add('tags-dragging'), 0);
            });
            g.addEventListener('dragend', () => { g.draggable = false; drag = null; g.classList.remove('tags-dragging'); container.querySelectorAll('.tags-drop').forEach(x => x.classList.remove('tags-drop')); });
            g.addEventListener('mouseup', () => { g.draggable = false; });
            g.addEventListener('dragover', e => { if (drag && drag.a.level === 'cat' && drag.name !== cat) { e.preventDefault(); g.classList.add('tags-drop'); } });
            g.addEventListener('dragleave', e => { if (!g.contains(e.relatedTarget)) g.classList.remove('tags-drop'); });
            g.addEventListener('drop', e => {
                if (!drag || drag.a.level !== 'cat') return;
                e.preventDefault();
                g.classList.remove('tags-drop');
                const d = drag; drag = null;
                tagsReorder({ key, level: 'cat' }, d.name, Object.keys(tagsConfig(key)).indexOf(cat));
            });
            container.appendChild(g);
        });
        // Add a category: asks for the name straight away
        const addCat = tagsEl('div', 'tags-add-cat');
        const a = { key, level: 'cat' };
        const btn = tagsEl('button', 'tags-add has-label');
        btn.type = 'button';
        btn.innerHTML = `${TAGS_ICONS.plus}<span>Add category</span>`;
        btn.setAttribute('aria-label', 'Add a category');
        btn.dataset.tagsFocus = `addcat|${key}`;
        addCat.appendChild(btn);
        const hint = tagsEl('span', 'tags-add-cat-hint', 'Name the category and press Enter. It becomes a new row with its own + chip, ready for the first tag.');
        const openCat = () => {
            btn.hidden = true;
            const f = tagsField({
                placeholder: 'Category name', label: 'Name of the new category', focusId: `addcat|${key}::field`, noComma: true,
                onCommit: async value => {
                    const name = tagsClean(value);
                    if (!name) { f.tagsFinish(); rerender(); focusBack(`addcat|${key}`); return; }
                    const snap = tagsSnapshot(key, false);
                    const r = tagsAdd(a, name);
                    f.tagsFinish();
                    if (!r.added) { await tagsDone(snap, ''); showToast(`The category “${r.name}” already exists.`, 'info'); return; }
                    await tagsDone(snap, `Category “${r.name}” added.`);
                    // The new row's + chip opens for the first tag
                    setTimeout(() => {
                        const lvl = k.type === 'group' ? 'gitem' : 'sub1';
                        const plus = container.querySelector(`[data-tags-focus="${CSS.escape(`add|${key}|${lvl}|${r.name}`)}"]`);
                        if (plus && plus.parentElement.tagsOpen) plus.parentElement.tagsOpen();
                    }, 0);
                },
                onCancel: () => { rerender(); focusBack(`addcat|${key}`); },
                onBlur: () => { rerender(); }
            });
            addCat.insertBefore(f, btn);
            addCat.appendChild(hint);
            addCat.classList.add('is-open');
            f.tagsInput.focus();
        };
        btn.addEventListener('click', openCat);
        container.appendChild(addCat);
    }

    if (focusId) {
        const again = container.querySelector(`[data-tags-focus="${CSS.escape(focusId)}"]`);
        if (again) again.focus();
    }
    // A rename field that is open gets the focus and selects its text
    const renaming = container.querySelector('.tags-chip .tags-field input, .tags-cat .tags-field input');
    if (renaming && st.renaming && document.activeElement !== renaming) { renaming.focus(); renaming.select(); }
}

// Esc inside a tag field, a question or the Find field (Add Trade catches Esc first): true = handled
function tagsEscape() {
    const a = document.activeElement;
    if (!a) return false;
    const field = a.closest && a.closest('.tags-field');
    if (field && field.tagsCancel) { field.tagsCancel(); return true; }
    const q = a.closest && a.closest('.tags-confirm');
    if (q) { const no = q.querySelector('.btn-secondary'); if (no) no.click(); return true; }
    if (a.classList && a.classList.contains('tags-find-input') && a.value) {
        a.value = '';
        a.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    }
    return false;
}

// ---------- Settings: the line “Only in older trades” under a list ----------
// state: { all (show all), renaming (id), confirm: { e, into } }
const TAGS_OLD_SHOW = 12;
function tagsOldLine(container, key, state, opts = {}) {
    container.querySelectorAll(':scope > .tags-old').forEach(x => x.remove());
    const q = tagsClean(opts.query || '');
    let list = tagsOldValues(key);
    if (q) list = list.filter(e => tagsMatches(e.label, q) || tagsMatches(e.name, q));
    if (!list.length) return;
    const rerender = () => tagsOldLine(container, key, state, opts);
    const box = tagsEl('div', 'tags-old');
    box.appendChild(tagsEl('span', 'tags-old-title', 'Only in older trades · not in your list'));
    const row = tagsEl('div', 'tags-old-row');
    const shown = state.all || q ? list : list.slice(0, TAGS_OLD_SHOW);
    const focusBack = id => setTimeout(() => { const el = container.querySelector(`[data-tags-focus="${CSS.escape(id)}"]`); if (el) el.focus(); }, 0);
    shown.forEach((e, i) => {
        const chip = tagsEl('span', 'tags-old-chip');
        chip.dataset.oldId = e.id;
        if (state.renaming === e.id) {
            const f = tagsField({
                value: e.name, label: `Rename ${e.name} in your trades`, focusId: 'old|' + e.id + '::rename', noComma: true,
                onCommit: async value => {
                    const r = await tagsRenameOld(e, value);
                    f.tagsFinish();
                    if (r.conflict) { state.renaming = null; state.confirm = { e, into: r.conflict }; rerender(); return; }
                    state.renaming = null;
                    if (r.same) { rerender(); focusBack('old|' + e.id); }
                },
                onCancel: () => { state.renaming = null; rerender(); focusBack('old|' + e.id); },
                onBlur: () => { state.renaming = null; rerender(); }
            });
            chip.classList.add('is-renaming');
            chip.appendChild(f);
            row.appendChild(chip);
            setTimeout(() => { f.tagsInput.focus(); f.tagsInput.select(); }, 0);
            return;
        }
        const name = tagsEl('button', 'tags-old-name');
        name.type = 'button';
        name.dataset.tagsFocus = 'old|' + e.id;
        if (e.label !== e.name) {
            name.appendChild(tagsEl('span', 'tags-old-cat', e.label.slice(0, e.label.length - e.name.length)));
        }
        name.appendChild(document.createTextNode(e.name));
        name.title = 'Click to rename it in your trades';
        name.setAttribute('aria-label', `${e.label}, ${tagsTradesText(e.n).toLowerCase()}, not in your list. Enter to rename it in your trades`);
        tagsTipAttach(name, () => tagsTradesText(e.n));
        name.addEventListener('click', () => { state.renaming = e.id; state.confirm = null; rerender(); });
        const back = tagsEl('button', 'tags-old-back');
        back.type = 'button';
        back.innerHTML = `${TAGS_ICONS.plus}<span>Add back</span>`;
        back.dataset.tagsFocus = 'oldback|' + e.id;
        back.setAttribute('aria-label', `Add ${e.label} back to your list`);
        back.addEventListener('click', async () => {
            const next = shown[i + 1] || shown[i - 1];
            await tagsAddBack(e);
            if (next) focusBack('oldback|' + next.id);
        });
        chip.append(name, back);
        row.appendChild(chip);
    });
    if (!state.all && !q && list.length > TAGS_OLD_SHOW) {
        const more = tagsEl('button', 'chip chip-more', `Show ${list.length - TAGS_OLD_SHOW} more`);
        more.type = 'button';
        more.addEventListener('click', () => { state.all = true; rerender(); });
        row.appendChild(more);
    }
    box.appendChild(row);
    const c = state.confirm;
    if (c && list.some(x => x.id === c.e.id)) {
        const n = c.e.n;
        const q2 = tagsConfirm(`“${c.into}” is in your list. Merge “${c.e.name}” into ${c.into}? The ${n} trade${n === 1 ? '' : 's'} with ${c.e.name} get${n === 1 ? 's' : ''} ${c.into}.`, 'Merge',
            async () => { state.confirm = null; await tagsMerge(c.e.a, c.e.name, c.into); },
            () => { state.confirm = null; rerender(); focusBack('old|' + c.e.id); },
            { primary: true, noText: 'Cancel' });
        box.appendChild(q2);
        setTimeout(() => q2.tagsYes.focus(), 0);
    }
    container.appendChild(box);
}
