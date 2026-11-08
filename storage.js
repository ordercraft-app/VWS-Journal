// --- IndexedDB Setup ---

const DB_NAME = 'VWAPAppDB';
const STORE_NAME = 'fileStore';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e);
    });
}

async function saveHandleToDB(handle) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(handle, 'journalDirHandle'); 
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e);
    });
}

async function getHandleFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get('journalDirHandle');
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e);
    });
}

async function verifyPermission(dirHandle, readWrite = true) {
    const opts = { mode: readWrite ? 'readwrite' : 'read' };
    if ((await dirHandle.queryPermission(opts)) === 'granted') {
        return true;
    }
    if ((await dirHandle.requestPermission(opts)) === 'granted') {
        return true;
    }
    return false;
}


// --- Data Loading ---

// Setup used to be one flat list; it is now grouped in categories
// (like Evidence). Known core setups go to "Core setup", the rest to "Advanced setup".
const CORE_SETUP_NAMES = ['price discovery continuation', 'fade value area extremes', 'return to value', 'vwap bounce'];

// Setup names in American title case. Old spellings are renamed in the
// settings and in every saved trade, so stats keep counting them together.
const SETUP_RENAMES = {
    'Fade value area extremes': 'Fade Value Area Extremes',
    'Return to value': 'Return to Value',
    'VWAP/POC Scalpes in balance': 'VWAP/POC Scalps in Balance',
    'Inside HTF balance fades': 'Inside HTF Balance Fades',
    'IB Extension fades': 'IB Extension Fades'
};

function renameSetups() {
    const rename = name => SETUP_RENAMES[name] || name;
    const cfg = appData.settings.setup;
    if (cfg && !Array.isArray(cfg)) {
        Object.keys(cfg).forEach(cat => {
            if (!Array.isArray(cfg[cat])) return;
            // Rename and drop duplicates if both spellings existed
            cfg[cat] = cfg[cat].map(rename).filter((v, i, arr) => arr.indexOf(v) === i);
        });
    }
    appData.trades.forEach(t => {
        if (t.setup) t.setup = rename(t.setup);
    });
}

// Starter custom chart every user gets once. If they delete it, it stays gone.
// Setup values are only used when they exist in the user's own setup list.
const DEFAULT_SETUPS_FOR_HEATMAP = ['Price Discovery Continuation', 'Fade Value Area Extremes', 'Return to Value', 'VWAP Bounce'];

function addDefaultCustomCharts() {
    const sets = appData.settings;
    if (!Array.isArray(sets.customCharts)) sets.customCharts = [];
    if (sets.customCharts.some(c => c && c.id === 'cc_default_symbol_setup')) return;

    const setupCfg = sets.setup && !Array.isArray(sets.setup) ? sets.setup : {};
    const known = Object.values(setupCfg).flat();
    const setups = DEFAULT_SETUPS_FOR_HEATMAP.filter(s => known.includes(s));

    const filters = [];
    if (setups.length) filters.push({ field: 'setup', exclude: false, values: setups });
    filters.push({ field: 'symbol', exclude: true, values: ['BTC', 'CL'] });

    sets.customCharts.push({
        id: 'cc_default_symbol_setup',
        title: '',
        view: 'heatmap',
        metric: 'winRate',
        groupBy: '',
        rowsBy: 'symbol',
        colsBy: 'setup',
        filters,
        minTrades: 3,
        size: 3
    });
    if (!sets.chartVisibility) sets.chartVisibility = {};
    sets.chartVisibility['custom:cc_default_symbol_setup'] = true;
}

// Target "Swing" (High / Low) became "Price Action" (Swing High / Swing Low,
// plus Higher High and Lower Low). Renamed in settings, trades and custom charts.
const SWING_SUB_RENAMES = { 'HIgh': 'Swing High', 'High': 'Swing High', 'Low': 'Swing Low' };

function migrateTargetPriceAction() {
    const sets = appData.settings;
    const target = sets.target;
    if (!target || typeof target !== 'object' || Array.isArray(target)) return;
    if (!target.Swing || target['Price Action']) return; // user changed it already, leave it alone

    const renamed = {};
    Object.keys(target).forEach(key => {
        if (key !== 'Swing') { renamed[key] = target[key]; return; }
        const old = target.Swing || {};
        const sub1 = (old.sub1 || []).map(v => SWING_SUB_RENAMES[v] || v);
        ['Higher High', 'Lower Low'].forEach(v => { if (!sub1.includes(v)) sub1.push(v); });
        renamed['Price Action'] = { sub1: [...new Set(sub1)], sub2: old.sub2 || [] };
    });
    sets.target = renamed;

    appData.trades.forEach(t => {
        if (t.target !== 'Swing') return;
        t.target = 'Price Action';
        if (t.targetSub1) t.targetSub1 = SWING_SUB_RENAMES[t.targetSub1] || t.targetSub1;
    });

    (sets.customCharts || []).forEach(c => (c.filters || []).forEach(f => {
        if (f.field !== 'target' || !Array.isArray(f.values)) return;
        f.values = f.values.map(v => {
            const parts = String(v).split(' › ');
            if (parts[0] !== 'Swing') return v;
            parts[0] = 'Price Action';
            if (parts[1]) parts[1] = SWING_SUB_RENAMES[parts[1]] || parts[1];
            return parts.join(' › ');
        });
    }));
}

// Clean up trades so every part of the app can rely on the same shape:
// lists are always arrays, without empty entries. Runs on every load and
// only removes values that could never be shown (null, missing primary).
function normalizeTrades() {
    if (!Array.isArray(appData.trades)) appData.trades = [];
    const pathList = list => (Array.isArray(list) ? list : [])
        .filter(x => x && typeof x === 'object' && x.primary)
        .map(x => ({ ...x, primary: String(x.primary) }));
    appData.trades = appData.trades.filter(t => t && typeof t === 'object').map(t => {
        const n = { ...t };
        n.locations = pathList(t.locations);
        n.evidences = pathList(t.evidences);
        n.invalidations = pathList(t.invalidations);
        n.psychology = (Array.isArray(t.psychology) ? t.psychology : []).filter(x => typeof x === 'string' && x.trim());
        ['symbol', 'marketCondition', 'setup', 'direction', 'target', 'targetSub1', 'targetSub2', 'notes'].forEach(k => {
            if (n[k] === undefined || n[k] === null) n[k] = '';
        });
        if (!n.id) n.id = (crypto.randomUUID ? crypto.randomUUID() : 'id_' + Math.random().toString(36).slice(2));
        return n;
    });
}

// Make sure every list the app reads exists with the right type, so a
// hand-edited or older settings.json can't break the Settings page or forms.
function ensureSettingsShape() {
    if (!appData.settings || typeof appData.settings !== 'object' || Array.isArray(appData.settings)) appData.settings = {};
    const sets = appData.settings;
    ['symbol', 'marketCondition', 'direction', 'psychology'].forEach(k => {
        if (!Array.isArray(sets[k])) sets[k] = [];
    });
    ['location', 'evidence', 'invalidation', 'target'].forEach(k => {
        if (!sets[k] || typeof sets[k] !== 'object' || Array.isArray(sets[k])) sets[k] = {};
    });
    ['location', 'target'].forEach(k => {
        Object.keys(sets[k]).forEach(cat => {
            const v = sets[k][cat];
            sets[k][cat] = {
                sub1: Array.isArray(v && v.sub1) ? v.sub1 : [],
                sub2: Array.isArray(v && v.sub2) ? v.sub2 : []
            };
        });
    });
    ['evidence', 'invalidation'].forEach(k => {
        Object.keys(sets[k]).forEach(cat => { if (!Array.isArray(sets[k][cat])) sets[k][cat] = []; });
    });
    if (!sets.features || typeof sets.features !== 'object') sets.features = {};
    ['evidence', 'invalidation', 'target', 'psychology'].forEach(k => {
        if (typeof sets.features[k] !== 'boolean') sets.features[k] = true;
    });
}

// New default target "Scalp points" (5, 10, 20, 40), placed first, before VWAP.
// Added once to existing journals; if the user removes it later it stays removed.
function addTargetScalpPoints() {
    const sets = appData.settings;
    const target = sets.target;
    if (!target || typeof target !== 'object' || Array.isArray(target)) return;
    if (Object.keys(target).some(k => k.trim().toLowerCase() === 'scalp points')) return;
    sets.target = { 'Scalp points': { sub1: ['5', '10', '20', '30', '40', '50'], sub2: [] }, ...target };
}

// Scalp points got 30 and 50 (5, 10, 20, 30, 40, 50). Added once to journals that have Scalp points.
function addScalpPoints3050() {
    const target = appData.settings.target;
    const key = target && Object.keys(target).find(k => k.trim().toLowerCase() === 'scalp points');
    if (!key || !target[key] || !Array.isArray(target[key].sub1)) return;
    const list = target[key].sub1;
    ['30', '50'].forEach(v => { if (!list.includes(v)) list.push(v); });
    // Keep the points in order when the list only holds numbers
    if (list.every(v => /^\d+(\.\d+)?$/.test(String(v).trim()))) list.sort((a, b) => Number(a) - Number(b));
}

// New default under Invalidation > Levels: "Stitching bands". Added once.
function addInvalidationStitchingBands() {
    const inv = appData.settings.invalidation;
    if (!inv || typeof inv !== 'object' || Array.isArray(inv)) return;
    const key = Object.keys(inv).find(k => k.trim().toLowerCase() === 'levels');
    if (!key || !Array.isArray(inv[key])) return;
    if (!inv[key].some(v => String(v).trim().toLowerCase() === 'stitching bands')) inv[key].push('Stitching bands');
}

function migrateSettings() {
    ensureSettingsShape();
    const sets = appData.settings;
    if (Array.isArray(sets.setup)) {
        const core = sets.setup.filter(x => CORE_SETUP_NAMES.includes(String(x).trim().toLowerCase()));
        const advanced = sets.setup.filter(x => !core.includes(x));
        const grouped = {};
        if (core.length) grouped['Core setup'] = core;
        if (advanced.length) grouped['Advanced setup'] = advanced;
        sets.setup = grouped;
    } else if (!sets.setup || typeof sets.setup !== 'object') {
        sets.setup = {};
    }

    // One-time migrations: run once, then never override the user's own choices
    if (!sets.migrations) sets.migrations = {};
    if (!sets.migrations.setupTitleCase) {
        renameSetups();
        sets.migrations.setupTitleCase = true;
    }
    // Runs after the rename above, so the setup names already match
    if (!sets.migrations.targetPriceAction) {
        migrateTargetPriceAction();
        sets.migrations.targetPriceAction = true;
    }
    if (!sets.migrations.defaultCustomCharts) {
        addDefaultCustomCharts();
        sets.migrations.defaultCustomCharts = true;
    }
    if (!sets.migrations.targetScalpPoints) {
        addTargetScalpPoints();
        sets.migrations.targetScalpPoints = true;
    }
    if (!sets.migrations.scalpPoints3050) {
        addScalpPoints3050();
        sets.migrations.scalpPoints3050 = true;
    }
    if (!sets.migrations.invalidationStitchingBands) {
        addInvalidationStitchingBands();
        sets.migrations.invalidationStitchingBands = true;
    }
    // Rule check per setup (rules.js): does nothing while the feature is hidden
    if (typeof rulesMigrate === 'function') rulesMigrate();
    // VWS Journal system or own system (system.js)
    if (typeof systemSync === 'function') systemSync();
    // What's new: which releases this journal has seen (releases.js)
    if (typeof releasesMigrate === 'function') releasesMigrate();
}

async function loadDataFromFile() {
    journalStamp = {};
    let damaged = null; // { file, text } when a journal file can't be read
    if (journalDamaged) { journalDamaged = null; if (journalLockHeld) journalReadOnly = false; }
    try {
        // Load settings first
        try {
            const settingsHandle = await dirHandle.getFileHandle('settings.json');
            const settingsFile = await settingsHandle.getFile();
            const settingsContents = await settingsFile.text();
            journalRememberLoaded('settings.json', settingsFile, settingsContents);
            if(settingsContents) {
                try { appData.settings = JSON.parse(settingsContents); }
                catch (pe) { damaged = { file: 'settings.json', text: settingsContents }; appData.settings = { ...getDefaultSettings(), theme: appData.settings.theme }; }
                if (!appData.settings.symbol) appData.settings.symbol = ["NQ", "ES", "GC", "CL", "BTC"];
            } else {
                appData.settings = { ...getDefaultSettings(), theme: appData.settings.theme };
            }
        } catch(e) {
            // No settings.json yet (new folder): start with the full default settings
            console.log("No existing settings.json found, using defaults.");
            appData.settings = { ...getDefaultSettings(), theme: appData.settings.theme };
        }

        // Load trades
        try {
            const tradesHandle = await dirHandle.getFileHandle('vwap-journal.json', { create: true });
            const tradesFile = await tradesHandle.getFile();
            const tradesContents = await tradesFile.text();
            journalRememberLoaded('vwap-journal.json', tradesFile, tradesContents);
            if(tradesContents) {
                let parsedTrades;
                try { parsedTrades = JSON.parse(tradesContents); }
                catch (pe) { damaged = { file: 'vwap-journal.json', text: tradesContents }; parsedTrades = []; }
                // Handle migration from old format where trades and settings were in one file
                if (parsedTrades.trades) {
                   appData.trades = parsedTrades.trades;
                   // Only migrate settings from old journal if we didn't just load a dedicated settings.json
                   const vwap = appData.settings.location && appData.settings.location.VWAP;
                   if(parsedTrades.settings && (!vwap || !(vwap.sub1 || []).length)) {
                        appData.settings = parsedTrades.settings;
                   }
                } else if (Array.isArray(parsedTrades)) {
                   appData.trades = parsedTrades;
                }
                
                // Migrate old trades to arrays and new formats
                appData.trades = appData.trades.map(trade => {
                    if (trade.location !== undefined && !trade.locations) {
                        trade.locations = [{primary: trade.location, sub1: trade.locSub1, sub2: trade.locSub2}];
                        delete trade.location; delete trade.locSub1; delete trade.locSub2;
                    }
                    if (trade.evidence !== undefined && !trade.evidences) {
                        trade.evidences = [{primary: trade.evidence, sub: trade.evidenceSub}];
                        delete trade.evidence; delete trade.evidenceSub;
                    }
                    
                    // Invalidation Migration
                    if (trade.invalidation !== undefined && !trade.invalidations) {
                        trade.invalidations = [{primary: 'Legacy', sub: trade.invalidation}];
                        delete trade.invalidation;
                    } else if (trade.invalidations && trade.invalidations.length > 0) {
                        if (typeof trade.invalidations[0] === 'string') {
                            trade.invalidations = trade.invalidations.map(inv => ({primary: 'Legacy', sub: inv}));
                        }
                    }

                    // Features Migration
                    if (!appData.settings.features) {
                        appData.settings.features = {
                            evidence: true,
                            invalidation: true,
                            target: true,
                            psychology: true
                        };
                    }

                    // Psychology to Notes Migration
                    if (trade.psychology && typeof trade.psychology === 'string') {
                        trade.notes = trade.psychology;
                        trade.psychology = [];
                    }
                    
                    return trade;
                });
            }
        } catch (e) {
            console.error("Error loading vwap-journal.json:", e);
        }
        
        migrateSettings();
        normalizeTrades();

        // Shared trades and their reviews (share.json)
        if (typeof loadShareState === 'function') await loadShareState();

        // Only one window saves to a journal (a second window opens read only)
        journalReloading = false;
        await journalLockAcquire();

        // A file that can't be read is kept and never written over (read only, restore a backup).
        // Otherwise: today's backup of the files as they were loaded (backup.js)
        if (damaged && typeof backupHandleDamaged === 'function') await backupHandleDamaged(damaged.file, damaged.text);
        else if (typeof backupDailyIfNeeded === 'function') await backupDailyIfNeeded();

        // Force save to ensure both files exist in the new format
        await autoSave();
        renderDashboard();

        // Promo toast for auto-screenshots (only after the folder is connected,
        // so never while the installation guide / welcome screen is visible)
        if (typeof maybeShowScreenshotPromo === 'function') maybeShowScreenshotPromo();
    } catch (err) {
        console.error("Load process failed:", err);
        journalReloading = false;
    }
}

// --- AutoSave Logic ---
// One save at a time; a save asked for while one runs is done right after it.
// A failed save shows "Not saved · Try again" at the top (journal status), and the
// browser warns before closing the window. Before writing, the files on disk are
// compared with what this window loaded or wrote last: changed outside the app
// (another computer, a sync service) → the user chooses which version to keep.
// Only one window can save to a journal: a second window opens read only.

let journalSaving = null;       // the save in progress (a promise)
let journalSaveAgain = false;   // another save was asked for while saving
let journalSaveError = null;    // message of the last failed save, null = all saved
let journalReadOnly = false;    // this window may not save (journal open in another window)
let journalReloading = false;   // a newer version from disk is being loaded
let journalStamp = {};          // file name → { t: lastModified, text } as last loaded or written
let journalDamaged = null;      // { file, keptAs } when a journal file could not be read (backup.js)

const JOURNAL_FILES = ['vwap-journal.json', 'settings.json'];

async function autoSave() {
    if (!dirHandle) return;
    if (journalReadOnly) { journalStatusSync(); return; }
    if (journalSaving) { journalSaveAgain = true; return journalSaving; }
    journalSaving = (async () => {
        do {
            journalSaveAgain = false;
            await journalSaveNow();
        } while (journalSaveAgain && !journalReadOnly && !journalReloading);
    })();
    try { await journalSaving; } finally { journalSaving = null; }
}

async function journalSaveNow() {
    if (journalReloading) return;
    try {
        let hasPermission = false;
        try { hasPermission = await verifyPermission(dirHandle, true); } catch (e) { hasPermission = false; }
        if (!hasPermission) throw new Error('no-permission');
        fileConnected = true;
        const texts = {
            'vwap-journal.json': JSON.stringify(appData.trades, null, 2),
            'settings.json': JSON.stringify(appData.settings, null, 2)
        };
        if (await journalChangedOutside()) {
            const keepMine = await journalAskWhichVersion();
            if (!keepMine) {
                journalReloading = true;
                setTimeout(async () => {
                    await loadDataFromFile();
                    if (typeof showToast === 'function') showToast('The newer version of your journal is loaded.', 'success');
                }, 0);
                return;
            }
        }
        for (const name of JOURNAL_FILES) {
            const handle = await dirHandle.getFileHandle(name, { create: true });
            const writable = await handle.createWritable();
            await writable.write(texts[name]);
            await writable.close();
            const f = await handle.getFile();
            journalStamp[name] = { t: f.lastModified, text: texts[name] };
        }
        const hadError = !!journalSaveError;
        journalSaveError = null;
        journalStatusSync();
        if (hadError && typeof showToast === 'function') showToast('Saved. Your journal is up to date.', 'success');
    } catch (err) {
        console.error('Background save failed:', err);
        const first = !journalSaveError;
        journalSaveError = err && err.message === 'no-permission'
            ? 'No access to your journal folder.'
            : 'Your journal could not be saved.';
        journalStatusSync();
        if (first && typeof showToast === 'function') {
            showToast(`${journalSaveError} Your last change is not saved yet.`, 'error', {
                duration: 8000, action: { label: 'Try again', onClick: () => autoSave() }
            });
        }
    }
}

// Remember the files as they are on disk now (after loading them)
function journalRememberLoaded(name, file, text) {
    journalStamp[name] = file ? { t: file.lastModified, text } : null;
}

// True when a journal file on disk is different from what this window loaded or wrote last
async function journalChangedOutside() {
    for (const name of JOURNAL_FILES) {
        const known = journalStamp[name];
        if (!known) continue;
        let file;
        try { file = await (await dirHandle.getFileHandle(name)).getFile(); } catch (e) { continue; } // gone: written again below
        if (file.lastModified === known.t) continue;
        const text = await file.text();
        if (text === known.text) { known.t = file.lastModified; continue; } // touched, not changed
        return true;
    }
    return false;
}

async function journalAskWhichVersion() {
    if (typeof appConfirm !== 'function') return true;
    return appConfirm({
        title: 'Your journal changed outside this window',
        message: 'A newer version of your journal was saved from somewhere else, for example another computer or a sync service like iCloud or Dropbox. Load the newer version (your last change in this window is not kept), or keep this window’s version (the newer version is overwritten).',
        confirmText: 'Keep this window’s version',
        cancelText: 'Load the newer version',
        icon: 'warn'
    });
}

// ---------- One window per journal ----------

let journalLockName = '';
let journalLockHeld = false;
let journalLockFree = null;     // releases the lock this window holds

function journalLockRequest(name, opts) {
    return new Promise(resolve => {
        navigator.locks.request(name, opts, lock => {
            if (!lock) { resolve(false); return null; }
            journalLockHeld = true;
            journalReadOnly = false;
            journalStatusSync();
            resolve(true);
            return new Promise(release => {
                journalLockFree = () => { journalLockHeld = false; journalLockFree = null; release(); };
            });
        }).catch(err => {
            // Another window took the journal over
            if (err && err.name === 'AbortError' && journalLockName === name) {
                journalLockHeld = false;
                journalLockFree = null;
                journalReadOnly = true;
                journalStatusSync();
                if (typeof showToast === 'function') showToast('Your journal is now used in another window. Changes in this window are not saved.', 'error', {
                    duration: 10000, action: { label: 'Use it here', onClick: journalTakeOver }
                });
            }
            resolve(false);
        });
    });
}

// Called after a journal is loaded
async function journalLockAcquire() {
    if (!dirHandle || !navigator.locks) return;
    const name = 'vws-journal:' + dirHandle.name;
    if (journalLockHeld && journalLockName === name) return;
    if (journalLockFree) journalLockFree(); // another folder was open before
    journalLockName = name;
    const got = await journalLockRequest(name, { ifAvailable: true });
    if (!got && !journalLockHeld) {
        journalReadOnly = true;
        journalStatusSync();
        setTimeout(journalOpenElsewhere, 0);
    }
}

async function journalOpenElsewhere() {
    if (typeof appConfirm !== 'function') return;
    const useHere = await appConfirm({
        title: 'Your journal is open in another window',
        message: 'Two windows on the same journal overwrite each other’s changes. This window is read only for now. Use the journal here, and the other window stops saving.',
        confirmText: 'Use it here',
        cancelText: 'Keep read only',
        tone: 'primary', icon: 'warn'
    });
    if (useHere) journalTakeOver();
}

async function journalTakeOver() {
    if (!navigator.locks || !journalLockName) return;
    const got = await journalLockRequest(journalLockName, { steal: true });
    if (!got) return;
    // The other window may have saved changes: start from what is on disk now
    journalReloading = true;
    await loadDataFromFile();
    if (typeof showToast === 'function') showToast('Your journal is used in this window now.', 'success');
}

// ---------- Journal status (top bar) ----------

function journalStatusSync() {
    const el = document.getElementById('journal-status');
    if (!el) return;
    if (journalDamaged) {
        el.hidden = false;
        el.className = 'journal-status is-error';
        el.innerHTML = `<span class="journal-status-dot"></span>File damaged<span class="journal-status-act">${typeof backupFeatureOn !== 'undefined' && backupFeatureOn ? 'Restore a backup' : 'What now?'}</span>`;
        el.title = journalDamaged.file + ' could not be read';
    } else if (journalReadOnly) {
        el.hidden = false;
        el.className = 'journal-status is-readonly';
        el.innerHTML = '<span class="journal-status-dot"></span>Read only<span class="journal-status-act">Use it here</span>';
        el.title = 'Your journal is open in another window';
    } else if (journalSaveError) {
        el.hidden = false;
        el.className = 'journal-status is-error';
        el.innerHTML = '<span class="journal-status-dot"></span>Not saved<span class="journal-status-act">Try again</span>';
        el.title = journalSaveError;
    } else {
        el.hidden = true;
        el.className = 'journal-status';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('journal-status');
    if (el) el.addEventListener('click', () => {
        if (journalDamaged) { if (typeof backupFeatureOn !== 'undefined' && backupFeatureOn) backupRestoreDialog(); else backupDamagedDialog(); }
        else if (journalReadOnly) journalTakeOver();
        else autoSave();
    });
});

// Unsaved changes: let the browser ask before the window closes
window.addEventListener('beforeunload', (e) => {
    if (journalSaveError || journalSaving) { e.preventDefault(); e.returnValue = ''; }
});

// --- Image Handling Logic ---

async function getImageUrl(filename) {
    if (!dirHandle || !filename) return null;
    try {
        const imgDir = await dirHandle.getDirectoryHandle('img', { create: true });
        const fileHandle = await imgDir.getFileHandle(filename);
        const file = await fileHandle.getFile();
        const url = URL.createObjectURL(file);
        activeObjectUrls.push(url);
        return url;
    } catch(e) {
        console.warn("Image not found:", filename);
        return null;
    }
}

async function saveImageToDir(blob, filename) {
    if (!dirHandle) return;
    const imgDir = await dirHandle.getDirectoryHandle('img', { create: true });
    const fileHandle = await imgDir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

async function deleteImageFromDir(filename) {
    if (!dirHandle || !filename) return;
    try {
        const imgDir = await dirHandle.getDirectoryHandle('img');
        await imgDir.removeEntry(filename);
    } catch(e) {
        console.warn("Could not delete image or already deleted:", filename);
    }
}

function revokeObjectUrls() {
    activeObjectUrls.forEach(url => URL.revokeObjectURL(url));
    activeObjectUrls = [];
}

let imageViewerRelease = null; // keys and focus while the viewer is open (appDialogTrap)
function openImageViewer(src) {
    if (typeof shotsViewerReset === 'function') shotsViewerReset(); // shots.js adds the carousel after this
    enlargedImage.src = src;
    imageViewerModal.classList.add('active');
    if (!imageViewerRelease && typeof appDialogTrap === 'function') {
        imageViewerRelease = appDialogTrap(imageViewerModal, { onEscape: closeImageViewer, initialFocus: imageViewerClose });
    }
}

function closeImageViewer() {
    imageViewerModal.classList.remove('active');
    if (typeof shotsViewerReset === 'function') setTimeout(() => { if (!imageViewerModal.classList.contains('active')) shotsViewerReset(); }, 300);
    if (imageViewerRelease) { const release = imageViewerRelease; imageViewerRelease = null; release(); }
}

function setupImageViewer() {
    const closeViewer = closeImageViewer;
    imageViewerClose.addEventListener('click', closeViewer);
    // Click anywhere (also on the image itself) to close
    imageViewerModal.addEventListener('click', (e) => {
        if (e.target === imageViewerModal || e.target === enlargedImage) closeViewer();
    });
}

