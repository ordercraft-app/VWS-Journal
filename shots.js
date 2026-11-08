// ===================== Multiple screenshots per trade (shots.js) =====================
// Part of the scalping mode release: on when FEATURES.scalp.on is (scalp.js, ?scalp=on / off).
// With the feature on:
//  - A trade holds up to SHOTS_MAX screenshots. Every paste, drop, file or Auto-Capture adds one.
//  - Add / Edit Trade: the latest screenshot shows large to the left of the form ("stage"),
//    with arrows, thumbnails and Alt ← / Alt → (only on screens wide enough, see styles.css).
//  - The form shows a strip of numbered thumbnails with "Latest", × and + Add.
//  - The image viewer is a carousel (arrows, ← / →, thumbnails) for trades with 2 or more.
//  - Cards and list rows show how many screenshots a trade has (from 2).
// Data: trade.screenshots = file names in the order they were added, only when there are 2 or more.
// trade.screenshot always holds the latest one, so older versions of the app show that one.
// Nothing to migrate. Without the feature the form works on trade.screenshot as before and
// keeps trade.screenshots in step (ui.js, Save).

const SHOTS_MAX = 10;
const SHOTS_I = {
    left: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>',
    right: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>',
    expand: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    stack: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/></svg>',
    img: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
};

// The stage next to the form only fits on wide screens (same query as styles.css)
const SHOTS_WIDE = '(min-width: 1100px) and (min-height: 560px)';
function shotsStageShown() { try { return window.matchMedia(SHOTS_WIDE).matches; } catch (e) { return true; } }

function shotsActive() { return typeof scalpFeatureOn !== 'undefined' && !!scalpFeatureOn; }

// ---------- form state ----------
// items: { file: name on disk or null (new), blob: new image or null, url }
const shotsSt = { items: [], at: 0, removed: [], tradeId: null, number: '', symbol: '', open: false };

// Object URLs of the form are our own (renderDashboard revokes the dashboard ones)
async function shotsFileUrl(name) {
    if (!dirHandle || !name) return null;
    try {
        const imgDir = await dirHandle.getDirectoryHandle('img');
        const file = await (await imgDir.getFileHandle(name)).getFile();
        return URL.createObjectURL(file);
    } catch (e) { console.warn('Image not found:', name); return null; }
}
function shotsRevokeAll() { shotsSt.items.forEach(it => { if (it.url) URL.revokeObjectURL(it.url); }); }

async function shotsFormOpened(trade) {
    if (!shotsActive()) return;
    shotsRevokeAll();
    const files = tradeShotFiles(trade);
    const items = [];
    for (const f of files) items.push({ file: f, blob: null, url: await shotsFileUrl(f) });
    Object.assign(shotsSt, { items, at: Math.max(0, items.length - 1), removed: [], tradeId: trade ? trade.id : null,
        number: trade ? String(trade.number || '') : String(document.getElementById('t-number').value || ''), symbol: trade ? (trade.symbol || '') : '', open: true });
    if (tImageInput) tImageInput.multiple = true;
    shotsRender();
}
function shotsFormClosed() {
    if (!shotsActive() || !shotsSt.open) return;
    shotsSt.open = false;
    // The form fades out; the images are freed once it is gone
    const items = shotsSt.items;
    setTimeout(() => { if (!shotsSt.open) items.forEach(it => { if (it.url) URL.revokeObjectURL(it.url); }); }, 400);
    shotsSt.items = []; shotsSt.removed = [];
}

// A new image (compressed blob) for the open form. false when the trade is full.
function shotsAdd(blob) {
    if (!shotsActive() || !blob) return false;
    if (shotsSt.items.length >= SHOTS_MAX) {
        showToast(`A trade holds up to ${SHOTS_MAX} screenshots. Remove one to add another.`, 'error');
        return false;
    }
    shotsSt.items.push({ file: null, blob, url: URL.createObjectURL(blob) });
    shotsSt.at = shotsSt.items.length - 1;
    isFormDirty = true;
    shotsRender();
    return true;
}
function shotsRemove(i) {
    const it = shotsSt.items[i]; if (!it) return;
    shotsSt.items.splice(i, 1);
    if (it.file) shotsSt.removed.push(it.file);
    if (it.url && it.blob) URL.revokeObjectURL(it.url);
    if (shotsSt.at >= shotsSt.items.length) shotsSt.at = shotsSt.items.length - 1;
    else if (i < shotsSt.at) shotsSt.at--;
    shotsSt.at = Math.max(0, shotsSt.at);
    isFormDirty = true;
    shotsRender();
}
function shotsGo(d) {
    const n = shotsSt.items.length; if (n < 2) return false;
    const at = Math.max(0, Math.min(n - 1, shotsSt.at + d));
    if (at !== shotsSt.at) { shotsSt.at = at; shotsRender(); }
    return true;
}
function shotsPick(i) { if (shotsSt.items[i]) { shotsSt.at = i; shotsRender(); } }
function shotsCurrentUrl() { const it = shotsSt.items[shotsSt.at]; return it ? it.url : null; }
function shotsCount() { return shotsSt.items.length; }

// Writes the new images, removes the removed ones (unless another trade uses the file).
// Returns { screenshot, screenshots } for the trade.
async function shotsSave(tradeId) {
    const names = [];
    let failed = 0, k = 0;
    for (const it of shotsSt.items) {
        if (it.file) { names.push(it.file); continue; }
        const name = `trade_${tradeId}_${Date.now()}${k ? `_${k}` : ''}.webp`; k++;
        try { await saveImageToDir(it.blob, name); it.file = name; names.push(name); }
        catch (e) { console.error(e); failed++; }
    }
    if (failed) showToast(failed === 1 ? 'A screenshot could not be saved; the trade is saved without it.' : `${failed} screenshots could not be saved; the trade is saved without them.`, 'error');
    for (const f of shotsSt.removed) {
        if (names.includes(f)) continue;
        if (appData.trades.some(t => t.id !== tradeId && tradeShotFiles(t).includes(f))) continue;
        await deleteImageFromDir(f);
    }
    shotsSt.removed = [];
    return { screenshot: names.length ? names[names.length - 1] : null, screenshots: names.length > 1 ? names : undefined };
}

// ---------- rendering ----------
function shotsLabel() {
    const num = document.getElementById('t-number').value || shotsSt.number;
    const sym = (typeof tfState !== 'undefined' && tfState && tfState.symbol) || shotsSt.symbol;
    return [num ? `Trade ${num}` : (shotsSt.tradeId ? 'Trade' : 'New trade'), sym].filter(Boolean).join(' · ');
}
function shotsKbd(k) { return `<kbd class="keys-kbd is-inline">${k}</kbd>`; }
function shotsRender() { if (!shotsSt.open) return; shotsStage(); shotsStrip(); }

function shotsStage() {
    let st = document.getElementById('shots-stage');
    if (!st) {
        st = document.createElement('div'); st.id = 'shots-stage'; st.className = 'shots-stage';
        tradeModal.insertBefore(st, tradeModal.firstChild);
    }
    const n = shotsSt.items.length, A = typeof keysAlt === 'function' ? keysAlt() : 'Alt';
    if (!n) {
        st.innerHTML = `<button type="button" class="shots-empty" data-shots-add>${SHOTS_I.img}<strong>The chart of this trade shows here</strong><span>Paste a screenshot (${shotsKbd(A === 'Option' ? 'Cmd' : 'Ctrl')} ${shotsKbd('V')}), drop it here or use Auto-Capture (${shotsKbd('C')}). Add as many as you like.</span></button>`;
        return;
    }
    const at = shotsSt.at, it = shotsSt.items[at], latest = at === n - 1;
    st.innerHTML = `
        <div class="shots-head"><span class="shots-title">${escapeHTML(shotsLabel())}</span><span class="shots-count">Screenshot ${at + 1} of ${n}${latest ? ' · <b>latest</b>' : ''}</span>
            ${it.url ? `<button type="button" class="shots-enlarge" data-shots-enlarge>${SHOTS_I.expand}Enlarge</button>` : ''}</div>
        <div class="shots-frame">
            ${n > 1 ? `<button type="button" class="shots-arrow is-left" data-shots-go="-1" aria-label="Previous screenshot" ${at === 0 ? 'disabled' : ''}>${SHOTS_I.left}</button>` : ''}
            ${it.url ? `<img src="${it.url}" alt="Screenshot ${at + 1} of ${n}" data-shots-enlarge>` : `<div class="shots-missing">This screenshot is not in the img folder of your journal.</div>`}
            ${n > 1 ? `<button type="button" class="shots-arrow is-right" data-shots-go="1" aria-label="Next screenshot" ${latest ? 'disabled' : ''}>${SHOTS_I.right}</button>` : ''}
        </div>
        ${n > 1 ? `<div class="shots-thumbs" role="group" aria-label="Screenshots">${shotsSt.items.map((x, i) => `<button type="button" class="shots-thumb${i === at ? ' is-on' : ''}" data-shots-pick="${i}" aria-label="Screenshot ${i + 1}" aria-pressed="${i === at}">${x.url ? `<img src="${x.url}" alt="">` : ''}</button>`).join('')}</div>` : ''}
        <p class="shots-hint">${n > 1 ? `${shotsKbd(A)} ${shotsKbd('←')} ${shotsKbd('→')} previous / next while you fill in the form` : 'Paste or capture another screenshot to add it'}</p>`;
}

function shotsStrip() {
    let s = document.getElementById('shots-strip');
    if (!s) {
        s = document.createElement('div'); s.id = 'shots-strip'; s.className = 'shots-strip';
        imagePreviewContainer.parentNode.insertBefore(s, imagePreviewContainer);
    }
    const n = shotsSt.items.length;
    imagePreviewContainer.style.display = 'none';
    imageDropzone.style.display = n ? 'none' : 'flex';
    if (!n) { s.innerHTML = ''; return; }
    // Without the stage (smaller screens) a thumbnail opens the enlarged view instead
    const wide = shotsStageShown();
    s.classList.toggle('is-narrow', !wide);
    s.innerHTML = shotsSt.items.map((x, i) => `<div class="shots-chip${i === shotsSt.at ? ' is-on' : ''}"><button type="button" class="shots-chip-img" data-shots-pick="${i}" aria-label="${wide ? 'Show' : 'Enlarge'} screenshot ${i + 1}${i === n - 1 ? ' (latest)' : ''}"${wide ? ` aria-pressed="${i === shotsSt.at}"` : ''} title="${wide ? 'Show next to the form' : 'Enlarge'}">${x.url ? `<img src="${x.url}" alt="">` : ''}<span class="shots-chip-n">${i + 1}</span>${i === n - 1 ? '<span class="shots-chip-tag">Latest</span>' : ''}${x.url ? `<span class="shots-chip-zoom" aria-hidden="true">${SHOTS_I.expand}</span>` : ''}</button><button type="button" class="shots-chip-x" data-shots-remove="${i}" aria-label="Remove screenshot ${i + 1}" title="Remove">&times;</button></div>`).join('')
        + (n < SHOTS_MAX ? `<button type="button" class="shots-add" data-shots-add>${SHOTS_I.plus}<span>Add</span><small>paste · drop · capture</small></button>` : `<span class="shots-full help-text">${SHOTS_MAX} screenshots: the most a trade holds</span>`);
}

// ---------- the image viewer as a carousel ----------
const shotsView = { urls: [], at: 0, label: '', fromForm: false };
// Called by openImageViewer (storage.js): a single image shows without the carousel parts
function shotsViewerReset() {
    const bar = document.getElementById('shots-viewer');
    if (bar) bar.remove();
    shotsView.urls = []; shotsView.fromForm = false;
    imageViewerModal.classList.remove('shots-viewing');
}
function shotsViewer(urls, at, label, fromForm) {
    urls = urls.filter(Boolean);
    if (!urls.length) return;
    at = Math.max(0, Math.min(urls.length - 1, at));
    openImageViewer(urls[at]);
    if (urls.length < 2) return;
    Object.assign(shotsView, { urls, at, label: label || '', fromForm: !!fromForm });
    imageViewerModal.classList.add('shots-viewing');
    shotsViewerRender();
}
function shotsViewerRender() {
    const { urls, at, label } = shotsView, n = urls.length;
    let bar = document.getElementById('shots-viewer');
    if (!bar) { bar = document.createElement('div'); bar.id = 'shots-viewer'; imageViewerModal.appendChild(bar); }
    enlargedImage.src = urls[at];
    enlargedImage.alt = `Screenshot ${at + 1} of ${n}`;
    bar.innerHTML = `
        <button type="button" class="shots-varrow is-left" data-shots-vgo="-1" aria-label="Previous screenshot" ${at === 0 ? 'disabled' : ''}>${SHOTS_I.left}</button>
        <button type="button" class="shots-varrow is-right" data-shots-vgo="1" aria-label="Next screenshot" ${at === n - 1 ? 'disabled' : ''}>${SHOTS_I.right}</button>
        <div class="shots-vfoot"><span class="shots-vcap">${label ? `${escapeHTML(label)} · ` : ''}${at + 1} / ${n}</span>
            <div class="shots-vthumbs" role="group" aria-label="Screenshots">${urls.map((u, i) => `<button type="button" class="shots-thumb${i === at ? ' is-on' : ''}" data-shots-vpick="${i}" aria-label="Screenshot ${i + 1}" aria-pressed="${i === at}"><img src="${u}" alt=""></button>`).join('')}</div></div>`;
}
function shotsViewerGo(i) {
    const n = shotsView.urls.length; if (n < 2) return;
    const at = Math.max(0, Math.min(n - 1, i));
    if (at === shotsView.at) return;
    shotsView.at = at;
    if (shotsView.fromForm && shotsSt.open) {
        // the form follows: closing the viewer shows the same screenshot there
        const idx = shotsSt.items.map(x => x.url).indexOf(shotsView.urls[at]);
        if (idx >= 0) { shotsSt.at = idx; shotsRender(); }
    }
    shotsViewerRender();
}
function shotsEnlargeFromForm() {
    const urls = shotsSt.items.map(x => x.url), cur = urls[shotsSt.at];
    const valid = urls.filter(Boolean);
    shotsViewer(valid, Math.max(0, valid.indexOf(cur)), shotsLabel(), true);
}

// A click on the screenshot of a card or row (app.js). true = handled here.
function shotsOpenTrade(imgEl) {
    if (!shotsActive()) return false;
    const host = imgEl.closest('[data-trade-id]');
    const t = host && appData.trades.find(x => x.id === host.dataset.tradeId);
    const files = tradeShotFiles(t);
    if (files.length < 2) return false;
    (async () => {
        const urls = [];
        for (const f of files) urls.push(f === t.screenshot && imgEl.dataset.imgUrl ? imgEl.dataset.imgUrl : await getImageUrl(f));
        const valid = urls.filter(Boolean);
        shotsViewer(valid, valid.length - 1, [t.number ? `Trade ${t.number}` : '', t.symbol].filter(Boolean).join(' · '));
    })();
    return true;
}

// ---------- cards and rows: how many screenshots ----------
function shotsDecorate() {
    if (!shotsActive()) return;
    document.querySelectorAll('#trades-list [data-trade-id]').forEach(el => {
        const t = appData.trades.find(x => x.id === el.dataset.tradeId);
        const n = tradeShotFiles(t).length;
        if (n < 2) return;
        const label = `${n} screenshots`;
        if (el.classList.contains('trade-row')) {
            const th = el.querySelector('.row-main > .row-thumb');
            if (th && !el.querySelector('.shots-row-badge')) {
                const w = document.createElement('span'); w.className = 'shots-row-wrap';
                th.replaceWith(w); w.appendChild(th);
                w.insertAdjacentHTML('beforeend', `<span class="shots-row-badge" title="${label}" aria-label="${label}">${n}</span>`);
            }
        } else {
            const a = el.querySelector('.card-image-area');
            if (a && !a.querySelector('.shots-card-badge')) a.insertAdjacentHTML('beforeend', `<span class="shots-card-badge" title="${label}" aria-label="${label}">${SHOTS_I.stack}${n}</span>`);
        }
    });
}

// ---------- start ----------
document.addEventListener('DOMContentLoaded', () => {
    if (!shotsActive()) return;
    document.documentElement.classList.add('shots-feature');
    const sep = imageDropzone.closest('.form-grid') && imageDropzone.closest('.form-grid').previousElementSibling;
    const title = sep && sep.querySelector('span');
    if (title && title.textContent.trim() === 'Screenshot') title.textContent = 'Screenshots';
    const dzText = imageDropzone.querySelector('span');
    if (dzText) dzText.textContent = 'Click, drop or paste (Ctrl+V / Cmd+V) screenshots here';

    tradeModal.addEventListener('click', e => {
        if (!shotsSt.open) return;
        const go = e.target.closest('[data-shots-go]'); if (go) { shotsGo(Number(go.dataset.shotsGo)); return; }
        const pick = e.target.closest('[data-shots-pick]');
        if (pick) {
            shotsPick(Number(pick.dataset.shotsPick));
            // In the form without the stage next to it: open the enlarged view
            if (pick.classList.contains('shots-chip-img') && !shotsStageShown() && shotsCurrentUrl()) shotsEnlargeFromForm();
            return;
        }
        const rm = e.target.closest('[data-shots-remove]'); if (rm) { shotsRemove(Number(rm.dataset.shotsRemove)); return; }
        if (e.target.closest('[data-shots-add]')) { tImageInput.click(); return; }
        if (e.target.closest('[data-shots-enlarge]')) shotsEnlargeFromForm();
    });
    // The stage sits on the backdrop: a click next to the chart closes the form, as the backdrop did
    tradeModal.addEventListener('mousedown', e => { if (e.target.id === 'shots-stage') closeModal(); });
    // Drop images anywhere on the stage
    tradeModal.addEventListener('dragover', e => {
        const st = e.target.closest && e.target.closest('#shots-stage'); if (!st) return;
        e.preventDefault(); st.classList.add('is-drop');
    });
    tradeModal.addEventListener('dragleave', e => { const st = document.getElementById('shots-stage'); if (st && !st.contains(e.relatedTarget)) st.classList.remove('is-drop'); });
    tradeModal.addEventListener('drop', async e => {
        const st = e.target.closest && e.target.closest('#shots-stage'); if (!st) return;
        e.preventDefault(); st.classList.remove('is-drop');
        const files = [...((e.dataTransfer && e.dataTransfer.files) || [])].filter(f => f.type && f.type.startsWith('image/'));
        for (const f of files) await handleImageFile(f);
    });

    // Screen gets wider / narrower while the form is open: thumbnails switch between show and enlarge
    try { window.matchMedia(SHOTS_WIDE).addEventListener('change', () => { if (shotsSt.open) shotsStrip(); }); } catch (e) {}

    imageViewerModal.addEventListener('click', e => {
        const g = e.target.closest('[data-shots-vgo]'); if (g) { shotsViewerGo(shotsView.at + Number(g.dataset.shotsVgo)); return; }
        const p = e.target.closest('[data-shots-vpick]'); if (p) { shotsViewerGo(Number(p.dataset.shotsVpick)); return; }
    });
    imageViewerModal.addEventListener('keydown', e => {
        if (shotsView.urls.length < 2 || e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); shotsViewerGo(shotsView.at - 1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); shotsViewerGo(shotsView.at + 1); }
        else if (e.key === 'Home') { e.preventDefault(); shotsViewerGo(0); }
        else if (e.key === 'End') { e.preventDefault(); shotsViewerGo(shotsView.urls.length - 1); }
    });
});
