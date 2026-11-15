// --- Always the latest version (2026-11-15) ---
// A tab that stays open keeps running the version it was opened with. This file looks for a newer
// version online (when you come back to the tab and every 30 minutes) and reloads by itself, but only
// at a safe moment: nothing open, nothing waiting to save, not typing, no Undo waiting, no Auto-Capture.
// The tab is in the background (or the window has been left alone a while): reload right away.
// You come back after 5+ minutes away: reload before you click anything.
// A fix or small change: only that, silently. A new release or improvement (a FEATURES switch that is new
// or goes from off to on in the new globals.js): someone who keeps working also gets a small notice in the
// corner ("A new version is ready", Later / Reload); after the reload the What's new card follows.
//
// Nothing extra to maintain: the version is the ?v= of globals.js in index.html, raised with every delivery.
// No journal data leaves the computer: the check only reads the app page itself. It asks the server
// "changed?" (ETag), so an unchanged page costs a few hundred bytes, not the whole page.
// Off with ?update=off (tests, support).

const UPDATE_TIMES = {
    check: 30 * 60 * 1000,    // look for a new version this often
    away: 5 * 60 * 1000,      // away this long = a return counts as "coming back"
    idle: 5 * 60 * 1000,      // window visible but not used this long (no focus, no input) = in the background
    returnGrace: 4000,        // after coming back: reload only within this time and before any input
    tick: 30 * 1000           // once a new version is known: how often to look for a safe moment
};

const updateOn = (() => {
    try {
        if ((new URLSearchParams(window.location.search).get('update') || '').toLowerCase() === 'off') return false;
    } catch (e) { /* on */ }
    return /^https?:$/.test(window.location.protocol);
})();

function updateVersionOf(text) {
    const m = /globals\.js\?v=([\w.-]+)/.exec(String(text || ''));
    return m ? m[1] : null;
}
const updateRunning = (() => {
    const s = document.querySelector('script[src*="globals.js"]');
    return s ? updateVersionOf(s.getAttribute('src')) : null;
})();

let updateReady = null;        // the newer version found online
let updateKind = null;         // 'release' (a switch new or turned on: the notice may show) or 'fix' (silent)
let updateChecking = null;     // the check in progress (a promise)
let updateLastCheck = 0;
let updateDismissed = null;    // "Later" on the notice for this version
let updateReloading = false;
let updateHiddenAt = document.hidden ? Date.now() : 0;
let updateBlurAt = 0;
let updateInputAt = Date.now();
let updateReturnAt = 0;        // when the user came back after being away (0 = not in a return)

// This page load came from an automatic update (storage.js keeps the "Read only" question quiet)
const updateAfterReload = (() => {
    try {
        const v = sessionStorage.getItem('vwsUpdateTo');
        return !!v && v === updateRunning;
    } catch (e) { return false; }
})();

function updateTried() {
    try { return sessionStorage.getItem('vwsUpdateTo'); } catch (e) { return null; }
}

// ---------- Is there a newer version? ----------

function updateCheck() {
    if (!updateOn || !updateRunning) return Promise.resolve(null);
    if (updateChecking) return updateChecking;
    if (navigator.onLine === false) return Promise.resolve(updateReady);
    updateLastCheck = Date.now();
    updateChecking = (async () => {
        try {
            // no-cache = ask the server whether the page changed (304 when not): tiny, also with many users
            const res = await fetch(window.location.pathname, { cache: 'no-cache', credentials: 'same-origin' });
            if (!res.ok) return updateReady;
            const v = updateVersionOf(await res.text());
            if (v && v !== updateRunning && v !== updateReady) {
                updateKind = await updateKindOf(v);
                updateReady = v;
                updateWatch();
            }
        } catch (e) { /* offline or blocked: try again later */ }
        return updateReady;
    })();
    return updateChecking.finally(() => { updateChecking = null; });
}

// Release or fix? Compare the FEATURES switches in the new globals.js with the running ones.
// The new globals.js is the file the reload needs anyway, so the browser keeps it for that.
function updateSwitchesOf(text) {
    const block = /const\s+FEATURES\s*=\s*\{([\s\S]*?)\n\};/.exec(String(text || ''));
    if (!block) return null;
    const out = {};
    const re = /(\w+)\s*:\s*\{\s*on\s*:\s*(true|false)/g;
    let m;
    while ((m = re.exec(block[1]))) out[m[1]] = m[2] === 'true';
    return out;
}
async function updateKindOf(v) {
    try {
        const res = await fetch(`globals.js?v=${encodeURIComponent(v)}`, { credentials: 'same-origin' });
        if (!res.ok) return 'fix';
        const next = updateSwitchesOf(await res.text());
        if (!next) return 'fix';
        const now = typeof FEATURES !== 'undefined' ? FEATURES : {};
        return Object.keys(next).some(k => next[k] && !(now[k] && now[k].on)) ? 'release' : 'fix';
    } catch (e) { return 'fix'; }
}

// ---------- Is it a safe moment? ----------

function updateTyping() {
    const a = document.activeElement;
    if (!a || a === document.body) return false;
    if (a.isContentEditable) return true;
    if (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') return true;
    if (a.tagName !== 'INPUT') return false;
    return !/^(checkbox|radio|button|submit|reset|range|color|file|image|hidden)$/i.test(a.type || 'text');
}

function updateShown(el) {
    if (!el) return false;
    const overlay = el.closest('.modal-overlay');
    if (overlay) return overlay.classList.contains('active');
    if (typeof el.checkVisibility === 'function') return el.checkVisibility({ checkVisibilityCSS: true });
    return el.getClientRects().length > 0;
}

// null = safe, otherwise why not (for the tests)
function updateUnsafe() {
    if (typeof journalSaveError !== 'undefined' && journalSaveError) return 'save-error';
    if (typeof journalDamaged !== 'undefined' && journalDamaged) return 'damaged';
    if ((typeof journalSaving !== 'undefined' && journalSaving) || (typeof journalReloading !== 'undefined' && journalReloading)) return 'saving';
    if (typeof scalpSaveNextPending !== 'undefined' && scalpSaveNextPending) return 'saving';
    if (typeof shareBusy !== 'undefined' && shareBusy) return 'saving';
    if (typeof isFormDirty !== 'undefined' && isFormDirty) return 'form';
    const modal = document.getElementById('trade-modal');
    if (modal && modal.classList.contains('active')) return 'form';
    if (typeof scalpQ !== 'undefined' && scalpQ) return 'form';
    if (document.getElementById('app-dialog') || document.getElementById('release-menu')) return 'popup';
    const viewer = document.getElementById('image-viewer-modal');
    if (viewer && viewer.classList.contains('active')) return 'popup';
    if (document.querySelector('.flatpickr-calendar.open')) return 'popup';
    const modals = document.querySelectorAll('[aria-modal="true"]');
    for (const m of modals) {
        if (m.closest('#connect-gate')) continue; // the "open your journal" screen: nothing to lose
        if (updateShown(m)) return 'popup';
    }
    if (document.querySelector('#toast-container .toast-action')) return 'undo';
    if (typeof activeMediaStream !== 'undefined' && activeMediaStream && activeMediaStream.active) return 'capture';
    if (typeof scalpCapturing !== 'undefined' && scalpCapturing) return 'capture';
    if (updateTyping()) return 'typing';
    return null;
}

// The user is not using this window right now
function updateAway() {
    if (document.hidden) return true;
    const now = Date.now();
    return !document.hasFocus() && updateBlurAt && now - updateBlurAt >= UPDATE_TIMES.idle && now - updateInputAt >= UPDATE_TIMES.idle;
}

// ---------- Reload ----------

function updateViewNow() {
    const active = document.querySelector('.view.active');
    const id = active ? active.id : '';
    return { view: id.replace(/^view-/, '') || 'dashboard', tab: typeof currentSettingsTab !== 'undefined' ? currentSettingsTab : '' };
}

async function updateReloadNow() {
    if (updateReloading || !updateReady) return false;
    updateReloading = true;
    try { if (typeof journalSaving !== 'undefined' && journalSaving) await journalSaving; } catch (e) { /* checked below */ }
    if (typeof journalSaveError !== 'undefined' && journalSaveError) { updateReloading = false; updateNoticeSync(); return false; }
    try {
        sessionStorage.setItem('vwsUpdateTo', updateReady);
        sessionStorage.setItem('vwsUpdateView', JSON.stringify(updateViewNow()));
    } catch (e) { /* the page still reloads */ }
    // Put the new page in the browser cache first, so the reload really gets it
    try { await fetch(window.location.href.split('#')[0], { cache: 'reload', credentials: 'same-origin' }); } catch (e) { /* reload anyway */ }
    updateDoReload();
    return true;
}
// Separate so the tests can catch it
function updateDoReload() { window.location.reload(); }

// Automatic: only at a safe moment, and only once per version (no loop when a cache keeps the old page)
function updateMaybeReload(reason) {
    if (!updateReady || updateReloading) return false;
    if (updateTried() === updateReady) return false;
    if (updateUnsafe()) return false;
    const returning = updateReturnAt && Date.now() - updateReturnAt <= UPDATE_TIMES.returnGrace && updateInputAt < updateReturnAt;
    if (!updateAway() && !returning) return false;
    updateReloadNow();
    return true;
}

// After an automatic reload: back on the page the user was on (called when the journal has loaded)
function updateRestoreView() {
    let saved = null;
    try {
        saved = JSON.parse(sessionStorage.getItem('vwsUpdateView') || 'null');
        sessionStorage.removeItem('vwsUpdateView');
    } catch (e) { saved = null; }
    if (!saved || !saved.view || saved.view === 'dashboard') return;
    try {
        if (saved.view === 'settings' && saved.tab && typeof currentSettingsTab !== 'undefined') currentSettingsTab = saved.tab;
        if (saved.view === 'share') { if (typeof openShareView === 'function' && typeof shareFeatureOn !== 'undefined' && shareFeatureOn) openShareView(); return; }
        const btn = document.getElementById(`btn-nav-${saved.view}`);
        if (btn) btn.click();
    } catch (e) { /* stays on the dashboard */ }
}

// ---------- The notice ----------

const UPDATE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';

function updateNoticeWanted() {
    if (!updateReady || updateKind !== 'release' || updateReloading || updateDismissed === updateReady || document.hidden) return false;
    const why = updateUnsafe();
    return !why || why === 'saving' || why === 'typing' || why === 'undo' || why === 'capture';
}

function updateNoticeSync() {
    const card = document.getElementById('update-card');
    const wanted = updateNoticeWanted();
    if (!wanted) { if (card) updateNoticeHide(); return; }
    if (!card) { updateNoticeShow(); return; }
    const btn = card.querySelector('[data-update="reload"]');
    const busy = updateUnsafe() === 'saving';
    if (btn && btn.disabled !== busy) { btn.disabled = busy; btn.textContent = busy ? 'Saving…' : 'Reload'; }
}

function updateNoticeShow() {
    if (document.getElementById('update-card') || typeof getToastContainer !== 'function') return;
    const card = document.createElement('div');
    card.id = 'update-card';
    card.className = 'update-card';
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', 'A new version is ready');
    card.innerHTML = `
        <span class="update-card-icon">${UPDATE_ICON}</span>
        <div class="update-card-body">
            <strong class="update-card-title">A new version is ready</strong>
            <span class="update-card-text">Reload to get the latest VWS Journal. Your journal is saved, nothing gets lost.</span>
            <div class="update-card-actions">
                <button type="button" class="btn-secondary btn-sm" data-update="later">Later</button>
                <button type="button" class="btn-primary btn-sm" data-update="reload">Reload</button>
            </div>
        </div>`;
    card.querySelector('[data-update="later"]').addEventListener('click', () => { updateDismissed = updateReady; updateNoticeHide(); });
    card.querySelector('[data-update="reload"]').addEventListener('click', () => { updateReloadNow(); });
    getToastContainer().appendChild(card);
    updateNoticeSync();
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('visible')));
}

function updateNoticeHide() {
    const card = document.getElementById('update-card');
    if (!card || card.classList.contains('hiding')) return;
    card.classList.add('hiding');
    card.classList.remove('visible');
    setTimeout(() => card.remove(), 450);
}

// Once a new version is known: Add Trade, Quick trade or a popup opens → the notice slides away,
// it closes → the notice comes back. Saving → the Reload button waits.
let updateWatching = false;
function updateWatch() {
    if (updateWatching) return;
    updateWatching = true;
    let queued = false;
    const later = () => {
        if (queued) return;
        queued = true;
        setTimeout(() => { queued = false; updateNoticeSync(); }, 150);
    };
    const watch = new MutationObserver(later);
    const modal = document.getElementById('trade-modal');
    if (modal) watch.observe(modal, { attributes: true, attributeFilter: ['class'] });
    const viewer = document.getElementById('image-viewer-modal');
    if (viewer) watch.observe(viewer, { attributes: true, attributeFilter: ['class'] });
    watch.observe(document.body, { childList: true });
    const status = document.getElementById('journal-status');
    if (status) watch.observe(status, { attributes: true, childList: true, subtree: true });
    ['focusin', 'focusout'].forEach(ev => document.addEventListener(ev, later));
}

// ---------- When to look ----------

async function updateTick() {
    if (!updateOn || !updateRunning || updateReloading) return;
    if (!updateReady && Date.now() - updateLastCheck >= UPDATE_TIMES.check) await updateCheck();
    if (!updateReady) return;
    if (updateMaybeReload('tick')) return;
    updateNoticeSync();
}

async function updateCameBack() {
    const away = (updateHiddenAt && Date.now() - updateHiddenAt >= UPDATE_TIMES.away)
        || (updateBlurAt && Date.now() - updateBlurAt >= UPDATE_TIMES.away && Date.now() - updateInputAt >= UPDATE_TIMES.away);
    updateHiddenAt = 0;
    updateBlurAt = 0;
    if (!away) { updateNoticeSync(); return; }
    updateReturnAt = Date.now();
    await updateCheck();
    if (!updateReady) return;
    if (!updateMaybeReload('return')) updateNoticeSync();
}

if (updateOn && updateRunning) {
    if (updateAfterReload) {
        try { sessionStorage.removeItem('vwsUpdateTo'); } catch (e) { /* fine */ }
    }
    updateLastCheck = Date.now(); // just loaded: this is the newest
    const input = () => { updateInputAt = Date.now(); };
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, input, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            updateHiddenAt = Date.now();
            updateNoticeSync();
            updateMaybeReload('hidden');
        } else {
            updateCameBack();
        }
    });
    window.addEventListener('blur', () => { if (!document.hidden) updateBlurAt = Date.now(); });
    window.addEventListener('focus', () => { if (updateBlurAt) updateCameBack(); });
    setInterval(updateTick, UPDATE_TIMES.tick);
}
