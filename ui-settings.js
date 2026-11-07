// --- Settings page (lists, Journal / Chart / Screenshot tabs) ---
// Split off from ui.js. Loaded right after ui.js.

// --- Settings UI Architecture ---

function createPillBox(dataArray, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'pill-box';
    let draggedIndex = null;
    
    function render() {
        wrapper.innerHTML = '';
        dataArray.forEach((item, index) => {
            const pill = document.createElement('div');
            pill.className = 'pill';
            pill.draggable = true;
            
            // Drag Drop logic for pills
            pill.ondragstart = (e) => {
                e.stopPropagation(); // STOP event from reaching the row drag handler
                draggedIndex = index;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => pill.classList.add('dragging'), 0);
            };
            pill.ondragend = () => {
                draggedIndex = null;
                pill.classList.remove('dragging');
                wrapper.querySelectorAll('.pill').forEach(p => p.classList.remove('drag-over'));
            };
            pill.ondragover = (e) => {
                e.preventDefault();
                if (draggedIndex !== null && draggedIndex !== index) {
                    pill.classList.add('drag-over');
                }
            };
            pill.ondragleave = () => pill.classList.remove('drag-over');
            pill.ondrop = (e) => {
                e.preventDefault();
                pill.classList.remove('drag-over');
                if (draggedIndex !== null && draggedIndex !== index) {
                    const draggedItem = dataArray.splice(draggedIndex, 1)[0];
                    dataArray.splice(index, 0, draggedItem);
                    onChange();
                    render();
                }
            };
            
            const textNode = document.createElement('span');
            textNode.textContent = item;
            textNode.className = 'pill-text';
            textNode.title = "Click to edit, Drag to reorder";
            
            textNode.onclick = (e) => {
                e.stopPropagation();
                textNode.contentEditable = true;
                pill.draggable = false; 
                textNode.focus();
            };
            
            textNode.onblur = () => {
                textNode.contentEditable = false;
                pill.draggable = true;
                const newVal = textNode.textContent.trim();
                if (newVal && newVal !== item && !dataArray.includes(newVal)) {
                    dataArray[index] = newVal;
                    // A renamed setup keeps its rules (rules.js)
                    if (typeof rulesOnListRename === 'function') rulesOnListRename(dataArray, item, newVal);
                    onChange();
                    render();
                } else if (!newVal) {
                    dataArray.splice(index, 1);
                    onChange();
                    render();
                } else {
                    textNode.textContent = item;
                }
            };
            
            textNode.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    textNode.blur();
                }
            };
            
            const closeBtn = document.createElement('span');
            closeBtn.innerHTML = '&times;';
            closeBtn.className = 'pill-close';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                dataArray.splice(index, 1);
                onChange();
                render();
            };
            
            pill.appendChild(textNode);
            pill.appendChild(closeBtn);
            wrapper.appendChild(pill);
        });
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'pill-input-field';
        input.placeholder = dataArray.length === 0 ? 'Type & press comma...' : '';
        
        input.onkeydown = (e) => {
            if (e.key === ',' || e.key === 'Enter') {
                e.preventDefault();
                let val = input.value.trim().replace(/,+$/, '');
                if (val && !dataArray.includes(val)) {
                    dataArray.push(val);
                    onChange();
                    render();
                    wrapper.querySelector('.pill-input-field').focus();
                } else {
                    input.value = '';
                }
            }
        };
        
        wrapper.appendChild(input);
        wrapper.onclick = () => input.focus();
    }
    
    render();
    return wrapper;
}

function renderComplexSetting(title, configObj, type, onChange, toggleKey = null) {
    const container = document.createElement('div');
    container.className = 'setting-category-card';
    
    const headerWrapper = document.createElement('div');
    headerWrapper.style.display = 'flex';
    headerWrapper.style.justifyContent = 'space-between';
    headerWrapper.style.alignItems = 'center';
    headerWrapper.style.marginBottom = '16px';

    const header = document.createElement('h3');
    header.textContent = title;
    header.className = 'setting-cat-title';
    header.style.marginBottom = '0';
    headerWrapper.appendChild(header);

    const itemsWrapper = document.createElement('div');

    if (toggleKey) {
        if (!appData.settings.features) appData.settings.features = {};
        if (appData.settings.features[toggleKey] === undefined) appData.settings.features[toggleKey] = true;
        
        const isEnabled = appData.settings.features[toggleKey];
        const toggleBtn = document.createElement('button');
        toggleBtn.className = isEnabled ? 'btn-secondary btn-sm' : 'btn-primary btn-sm';
        toggleBtn.textContent = isEnabled ? 'Disable' : 'Enable';
        toggleBtn.onclick = () => {
            appData.settings.features[toggleKey] = !appData.settings.features[toggleKey];
            onChange();
            renderSettingsUI();
        };
        headerWrapper.appendChild(toggleBtn);
        if (!isEnabled) itemsWrapper.style.display = 'none';
    }

    container.appendChild(headerWrapper);
    itemsWrapper.className = 'setting-items-wrapper';
    container.appendChild(itemsWrapper);
    
    let draggedRowKey = null;

    const renderItems = () => {
        itemsWrapper.innerHTML = '';
        Object.keys(configObj).forEach((key) => {
            const row = document.createElement('div');
            row.className = 'setting-row';
            
            // Row drag and drop (Level 1)
            row.ondragstart = (e) => {
                draggedRowKey = key;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => row.classList.add('dragging-row'), 0);
            };
            row.ondragend = () => {
                draggedRowKey = null;
                row.draggable = false; 
                row.classList.remove('dragging-row');
                itemsWrapper.querySelectorAll('.setting-row').forEach(r => r.classList.remove('row-drag-over'));
            };
            row.ondragover = (e) => {
                e.preventDefault();
                if (draggedRowKey && draggedRowKey !== key) {
                    row.classList.add('row-drag-over');
                }
            };
            row.ondragleave = () => row.classList.remove('row-drag-over');
            row.ondrop = (e) => {
                e.preventDefault();
                row.classList.remove('row-drag-over');
                if (draggedRowKey && draggedRowKey !== key) {
                    const keysArray = Object.keys(configObj);
                    const draggedIdx = keysArray.indexOf(draggedRowKey);
                    const dropIdx = keysArray.indexOf(key);
                    
                    keysArray.splice(draggedIdx, 1);
                    keysArray.splice(dropIdx, 0, draggedRowKey);
                    
                    const newObj = {};
                    keysArray.forEach(k => newObj[k] = configObj[k]);
                    
                    Object.keys(configObj).forEach(k => delete configObj[k]);
                    Object.keys(newObj).forEach(k => configObj[k] = newObj[k]);
                    
                    onChange();
                    renderItems();
                }
            };
            
            const level1Div = document.createElement('div');
            level1Div.className = 'setting-level-1';
            
            const dragHandle = document.createElement('div');
            dragHandle.innerHTML = DRAG_ICON_SVG;
            dragHandle.className = 'row-drag-handle';
            dragHandle.title = "Drag to reorder category";
            
            dragHandle.onmousedown = () => { row.draggable = true; };
            dragHandle.onmouseup = () => { row.draggable = false; };
            dragHandle.onmouseleave = () => { row.draggable = false; };
            
            const keyInput = document.createElement('input');
            keyInput.type = 'text';
            keyInput.className = 'linear-input level-1-input';
            keyInput.value = key;
            
            const delLvl1Btn = document.createElement('button');
            delLvl1Btn.innerHTML = '&times;';
            delLvl1Btn.className = 'btn-icon delete-level-1';
            delLvl1Btn.onclick = async () => {
                if (await appConfirm({ title: `Delete the category “${key}”?`, message: 'The category and its options are removed from your lists. Trades you already logged keep what they had.', confirmText: 'Delete', icon: 'trash' })) {
                    delete configObj[key];
                    onChange();
                    renderItems();
                }
            };
            
            level1Div.appendChild(dragHandle);
            level1Div.appendChild(keyInput);
            level1Div.appendChild(delLvl1Btn);
            row.appendChild(level1Div);
            
            keyInput.onblur = () => {
                const newKey = keyInput.value.trim();
                if(newKey && newKey !== key && !configObj[newKey]) {
                    configObj[newKey] = configObj[key];
                    delete configObj[key];
                    onChange();
                    renderItems();
                } else {
                    keyInput.value = key; 
                }
            };

            const subsDiv = document.createElement('div');
            subsDiv.className = 'setting-subs';
            
            if (type === '3-level') {
                const sub1Label = document.createElement('label');
                sub1Label.textContent = 'Level 1';
                subsDiv.appendChild(sub1Label);
                subsDiv.appendChild(createPillBox(configObj[key].sub1, onChange));
                
                const sub2Label = document.createElement('label');
                sub2Label.textContent = 'Level 2';
                subsDiv.appendChild(sub2Label);
                subsDiv.appendChild(createPillBox(configObj[key].sub2, onChange));
            } else if (type === '2-level') {
                const subLabel = document.createElement('label');
                subLabel.textContent = 'Level 1';
                subsDiv.appendChild(subLabel);
                subsDiv.appendChild(createPillBox(configObj[key], onChange));
            }
            
            row.appendChild(subsDiv);
            itemsWrapper.appendChild(row);
        });
        
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-secondary btn-sm add-level-1-btn';
        addBtn.textContent = '+ Add Category';
        addBtn.onclick = () => {
            let newKey = 'New Category';
            let counter = 1;
            while(configObj[newKey]) {
                newKey = `New Category ${counter}`;
                counter++;
            }
            if (type === '3-level') {
                configObj[newKey] = { sub1: [], sub2: [] };
            } else {
                configObj[newKey] = [];
            }
            onChange();
            renderItems();
        };
        itemsWrapper.appendChild(addBtn);
    };
    
    renderItems();
    return container;
}

function renderSimpleSetting(title, dataArray, onChange, toggleKey = null) {
    const container = document.createElement('div');
    container.className = 'setting-category-card';
    
    const headerWrapper = document.createElement('div');
    headerWrapper.style.display = 'flex';
    headerWrapper.style.justifyContent = 'space-between';
    headerWrapper.style.alignItems = 'center';
    headerWrapper.style.marginBottom = '16px';

    const header = document.createElement('h3');
    header.textContent = title;
    header.className = 'setting-cat-title';
    header.style.marginBottom = '0';
    headerWrapper.appendChild(header);
    
    container.appendChild(headerWrapper);

    const pillBox = createPillBox(dataArray, onChange);

    if (toggleKey) {
        if (!appData.settings.features) appData.settings.features = {};
        if (appData.settings.features[toggleKey] === undefined) appData.settings.features[toggleKey] = true;

        const isEnabled = appData.settings.features[toggleKey];
        const toggleBtn = document.createElement('button');
        toggleBtn.className = isEnabled ? 'btn-secondary btn-sm' : 'btn-primary btn-sm';
        toggleBtn.textContent = isEnabled ? 'Disable' : 'Enable';
        toggleBtn.onclick = () => {
            appData.settings.features[toggleKey] = !appData.settings.features[toggleKey];
            onChange();
            renderSettingsUI();
        };
        headerWrapper.appendChild(toggleBtn);
        if (!isEnabled) pillBox.style.display = 'none';
    }

    container.appendChild(pillBox);
    return container;
}

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
    settingsContainer.appendChild(tabsDiv);
    slidePillIndicator(tabsDiv, { journal: tabJournal, rules: tabRules, chart: tabChart, screenshot: tabScreenshot }[currentSettingsTab], 'settingsTabs');
    
    const onSettingsChange = async () => { await autoSave(); };

    if (currentSettingsTab === 'journal') {
        // VWS Journal system / own system (system.js)
        if (typeof systemSettingsEl === 'function') settingsContainer.appendChild(systemSettingsEl());
        const banner = document.createElement('div');
        banner.className = 'info-banner';
        banner.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg><span><strong>Tip:</strong> Add a parameter by typing and pressing <strong>comma ( , )</strong> or <strong>Enter</strong>. You can easily drag & drop parameters and categories to reorder them!</span>`;
        settingsContainer.appendChild(banner);

        settingsContainer.appendChild(renderSimpleSetting('Symbol', appData.settings.symbol, onSettingsChange));
        // Same order as the add/edit trade form
        settingsContainer.appendChild(renderSimpleSetting('Market Condition', appData.settings.marketCondition, onSettingsChange));
        settingsContainer.appendChild(renderComplexSetting('Location', appData.settings.location, '3-level', onSettingsChange));
        settingsContainer.appendChild(renderComplexSetting('Setup', appData.settings.setup, '2-level', onSettingsChange));
        settingsContainer.appendChild(renderSimpleSetting('Direction', appData.settings.direction, onSettingsChange));
        settingsContainer.appendChild(renderComplexSetting('Evidence', appData.settings.evidence, '2-level', onSettingsChange, 'evidence'));
        settingsContainer.appendChild(renderComplexSetting('Invalidation', appData.settings.invalidation, '2-level', onSettingsChange, 'invalidation'));
        settingsContainer.appendChild(renderComplexSetting('Target', appData.settings.target, '3-level', onSettingsChange, 'target'));
        
        settingsContainer.appendChild(renderSimpleSetting('Psychology', appData.settings.psychology, onSettingsChange, 'psychology'));

                

        } else if (currentSettingsTab === 'rules' && showRulesTab) {
        // --- Rules (rules.js) ---
        renderRulesSettings(settingsContainer, onSettingsChange);
        } else if (currentSettingsTab === 'screenshot') {
        // --- Auto-Screenshot Settings Block (Browser API) ---
        const screenshotContainer = document.createElement('div');
        screenshotContainer.className = 'setting-category-card';
        
        const scHeaderWrapper = document.createElement('div');
        scHeaderWrapper.style.display = 'flex';
        scHeaderWrapper.style.justifyContent = 'space-between';
        scHeaderWrapper.style.alignItems = 'center';
        
        const scHeaderInfo = document.createElement('div');
        scHeaderInfo.innerHTML = '<h3 class="setting-cat-title" style="margin-bottom: 0;">Auto-Screenshots</h3><p class="help-text" style="margin-top: 4px; margin-bottom: 0;">Connect a window for 1-click capturing during this session.</p>';
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
