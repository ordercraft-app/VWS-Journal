// --- System choice: the VWS Journal system (default) or your own system ---
// settings.systemMode = 'vws' | 'own' (missing = 'vws'; the app always starts with the VWS system)
// settings.savedSystems = { vws: {...}, own: {...} }: the system that is not in use, kept aside
// A system = the lists Location, Market condition, Setup, Evidence, Invalidation, Target
// + the rules (+ whether the default heatmap is shown). Symbol, Direction and Psychology
// are shared. Trades are never touched; codes (settings.setupRules) stay valid.

const SYSTEM_KEYS = ['location', 'marketCondition', 'setup', 'evidence', 'invalidation', 'target'];
// The default heatmap (win rate per symbol x VWS core setup) only belongs to the VWS system
const SYSTEM_VWS_CHART = 'custom:cc_default_symbol_setup';

function systemMode() {
    return appData.settings && appData.settings.systemMode === 'own' ? 'own' : 'vws';
}

function systemClone(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

function systemIsObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}

// The system that is in use now
function systemSnapshot() {
    const s = appData.settings;
    const snap = {};
    SYSTEM_KEYS.forEach(k => { snap[k] = systemClone(s[k] !== undefined ? s[k] : (k === 'marketCondition' ? [] : {})); });
    snap.rules = systemIsObject(s.rules) ? systemClone(s.rules) : null;
    const vis = s.chartVisibility || {};
    snap.vwsChart = Object.prototype.hasOwnProperty.call(vis, SYSTEM_VWS_CHART) ? vis[SYSTEM_VWS_CHART] : null;
    return snap;
}

function systemApply(snap) {
    const s = appData.settings;
    SYSTEM_KEYS.forEach(k => { s[k] = systemClone(snap[k]); });
    if (snap.rules) s.rules = systemClone(snap.rules);
    else if (systemIsObject(s.rules)) s.rules = { _all: [] };
    if (snap.vwsChart !== null && snap.vwsChart !== undefined) {
        if (!s.chartVisibility) s.chartVisibility = {};
        s.chartVisibility[SYSTEM_VWS_CHART] = snap.vwsChart;
    }
}

// Empty system: no lists, no rules, no default heatmap
function systemEmpty() {
    return { location: {}, marketCondition: [], setup: {}, evidence: {}, invalidation: {}, target: {}, rules: { _all: [] }, vwsChart: false };
}

// The default VWS lists; the rules come from rulesBuildDefaults (rules for all setups +
// the setup rules the code allows)
function systemApplyVwsDefaults() {
    const s = appData.settings;
    const d = getDefaultSettings();
    SYSTEM_KEYS.forEach(k => { s[k] = systemClone(d[k]); });
    if (systemIsObject(s.rules) && typeof rulesBuildDefaults === 'function') {
        s.rules = rulesBuildDefaults();
        if (typeof rulesEnsureShape === 'function') rulesEnsureShape();
        if (typeof rulesRemoveLockedDefaults === 'function') rulesRemoveLockedDefaults();
    }
    if (!s.chartVisibility) s.chartVisibility = {};
    if (s.chartVisibility[SYSTEM_VWS_CHART] === false) s.chartVisibility[SYSTEM_VWS_CHART] = true;
}

function systemAfterChange(message) {
    document.documentElement.classList.toggle('system-own', systemMode() === 'own');
    if (typeof renderSettingsUI === 'function') renderSettingsUI();
    if (typeof renderDashboard === 'function') renderDashboard();
    showToast(message, 'success');
}

async function systemSwitch(to) {
    const s = appData.settings;
    const from = systemMode();
    if (to === from) return;
    const own = to === 'own';
    const hasSaved = !!(systemIsObject(s.savedSystems) && s.savedSystems[to]);
    const ok = await appConfirm(own ? {
        title: 'Use your own system?',
        message: hasSaved
            ? 'Your own lists and rules come back as you left them. The VWS lists and rules are kept aside, so you can switch back any time. Trades you logged stay as they are.'
            : 'Location, Market condition, Setup, Evidence, Invalidation, Target and all rules are emptied, so you can set up your own system. Symbol, Direction and Psychology stay. The VWS lists and rules are kept aside, so you can switch back any time. Trades you logged stay as they are.',
        confirmText: 'Use my own system', tone: 'primary', icon: 'undo'
    } : {
        title: 'Use the VWS Journal system?',
        message: 'The VWS lists and rules come back as you left them. Your own lists and rules are kept aside, so you can switch back any time. Trades you logged stay as they are.',
        confirmText: 'Use the VWS system', tone: 'primary', icon: 'undo'
    });
    if (!ok) return;
    if (!systemIsObject(s.savedSystems)) s.savedSystems = {};
    s.savedSystems[from] = systemSnapshot();
    if (hasSaved) systemApply(s.savedSystems[to]);
    else if (own) systemApply(systemEmpty());
    else systemApplyVwsDefaults();
    delete s.savedSystems[to];
    s.systemMode = to;
    if (!own && typeof rulesRemoveLockedDefaults === 'function') rulesRemoveLockedDefaults();
    if (typeof autoSave === 'function') await autoSave();
    systemAfterChange(own ? 'You are now using your own system' : 'You are now using the VWS Journal system');
}

// Reset the VWS system to the default settings: the 6 lists and the rules.
// Symbol, Direction, Psychology, codes, charts, an own system kept aside and trades stay.
async function systemResetVws() {
    if (systemMode() !== 'vws') return;
    const ok = await appConfirm({
        title: 'Reset to the default VWS settings?',
        message: 'Location, Market condition, Setup, Evidence, Invalidation, Target and all rules go back to the default VWS settings. Setups and rules you added yourself are removed. Symbol, Direction, Psychology, your codes, your charts and your trades stay as they are.',
        confirmText: 'Reset', icon: 'undo'
    });
    if (!ok) return;
    systemApplyVwsDefaults();
    if (typeof autoSave === 'function') await autoSave();
    systemAfterChange('Default VWS settings restored');
}

// Settings > Journal: the card (VWS system) or the banner (own system) at the top
function systemSettingsEl() {
    const el = document.createElement('div');
    if (systemMode() === 'own') {
        el.className = 'system-banner';
        el.innerHTML = `<span class="system-banner-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg></span>
            <div class="system-text"><strong>You are using your own system</strong><span>Your own lists and rules. The VWS lists, setup rules and codes are kept aside.</span></div>
            <button type="button" class="btn-primary btn-sm" data-system="vws">Use the VWS Journal system</button>`;
        el.querySelector('[data-system="vws"]').onclick = () => systemSwitch('vws');
    } else {
        el.className = 'system-card';
        el.innerHTML = `<div class="system-text"><strong>VWS Journal system</strong><span>The lists and rules are set up for the VWS setups. Trade another system? Start from empty lists; the VWS lists are kept aside.</span></div>
            <div class="system-actions"><button type="button" class="btn-secondary btn-sm" data-system="reset">Reset to default</button><button type="button" class="btn-secondary btn-sm" data-system="own">Use your own system</button></div>`;
        el.querySelector('[data-system="own"]').onclick = () => systemSwitch('own');
        el.querySelector('[data-system="reset"]').onclick = () => systemResetVws();
    }
    return el;
}

// Called after settings.json is loaded (migrateSettings) and on start
function systemSync() {
    document.documentElement.classList.toggle('system-own', systemMode() === 'own');
}
document.addEventListener('DOMContentLoaded', systemSync);
