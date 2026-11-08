// --- What's new (the bell, top right) ---
// Every release whose feature switch is on shows in the list. No release on = no bell.
// The blue dot on the bell only shows for journals that existed before the release:
// settings.releasesSeen = ids of the releases this journal has already seen.
// A new journal (no trades yet) gets every release that is on as "seen", so no dot.

// ---------- The releases (newest first) ----------
// To add a release: add an entry on top, with on() pointing to its feature switch.
// Switch, date and YouTube id of each release live in FEATURES (globals.js).
// The video only loads when someone clicks it.
const RELEASES = [
    {
        id: 'scalping-mode',
        on: () => typeof scalpFeatureOn !== 'undefined' && scalpFeatureOn,
        date: FEATURES.scalp ? FEATURES.scalp.date : '',
        youtube: FEATURES.scalp ? FEATURES.scalp.youtube : '',
        icon: 'bolt',
        title: 'Scalping mode',
        summary: 'Log a trade in seconds on busy days. Complete it later.',
        image: 'releases/scalping-mode.webp',
        intro: 'Many trades in a day? Switch to Scalp at the bottom of the sidebar and log each trade in a few seconds. Add the details when the market is closed.',
        points: [
            ['zap', 'Quick trade', 'Symbol, direction, setup and result. Enter saves and starts the next one.'],
            ['camera', 'Auto-Capture with Alt A', 'A screenshot of your chart window in one key, or paste one.'],
            ['check', 'Complete trade later', 'Add market condition, location and notes when you have time.'],
            ['bar', 'Day bar and a loss limit', 'All trades of the day at a glance, and a calm message at your max losses.']
        ],
        cta: 'Switch to Scalp',
        go: () => { if (typeof scalpSet === 'function') scalpSet(true, true); }
    },
    {
        id: 'automatic-backups',
        on: () => typeof backupFeatureOn !== 'undefined' && backupFeatureOn,
        date: FEATURES.backup ? FEATURES.backup.date : '',
        youtube: FEATURES.backup ? FEATURES.backup.youtube : '',
        icon: 'shield',
        title: 'Automatic backups',
        summary: 'Your journal is copied every day. Restore it in one click.',
        image: 'releases/automatic-backups.webp',
        intro: 'Your trades are your most valuable data. From now on the journal makes a copy every day, and a damaged file can never cost you your trades again.',
        points: [
            ['check', 'A copy every day', 'The first time you open your journal each day, in the backups folder.'],
            ['plus', 'Restore in one click', 'Settings › Backups: choose a day and you are back.'],
            ['eye', 'A damaged file is caught', 'Never overwritten: the app offers your latest backup.'],
            ['link', 'Undo a restore too', 'Before a restore, your journal is saved as a backup first.']
        ],
        cta: 'Open Backups',
        go: () => { if (typeof btnNavSettings !== 'undefined' && btnNavSettings) btnNavSettings.click(); if (typeof switchSettingsTab === 'function') switchSettingsTab('backups'); }
    },
    {
        id: 'share-for-review',
        on: () => typeof shareFeatureOn !== 'undefined' && shareFeatureOn,
        date: FEATURES.share.date,
        youtube: FEATURES.share.youtube,
        icon: 'share',
        title: 'Share for review',
        summary: 'Get your trades reviewed by your mentor or group.',
        image: 'releases/share-for-review.webp',
        intro: 'Share trades with your mentor or trading group and find out if you really follow your system. One link, no account needed for the reviewer.',
        points: [
            ['plus', 'Add to shares', 'One click on any trade with a screenshot, or Share day for a whole day.'],
            ['link', 'Up to 10 trades, one link', 'The link works for 5 days. Cancel it any time.'],
            ['eye', 'You choose what they see', 'Your name, plus evidence, invalidation, target, psychology or notes on or off.'],
            ['msg', 'Reviews land in your journal', 'Saved with the trade, also after the link has expired.']
        ],
        cta: 'Open Your shares',
        go: () => { if (typeof openShareView === 'function') openShareView(); }
    },
    {
        id: 'rules-and-grades',
        on: () => typeof rulesFeatureOn !== 'undefined' && rulesFeatureOn,
        date: FEATURES.rules.date,
        youtube: FEATURES.rules.youtube,
        icon: 'rules',
        title: 'Rules & grades',
        summary: 'Tick off your rules on every trade and get a grade.',
        image: 'releases/rules-and-grades.webp',
        intro: 'Every setup now has a short list of rules. Tick them off when you log a trade and see if you really trade your plan.',
        points: [
            ['list', 'Rules per setup', 'Context, location, entry and risk. Edit them or add your own.'],
            ['check', 'Tick them off in seconds', '✓ or ✗ per rule, or use the keys 1 to 9.'],
            ['award', 'A grade for every trade', 'C to A+, from the locations that line up.'],
            ['bar', 'See which rule you break most', 'A new Rules tab on the Stats page.']
        ],
        codeNote: true,
        cta: 'Set up your rules',
        go: () => {
            if (typeof btnNavSettings !== 'undefined' && btnNavSettings) btnNavSettings.click();
            if (typeof switchSettingsTab === 'function') switchSettingsTab('rules');
        }
    }
];

const RELEASE_ICONS = {
    shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',
    rules: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    list: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    award: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
    bar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    link: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    msg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    key: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
    bolt: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/></svg>',
    zap: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/></svg>',
    camera: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>'
};

let releasesReady = false; // true once a journal is loaded (before that: no dot)

function releasesOn() { return RELEASES.filter(r => { try { return !!r.on(); } catch (e) { return false; } }); }
function releasesSeen() {
    const s = typeof appData !== 'undefined' && appData.settings;
    return (s && Array.isArray(s.releasesSeen)) ? s.releasesSeen : [];
}
function releasesUnseen() {
    if (!releasesReady) return [];
    const seen = releasesSeen();
    return releasesOn().filter(r => !seen.includes(r.id));
}

// Called from migrateSettings(), after settings.json and the trades are loaded
function releasesMigrate() {
    const s = appData.settings;
    if (!Array.isArray(s.releasesSeen)) {
        // New journal: what is out now is not "new" for this user
        const isNew = !Array.isArray(appData.trades) || appData.trades.length === 0;
        s.releasesSeen = isNew ? releasesOn().map(r => r.id) : [];
    }
    s.releasesSeen = s.releasesSeen.filter(id => typeof id === 'string');
    releasesReady = true;
    releaseBellSync();
}

function releaseBellSync() {
    const btn = document.getElementById('btn-releases');
    if (!btn) return;
    btn.hidden = releasesOn().length === 0;
    const n = releasesUnseen().length;
    btn.classList.toggle('has-new', n > 0);
    btn.setAttribute('aria-label', n ? `What's new, ${n} new` : "What's new");
    btn.title = "What's new";
}

// ---------- The list ----------

function releaseText(t) { return typeof escapeHTML === 'function' ? escapeHTML(t) : String(t); }

function openReleaseMenu(fromKeyboard) {
    if (document.getElementById('release-menu')) { closeReleaseMenu(); return; }
    const list = releasesOn();
    if (!list.length) return;
    const fresh = releasesUnseen().map(r => r.id);
    const btn = document.getElementById('btn-releases');
    const menu = document.createElement('div');
    menu.id = 'release-menu';
    menu.className = 'release-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', "What's new");
    menu.innerHTML = `
        <div class="release-menu-head"><span>What's new</span><span class="release-menu-sub">Releases</span></div>
        <div class="release-menu-list">
        ${list.map(r => {
            const isNew = fresh.includes(r.id);
            return `<button type="button" class="release-item ${isNew ? 'is-new' : ''}" role="menuitem" data-release="${r.id}">
                <span class="release-item-icon">${RELEASE_ICONS[r.icon] || ''}</span>
                <span class="release-item-text">
                    <span class="release-item-top"><strong>${releaseText(r.title)}</strong>${isNew ? '<span class="release-new">New</span>' : ''}</span>
                    <span class="release-item-sum">${releaseText(r.summary)}</span>
                    ${r.date ? `<span class="release-item-date">${releaseText(r.date)}</span>` : ''}
                </span>
                <span class="release-item-chev">${RELEASE_ICONS.chev}</span>
            </button>`;
        }).join('')}
        </div>`;
    btn.parentElement.appendChild(menu);
    btn.classList.add('active');
    btn.setAttribute('aria-expanded', 'true');
    menu.querySelectorAll('.release-item').forEach(b => b.addEventListener('click', () => openReleaseDialog(b.dataset.release)));
    if (fromKeyboard) { const first = menu.querySelector('.release-item'); if (first) first.focus(); }

    // Opening the list counts as seen: the dot goes away now, the "New" tags stay until it closes
    if (fresh.length) {
        appData.settings.releasesSeen = [...new Set([...releasesSeen(), ...fresh])];
        releaseBellSync();
        if (typeof autoSave === 'function') autoSave();
    }
    setTimeout(() => document.addEventListener('mousedown', releaseMenuOutside, true), 0);
    document.addEventListener('keydown', releaseMenuKey, true);
}

function releaseMenuOutside(e) {
    const m = document.getElementById('release-menu');
    if (m && !m.contains(e.target) && !e.target.closest('#btn-releases')) closeReleaseMenu();
}

function releaseMenuKey(e) {
    const m = document.getElementById('release-menu');
    if (!m || document.getElementById('app-dialog')) return;
    if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        closeReleaseMenu();
        const btn = document.getElementById('btn-releases'); if (btn) btn.focus();
        return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        const items = [...m.querySelectorAll('.release-item')];
        const i = items.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
        items[next].focus();
    }
}

function closeReleaseMenu() {
    const m = document.getElementById('release-menu');
    if (m) m.remove();
    const btn = document.getElementById('btn-releases');
    if (btn) { btn.classList.remove('active'); btn.setAttribute('aria-expanded', 'false'); }
    document.removeEventListener('mousedown', releaseMenuOutside, true);
    document.removeEventListener('keydown', releaseMenuKey, true);
}

// ---------- The popup ----------

function openReleaseDialog(id) {
    const r = RELEASES.find(x => x.id === id);
    if (!r || document.getElementById('app-dialog')) return;
    closeReleaseMenu();
    const previousFocus = document.getElementById('btn-releases');
    const own = typeof rulesOwnSystem === 'function' && rulesOwnSystem();
    const showCode = r.codeNote && !own && typeof rulesOpenCodeInfoDialog === 'function';
    const overlay = document.createElement('div');
    overlay.id = 'app-dialog';
    overlay.className = 'app-dialog-overlay';
    overlay.innerHTML = `
        <div class="app-dialog release-dialog" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title">
            <button type="button" class="rules-code-close" data-dialog="cancel" aria-label="Close">&times;</button>
            <div class="release-hero">
                <img src="${r.image}" alt="">
                ${r.youtube ? `<button type="button" class="release-play" data-dialog="play">${RELEASE_ICONS.play}Watch the video</button>` : ''}
            </div>
            <div class="app-dialog-copy">
                <span class="release-kicker"><span class="release-kicker-dot"></span>${r.date ? `New · ${releaseText(r.date)}` : 'New release'}</span>
                <h2 id="app-dialog-title">${releaseText(r.title)}</h2>
                <p>${releaseText(r.intro)}</p>
            </div>
            <div class="release-points">
                ${r.points.map(([ic, t, d]) => `<div class="release-point"><span class="release-point-icon">${RELEASE_ICONS[ic] || ''}</span><div class="release-point-text"><strong>${releaseText(t)}</strong><span>${releaseText(d)}</span></div></div>`).join('')}
            </div>
            ${showCode ? `<div class="release-note"><span class="release-note-icon">${RELEASE_ICONS.key}</span><span>The default rules for the setups unlock with a <strong>VWS code</strong>, shared in the Discord of the Drysdale Trading Group. The rules for all setups and your own rules always work.</span><button type="button" class="release-note-link" data-dialog="code">Where do I find a code?</button></div>` : ''}
            <div class="app-dialog-actions">
                <button type="button" class="btn-secondary" data-dialog="cancel">Close</button>
                <button type="button" class="btn-primary" data-dialog="ok">${releaseText(r.cta)}</button>
            </div>
        </div>`;

    let release = null;
    const close = () => {
        overlay.remove(); // also stops a playing video
        if (release) release();
    };
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
    overlay.querySelectorAll('[data-dialog="cancel"]').forEach(b => b.addEventListener('click', close));
    overlay.querySelector('[data-dialog="ok"]').addEventListener('click', () => { close(); r.go(); });
    const code = overlay.querySelector('[data-dialog="code"]');
    if (code) code.addEventListener('click', () => { close(); rulesOpenCodeInfoDialog(); });
    const play = overlay.querySelector('[data-dialog="play"]');
    if (play) play.addEventListener('click', () => {
        // Only now does anything load from YouTube (privacy-enhanced mode, no cookies until it plays)
        const hero = overlay.querySelector('.release-hero');
        hero.classList.add('is-playing');
        hero.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(r.youtube)}?autoplay=1&rel=0" title="${releaseText(r.title)} video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    });

    document.body.appendChild(overlay);
    release = appDialogTrap(overlay.querySelector('.app-dialog'), {
        onEscape: close, initialFocus: '[data-dialog="ok"]',
        returnFocus: previousFocus && !previousFocus.hidden ? previousFocus : null
    });
}

// ---------- start ----------

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-releases');
    if (btn) btn.addEventListener('click', (e) => openReleaseMenu(e.detail === 0));
    releaseBellSync();
});
