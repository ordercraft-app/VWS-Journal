// ===================== Stream Deck (streamdeck.js) =====================
// Release switch: FEATURES.streamdeck.on (globals.js). Test per browser with ?streamdeck=on / ?streamdeck=off.
// With the feature on:
//  - What's new: release “Stream Deck icon pack” (releases.js), main button to the Elgato Marketplace,
//    second button “See how to boost it” opens the page below.
//  - Sidebar: Stream Deck button under Help, page #view-streamdeck: combine the VWS Journal keys with
//    Tradovate trade keys (set up in 8 steps, how it works, keys & shortcuts, troubleshooting).
//  - Downloads in streamdeck/: the two Stream Deck profiles and the Tampermonkey size script.
// Data: only localStorage 'vws-streamdeck-steps' (the Done ticks, per browser). Nothing in the journal.

const SD_FEATURE_ENABLED = !!(FEATURES.streamdeck && FEATURES.streamdeck.on);
const SD_FEATURE_KEY = 'vws-streamdeck-feature';
const sdFeatureOn = (() => {
    let override = null;
    try {
        const params = new URLSearchParams(window.location.search);
        const asked = (params.get('streamdeck') || '').toLowerCase();
        if (asked === 'on' || asked === 'off') {
            localStorage.setItem(SD_FEATURE_KEY, asked);
            params.delete('streamdeck');
            const rest = params.toString();
            history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
        }
        override = localStorage.getItem(SD_FEATURE_KEY);
    } catch (e) { /* storage blocked: use the default */ }
    if (override === 'on') return true;
    if (override === 'off') return false;
    return SD_FEATURE_ENABLED;
})();
document.documentElement.classList.toggle('streamdeck-on', sdFeatureOn);

const SD_MARKETPLACE = 'https://marketplace.elgato.com/@ordercraft';
const SD_FILES = {
    tradovate: 'streamdeck/Tradovate.streamDeckProfile',
    journal: 'streamdeck/VWS-Journal.streamDeckProfile',
    script: 'streamdeck/tradovate-size.user.js'
};
const SD_STEPS_KEY = 'vws-streamdeck-steps';
const SD_STEP_COUNT = 8;
let sdTab = 'setup';

// ---------- small builders ----------
const sdSvg = (d, s = 16, extra = '') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const SD_IC = {
    deck: '<rect x="2" y="4" width="20" height="16" rx="3"/><g fill="currentColor" stroke="none"><rect x="5" y="7.9" width="2.8" height="2.8" rx=".6"/><rect x="10.6" y="7.9" width="2.8" height="2.8" rx=".6"/><rect x="16.2" y="7.9" width="2.8" height="2.8" rx=".6"/><rect x="5" y="13.3" width="2.8" height="2.8" rx=".6"/><rect x="10.6" y="13.3" width="2.8" height="2.8" rx=".6"/><rect x="16.2" y="13.3" width="2.8" height="2.8" rx=".6"/></g>',
    ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    cam: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    bolt: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z" fill="currentColor" stroke="none"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    pkg: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    user: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M12 8v8"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>',
    clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M10 2h4"/>',
    key: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    chev: '<polyline points="6 9 12 15 18 9"/>'
};
const sdKey = n => `streamdeck/keys/${n}.webp`;
const sdCam = (cls = '') => `<span class="sd-cam${cls}" title="Also adds a screenshot">${sdSvg(SD_IC.cam, 10, 'stroke-width="2.6"')}</span>`;
const sdKbd = s => `<span class="sd-kbd">${s.split(' + ').map(k => `<kbd class="keys-kbd">${k}</kbd>`).join('')}</span>`;
const sdExtLink = (label, cls) => `<a class="${cls}" href="${SD_MARKETPLACE}" target="_blank" rel="noopener noreferrer">${label} ${sdSvg(SD_IC.ext, 13)}<span class="sd-sr"> (opens in a new tab)</span></a>`;

// The two decks, as on Sanny's Stream Deck (15 keys, left to right, top to bottom)
const SD_TRADE = [['dom-size-1'], ['dom-size-2'], ['dom-size-3'], ['dom-size-4'], ['vws-journal', 'switch'],
    ['dom-join-ask', 'cam'], ['dom-sell-market', 'cam'], ['empty'], ['dom-buy-market', 'cam'], ['dom-join-bid', 'cam'],
    ['dom-flatten-all', 'cam'], ['empty'], ['dom-center'], ['empty'], ['dom-cancel-all']];
const SD_JOURNAL = [['vws-new-trade'], ['vws-long'], ['vws-short'], ['vws-capture'], ['vws-trade', 'switch'],
    ['vws-setup-1'], ['vws-setup-2'], ['vws-setup-3'], ['vws-setup-4'], ['vws-more-setups'],
    ['vws-win'], ['vws-loss'], ['vws-break-even'], ['vws-save-close'], ['vws-save-next']];
const sdDeck = (keys, size, label) => `<div class="sd-deck ${size}" role="img" aria-label="${label}">${keys.map(([k, f]) =>
    `<div class="sd-key${f === 'switch' ? ' is-switch' : ''}"><img src="${sdKey(k)}" alt="" loading="lazy" decoding="async">${f === 'cam' ? sdCam() : ''}</div>`).join('')}</div>`;

function sdStepsDone() {
    try {
        const v = JSON.parse(localStorage.getItem(SD_STEPS_KEY) || '[]');
        return Array.isArray(v) ? v.filter(n => Number.isInteger(n) && n >= 1 && n <= SD_STEP_COUNT) : [];
    } catch (e) { return []; }
}
function sdStepsSave(list) {
    try { localStorage.setItem(SD_STEPS_KEY, JSON.stringify([...new Set(list)].sort((a, b) => a - b))); } catch (e) { /* storage blocked: ticks just don't stay */ }
}

const sdStep = (n, title, body, opts = {}) => {
    const done = sdStepsDone().includes(n);
    return `<div class="sd-step${opts.key ? ' is-key' : ''}${done ? ' is-done' : ''}" data-step="${n}">
        <div class="sd-num" aria-hidden="true">${done ? sdSvg(SD_IC.check, 16, 'stroke-width="3"') : n}</div>
        <h3><span class="sd-sr">Step ${n}: </span>${title}${opts.key ? '<span class="sd-flag">Most important</span>' : ''}</h3>
        <button type="button" class="sd-done" data-sd-done="${n}" aria-pressed="${done}" aria-label="Step ${n} done"><span class="box" aria-hidden="true">${done ? sdSvg(SD_IC.check, 11, 'stroke-width="3.5"') : ''}</span>Done</button>
        <div class="sd-body">${body}</div></div>`;
};
const sdCheckline = t => `<div class="sd-checkline">${sdSvg(SD_IC.check, 14, 'stroke-width="2.6"')}<span><strong>Check:</strong> ${t}</span></div>`;

// Stream Deck multi action mocks
const SD_MA_TRADE = [['rocket', 'Open', 'Tradovate', 1], ['clock', 'Delay', '50 ms'], ['key', 'Hotkey', '⌃ ⇧ 5', 2], ['clock', 'Delay', '50 ms'],
    ['rocket', 'Open', 'VWS Journal', 1], ['clock', 'Delay', '100 ms'], ['key', 'Hotkey', 'C'], ['clock', 'Delay', '100 ms'], ['rocket', 'Open', 'Tradovate', 1]];
const sdMaBox = (title, rows) => `<div class="sd-ma"><div class="sd-ma-title">${title}</div>${rows.map(([i, a, v, o]) =>
    `<div class="sd-ma-row${o === 1 ? ' is-open' : o === 2 ? ' is-hot' : ''}">${sdSvg(SD_IC[i], 15)}<span>${a}</span>${o === 2 ? '<em class="sd-hot-tag">Tradovate hotkey</em>' : ''}<small>${v}</small></div>`).join('')}</div>`;

// Trading keys: [icon, key, Tradovate action, shortcut, screenshot, extra]
const SD_HOT = [['dom-size-1', 'Size 1–4', 'Size script (no Tradovate hotkey)', 'Ctrl + Shift + 1', false, 'size'],
    ['dom-center', 'Center', 'Center DOM', 'Ctrl + Shift + 2', false], ['dom-buy-market', 'Buy market', 'Buy Market', 'Ctrl + Shift + 3', true],
    ['dom-sell-market', 'Sell market', 'Sell Market', 'Ctrl + Shift + 4', true], ['dom-join-bid', 'Join bid', 'Join Bid', 'Ctrl + Shift + 5', true],
    ['dom-join-ask', 'Join ask', 'Join Ask', 'Ctrl + Shift + 6', true], ['dom-flatten-all', 'Flatten', 'Exit at Market and Cancel', 'Ctrl + Shift + G', true],
    ['dom-cancel-all', 'Cancel all', 'Cancel All', 'Ctrl + Shift + H', false], ['vws-journal', 'VWS Journal', '—', '', false, 'open:VWS Journal']];
const sdHotTable = withShot => `<div class="sd-table-wrap"><table class="sd-table"><thead><tr><th scope="col">Stream Deck key</th><th scope="col">Tradovate action</th><th scope="col">Shortcut</th>${withShot ? '<th scope="col">Screenshot</th>' : ''}</tr></thead><tbody>${SD_HOT.filter(r => withShot || (r[3] && r[5] !== 'size')).map(([i, k, a, s, shot, extra]) =>
    `<tr><td class="k"><img src="${sdKey(i)}" alt="" loading="lazy">${k}</td><td class="muted">${a}</td><td>${s ? sdKbd(s) : `<span class="muted">Opens the ${extra.slice(5)} app</span>`}</td>${withShot ? `<td>${shot ? `<span class="yes">${sdSvg(SD_IC.cam, 14)}Yes</span>` : '<span class="muted">—</span>'}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;

// Journal keys: [icon, key, does, VWS Journal shortcut]
const SD_JK = [['vws-new-trade', 'New trade', 'Opens Quick trade', 'Alt + N'], ['vws-long', 'Long / Short', 'Direction', '↑ / ↓'], ['vws-capture', 'Capture', 'Adds a screenshot', 'C'],
    ['vws-setup-1', 'Setup 1–4', 'Setups in the order of Settings', '1 – 4'], ['vws-more-setups', 'More setups', 'Folder with setups 5–9 and Back', ''],
    ['vws-win', 'Win / Loss / B/E', 'Result', 'W / L / B'], ['vws-save-close', 'Save & close', 'Saves the trade', 'Shift + Enter'], ['vws-save-next', 'Save & next', 'Saves and opens the next trade', 'Enter'],
    ['vws-trade', 'Trade', 'Back to your trading keys', 'open:Tradovate']];
const sdJournalTable = () => `<div class="sd-table-wrap"><table class="sd-table compact"><thead><tr><th scope="col">Stream Deck key</th><th scope="col">Does</th><th scope="col">VWS Journal shortcut</th></tr></thead><tbody>${SD_JK.map(([i, k, d, s]) =>
    `<tr><td class="k"><img src="${sdKey(i)}" alt="" loading="lazy">${k}</td><td class="muted">${d}</td><td>${s.startsWith('open:') ? `<span class="muted">Opens the ${s.slice(5)} app</span>` : s ? (s.includes(' / ') ? s.split(' / ').map(x => sdKbd(x)).join(' <span class="muted">/</span> ') : sdKbd(s)) : '<span class="muted">Stream Deck folder</span>'}</td></tr>`).join('')}</tbody></table></div>`;

const sdFaq = (q, a) => `<div class="faq-item open"><button type="button" class="faq-question" aria-expanded="true"><span>${q}</span>${sdSvg(SD_IC.chev, 20, 'class="faq-icon"')}</button><div class="faq-answer">${a}</div></div>`;

// ---------- the tabs ----------
function sdTabSetup() {
    const done = sdStepsDone().length;
    return `
      <div class="sd-tip sd-tip-top">${sdSvg(SD_IC.deck, 16)}<span><strong>Only want the journal keys?</strong> You only need the VWS Journal pack and the VWS Journal profile: follow steps 1 to 4 for VWS Journal only.</span></div>
      <h2 class="sd-section-title">What you need</h2>
      <div class="sd-need">
        <div class="sd-need-item"><span class="sd-need-icon">${sdSvg(SD_IC.deck, 18)}</span><strong>Stream Deck</strong><span>MK.2 or another model with 15 keys.</span></div>
        <div class="sd-need-item"><span class="sd-need-icon">${sdSvg(SD_IC.pkg, 18)}</span><strong>2 icon packs</strong><span>One of the DOM scalping packs and the VWS Journal pack.</span></div>
        <div class="sd-need-item"><span class="sd-need-icon">${sdSvg(SD_IC.user, 18)}</span><strong>2 profiles</strong><span>Tradovate and VWS Journal, every key set up. Download them here.</span></div>
        <div class="sd-need-item"><span class="sd-need-icon">${sdSvg(SD_IC.globe, 18)}</span><strong>Chrome or Edge</strong><span>Tradovate and VWS Journal installed as apps.</span></div>
        <div class="sd-need-item"><span class="sd-need-icon">${sdSvg(SD_IC.code, 18)}</span><strong>Tampermonkey</strong><span>Free browser extension, for the size keys.</span></div>
      </div>
      <div class="sd-progress"><div class="sd-progress-bar" role="progressbar" aria-label="Set up" aria-valuemin="0" aria-valuemax="${SD_STEP_COUNT}" aria-valuenow="${done}"><i style="width:${Math.round(done / SD_STEP_COUNT * 100)}%"></i></div><span>${done} of ${SD_STEP_COUNT} done</span></div>
      <div class="sd-steps">
        ${sdStep(1, 'Install Tradovate and VWS Journal as apps', `<p>The Stream Deck keys open these apps. In a normal browser tab they can't find the right window.</p>
          <div class="sd-sub"><b>Chrome</b><span class="sd-path">⋮<i>›</i>Cast, save and share<i>›</i>Install page as app</span><b>Edge</b><span class="sd-path">⋯<i>›</i>Apps<i>›</i>Install this site as an app</span></div>
          ${sdCheckline('both open in their own window, without tabs.')}`)}
        ${sdStep(2, 'Get the icon packs and the profiles', `<p>Get one of the DOM scalping packs and the VWS Journal pack on the Elgato Marketplace. Download the two profiles here.</p>
          <div class="sd-actions">${sdExtLink('Get the icon packs', 'btn-secondary btn-sm')}<a class="btn-secondary btn-sm" href="${SD_FILES.tradovate}" download>${sdSvg(SD_IC.dl, 13)} Tradovate profile</a><a class="btn-secondary btn-sm" href="${SD_FILES.journal}" download>${sdSvg(SD_IC.dl, 13)} VWS Journal profile</a></div>`)}
        ${sdStep(3, 'Import the profiles', `<p>In Stream Deck, open <strong>Preferences › Profiles</strong>. Click the <strong>chevron ▾</strong> under the list of profiles, choose <strong>Import…</strong> and pick the downloaded file. Do this for both profiles.</p>
          <div class="sd-row"><div class="sd-menu" aria-hidden="true"><div class="sd-menu-bar"><span>+</span><span>−</span><span class="chev">⌄</span></div><div class="sd-menu-pop"><span>Duplicate</span><span>Rename</span><i></i><span class="on">Import…</span><span>Export…</span><i></i><span>Backup All <em>›</em></span></div></div>
          <div class="sd-why"><div class="sd-sub sd-sub-top"><b>Tradovate</b><span>Make it the <strong>default profile</strong>.</span><b>VWS Journal</b><span>Select it and choose the <strong>VWS Journal app</strong> as its app.</span></div>
          <p>Why: Stream Deck then shows your journal keys by itself when VWS Journal is in front, and your trading keys when Tradovate is in front. That is why the VWS Journal and Trade keys simply open the app.</p></div></div>
          ${sdCheckline('Stream Deck starts with your trading keys.')}`)}
        ${sdStep(4, 'Put the icons on the keys', `<p>Every key is named after its icon. Click a key, open the image menu <strong>▾ › Icon library</strong>, choose the pack and pick the icon with the same name. Each icon comes static or animated, with or without a label: pick the one you like.</p>
          <div class="sd-row"><div class="sd-name"><span><span class="lbl">Key name</span><br><strong>Join Bid</strong></span><span class="muted" aria-hidden="true">→</span><img src="${sdKey('dom-join-bid')}" alt="Join Bid icon" loading="lazy"></div><div class="sd-name"><span><span class="lbl">Key name</span><br><strong>Save & next</strong></span><span class="muted" aria-hidden="true">→</span><img src="${sdKey('vws-save-next')}" alt="Save & next icon" loading="lazy"></div></div>`)}
        ${sdStep(5, 'Check the Open actions in every key', `<p>Every key starts with an <strong>Open</strong> action. Click each one and choose the <strong>installed app</strong>, not Chrome or Edge.</p>
          <div class="sd-sub"><b>Trading keys</b><span>Open <strong>Tradovate</strong>. The keys with a camera also open <strong>VWS Journal</strong> for the screenshot, then Tradovate again.</span><b>Journal keys</b><span>Open <strong>VWS Journal</strong>. Only the <strong>Trade</strong> key opens <strong>Tradovate</strong>.</span></div>
          <div class="sd-sub"><b>Mac</b><span class="sd-path">Home folder<i>›</i>Applications<i>›</i>Chrome Apps (or Edge Apps)</span><b>Windows</b><span class="sd-path">Start menu<i>›</i>Chrome Apps (or your Edge apps)</span></div>
          <div class="sd-row"><div>${sdMaBox('Trading key · Join Bid', SD_MA_TRADE)}</div><div>${sdMaBox('Journal key · Capture', [['rocket', 'Open', 'VWS Journal', 1], ['clock', 'Delay', '50 ms'], ['key', 'Hotkey', 'C']])}<div class="sd-gap"></div>${sdMaBox('Journal key · Trade', [['rocket', 'Open', 'Tradovate', 1]])}</div>
          <div class="sd-ma-note">Check <strong>every key</strong> in both profiles. If an Open action shows another app or is empty, choose the installed app.<p>The keys use pauses of <strong>50 and 100 ms</strong>. If that is too fast for your computer, raise them a little, for example to 100 and 150 ms.</p></div></div>`, { key: true })}
        ${sdStep(6, 'Set the hotkeys in Tradovate', `<p>Tradovate › <strong>Settings › Application › Hotkeys</strong>. Turn on <strong>Hotkeys</strong>, the DOM group and the SuperDOM/Chart group, and set these shortcuts. On a Mac, use <strong>Control (⌃)</strong>, not Command. The size keys need no hotkey in Tradovate: the size script does that (step 7).</p>
          <div class="sd-mt">${sdHotTable(false)}</div>
          <div class="sd-row sd-row-center"><div class="sd-hbar" aria-hidden="true"><span class="sd-htip">Toggle</span><span class="sd-h">H</span><span>↗</span><span>✕</span><span>⚙</span></div><span class="muted sd-arrow" aria-hidden="true">→</span><div class="sd-tab-mock" aria-hidden="true">${sdSvg(SD_IC.key, 16)}<span>MNQZ6</span><i></i><b>✕</b></div><div class="sd-h-note"><strong>Then turn hotkeys on in every DOM:</strong> click the <strong>H</strong> at the top right of the DOM. A small <strong>keyboard icon</strong> appears in front of the symbol on the DOM tab: that DOM now listens to your hotkeys.</div></div>
          <div class="sd-tip">${sdSvg(SD_IC.key, 16)}<span><strong>Using other hotkeys in Tradovate?</strong> Keep them. Open the Stream Deck key and change the <strong>Hotkey</strong> action right after <strong>Open Tradovate</strong> (marked in blue in step 5) to your own shortcut.</span></div>`)}
        ${sdStep(7, 'Add the size script', `<p>The size keys put a size in the quantity field of the DOM. They need a small script in Tampermonkey.</p>
          <div class="sd-sub num"><b>1</b><span>Install <strong>Tampermonkey</strong> in Chrome or Edge.</span><b>2</b><span>Chrome: Tampermonkey details › <strong>Allow User Scripts</strong>. Edge: edge://extensions › <strong>Developer mode</strong>.</span><b>3</b><span>Tampermonkey › <strong>Create a new script</strong>, clear it, paste the script, save.</span><b>4</b><span>Reload Tradovate.</span></div>
          <div class="sd-actions"><button type="button" class="btn-primary btn-sm" data-sd-copy>${sdSvg(SD_IC.copy, 13)} Copy script</button></div>
          ${sdCheckline('Ctrl + Shift + 1 in Tradovate gives the quantity field a blue outline.')}`)}
        ${sdStep(8, 'Test on a sim account', `<p>Do the three things in <strong>Before you trade</strong>, then try every kind of key on a <strong>sim account</strong> before you trade live.</p>
          <div class="sd-sub"><b>Join bid</b><span>The order is placed and a screenshot appears in your Quick trade.</span><b>Size 2</b><span>The quantity in the DOM changes to 2.</span><b>VWS Journal</b><span>Your journal keys appear. <strong>Trade</strong> brings your trading keys back.</span></div>`)}
      </div>`;
}

function sdTabHow() {
    return `
      <div class="sd-how">
        <div class="sd-how-deck">${sdDeck(SD_TRADE, 'lg', 'Trading keys')}<div class="sd-deck-label"><strong>Trading keys</strong>Tradovate profile</div></div>
        <div class="sd-swap" aria-hidden="true"><span class="sd-swap-ico">⇄</span><small>top right key</small></div>
        <div class="sd-how-deck">${sdDeck(SD_JOURNAL, 'lg', 'Journal keys')}<div class="sd-deck-label"><strong>Journal keys</strong>VWS Journal profile</div></div>
      </div>
      <div class="sd-legend"><span>${sdCam(' is-static')} Places the order and adds a screenshot</span><span><span class="sw"></span> Switches between your trading and journal keys</span></div>
      <h2 class="sd-section-title sd-mt-lg">One key press</h2>
      <div class="sd-flow">
        <div class="sd-flow-item"><span class="n">1</span><strong>Press Join bid</strong><span>Or Join ask, Buy market, Sell market, Flatten.</span></div>
        <div class="sd-flow-item"><span class="n">2</span><strong>Order in Tradovate</strong><span>The order goes out first, within 50 ms.</span></div>
        <div class="sd-flow-item"><span class="n">3</span><strong>Chart in your Quick trade</strong><span>VWS Journal captures your charting app.</span></div>
        <div class="sd-flow-item"><span class="n">4</span><strong>Back in Tradovate</strong><span>The whole key takes about 0.3 seconds.</span></div>
      </div>
      <div class="sd-dom-note">${sdSvg(SD_IC.alert, 18)}<div><strong>Only the Stream Deck keys add a screenshot</strong><span>Orders you place or close directly in the DOM, with the mouse or when a stop or target fills, don't. You can still log them with your journal keys: draw the trade with the long or short tool in your charting app, then press Capture.</span></div></div>
      <h2 class="sd-section-title sd-mt-lg">Then log the trade</h2>
      <div class="sd-flow is-three">
        <div class="sd-flow-item"><span class="n">1</span><strong>Press VWS Journal</strong><span>Top right on your trading keys. Your journal keys appear.</span></div>
        <div class="sd-flow-item"><span class="n">2</span><strong>Setup, result, save</strong><span>Save & next starts the next Quick trade right away.</span></div>
        <div class="sd-flow-item"><span class="n">3</span><strong>Press Trade</strong><span>Same spot, back to your trading keys.</span></div>
      </div>`;
}

function sdTabKeys() {
    return `
      <h2 class="sd-section-title">Trading keys · Tradovate profile</h2>
      ${sdHotTable(true)}
      <div class="sd-note">On a Mac, use Control (⌃), not Command (⌘). Don't use Ctrl + Shift + 1 in Tradovate itself: the size script uses it. Using other hotkeys in Tradovate? Change the Hotkey action right after Open Tradovate in the Stream Deck key to your own shortcut.</div>
      <h2 class="sd-section-title sd-mt-lg">Journal keys · VWS Journal profile</h2>
      ${sdJournalTable()}`;
}

function sdTabHelp() {
    return `<div class="sd-faq">
      ${sdFaq('The order goes through, but no screenshot is added', `<p>Check the three things in <strong>Before you trade</strong>: VWS Journal in Scalping mode, a Quick trade open and Auto-Capture connected to your charting app. If VWS Journal reloaded, connect the window again. After Save &amp; close, open a new Quick trade. The cursor must not be in a text field, and a trade holds up to 10 screenshots.</p>`)}
      ${sdFaq('A key does nothing', `<p>Tradovate must run as an installed app, and the key's Open action must point to it (step 5). Check that Hotkeys are on in Tradovate and that the DOM tab shows the keyboard icon; if not, click the <strong>H</strong> on the DOM (step 6). On a Mac, the shortcuts use Control, not Command.</p>`)}
      ${sdFaq('The wrong window comes to the front', `<p>That key's Open action points to Chrome or Edge instead of the installed app. Click the key and choose the app again (step 5).</p>`)}
      ${sdFaq('Pressing VWS Journal doesn’t show my journal keys', `<p>The VWS Journal profile is not linked to the VWS Journal app. Choose the app in the profile (step 3). Trade not bringing your trading keys back? Make Tradovate the default profile.</p>`)}
      ${sdFaq('The size doesn’t change', `<p>Check that Tampermonkey is on and the script is enabled, then reload Tradovate. A red message “Quantity field not found” means Tradovate changed its page: let us know.</p>`)}
      ${sdFaq('The screenshot shows VWS Journal instead of the chart', `<p>Auto-Capture is connected to your whole screen. Connect the window of your charting app instead: Connect window › Window › your charting app.</p>`)}
      ${sdFaq('My stop or target filled, but there is no screenshot', `<p>Only the Stream Deck keys add a screenshot. Orders placed or closed directly in the DOM, with the mouse or by a stop or target, don't. Log them with your journal keys: draw the trade with the long or short tool in your charting app, then press Capture.</p>`)}
      ${sdFaq('VWS Journal flashes over my DOM', `<p>The screenshot keys bring VWS Journal to the front for a moment. Put VWS Journal on a second screen if you have one.</p>`)}
      ${sdFaq('Two keys pressed quickly mix things up', `<p>A key takes about 0.3 seconds. Wait for it to finish before you press the next one.</p>`)}
      ${sdFaq('A key sometimes misses the order or the screenshot', `<p>The keys use pauses of 50 and 100 ms between the steps. If that is too fast for your computer, open the key in Stream Deck and raise the Delay actions a little, for example to 100 and 150 ms.</p>`)}
      ${sdFaq('Does it work on a Mac and on Windows?', `<p>Yes. The keys and shortcuts are the same on both, with Control (⌃) on a Mac. Use Chrome or Edge.</p>`)}
    </div>`;
}

const SD_TABS = [['setup', 'Set up', sdTabSetup], ['how', 'How it works', sdTabHow], ['keys', 'Keys & shortcuts', sdTabKeys], ['help', 'Troubleshooting', sdTabHelp]];

// ---------- the page ----------
function sdRender() {
    const v = document.getElementById('view-streamdeck');
    if (!v) return;
    const tab = SD_TABS.find(t => t[0] === sdTab) || SD_TABS[0];
    v.innerHTML = `
      <header class="view-header sd-header"><h1>Stream Deck</h1><p class="help-text">Got the VWS Journal icon pack? Combine it with your Tradovate keys.</p></header>
      <div class="sd-hero">
        <div class="sd-hero-copy">
          <span class="sd-kicker">Stream Deck · Tradovate · VWS Journal</span>
          <h2>Boost your trading<br>and journaling.</h2>
          <p>Combine your Tradovate trade actions with VWS Journal. One key places the order and adds the chart to your Quick trade, so your journal fills itself while you trade.</p>
          <div class="sd-hero-actions">${sdExtLink('Get the icon packs', 'btn-primary')}</div>
        </div>
        <div class="sd-visual">${sdDeck(SD_TRADE, 'sm', 'Trading keys')}<span class="sd-swap" aria-hidden="true">⇄</span>${sdDeck(SD_JOURNAL, 'sm', 'Journal keys')}</div>
      </div>
      <div class="sd-before">
        <span class="sd-before-icon">${sdSvg(SD_IC.bolt, 18)}</span>
        <h2>Before you trade, every time</h2>
        <div class="sd-before-list"><span class="sd-check"><span class="n">1</span><span><b>VWS Journal in Scalping mode</b><em>Scalp, at the bottom of the sidebar.</em></span></span><span class="sd-check"><span class="n">2</span><span><b>A Quick trade open</b><em>New trade (Alt N). Save &amp; next keeps it open.</em></span></span><span class="sd-check"><span class="n">3</span><span><b>Auto-Capture connected to your charting app</b><em>Connect window › your charting app. Connect again if VWS Journal reloads.</em></span></span></div>
        <small>Without these the order still goes through, but no screenshot is added to your trade. Orders placed or closed directly in the DOM never add a screenshot: log those yourself.</small>
      </div>
      <div class="settings-tabs sd-tabs" role="tablist" aria-label="Stream Deck">${SD_TABS.map(([id, t]) =>
        `<button type="button" class="settings-tab-btn${id === tab[0] ? ' active' : ''}" role="tab" id="sd-tab-${id}" aria-selected="${id === tab[0]}" aria-controls="sd-panel" tabindex="${id === tab[0] ? 0 : -1}" data-sd-tab="${id}">${t}</button>`).join('')}</div>
      <div class="sd-tab" id="sd-panel" role="tabpanel" aria-labelledby="sd-tab-${tab[0]}">${tab[2]()}</div>`;
    const tabs = v.querySelector('.sd-tabs');
    if (typeof slidePillIndicator === 'function') slidePillIndicator(tabs, tabs.querySelector('.active'), 'sdTabs');
}

function sdSwitchTab(id, focus) {
    if (!SD_TABS.some(t => t[0] === id) || id === sdTab) return;
    sdTab = id;
    const v = document.getElementById('view-streamdeck');
    const tabs = v.querySelector('.sd-tabs');
    tabs.querySelectorAll('[data-sd-tab]').forEach(b => {
        const on = b.dataset.sdTab === id;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on);
        b.tabIndex = on ? 0 : -1;
    });
    const active = tabs.querySelector('.active');
    if (typeof slidePillIndicator === 'function') slidePillIndicator(tabs, active, 'sdTabs');
    const panel = v.querySelector('#sd-panel');
    panel.setAttribute('aria-labelledby', `sd-tab-${id}`);
    panel.innerHTML = SD_TABS.find(t => t[0] === id)[2]();
    if (focus) active.focus();
}

function sdToggleStep(n) {
    const list = sdStepsDone();
    sdStepsSave(list.includes(n) ? list.filter(x => x !== n) : [...list, n]);
    const v = document.getElementById('view-streamdeck');
    const panel = v && v.querySelector('#sd-panel');
    if (!panel || sdTab !== 'setup') return;
    const y = v.scrollTop;
    panel.innerHTML = sdTabSetup();
    v.scrollTop = y;
    const b = panel.querySelector(`[data-sd-done="${n}"]`);
    if (b) b.focus();
}

async function sdCopyScript() {
    try {
        const res = await fetch(SD_FILES.script, { cache: 'no-cache' });
        if (!res.ok) throw new Error(res.status);
        await navigator.clipboard.writeText(await res.text());
        if (typeof showToast === 'function') showToast('Script copied. Paste it in Tampermonkey.', 'success');
    } catch (e) {
        if (typeof showToast === 'function') showToast('Could not copy the script. Try again, or open it and copy it yourself.', 'error', { duration: 7000, action: { label: 'Open script', onClick: () => window.open(SD_FILES.script, '_blank', 'noopener') } });
    }
}

// Opens the page (from the sidebar or the release popup)
function sdOpen(tab) {
    if (!sdFeatureOn) return;
    const view = document.getElementById('view-streamdeck');
    const btn = document.getElementById('btn-nav-streamdeck');
    if (!view || !btn) return;
    const wasActive = btn.classList.contains('active') && view.classList.contains('active');
    if (tab) sdTab = tab;
    document.querySelectorAll('.main-content .view').forEach(v => v.classList.remove('active'));
    [btnNavDashboard, btnNavStats, btnNavSettings, btnNavHelp].forEach(b => b && b.classList.remove('active'));
    if (typeof closeShareViewState === 'function') closeShareViewState();
    view.classList.add('active');
    btn.classList.add('active');
    sdRender();
    if (typeof moveNavIndicator === 'function') moveNavIndicator(btn, true);
    if (!wasActive && typeof playViewEnter === 'function') playViewEnter(view);
    if (typeof startViewAtTop === 'function') startViewAtTop(view); else view.scrollTop = 0;
}

// Another page opens: the Stream Deck page and its button step aside
function sdLeave() {
    const view = document.getElementById('view-streamdeck');
    const btn = document.getElementById('btn-nav-streamdeck');
    if (view) view.classList.remove('active');
    if (btn) btn.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-nav-streamdeck');
    const view = document.getElementById('view-streamdeck');
    if (!sdFeatureOn || !btn || !view) { if (btn) btn.remove(); if (view) view.remove(); return; }
    btn.addEventListener('click', () => sdOpen());
    [btnNavDashboard, btnNavStats, btnNavSettings, btnNavHelp].forEach(b => b && b.addEventListener('click', sdLeave));
    const shares = document.getElementById('btn-your-shares');
    if (shares) shares.addEventListener('click', sdLeave);

    view.addEventListener('click', e => {
        const tab = e.target.closest('[data-sd-tab]');
        if (tab) { sdSwitchTab(tab.dataset.sdTab); return; }
        const done = e.target.closest('[data-sd-done]');
        if (done) { sdToggleStep(parseInt(done.dataset.sdDone, 10)); return; }
        if (e.target.closest('[data-sd-copy]')) { sdCopyScript(); return; }
        const q = e.target.closest('.sd-faq .faq-question');
        if (q) {
            const item = q.parentElement;
            item.classList.toggle('open');
            q.setAttribute('aria-expanded', item.classList.contains('open'));
        }
    });
    // Tabs: ← → Home End (as in a tab list)
    view.addEventListener('keydown', e => {
        const tab = e.target.closest('[data-sd-tab]');
        if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const ids = SD_TABS.map(t => t[0]);
        const i = ids.indexOf(tab.dataset.sdTab);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
        sdSwitchTab(ids[next], true);
    });
});
