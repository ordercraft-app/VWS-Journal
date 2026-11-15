// --- Settings page (lists, Journal / Chart / Screenshot tabs) ---
// Split off from ui.js. Loaded right after ui.js.

// --- Settings UI Architecture ---
// Every list card (Symbol … Psychology) uses the list editor from tags.js: the same chips,
// + chips, rename (trades follow), merge, × with Undo and questions inside the card as the
// pencil edit mode in Add Trade. Since 2026-11-15 (before: pill boxes and name fields).

const settingsTagCards = new Map(); // key → { body, query, findBox }

function renderTagsSetting(title, key, toggleKey = null) {
    const container = document.createElement('div');
    container.className = 'setting-category-card';
    container.dataset.tagsKey = key;

    const head = document.createElement('div');
    head.className = 'setting-cat-head';
    const header = document.createElement('h2'); // a11y: h2 under the page h1
    header.textContent = title;
    header.className = 'setting-cat-title';
    head.appendChild(header);
    const tools = document.createElement('div');
    tools.className = 'tags-tools';
    head.appendChild(tools);
    container.appendChild(head);

    const body = document.createElement('div');
    const card = { body, query: '', findBox: null, cat: '' };
    settingsTagCards.set(key, card);

    // Find or add (7+ tags)
    const findBox = document.createElement('span');
    findBox.className = 'tags-find';
    findBox.innerHTML = `${TAGS_ICONS.search}<input type="text" class="tags-find-input" placeholder="Find or add" aria-label="Find or add in ${title}" autocomplete="off" spellcheck="false">`;
    const input = findBox.querySelector('input');
    input.addEventListener('input', () => { card.query = input.value; settingsTagRender(key); });
    input.addEventListener('keydown', e => settingsTagFindKey(key, e, input));
    card.findBox = findBox;
    tools.appendChild(findBox);

    if (toggleKey) {
        if (!appData.settings.features) appData.settings.features = {};
        if (appData.settings.features[toggleKey] === undefined) appData.settings.features[toggleKey] = true;
        const isEnabled = appData.settings.features[toggleKey];
        const toggleBtn = document.createElement('button');
        toggleBtn.className = isEnabled ? 'btn-secondary btn-sm' : 'btn-primary btn-sm';
        toggleBtn.textContent = isEnabled ? 'Disable' : 'Enable';
        toggleBtn.onclick = async () => {
            appData.settings.features[toggleKey] = !appData.settings.features[toggleKey];
            await autoSave();
            renderSettingsUI();
        };
        tools.appendChild(toggleBtn);
        if (!isEnabled) { body.style.display = 'none'; findBox.hidden = true; }
    }

    container.appendChild(body);
    settingsTagRender(key);
    return container;
}

function settingsTagRender(key) {
    const card = settingsTagCards.get(key);
    if (!card || !card.body.isConnected && card.body.parentElement === null) return;
    const disabled = card.body.style.display === 'none';
    card.findBox.hidden = disabled || tagsCount(key) < TAGS_FIND_FROM;
    tagsEditor(card.body, key, { query: card.query, place: 'settings' });
    // Tags that only live in older trades (tags.js)
    if (!card.old) card.old = {};
    tagsOldLine(card.body, key, card.old, { query: card.query });
    // No match in a card with categories: choose where it goes
    const q = tagsClean(card.query);
    card.body.querySelectorAll('.settings-find-add').forEach(x => x.remove());
    if (!q) return;
    const k = TAGS_KINDS[key];
    const hits = card.body.querySelectorAll('.tags-chip:not([hidden]), .tags-group:not([hidden]) .tags-cat').length;
    const exact = settingsTagAll(key).some(n => tagsSame(n, q));
    const box = document.createElement('div');
    box.className = 'settings-find-add';
    const hint = document.createElement('p');
    hint.className = 'chip-empty';
    if (exact) {
        hint.textContent = 'Enter goes to it.';
    } else if (k.type === 'flat') {
        hint.textContent = hits ? `Enter goes to the first match. No exact match: click + to add “${q}”.` : `No match. Enter adds “${q}”.`;
    } else if (k.type === 'group') {
        const cats = Object.keys(tagsConfig(key));
        if (!cats.includes(card.cat)) card.cat = cats[0] || '';
        if (cats.length) {
            const row = document.createElement('div');
            row.className = 'tags-find-cats';
            const add = document.createElement('button');
            add.type = 'button';
            add.className = 'tags-add has-label' + (hits ? '' : ' is-find-hi');
            add.innerHTML = `${TAGS_ICONS.plus}<span></span>`;
            add.querySelector('span').textContent = `Add “${q}”`;
            add.addEventListener('click', () => settingsTagFindAdd(key));
            row.appendChild(add);
            const lab = document.createElement('span');
            lab.className = 'tags-find-in';
            lab.textContent = 'in';
            row.appendChild(lab);
            cats.forEach(c => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'chip' + (c === card.cat ? ' is-find-cat' : '');
                b.textContent = c;
                b.addEventListener('click', () => { card.cat = c; settingsTagRender(key); });
                row.appendChild(b);
            });
            box.appendChild(row);
        }
        hint.textContent = hits ? 'Enter goes to the first match.' : (cats.length > 1 ? 'No match. ← → picks the category, Enter adds it there.' : 'No match. Enter adds it.');
    } else {
        hint.textContent = hits ? 'Enter goes to the first match.' : 'No match. Use the + in the row where it belongs.';
    }
    box.appendChild(hint);
    card.body.prepend(box);
}

function settingsTagAll(key) {
    const k = TAGS_KINDS[key], cfg = tagsConfig(key);
    if (k.type === 'flat') return [...cfg];
    if (k.type === 'group') return [...Object.keys(cfg), ...Object.values(cfg).flat()];
    return Object.keys(cfg).flatMap(c => [c, ...((cfg[c] || {}).sub1 || []), ...((cfg[c] || {}).sub2 || [])]);
}

function settingsTagFindKey(key, e, input) {
    const card = settingsTagCards.get(key);
    if (e.key === 'Escape') {
        if (input.value) { e.preventDefault(); e.stopPropagation(); input.value = ''; card.query = ''; settingsTagRender(key); }
        return;
    }
    const q = tagsClean(input.value);
    if (!q) return;
    const k = TAGS_KINDS[key];
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && k.type === 'group' && !card.body.querySelector('.tags-chip:not([hidden])')) {
        e.preventDefault();
        const cats = Object.keys(tagsConfig(key));
        const i = cats.indexOf(card.cat);
        card.cat = cats[(i + (e.key === 'ArrowLeft' ? -1 : 1) + cats.length) % cats.length];
        settingsTagRender(key);
        return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Exact name first, then the first match
    const names = [...card.body.querySelectorAll('.tags-chip:not([hidden]) .tags-chip-name, .tags-group:not([hidden]) .tags-cat-name')];
    const hit = names.find(b => tagsSame(b.textContent, q)) || names.find(b => tagsMatches(b.textContent, q) > 0);
    if (hit) { hit.focus(); return; }
    settingsTagFindAdd(key);
}

async function settingsTagFindAdd(key) {
    const card = settingsTagCards.get(key);
    const q = tagsClean(card.query);
    const k = TAGS_KINDS[key];
    if (!q || k.type === 'tree') return;
    const a = k.type === 'flat' ? { key, level: 'item' } : { key, level: 'gitem', cat: card.cat };
    if (k.type === 'group' && !card.cat) return;
    const snap = tagsSnapshot(key, false);
    const r = tagsAdd(a, q);
    card.query = '';
    const input = card.findBox.querySelector('input');
    input.value = '';
    const where = tagsWhere(a);
    await tagsDone(snap, r.added ? `“${r.name}” added${where ? ` to ${where}` : ''}.` : '');
    input.focus();
}

// After any list change (here or in Add Trade): re-render the cards that are on screen
tagsRefreshers.add(() => {
    settingsTagCards.forEach((card, key) => { if (card.body.isConnected) settingsTagRender(key); });
});

// Re-rendering rebuilds the whole settings page. Keep the scroll position so
// toggling a category (Enable/Disable) doesn't throw you back to the top.
function renderSettingsUI() {
    const scrollY = viewSettings.scrollTop;
    renderSettingsContent();
    viewSettings.scrollTop = scrollY;
}

function renderSettingsContent() {
    settingsContainer.innerHTML = '';
    
    if (!appData.settings.chartVisibility) {
        appData.settings.chartVisibility = {
            growth: true, winLoss: true, directionalBias: true, dayOfWeek: true,
            setup: true, invalidation: true, psychology: true, confluence: true,
            symbol: true, marketCond: true, location: true
        };
    }

    const tabsDiv = document.createElement('div');
    tabsDiv.className = 'settings-tabs';
    
    const tabJournal = document.createElement('button');
    tabJournal.className = `settings-tab-btn ${currentSettingsTab === 'journal' ? 'active' : ''}`;
    tabJournal.textContent = 'Journal';
    tabJournal.onclick = () => switchSettingsTab('journal');
    
    
    const tabChart = document.createElement('button');
    tabChart.className = `settings-tab-btn ${currentSettingsTab === 'chart' ? 'active' : ''}`;
    tabChart.textContent = 'Chart';
    tabChart.onclick = () => switchSettingsTab('chart');
    
    const tabScreenshot = document.createElement('button');
    tabScreenshot.className = `settings-tab-btn ${currentSettingsTab === 'screenshot' ? 'active' : ''}`;
    tabScreenshot.textContent = 'Screenshot';
    tabScreenshot.onclick = () => switchSettingsTab('screenshot');
    
    // Rules tab (rules.js), only while the rules feature is switched on
    const showRulesTab = typeof rulesFeatureOn !== 'undefined' && rulesFeatureOn;
    let tabRules = null;
    if (showRulesTab) {
        tabRules = document.createElement('button');
        tabRules.className = `settings-tab-btn ${currentSettingsTab === 'rules' ? 'active' : ''}`;
        tabRules.textContent = 'Rules';
        tabRules.onclick = () => switchSettingsTab('rules');
    } else if (currentSettingsTab === 'rules') {
        currentSettingsTab = 'journal';
        tabJournal.classList.add('active');
    }

    tabsDiv.appendChild(tabJournal);
    if (tabRules) tabsDiv.appendChild(tabRules);
    tabsDiv.appendChild(tabChart);
    tabsDiv.appendChild(tabScreenshot);
    // Backups tab (backup.js), only while automatic backups are switched on
    let tabBackups = null;
    if (typeof backupFeatureOn !== 'undefined' && backupFeatureOn) {
        tabBackups = document.createElement('button');
        tabBackups.className = `settings-tab-btn ${currentSettingsTab === 'backups' ? 'active' : ''}`;
        tabBackups.textContent = 'Backups';
        tabBackups.onclick = () => switchSettingsTab('backups');
        tabsDiv.appendChild(tabBackups);
    } else if (currentSettingsTab === 'backups') {
        currentSettingsTab = 'journal';
        tabJournal.classList.add('active');
    }
    settingsContainer.appendChild(tabsDiv);
    slidePillIndicator(tabsDiv, { journal: tabJournal, rules: tabRules, chart: tabChart, screenshot: tabScreenshot, backups: tabBackups }[currentSettingsTab], 'settingsTabs');
    
    const onSettingsChange = async () => { await autoSave(); };

    if (currentSettingsTab === 'journal') {
        // Show max losses per day message (scalp.js), on top, only while that release is on
        if (typeof scalpFeatureOn !== 'undefined' && scalpFeatureOn && typeof scalpSettingsEl === 'function') settingsContainer.appendChild(scalpSettingsEl());
        // VWS Journal system / own system (system.js)
        if (typeof systemSettingsEl === 'function') settingsContainer.appendChild(systemSettingsEl());
        const banner = document.createElement('div');
        banner.className = 'info-banner';
        banner.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg><span><strong>Tip:</strong> These are the same lists as in Add Trade. Click + and type: <strong>Enter</strong> or <strong>comma ( , )</strong> adds it, the field stays open for the next one. Click a name to rename it (your trades follow), drag to reorder, point at a tag to see how many trades use it. Every change has Undo.</span>`;
        settingsContainer.appendChild(banner);

        settingsContainer.appendChild(renderTagsSetting('Symbol', 'symbol'));
        // Same order as the add/edit trade form
        settingsContainer.appendChild(renderTagsSetting('Market Condition', 'marketCondition'));
        settingsContainer.appendChild(renderTagsSetting('Location', 'location'));
        settingsContainer.appendChild(renderTagsSetting('Setup', 'setup'));
        settingsContainer.appendChild(renderTagsSetting('Direction', 'direction'));
        settingsContainer.appendChild(renderTagsSetting('Evidence', 'evidence', 'evidence'));
        settingsContainer.appendChild(renderTagsSetting('Invalidation', 'invalidation', 'invalidation'));
        settingsContainer.appendChild(renderTagsSetting('Target', 'target', 'target'));
        
        settingsContainer.appendChild(renderTagsSetting('Psychology', 'psychology', 'psychology'));

                

        } else if (currentSettingsTab === 'rules' && showRulesTab) {
        // --- Rules (rules.js) ---
        renderRulesSettings(settingsContainer, onSettingsChange);
        } else if (currentSettingsTab === 'backups' && tabBackups) {
        // --- Backups (backup.js) ---
        backupSettingsEl(settingsContainer);
        } else if (currentSettingsTab === 'screenshot') {
        // --- Auto-Screenshot Settings Block (Browser API) ---
        const screenshotContainer = document.createElement('div');
        screenshotContainer.className = 'setting-category-card';
        
        const scHeaderWrapper = document.createElement('div');
        scHeaderWrapper.style.display = 'flex';
        scHeaderWrapper.style.justifyContent = 'space-between';
        scHeaderWrapper.style.alignItems = 'center';
        
        const scHeaderInfo = document.createElement('div');
        scHeaderInfo.innerHTML = '<h2 class="setting-cat-title" style="margin-bottom: 0;">Auto-Screenshots</h2><p class="help-text" style="margin-top: 4px; margin-bottom: 0;">Connect a window for 1-click capturing during this session.</p>';
        scHeaderWrapper.appendChild(scHeaderInfo);

        const isConnected = (activeMediaStream && activeMediaStream.active);
        const scActionBtn = document.createElement('button');
        scActionBtn.className = isConnected ? 'btn-danger btn-sm' : 'btn-primary btn-sm';
        scActionBtn.textContent = isConnected ? 'Disconnect Window' : 'Connect Window';
        
        scHeaderWrapper.appendChild(scActionBtn);
        screenshotContainer.appendChild(scHeaderWrapper);

        const previewContainer = document.createElement('div');
        previewContainer.className = 'stream-preview-container';
        previewContainer.style.display = isConnected ? 'flex' : 'none';
        
        const videoWrapper = document.createElement('div');
        videoWrapper.className = 'video-wrapper';
        if (isConnected) {
            const previewVideo = document.createElement('video');
            previewVideo.srcObject = activeMediaStream;
            previewVideo.autoplay = true;
            previewVideo.muted = true;
            previewVideo.style.width = '100%';
            previewVideo.style.objectFit = 'cover';
            previewVideo.style.borderRadius = '4px';
            videoWrapper.appendChild(previewVideo);
        }
        
        previewContainer.appendChild(videoWrapper);
        screenshotContainer.appendChild(previewContainer);
        settingsContainer.appendChild(screenshotContainer);

        scActionBtn.onclick = async () => {
            if (isConnected) {
                activeMediaStream.getTracks().forEach(track => track.stop());
                activeMediaStream = null;
                hiddenVideoElement.srcObject = null;
                appData.settings.autoScreenshotEnabled = false;
                onSettingsChange();
                renderSettingsUI();
                updateScreenshotBanner();
                showToast('Window disconnected', 'info');
            } else {
                await connectScreenshotWindow();
            }
        };
        // --- End Auto-Screenshot Settings Block ---
    } else {
        // Rules on: sub-tabs Stats | Rules (rules.js); the Rules list is drawn there
        if (typeof rulesChartSettingsTabs === 'function' && rulesChartSettingsTabs(settingsContainer, onSettingsChange)) return;
        const chartsConfig = [
            { key: 'growth', label: 'Execution Growth' },
            { key: 'winLoss', label: 'Overall Win/Loss Ratio' },
            { key: 'directionalBias', label: 'Directional Bias' },
            { key: 'dayOfWeek', label: 'Performance by Day' },
            { key: 'setup', label: 'Top 5 Setup Effectiveness' },
            { key: 'invalidation', label: 'Top 5 Invalidation Losses', depends: 'invalidation' },
            { key: 'psychology', label: 'Top 5 Psychology', depends: 'psychology' },
            { key: 'confluence', label: (typeof rulesGradeOn === 'function' && rulesGradeOn()) ? 'Win Rate by Grade' : 'Confluence Amount vs Win Rate' },
            { key: 'symbol', label: 'Performance by Symbol' },
            { key: 'marketCond', label: 'Market Condition Analysis' },
            { key: 'location', label: 'Location Effectiveness Heatmap' }
        ];
        
        const banner = document.createElement('div');
        banner.className = 'info-banner';
        banner.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg><span><strong>Tip:</strong> Drag a chart by its <span class="inline-drag-icon">${DRAG_ICON_SVG}</span> handle to change the order on the Stats page.</span>`;
        settingsContainer.appendChild(banner);

        // Wrap inside a container with an 8px gap
        const chartsWrapper = document.createElement('div');
        chartsWrapper.style.display = 'flex';
        chartsWrapper.style.flexDirection = 'column';
        chartsWrapper.style.gap = '8px';

        // Sort rows by the saved chart order (settings.json -> chartOrder)
        const order = getChartOrder();
        const allConfig = [...chartsConfig, ...ccSettingsRows()];
        const sortedConfig = allConfig.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
        let draggedChartKey = null;

        // Add button sits at the top of the list
        const addChartBtn = document.createElement('button');
        addChartBtn.className = 'btn-secondary btn-sm add-level-1-btn';
        addChartBtn.textContent = '+ Add Custom Chart';
        addChartBtn.onclick = () => openCustomChartModal();
        chartsWrapper.appendChild(addChartBtn);

        sortedConfig.forEach(c => {
            if (c.depends && !appData.settings.features[c.depends]) return;

            const row = document.createElement('div');
            row.className = 'chart-toggle-row';

            // --- Drag & drop to reorder (handle only, like the category rows) ---
            row.ondragstart = (e) => {
                draggedChartKey = c.key;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => row.classList.add('dragging-row'), 0);
            };
            row.ondragend = () => {
                draggedChartKey = null;
                row.draggable = false;
                row.classList.remove('dragging-row');
                chartsWrapper.querySelectorAll('.chart-toggle-row').forEach(r => r.classList.remove('row-drag-over'));
            };
            row.ondragover = (e) => {
                e.preventDefault();
                if (draggedChartKey && draggedChartKey !== c.key) row.classList.add('row-drag-over');
            };
            row.ondragleave = () => row.classList.remove('row-drag-over');
            row.ondrop = (e) => {
                e.preventDefault();
                row.classList.remove('row-drag-over');
                if (!draggedChartKey || draggedChartKey === c.key) return;
                const newOrder = getChartOrder();
                const dropIdx = newOrder.indexOf(c.key);
                newOrder.splice(newOrder.indexOf(draggedChartKey), 1);
                newOrder.splice(dropIdx, 0, draggedChartKey);
                appData.settings.chartOrder = newOrder;
                onSettingsChange();
                renderSettingsUI();
            };

            const leftDiv = document.createElement('div');
            leftDiv.className = 'chart-toggle-left';

            const dragHandle = document.createElement('div');
            dragHandle.innerHTML = DRAG_ICON_SVG;
            dragHandle.className = 'row-drag-handle';
            dragHandle.title = 'Drag to reorder chart';
            dragHandle.onmousedown = () => { row.draggable = true; };
            dragHandle.onmouseup = () => { row.draggable = false; };
            dragHandle.onmouseleave = () => { if (!draggedChartKey) row.draggable = false; };

            const label = document.createElement('span');
            label.className = 'chart-toggle-label';
            label.textContent = c.label;

            leftDiv.appendChild(dragHandle);
            leftDiv.appendChild(label);
            if (c.custom) {
                const tag = document.createElement('span');
                tag.className = 'chart-custom-tag';
                tag.textContent = 'Custom';
                leftDiv.appendChild(tag);
            }
            if (c.note) {
                const note = document.createElement('span');
                note.className = 'chart-toggle-note';
                note.textContent = c.note;
                leftDiv.appendChild(note);
            }

            const btn = document.createElement('button');
            const isEnabled = appData.settings.chartVisibility[c.key] !== false; 
            btn.className = isEnabled ? 'btn-secondary btn-sm' : 'btn-primary btn-sm';
            btn.textContent = isEnabled ? 'Disable' : 'Enable';
            btn.onclick = () => {
                appData.settings.chartVisibility[c.key] = !isEnabled;
                onSettingsChange();
                renderSettingsUI();
            };
            
            row.appendChild(leftDiv);
            if (c.custom) {
                const actions = document.createElement('div');
                actions.className = 'chart-toggle-actions';
                const editBtn = document.createElement('button');
                editBtn.className = 'btn-secondary btn-sm';
                editBtn.textContent = 'Edit';
                editBtn.onclick = () => openCustomChartModal(c.id);
                actions.appendChild(editBtn);
                actions.appendChild(btn);
                row.appendChild(actions);
            } else {
                row.appendChild(btn);
            }
            chartsWrapper.appendChild(row);
        });

        
        settingsContainer.appendChild(chartsWrapper);
    }
}
