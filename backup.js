// --- Automatic backups ---
// Every day, the first time a journal is opened, the files as they are on disk are copied to
// backups/<YYYY-MM-DD_HHMM>/ inside the journal folder: vwap-journal.json, settings.json, share.json
// and backup.json (when, why, how many trades). Screenshots are not copied: they never change.
// Old daily backups are removed after settings.backup.keep days. A damaged journal file is never
// overwritten: it is kept as vwap-journal.damaged-<date>.json and the user restores a backup.

// ---------- Release switch ----------
// Set in FEATURES (globals.js). false = no daily backups, no Backups tab, no release in What's new.
// Test per browser with ?backup=on (or ?backup=off); this browser remembers the choice.
// The damaged-file guard (never write over a journal file that can't be read) always works.
const BACKUP_FEATURE_ENABLED = !!(FEATURES.backup && FEATURES.backup.on);
const BACKUP_FEATURE_KEY = 'vws-backup-feature';
const backupFeatureOn = (() => {
    let override = null;
    try {
        const params = new URLSearchParams(window.location.search);
        const asked = (params.get('backup') || '').toLowerCase();
        if (asked === 'on' || asked === 'off') {
            localStorage.setItem(BACKUP_FEATURE_KEY, asked);
            params.delete('backup');
            const rest = params.toString();
            history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
        }
        override = localStorage.getItem(BACKUP_FEATURE_KEY);
    } catch (e) { /* storage blocked: use the default */ }
    if (override === 'on') return true;
    if (override === 'off') return false;
    return BACKUP_FEATURE_ENABLED;
})();
document.documentElement.classList.toggle('backup-on', backupFeatureOn);

const BACKUP_DIR = 'backups';
const BACKUP_FILES = ['vwap-journal.json', 'settings.json', 'share.json'];
const BACKUP_KEEP_OPTIONS = [7, 14, 30];
const BACKUP_KEEP_OTHER = 5; // backups made by hand or before a restore

const BACKUP_ICONS = {
    shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',
    warn: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    restore: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/></svg>',
    folder: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
};

function backupPrefs() {
    const b = (appData.settings && appData.settings.backup) || {};
    return { auto: b.auto !== false, keep: BACKUP_KEEP_OPTIONS.includes(b.keep) ? b.keep : 14 };
}

function backupStamp(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function backupLabel(iso) {
    const d = new Date(iso), now = new Date();
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((today - day) / 864e5);
    if (diff === 0) return `Today, ${time}`;
    if (diff === 1) return `Yesterday, ${time}`;
    return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

function backupSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function backupRoot(create = true) {
    return dirHandle.getDirectoryHandle(BACKUP_DIR, { create });
}

async function backupReadText(dir, name) {
    try { return await (await (await dir.getFileHandle(name)).getFile()).text(); } catch (e) { return null; }
}

async function backupWriteText(dir, name, text) {
    const h = await dir.getFileHandle(name, { create: true });
    const w = await h.createWritable();
    await w.write(text);
    await w.close();
}

// All backups, newest first
async function backupList() {
    if (!dirHandle) return [];
    const out = [];
    try {
        const root = await backupRoot(true);
        for await (const entry of root.values()) {
            if (entry.kind !== 'directory') continue;
            const meta = await backupReadText(entry, 'backup.json');
            let m = null; try { m = JSON.parse(meta); } catch (e) {}
            if (m && m.created) out.push({ name: entry.name, dir: entry, ...m });
        }
    } catch (e) { console.warn('Backups could not be listed', e); }
    return out.sort((a, b) => b.created.localeCompare(a.created));
}

// texts: { file name → text } as it should be kept
async function backupWrite(reason, texts) {
    const root = await backupRoot(true);
    let name = backupStamp() + (reason === 'daily' ? '' : `-${reason}`);
    const dir = await root.getDirectoryHandle(name, { create: true });
    let bytes = 0, trades = 0;
    for (const f of BACKUP_FILES) {
        if (typeof texts[f] !== 'string' || !texts[f]) continue;
        await backupWriteText(dir, f, texts[f]);
        bytes += texts[f].length;
    }
    try { const t = JSON.parse(texts['vwap-journal.json'] || '[]'); trades = Array.isArray(t) ? t.length : (t.trades || []).length; } catch (e) {}
    await backupWriteText(dir, 'backup.json', JSON.stringify({ created: new Date().toISOString(), reason, trades, bytes }, null, 2));
    await backupPrune();
    return name;
}

async function backupPrune() {
    const { keep } = backupPrefs();
    const list = await backupList();
    const daily = list.filter(b => b.reason === 'daily');
    const other = list.filter(b => b.reason !== 'daily');
    const drop = [...daily.slice(keep), ...other.slice(BACKUP_KEEP_OTHER)];
    if (!drop.length) return;
    const root = await backupRoot(true);
    for (const b of drop) { try { await root.removeEntry(b.name, { recursive: true }); } catch (e) {} }
}

// The files as they are on disk now (what journalStamp loaded), plus share.json
async function backupCurrentTexts() {
    const texts = {};
    for (const f of BACKUP_FILES) texts[f] = (journalStamp[f] && journalStamp[f].text) || await backupReadText(dirHandle, f);
    return texts;
}

// Called from loadDataFromFile, after reading and before the first save
async function backupDailyIfNeeded() {
    if (!backupFeatureOn || !dirHandle || journalDamaged || !backupPrefs().auto) return;
    const texts = await backupCurrentTexts();
    if (!texts['vwap-journal.json'] || texts['vwap-journal.json'].trim() === '[]') return; // nothing to keep yet
    const today = backupStamp().slice(0, 10);
    const list = await backupList();
    if (list.some(b => b.reason === 'daily' && b.name.startsWith(today))) return;
    try { await backupWrite('daily', texts); } catch (e) { console.warn('Daily backup failed', e); }
}

// ---------- Damaged journal file ----------

// Called from loadDataFromFile when vwap-journal.json (or settings.json) can't be read
async function backupHandleDamaged(file, text) {
    const keptAs = file.replace('.json', `.damaged-${backupStamp()}.json`);
    try { await backupWriteText(dirHandle, keptAs, text); } catch (e) {}
    journalDamaged = { file, keptAs };
    journalReadOnly = true; // never write over the damaged file
    journalStatusSync();
    setTimeout(backupDamagedDialog, 0);
}

async function backupDamagedDialog() {
    if (document.getElementById('app-dialog')) return;
    const list = backupFeatureOn ? await backupList() : [];
    const latest = list[0];
    const overlay = document.createElement('div');
    overlay.id = 'app-dialog';
    overlay.className = 'app-dialog-overlay';
    overlay.innerHTML = `
        <div class="app-dialog backup-dialog" role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title">
            <span class="app-dialog-icon is-danger">${BACKUP_ICONS.warn}</span>
            <div class="app-dialog-copy">
                <h2 id="app-dialog-title">Your journal file could not be read</h2>
                <p><strong>${journalDamaged.file}</strong> is damaged, probably by a save that was interrupted or by a sync service like iCloud, Dropbox or OneDrive. Nothing was overwritten: the damaged file is kept as <strong>${journalDamaged.keptAs}</strong>.</p>
            </div>
            ${latest ? `<div class="backup-latest"><span class="backup-latest-icon">${BACKUP_ICONS.shield}</span><div><strong>Latest backup: ${backupLabel(latest.created)}</strong><span>${latest.trades} trades · ${backupSize(latest.bytes)}</span></div></div>`
                     : `<div class="backup-latest is-empty"><span class="backup-latest-icon">${BACKUP_ICONS.warn}</span><div><strong>${backupFeatureOn ? 'No backup yet' : 'Nothing is lost'}</strong><span>The journal stays read only, so nothing is lost. Close the app and check the previous versions of the file in your sync service, or mail hello.ordercraft@gmail.com.</span></div></div>`}
            <div class="app-dialog-actions">
                ${latest ? `<button type="button" class="btn-secondary" data-dialog="choose">Choose another backup</button><button type="button" class="btn-primary" data-dialog="ok">Restore latest backup</button>`
                         : `<button type="button" class="btn-primary" data-dialog="cancel">OK</button>`}
            </div>
        </div>`;
    let release = null;
    const close = () => { overlay.remove(); if (release) release(); };
    document.body.appendChild(overlay);
    const ok = overlay.querySelector('[data-dialog="ok"]');
    if (ok) ok.addEventListener('click', () => { close(); backupRestore(latest, true); });
    const choose = overlay.querySelector('[data-dialog="choose"]');
    if (choose) choose.addEventListener('click', () => { close(); backupRestoreDialog(); });
    const cancel = overlay.querySelector('[data-dialog="cancel"]');
    if (cancel) cancel.addEventListener('click', close);
    release = appDialogTrap(overlay.querySelector('.app-dialog'), { onEscape: close, initialFocus: ok || cancel });
}

// ---------- Restore ----------

async function backupRestoreDialog() {
    if (document.getElementById('app-dialog')) return;
    const list = await backupList();
    const overlay = document.createElement('div');
    overlay.id = 'app-dialog';
    overlay.className = 'app-dialog-overlay';
    const reasonLabel = r => r === 'daily' ? 'Daily' : r === 'manual' ? 'By hand' : 'Before a restore';
    overlay.innerHTML = `
        <div class="app-dialog backup-dialog backup-list-dialog" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title">
            <button type="button" class="rules-code-close" data-dialog="cancel" aria-label="Close">&times;</button>
            <span class="app-dialog-icon is-primary">${BACKUP_ICONS.restore}</span>
            <div class="app-dialog-copy">
                <h2 id="app-dialog-title">Restore a backup</h2>
                <p>Your journal is replaced by the backup you choose. ${journalDamaged ? '' : 'Your journal as it is now is saved as a backup first, so you can always go back.'} Screenshots are not touched.</p>
            </div>
            ${list.length ? `<div class="backup-rows" role="radiogroup" aria-label="Backups">
                ${list.map((b, i) => `<label class="backup-row"><input type="radio" name="backup-pick" value="${b.name}" ${i === 0 ? 'checked' : ''}>
                    <span class="backup-row-main"><strong>${backupLabel(b.created)}</strong><span>${b.trades} trades · ${backupSize(b.bytes)}</span></span>
                    <span class="backup-row-tag ${b.reason === 'daily' ? '' : 'is-other'}">${reasonLabel(b.reason)}</span></label>`).join('')}
            </div>` : `<p class="backup-none">No backups yet. The first one is made the next time you open your journal.</p>`}
            <div class="app-dialog-actions">
                <button type="button" class="btn-secondary" data-dialog="cancel">Cancel</button>
                ${list.length ? `<button type="button" class="btn-primary" data-dialog="ok">Restore</button>` : ''}
            </div>
        </div>`;
    let release = null;
    const close = () => { overlay.remove(); if (release) release(); };
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-dialog="cancel"]').forEach(b => b.addEventListener('click', close));
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
    const ok = overlay.querySelector('[data-dialog="ok"]');
    if (ok) ok.addEventListener('click', () => {
        const name = (overlay.querySelector('input[name="backup-pick"]:checked') || {}).value;
        const pick = list.find(b => b.name === name);
        close();
        if (pick) backupRestore(pick, !!journalDamaged);
    });
    release = appDialogTrap(overlay.querySelector('.app-dialog'), { onEscape: close, initialFocus: 'input[name="backup-pick"]:checked' });
}

async function backupRestore(b, skipConfirm) {
    if (!b) return;
    if (!skipConfirm) {
        const ok = await appConfirm({
            title: `Restore the backup from ${backupLabel(b.created)}?`,
            message: `Your journal (${appData.trades.length} trades) is replaced by this backup (${b.trades} trades). Your journal as it is now is saved as a backup first, so you can go back.`,
            confirmText: 'Restore backup', tone: 'primary', icon: 'undo'
        });
        if (!ok) return;
    }
    try {
        if (!journalDamaged) await backupWrite('before-restore', await backupCurrentTexts());
        for (const f of BACKUP_FILES) {
            const text = await backupReadText(b.dir, f);
            if (text !== null) await backupWriteText(dirHandle, f, text);
        }
        journalDamaged = null;
        journalReadOnly = false;
        journalReloading = true;
        await loadDataFromFile();
        if (typeof renderSettingsUI === 'function' && document.getElementById('view-settings').classList.contains('active')) renderSettingsUI();
        showToast(`Backup from ${backupLabel(b.created)} restored.`, 'success');
    } catch (e) {
        console.error('Restore failed', e);
        showToast('The backup could not be restored. Your journal was not changed.', 'error');
    }
}

async function backupNow() {
    try {
        await autoSave();
        const texts = {};
        for (const f of BACKUP_FILES) texts[f] = await backupReadText(dirHandle, f);
        await backupWrite('manual', texts);
        showToast('Backup made.', 'success');
        if (typeof renderSettingsUI === 'function') renderSettingsUI();
    } catch (e) { showToast('The backup could not be made.', 'error'); }
}

// ---------- Settings › Backups ----------

async function backupSettingsEl(container) {
    const prefs = backupPrefs();
    const list = await backupList();
    const latest = list[0];
    const card = document.createElement('div');
    card.className = 'backup-status-card';
    card.innerHTML = `
        <span class="backup-status-icon ${prefs.auto ? '' : 'is-off'}">${BACKUP_ICONS.shield}</span>
        <div class="backup-status-text">
            <strong>${prefs.auto ? 'Automatic backups are on' : 'Automatic backups are off'}</strong>
            <span>${latest ? `Last backup: ${backupLabel(latest.created)} · ${latest.trades} trades · ${list.length} backups kept` : 'No backup yet: the first one is made the next time you open your journal.'}</span>
        </div>
        <div class="backup-status-actions">
            <button type="button" class="btn-secondary btn-sm" data-backup="now">Back up now</button>
            <button type="button" class="btn-secondary btn-sm" data-backup="restore">Restore a backup</button>
        </div>`;
    card.querySelector('[data-backup="now"]').onclick = backupNow;
    card.querySelector('[data-backup="restore"]').onclick = backupRestoreDialog;
    container.appendChild(card);

    const opts = document.createElement('div');
    opts.className = 'setting-category-card backup-options';
    opts.innerHTML = `
        <h2 class="setting-cat-title">Backups</h2>
        <div class="backup-opt">
            <div><strong>Daily backup</strong><span>The first time you open your journal each day, your trades and settings are copied to the <em>backups</em> folder inside your journal folder.</span></div>
            <button type="button" class="${prefs.auto ? 'btn-secondary' : 'btn-primary'} btn-sm" data-backup="auto">${prefs.auto ? 'Disable' : 'Enable'}</button>
        </div>
        <div class="backup-opt">
            <div><strong>Keep backups for</strong><span>Older daily backups are removed. Backups you make by hand and the ones made before a restore: the last ${BACKUP_KEEP_OTHER}.</span></div>
            <div class="cc-seg" role="group" aria-label="Keep backups for">${BACKUP_KEEP_OPTIONS.map(n => `<button type="button" class="cc-seg-btn ${prefs.keep === n ? 'is-selected' : ''}" data-keep="${n}">${n} days</button>`).join('')}</div>
        </div>
        <p class="help-text backup-foot">Screenshots are not copied: they never change after you add them. For an extra copy somewhere else (Google Drive, Dropbox, a USB stick) or to move to another computer, copy the whole journal folder.</p>`;
    opts.querySelector('[data-backup="auto"]').onclick = () => { appData.settings.backup = { ...prefs, auto: !prefs.auto }; autoSave(); renderSettingsUI(); };
    opts.querySelectorAll('[data-keep]').forEach(btn => btn.onclick = () => { appData.settings.backup = { ...prefs, keep: Number(btn.dataset.keep) }; autoSave(); renderSettingsUI(); });
    container.appendChild(opts);
}
