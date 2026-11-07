// --- Image Upload Events (Modal) ---

function setupImageUploadEvents() {
    imageDropzone.addEventListener('click', () => tImageInput.click());
    tImageInput.addEventListener('change', (e) => {
        if(e.target.files && e.target.files[0]) handleImageFile(e.target.files[0]);
    });

    imageDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        imageDropzone.classList.add('dragover');
    });
    imageDropzone.addEventListener('dragleave', () => imageDropzone.classList.remove('dragover'));
    imageDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        imageDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if(file.type.startsWith('image/')) handleImageFile(file);
        }
    });

    tradeModal.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                handleImageFile(blob);
                break;
            }
        }
    });

    btnRemoveImage.addEventListener('click', () => {
        pendingImageBlob = null;
        imageRemoved = true;
        showDropzone();
    });
    
    imagePreview.addEventListener('click', () => {
        if(imagePreview.src) openImageViewer(imagePreview.src);
    });
}

async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDim = 1920;
            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(img.src);
            canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.90);
        };
        img.onerror = (e) => { URL.revokeObjectURL(img.src); reject(e); };
        img.src = URL.createObjectURL(file);
    });
}

async function handleImageFile(file) {
    try {
        const compressedBlob = await compressImage(file);
        pendingImageBlob = compressedBlob;
        imageRemoved = false;
        const url = URL.createObjectURL(compressedBlob);
        imagePreview.src = url;
        hideDropzone();
        isFormDirty = true;
    } catch(e) {
        console.error("Compression failed", e);
    }
}

function showDropzone() {
    imageDropzone.style.display = 'flex';
    imagePreviewContainer.style.display = 'none';
    imagePreview.src = '';
    tImageInput.value = '';
}

function hideDropzone() {
    imageDropzone.style.display = 'none';
    imagePreviewContainer.style.display = 'flex';
}

// --- Helpers ---

function formatHierarchy(primary, sub1, sub2) {
    if (!primary) return '<div class="group-primary">-</div>';
    const subs = [sub1, sub2].filter(Boolean).map(escapeHTML).join(' - ');
    let html = `<div class="group-primary">${escapeHTML(primary)}</div>`;
    if (subs) html += `<div class="group-secondary">${subs}</div>`;
    return html;
}

function formatMultiHierarchy(items) {
    if (!items || items.length === 0) return '<div class="group-primary">-</div>';
    
    const htmls = items.map(item => {
        if (typeof item === 'string') {
            return `<div class="multi-item"><div class="group-primary">${item}</div></div>`;
        }
        const primary = item.primary || '-';
        const subs = [item.sub1, item.sub2, item.sub].filter(Boolean).join(' - ');
        let html = `<div class="group-primary">${primary}</div>`;
        if (subs) html += `<div class="group-secondary">${subs}</div>`;
        return `<div class="multi-item">${html}</div>`;
    });
    
    return htmls.join('<div class="multi-divider"></div>');
}

function getMonday(d) {
    d = new Date(d);
    var day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function alignWeekToDate(dateObj) {
    currentWeekStartDate = getMonday(dateObj);
}

// "2026-10-26" -> local date at noon (new Date("2026-10-26") is UTC midnight,
// which is the previous day for users west of UTC, e.g. in the US)
function parseLocalDate(dateStr) {
    const d = new Date(`${dateStr}T12:00:00`);
    return isNaN(d) ? null : d;
}

// Go to the previous/next week and keep the same weekday selected
// (Monday this week -> Monday last week), so the trades of that day show
function shiftWeek(delta) {
    const selected = parseLocalDate(datePicker.value);
    currentWeekStartDate.setDate(currentWeekStartDate.getDate() + 7 * delta);
    if (selected) {
        const weekdayIndex = (selected.getDay() + 6) % 7; // Monday = 0
        const target = new Date(currentWeekStartDate);
        target.setDate(target.getDate() + weekdayIndex);
        window.fpDatePicker.setDate(target.toLocaleDateString('en-CA'));
        alignWeekToDate(target);
    }
    renderDashboard();
}

function setupCalendarEvents() {
    btnPrevWeek.addEventListener('click', () => shiftWeek(-1));
    btnNextWeek.addEventListener('click', () => shiftWeek(1));
}

function renderWeeklyCalendar() {
    calDaysContainer.innerHTML = '';
    const selectedDateStr = datePicker.value; 
    const todayStr = new Date().toLocaleDateString('en-CA');
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    for (let i = 0; i < 7; i++) {
        let d = new Date(currentWeekStartDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toLocaleDateString('en-CA');
        
        const tradesForThisDate = appData.trades.filter(t => t.date === dateStr);
        const tradesCount = tradesForThisDate.length;
        
        const isActive = dateStr === selectedDateStr;
        const isToday = dateStr === todayStr; 
        
        const dayDiv = document.createElement('div');
        dayDiv.className = `cal-day ${isActive ? 'active' : ''} ${isToday ? 'is-today' : ''}`;
        
        // Result tags: green = wins, red = losses, grey = break-even (only shown when > 0)
        const winCount = tradesForThisDate.filter(t => t.result === 'WIN').length;
        const lossCount = tradesForThisDate.filter(t => t.result === 'LOST').length;
        const beCount = tradesForThisDate.filter(t => t.result === 'B/E').length;
        const tradesText = [
            winCount > 0 ? `<span class="cal-result-tag win" title="${winCount} winning">${winCount}</span>` : '',
            lossCount > 0 ? `<span class="cal-result-tag lost" title="${lossCount} losing">${lossCount}</span>` : '',
            beCount > 0 ? `<span class="cal-result-tag be" title="${beCount} break-even">${beCount}</span>` : ''
        ].join('');
        
        dayDiv.innerHTML = `
            <span class="cal-day-name">${dayNames[i]}</span>
            <span class="cal-day-num">${d.getDate()}</span>
            <span class="cal-day-trades">${tradesText}</span>
        `;
        
        dayDiv.addEventListener('click', () => {
            window.fpDatePicker.setDate(dateStr);
            renderDashboard();
        });
        
        calDaysContainer.appendChild(dayDiv);
    }
}

// --- Motion / Animations ---
// Subtle SaaS-style motion. Disabled automatically when the OS "reduce motion" setting is on.
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAX_STAGGER_ITEMS = 10;   // items after this all share the last delay
let pendingTradesAnimation = 'enter'; // 'enter' | 'next' | 'prev' | null
let lastRenderedDate = null;
let lastRenderedWeek = null;

// Plays a staggered animation on a list of elements: 'enter' (fade + slide up), 'next' or 'prev' (slide sideways)
function animateItems(elements, type = 'enter') {
    if (REDUCED_MOTION || !elements) return;
    const cls = 'anim-' + type;
    Array.from(elements).forEach((el, i) => {
        el.classList.remove('anim-enter', 'anim-next', 'anim-prev');
        el.style.setProperty('--i', Math.min(i, MAX_STAGGER_ITEMS));
        void el.offsetWidth; // restart animation
        el.classList.add(cls);
        const cleanup = (e) => {
            if (e.target !== el) return;
            el.classList.remove(cls);
            el.removeEventListener('animationend', cleanup);
        };
        el.addEventListener('animationend', cleanup);
    });
}

// Page enter: quick fade of the view + staggered content (runs after the page has rendered)
function playViewEnter(view) {
    if (REDUCED_MOTION || !view) return;
    view.classList.remove('view-enter');
    void view.offsetWidth;
    view.classList.add('view-enter');

    if (view.id === 'view-dashboard') pendingTradesAnimation = 'enter';

    // Microtask: runs after the synchronous render of the page, before the browser paints
    queueMicrotask(() => {
        const selectors = {
            'view-dashboard': '#screenshot-connect-banner, #share-active-banner, #weekly-calendar-widget',
            'view-stats': '.view-header, .stats-filters, .kpi-card, .stats-grid > .stat-card',
            'view-settings': '.view-header, .settings-tabs, #settings-ui-container > .info-banner, .setting-category-card, .chart-toggle-row',
            'view-help': '.view-header, .faq-item, .help-contact-card'
        };
        const sel = selectors[view.id];
        if (!sel) return;
        const items = Array.from(view.querySelectorAll(sel)).filter(el => el.offsetParent !== null);
        animateItems(items, 'enter');
    });
}

// Sliding active indicator behind the sidebar icons
function moveNavIndicator(btn, animate = true) {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav || !btn) return;
    let indicator = nav.querySelector('.nav-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'nav-indicator';
        nav.prepend(indicator);
        nav.classList.add('has-indicator');
        animate = false;
    }
    if (!animate || REDUCED_MOTION) indicator.style.transition = 'none';
    indicator.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
    if (!animate || REDUCED_MOTION) {
        void indicator.offsetWidth;
        indicator.style.transition = '';
    }
}

// Sliding pill behind the active tab / toggle (settings tabs, card/list toggle).
// Remembers the previous position per key, so it also slides when the tabs are re-rendered.
const pillIndicatorState = {};
function slidePillIndicator(host, activeEl, key) {
    if (!host || !activeEl) return;
    host.classList.add('pill-indicator-host', 'has-indicator');
    host.dataset.pillKey = key;
    let ind = host.querySelector(':scope > .pill-indicator');
    if (!ind) {
        ind = document.createElement('div');
        ind.className = 'pill-indicator';
        host.prepend(ind);
    }
    const target = { x: activeEl.offsetLeft, y: activeEl.offsetTop, w: activeEl.offsetWidth, h: activeEl.offsetHeight };
    if (!target.w) return; // not visible (yet)
    const place = (r) => {
        ind.style.transform = `translate(${r.x}px, ${r.y}px)`;
        ind.style.width = r.w + 'px';
        ind.style.height = r.h + 'px';
    };
    const prev = pillIndicatorState[key];
    ind.style.transition = 'none';
    if (prev && !REDUCED_MOTION && (prev.x !== target.x || prev.y !== target.y || prev.w !== target.w)) {
        place(prev);
        void ind.offsetWidth;
        ind.style.transition = '';
        place(target);
    } else {
        place(target);
        void ind.offsetWidth;
        ind.style.transition = '';
    }
    pillIndicatorState[key] = target;
}

// Re-place all pills without animation (e.g. after a window resize changes the layout)
function refreshPillIndicators() {
    document.querySelectorAll('.pill-indicator-host.has-indicator').forEach(host => {
        const active = host.querySelector(':scope > .active');
        const key = host.dataset.pillKey;
        if (!active || !key) return;
        delete pillIndicatorState[key];
        slidePillIndicator(host, active, key);
    });
}
window.addEventListener('resize', refreshPillIndicators);

// Settings tab switch: slide the pill + stagger the new tab content
function switchSettingsTab(tab) {
    if (currentSettingsTab === tab) return;
    currentSettingsTab = tab;
    renderSettingsUI();
    animateItems(settingsContainer.querySelectorAll(':scope > .info-banner, .setting-category-card, .chart-toggle-row'), 'enter');
}

// --- Dashboard Rendering ---

async function renderDashboard() {
    renderWeeklyCalendar();

    // Direction-aware motion: compare with what was shown before
    const renderDate = datePicker.value;
    const renderWeek = currentWeekStartDate.toLocaleDateString('en-CA');
    const weekChanged = lastRenderedWeek && renderWeek !== lastRenderedWeek;
    if (weekChanged) {
        animateItems([calDaysContainer], renderWeek > lastRenderedWeek ? 'next' : 'prev');
    }

    // Sliding pill behind the selected day (same motion as the sidebar).
    // On a week change the whole strip slides, so the pill is placed directly.
    const activeDay = calDaysContainer.querySelector('.cal-day.active');
    if (weekChanged || !activeDay) delete pillIndicatorState.calDay;
    if (activeDay) slidePillIndicator(calDaysContainer, activeDay, 'calDay');
    if (lastRenderedDate && renderDate !== lastRenderedDate && !pendingTradesAnimation) {
        pendingTradesAnimation = renderDate > lastRenderedDate ? 'next' : 'prev';
    }
    // Other day picked: check for new reviews on shared trades
    if (lastRenderedDate && renderDate !== lastRenderedDate && typeof syncReviewsSoon === 'function') syncReviewsSoon();
    lastRenderedDate = renderDate;
    if (typeof updateShareBanner === 'function') updateShareBanner();
    lastRenderedWeek = renderWeek;
    const tradesAnimation = pendingTradesAnimation;
    pendingTradesAnimation = null;
    revokeObjectUrls();
    tradesList.innerHTML = '';
    if(dashboardToolbar) dashboardToolbar.style.display = 'none';
    
    // No folder (or no permission yet): the connection popup locks the app
    updateConnectionGate();
    if (!dirHandle || !fileConnected) return;

    const selectedDate = datePicker.value;
    const tradesForDate = appData.trades.filter(t => t.date === selectedDate);
    
    if (tradesForDate.length === 0) {
        tradesList.innerHTML = `
            <div class="empty-state">
                <p style="margin-bottom: 16px; font-weight: 500;">Add first trade for this date</p>
                <button class="btn-primary" id="btn-add-first-trade">Add Trade</button>
            </div>`;
            
        document.getElementById('btn-add-first-trade').addEventListener('click', () => {
            openTradeModal();
        });
        if (tradesAnimation) animateItems(tradesList.children, tradesAnimation);
        return;
    }

    updateScreenshotBanner();
    if(dashboardToolbar) dashboardToolbar.style.display = 'flex';
    if(!appData.settings.viewMode) appData.settings.viewMode = 'card';
    btnViewCard.classList.toggle('active', appData.settings.viewMode === 'card');
    btnViewTable.classList.toggle('active', appData.settings.viewMode === 'table');
    slidePillIndicator(btnViewCard.parentElement, appData.settings.viewMode === 'table' ? btnViewTable : btnViewCard, 'viewToggle');
    
    const isTableView = appData.settings.viewMode === 'table';
    let tableWrapper, tableContainer;
    if(isTableView) {
        tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-responsive-wrapper';
        tableContainer = document.createElement('div');
        tableContainer.className = 'trades-table';
        tableWrapper.appendChild(tableContainer);
    }

    const fragment = document.createDocumentFragment();

    for (const trade of tradesForDate) {
        const resultClass = trade.result ? escapeHTML(trade.result).toLowerCase().replace('/', '') : '';
        const card = document.createElement('div');
        card.className = 'trade-card';
        card.dataset.tradeId = trade.id;
        
        let imageUrl = null;
        if (trade.screenshot) {
            imageUrl = await getImageUrl(trade.screenshot);
        }

        let imageHtml = '';
        if (imageUrl) {
            imageHtml = `
            <div class="card-image-area">
                <img src="${imageUrl}" class="trade-screenshot-thumb trade-img-trigger" data-img-url="${imageUrl}" alt="Screenshot">
                <span class="img-enlarge-hint" aria-hidden="true"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>Enlarge</span>
            </div>`;
        }

        let primaryLoc = trade.locations && trade.locations[0] && trade.locations[0].primary ? escapeHTML(trade.locations[0].primary) : '-';
        let subLoc1 = trade.locations && trade.locations[0] && trade.locations[0].sub1 ? escapeHTML(trade.locations[0].sub1) : '';
        let subLoc2 = trade.locations && trade.locations[0] && trade.locations[0].sub2 ? escapeHTML(trade.locations[0].sub2) : '';
        let subLoc = [subLoc1, subLoc2].filter(Boolean).join(' - ');

        if (isTableView) {
            const row = document.createElement('div');
            row.className = 'trade-row';
            row.dataset.tradeId = trade.id;
            
            let rowImageHtml = imageUrl 
                ? `<img src="${imageUrl}" class="row-thumb trade-img-trigger" data-img-url="${imageUrl}">`
                : `<div class="row-no-thumb"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div>`;
            
            row.innerHTML = `
                <div class="row-main" style="display: flex; align-items: center; gap: 16px; width: 100%;">
                    <div class="row-chevron-wrapper" style="padding: 4px 8px; margin-left: -8px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Expand details"><svg class="row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s; color: var(--text-muted);"><polyline points="9 18 15 12 9 6"></polyline></svg></div>
                    ${rowImageHtml}
                    <div class="row-col row-col-id" style="flex-direction: row; align-items: center; gap: 8px;">
                        <span class="row-id-main">
                            <span class="row-primary">${escapeHTML(trade.number || '-')}</span>
                            ${trade.symbol ? `<span class="symbol-tag" style="margin:0;">${escapeHTML(trade.symbol)}</span>` : ''}
                        </span>
                        <span class="row-reviews-slot">${shareReviewsButtonHtml(trade)}</span>
                    </div>
                    <div class="row-col row-col-setup">
                        <span class="row-primary" title="${escapeHTML(trade.setup || '-')}">${escapeHTML(trade.setup || '-')}</span>
                        <span class="row-secondary" title="${escapeHTML(trade.direction || '-')} ${trade.marketCondition ? '| ' + escapeHTML(trade.marketCondition) : ''}">${escapeHTML(trade.direction || '-')} ${trade.marketCondition ? '| ' + escapeHTML(trade.marketCondition) : ''}</span>
                    </div>
                    <div class="row-col row-col-loc">
                        <span class="row-primary">${primaryLoc}</span>
                        <span class="row-secondary" title="${subLoc}">${subLoc}</span>
                    </div>
                    <div class="row-col-res" style="margin-left: auto; display: flex; align-items: center; gap: 10px;">
                        ${sharedLabelHtml(trade)}
                        ${shareToggleButtonHtml(trade)}
                        ${typeof rulesCardBadgesHtml === 'function' ? rulesCardBadgesHtml(trade) : ''}
                        <span class="badge ${resultClass}">${escapeHTML(trade.result || '-')}</span>
                    </div>
                </div>
                <div class="expanded-content" style="display: none; width: 100%; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                    <div class="card-body">
                        <div class="card-group">
                            <span class="group-title">Location</span>
                            <div class="group-value">${formatMultiHierarchy(trade.locations)}</div>
                        </div>
                        <div class="card-group">
                            <span class="group-title">Market Condition</span>
                            <div class="group-value">${formatHierarchy(escapeHTML(trade.marketCondition))}</div>
                        </div>
                        <div class="card-group">
                            <span class="group-title">Setup</span>
                            <div class="group-value">${formatHierarchy(escapeHTML(trade.setup), escapeHTML(trade.direction))}</div>
                        </div>
                        ${appData.settings.features.evidence ? `
                        <div class="card-group">
                            <span class="group-title">Evidence</span>
                            <div class="group-value">${formatMultiHierarchy(trade.evidences)}</div>
                        </div>` : ''}
                        ${appData.settings.features.invalidation ? `
                        <div class="card-group">
                            <span class="group-title">Invalidation</span>
                            <div class="group-value">${formatMultiHierarchy(trade.invalidations)}</div>
                        </div>` : ''}
                        ${appData.settings.features.target ? `
                        <div class="card-group">
                            <span class="group-title">Target</span>
                            <div class="group-value">${formatHierarchy(escapeHTML(trade.target), escapeHTML(trade.targetSub1), escapeHTML(trade.targetSub2))}</div>
                        </div>` : ''}
                        ${(appData.settings.features.psychology && trade.psychology && trade.psychology.length > 0) ? `
                        <div class="card-group psych-group">
                            <span class="group-title">Psychology</span>
                            <div class="group-value">
                                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                    ${trade.psychology.map(p => `<span class="psych-pill-tag" style="padding-right: 8px;">${escapeHTML(p)}</span>`).join('')}
                                </div>
                            </div>
                        </div>
                        ` : ''}
                        ${trade.notes ? `
                        <div class="card-group psych-group">
                            <span class="group-title">Notes</span>
                            <div class="group-value">
                                <div class="group-primary" style="font-weight: 400; font-size: 13px; white-space: pre-wrap; line-height: 1.5;">${escapeHTML(trade.notes)}</div>
                            </div>
                        </div>
                        ` : ''}
                        ${typeof rulesCardGroupHtml === 'function' ? rulesCardGroupHtml(trade) : ''}
                    </div>
                </div>
            `;
            tableContainer.appendChild(row);
        } else {
            card.innerHTML = `
                ${imageHtml}
                <div class="card-content-area">
                    <div class="card-header">
                        <div class="card-trade-id">
                            ${escapeHTML(trade.number || '-')}
                            ${trade.symbol ? `<span class="symbol-tag">${escapeHTML(trade.symbol)}</span>` : ''}
                            ${shareReviewsButtonHtml(trade)}
                        </div>
                        <div class="card-header-actions">
                            ${sharedLabelHtml(trade)}
                            ${shareToggleButtonHtml(trade)}
                            ${typeof rulesCardBadgesHtml === 'function' ? rulesCardBadgesHtml(trade) : ''}
                            <span class="badge ${resultClass}">${escapeHTML(trade.result || '-')}</span>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="card-group">
                            <span class="group-title">Location</span>
                            <div class="group-value">${formatMultiHierarchy(trade.locations)}</div>
                        </div>
                        <div class="card-group">
                            <span class="group-title">Market Condition</span>
                            <div class="group-value">${formatHierarchy(escapeHTML(trade.marketCondition))}</div>
                        </div>
                        <div class="card-group">
                            <span class="group-title">Setup</span>
                            <div class="group-value">${formatHierarchy(escapeHTML(trade.setup), escapeHTML(trade.direction))}</div>
                        </div>
                        ${appData.settings.features.evidence ? `
                        <div class="card-group">
                            <span class="group-title">Evidence</span>
                            <div class="group-value">${formatMultiHierarchy(trade.evidences)}</div>
                        </div>` : ''}
                        ${appData.settings.features.invalidation ? `
                        <div class="card-group">
                            <span class="group-title">Invalidation</span>
                            <div class="group-value">${formatMultiHierarchy(trade.invalidations)}</div>
                        </div>` : ''}
                        ${appData.settings.features.target ? `
                        <div class="card-group">
                            <span class="group-title">Target</span>
                            <div class="group-value">${formatHierarchy(escapeHTML(trade.target), escapeHTML(trade.targetSub1), escapeHTML(trade.targetSub2))}</div>
                        </div>` : ''}
                        ${(appData.settings.features.psychology && trade.psychology && trade.psychology.length > 0) ? `
                        <div class="card-group psych-group">
                            <span class="group-title">Psychology</span>
                            <div class="group-value">
                                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                    ${trade.psychology.map(p => `<span class="psych-pill-tag" style="padding-right: 8px;">${escapeHTML(p)}</span>`).join('')}
                                </div>
                            </div>
                        </div>
                        ` : ''}
                        ${trade.notes ? `
                        <div class="card-group psych-group">
                            <span class="group-title">Notes</span>
                            <div class="group-value">
                                <div class="group-primary" style="font-weight: 400; font-size: 13px; white-space: pre-wrap; line-height: 1.5;">${escapeHTML(trade.notes)}</div>
                            </div>
                        </div>
                        ` : ''}
                        ${typeof rulesCardGroupHtml === 'function' ? rulesCardGroupHtml(trade) : ''}
                    </div>
                </div>
            `;
            fragment.appendChild(card);
        }
    }
    
    if (isTableView && tableWrapper) {
        fragment.appendChild(tableWrapper);
    }
    
    tradesList.appendChild(fragment);

    if (tradesAnimation) {
        const items = [];
        if (dashboardToolbar && tradesAnimation === 'enter') items.push(dashboardToolbar);
        items.push(...tradesList.querySelectorAll(':scope > .trade-card, .trade-row'));
        animateItems(items, tradesAnimation);
    }
}

// --- Trade Modal Dynamic Dropdowns (Elements instead of IDs) ---

btnNewTrade.addEventListener('click', () => openTradeModal());
btnCloseModal.addEventListener('click', closeModal);
btnCancelModal.addEventListener('click', closeModal);

async function openTradeModal(tradeId = null) {
    tradeForm.reset();
    window.fpTDate.setDate(datePicker.value);
    
    pendingImageBlob = null;
    existingImageFilename = null;
    imageRemoved = false;
    showDropzone();
    

    if (tradeId) {
        document.getElementById('modal-title').innerText = 'Edit Trade';
        btnDeleteTrade.style.display = 'block';
        const trade = appData.trades.find(t => t.id === tradeId);
        
        document.getElementById('trade-id').value = trade.id;
        window.fpTDate.setDate(trade.date);
        document.getElementById('t-number').value = trade.number;
        tfInit(trade);
        document.getElementById('t-notes').value = trade.notes || '';
        
        if (trade.screenshot) {
            existingImageFilename = trade.screenshot;
            const url = await getImageUrl(trade.screenshot);
            if(url) {
                imagePreview.src = url;
                hideDropzone();
            }
        }
    } else {
        document.getElementById('modal-title').innerText = 'Add Trade';
        document.getElementById('trade-id').value = '';
        btnDeleteTrade.style.display = 'none';
        
        const todayTrades = appData.trades.filter(t => t.date === datePicker.value);
        document.getElementById('t-number').value = todayTrades.length + 1;
        
        tfInit(null);
        document.getElementById('t-notes').value = '';
    }

    if(!appData.settings.features) appData.settings.features = {evidence:true, invalidation:true, target:true, psychology:true};
    document.getElementById('section-evidence').style.display = appData.settings.features.evidence ? 'block' : 'none';
    document.getElementById('section-invalidation').style.display = appData.settings.features.invalidation ? 'block' : 'none';
    document.getElementById('section-target').style.display = appData.settings.features.target ? 'block' : 'none';
    document.getElementById('section-psychology').style.display = appData.settings.features.psychology ? 'block' : 'none';


        const autoShotBtn = document.getElementById('btn-auto-screenshot');
    if (autoShotBtn) {
        const newAutoShotBtn = autoShotBtn.cloneNode(true);
        autoShotBtn.parentNode.replaceChild(newAutoShotBtn, autoShotBtn);
        // Auto-Capture when a window is connected, otherwise Connect Window in the same spot
        updateModalCaptureButtons();

        newAutoShotBtn.addEventListener('click', async () => {
            const symbol = (tfState && tfState.symbol) || 'Unknown';
            const originalText = newAutoShotBtn.innerHTML;
            newAutoShotBtn.innerHTML = 'Capturing...';
            newAutoShotBtn.disabled = true;

            try {
                const canvas = await captureConnectedWindow();
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.9));
                if (!blob) throw new Error('Could not create the image');
                const file = new File([blob], `${symbol}_screenshot_${Date.now()}.webp`, { type: 'image/webp' });
                await handleImageFile(file);
                showToast('Screenshot captured!', 'success');
            } catch (error) {
                console.error('Auto-Capture failed:', error);
                showToast(`Capture failed: ${error.message}`, 'error');
            } finally {
                newAutoShotBtn.innerHTML = originalText;
                newAutoShotBtn.disabled = false;
            }
        });
    }

    tradeModal.classList.add('active');
    setTimeout(() => { isFormDirty = false; }, 50);
    
    // Reset scroll to top AFTER modal is visible
    setTimeout(() => {
        const modalBody = document.querySelector('.modal-body');
        if (modalBody) modalBody.scrollTop = 0;
    }, 10);
}

async function closeModal() {
    if (isFormDirty) {
        const discard = await appConfirm({
            title: 'Discard your changes?',
            message: 'You changed this trade but didn’t save it. If you close now, those changes are lost.',
            cancelText: 'Keep editing', confirmText: 'Discard', icon: 'warn'
        });
        if (!discard) return;
    }
    tradeModal.classList.remove('active');
    isFormDirty = false;
}

tradeModal.addEventListener('mousedown', (e) => {
    if (e.target === tradeModal) {
        closeModal();
    }
});

btnSaveTrade.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!document.getElementById('t-date').value) {
        const hint = document.getElementById('tf-save-hint');
        if (hint) hint.textContent = 'Still needed: Date';
        showToast('Still needed: Date', 'error');
        return;
    }

    const missing = tfValidate();
    if (missing.length) {
        showToast(`Choose: ${missing.join(', ')}`, 'error');
        return;
    }

    const tradeId = document.getElementById('trade-id').value || crypto.randomUUID();
    
    let finalImageName = existingImageFilename;

    if (imageRemoved && existingImageFilename) {
        await deleteImageFromDir(existingImageFilename);
        finalImageName = null;
    }

    if (pendingImageBlob) {
        if (existingImageFilename && !imageRemoved) {
             await deleteImageFromDir(existingImageFilename); 
        }
        finalImageName = `trade_${tradeId}_${Date.now()}.webp`;
        await saveImageToDir(pendingImageBlob, finalImageName);
    }
    
    // Reviews come from shared links; editing the trade must not drop them
    const previousTrade = appData.trades.find(t => t.id === tradeId);

    const tradeData = {
        id: tradeId,
        date: document.getElementById('t-date').value,
        number: document.getElementById('t-number').value,
        ...tfGetData(),
        notes: document.getElementById('t-notes').value,
        screenshot: finalImageName,
        reviews: previousTrade && Array.isArray(previousTrade.reviews) ? previousTrade.reviews : undefined,
        // Rule check (rules.js); without the feature an existing copy is kept as is
        ruleChecks: typeof rulesGetTradeChecks === 'function' ? rulesGetTradeChecks(previousTrade) : (previousTrade ? previousTrade.ruleChecks : undefined)
    };

    const existingIndex = appData.trades.findIndex(t => t.id === tradeId);
    if (existingIndex >= 0) {
        appData.trades[existingIndex] = tradeData;
    } else {
        appData.trades.push(tradeData);
    }

    isFormDirty = false;
    closeModal();
    window.fpDatePicker.setDate(tradeData.date);
    alignWeekToDate(parseLocalDate(tradeData.date) || new Date());
    await renderDashboard();
    
    await autoSave();
});

btnDeleteTrade.addEventListener('click', async (e) => {
    e.preventDefault();
    const tradeId = document.getElementById('trade-id').value;
    const trade = appData.trades.find(t => t.id === tradeId);
    const d = trade && trade.date ? parseLocalDate(trade.date) : null;
    const what = trade ? [trade.number ? `Trade ${trade.number}` : 'This trade', trade.symbol, trade.setup].filter(Boolean).join(' · ') + (d ? ` (${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})` : '') : 'This trade';
    const ok = await appConfirm({
        title: 'Delete this trade?',
        message: `${what}${trade && trade.screenshot ? ' and its screenshot are' : ' is'} removed from your journal. You can undo this for a few seconds.`,
        confirmText: 'Delete trade', icon: 'trash'
    });
    if (ok) {
        const index = appData.trades.findIndex(t => t.id === tradeId);
        appData.trades = appData.trades.filter(t => t.id !== tradeId);
        isFormDirty = false;
        closeModal();
        await renderDashboard();
        await autoSave();
        if (trade) offerUndoDelete(trade, index);
    }
});

// Undo after deleting a trade: 10 seconds. The screenshot is only removed when the undo is over.
const UNDO_DELETE_MS = 10000;
function offerUndoDelete(trade, index) {
    let undone = false, done = false;
    const removeShot = () => {
        if (done || undone) return;
        done = true;
        window.removeEventListener('pagehide', removeShot);
        if (trade.screenshot && !appData.trades.some(t => t.screenshot === trade.screenshot)) deleteImageFromDir(trade.screenshot);
    };
    const timer = setTimeout(removeShot, UNDO_DELETE_MS);
    window.addEventListener('pagehide', removeShot);
    showToast('Trade deleted.', 'info', {
        duration: UNDO_DELETE_MS,
        action: {
            label: 'Undo',
            onClick: async () => {
                if (done) return;
                undone = true;
                clearTimeout(timer);
                window.removeEventListener('pagehide', removeShot);
                if (!appData.trades.some(t => t.id === trade.id)) {
                    appData.trades.splice(Math.max(0, Math.min(index, appData.trades.length)), 0, trade);
                }
                await renderDashboard();
                await autoSave();
                showToast('Trade restored.', 'success');
            }
        }
    });
}


// --- App confirmation popup (replaces the browser's confirm()) ---
// appConfirm({ title, message, confirmText, cancelText, tone, icon }) → Promise<boolean>
// tone: 'danger' (red outline button, default) or 'primary' (blue).
// icon: 'warn', 'trash' or 'undo'. Esc / Cancel / click outside = false, Enter = true.
const APP_DIALOG_ICONS = {
    warn: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
    trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>',
    undo: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"></path></svg>'
};

function appConfirm(opts = {}) {
    const old = document.getElementById('app-dialog');
    if (old) return Promise.resolve(false); // one at a time
    const tone = opts.tone === 'primary' ? 'primary' : 'danger';
    const icon = APP_DIALOG_ICONS[opts.icon] ? opts.icon : (tone === 'danger' ? 'trash' : 'warn');
    const iconTone = opts.icon === 'warn' ? 'is-neutral' : tone === 'primary' ? 'is-primary' : 'is-danger';

    return new Promise(resolve => {
        const previousFocus = document.activeElement;
        const overlay = document.createElement('div');
        overlay.id = 'app-dialog';
        overlay.className = 'app-dialog-overlay';
        overlay.innerHTML = `
            <div class="app-dialog" role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-text">
                <span class="app-dialog-icon ${iconTone}">${APP_DIALOG_ICONS[icon]}</span>
                <div class="app-dialog-copy">
                    <h2 id="app-dialog-title">${escapeHTML(opts.title || 'Are you sure?')}</h2>
                    ${opts.message ? `<p id="app-dialog-text">${escapeHTML(opts.message)}</p>` : ''}
                </div>
                <div class="app-dialog-actions">
                    <button type="button" class="btn-secondary" data-dialog="cancel">${escapeHTML(opts.cancelText || 'Cancel')}</button>
                    <button type="button" class="${tone === 'primary' ? 'btn-primary' : 'btn-danger'}" data-dialog="ok">${escapeHTML(opts.confirmText || 'OK')}</button>
                </div>
            </div>`;

        const close = (result) => {
            document.removeEventListener('keydown', onKey, true);
            overlay.remove();
            if (previousFocus && typeof previousFocus.focus === 'function' && document.contains(previousFocus)) {
                try { previousFocus.focus({ preventScroll: true }); } catch (e) {}
            }
            resolve(result);
        };
        // Captures every key while open, so app shortcuts and other Esc handlers don't fire
        const onKey = (e) => {
            e.stopPropagation();
            if (e.key === 'Escape') { e.preventDefault(); close(false); return; }
            if (e.key === 'Enter') { e.preventDefault(); close(true); return; }
            if (e.key === 'Tab') {
                const buttons = [...overlay.querySelectorAll('button')];
                const i = buttons.indexOf(document.activeElement);
                e.preventDefault();
                buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
                return;
            }
            if (e.altKey || e.ctrlKey || e.metaKey || e.key.length === 1) e.preventDefault();
        };
        overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(false); });
        overlay.querySelector('[data-dialog="cancel"]').addEventListener('click', () => close(false));
        overlay.querySelector('[data-dialog="ok"]').addEventListener('click', () => close(true));
        document.addEventListener('keydown', onKey, true);
        document.body.appendChild(overlay);
        overlay.querySelector('[data-dialog="cancel"]').focus(); // safe default for mouse users; Enter still confirms
    });
}

function getToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

// opts.duration: ms on screen (default 3000) · opts.action: { label, onClick } = a button in the toast
function showToast(message, type = 'info', opts = {}) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
    let timer = null;
    const remove = () => {
        clearTimeout(timer);
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    };
    if (opts.action && opts.action.label) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'toast-action';
        btn.textContent = opts.action.label;
        btn.addEventListener('click', () => { remove(); if (typeof opts.action.onClick === 'function') opts.action.onClick(); });
        toast.appendChild(btn);
    }
    container.appendChild(toast);
    timer = setTimeout(remove, opts.duration || 3000);
    return toast;
}


// Trade popup: show Auto-Capture when a window is connected, otherwise Connect Window
function updateModalCaptureButtons() {
    const autoBtn = document.getElementById('btn-auto-screenshot');
    const connectBtn = document.getElementById('btn-connect-window');
    if (!autoBtn || !connectBtn) return;
    const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    const connected = !!(activeMediaStream && activeMediaStream.active);
    autoBtn.style.display = connected ? 'block' : 'none';
    connectBtn.style.display = (!connected && supported) ? 'block' : 'none';
    connectBtn.onclick = async () => {
        connectBtn.disabled = true;
        await connectScreenshotWindow();
        connectBtn.disabled = false;
        updateModalCaptureButtons();
    };
}

// --- Auto-Capture: one frame from the connected window ---
// First straight from the stream (ImageCapture), so it doesn't depend on the
// hidden video element: in a normal Chrome tab that element can stay unpainted,
// which gave black screenshots. Falls back to the video element after making
// sure it plays and has a fresh frame. A fully black result is reported.
async function captureConnectedWindow() {
    const track = activeMediaStream && activeMediaStream.getVideoTracks()[0];
    if (!track || track.readyState !== 'live') throw new Error('No window connected. Click Connect Window first.');

    let canvas = null;
    if (typeof ImageCapture === 'function') {
        try {
            const frame = await new ImageCapture(track).grabFrame();
            canvas = frameToCanvas(frame, frame.width, frame.height);
            if (frame.close) frame.close();
            if (isCanvasBlack(canvas)) canvas = null;
        } catch (e) {
            console.warn('grabFrame failed, using the video element instead', e);
            canvas = null;
        }
    }
    if (!canvas) {
        await waitForVideoFrame(hiddenVideoElement);
        if (!hiddenVideoElement.videoWidth) throw new Error('Video stream not ready');
        canvas = frameToCanvas(hiddenVideoElement, hiddenVideoElement.videoWidth, hiddenVideoElement.videoHeight);
    }
    if (isCanvasBlack(canvas)) throw new Error('The image came out black. Disconnect and connect the window again, and keep that window open (not minimized).');
    return canvas;
}

function frameToCanvas(source, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(source, 0, 0, width, height);
    return canvas;
}

// Make sure the (hidden) video element plays and has painted a frame
async function waitForVideoFrame(video) {
    if (video.paused) { try { await video.play(); } catch (e) { /* stays paused */ } }
    if (typeof video.requestVideoFrameCallback === 'function') {
        await new Promise(resolve => {
            const timer = setTimeout(resolve, 600);
            video.requestVideoFrameCallback(() => { clearTimeout(timer); resolve(); });
        });
    }
}

// True when every sampled pixel is (almost) black
function isCanvasBlack(canvas) {
    const size = 48;
    const small = document.createElement('canvas');
    small.width = size;
    small.height = size;
    const ctx = small.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && (data[i] > 6 || data[i + 1] > 6 || data[i + 2] > 6)) return false;
    }
    return true;
}

async function connectScreenshotWindow() {
    try {
        activeMediaStream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'window' },
            audio: false
        });
        
        hiddenVideoElement.srcObject = activeMediaStream;
        
        activeMediaStream.getVideoTracks()[0].onended = () => {
            activeMediaStream = null;
            hiddenVideoElement.srcObject = null;
            if (currentSettingsTab === 'screenshot') renderSettingsUI();
            updateScreenshotBanner();
            updateModalCaptureButtons();
        };
        
        appData.settings.autoScreenshotEnabled = true;
        autoSave();
        
        if (currentSettingsTab === 'screenshot') renderSettingsUI();
        updateScreenshotBanner();
        hideScreenshotPromo();
        showToast('Window connected successfully!', 'success');
    } catch (err) {
        console.error("Screen share error:", err);
    }
}

function updateScreenshotBanner() {
    const banner = document.getElementById('screenshot-connect-banner');
    if (banner) {
        banner.onclick = connectScreenshotWindow;
        if (appData.settings.autoScreenshotEnabled && (!activeMediaStream || !activeMediaStream.active)) {
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }
}


// --- Auto-Screenshot Promo Toast ---
// Shown once per app session when auto-screenshots were NOT active in a previous
// session (appData.settings.autoScreenshotEnabled is false/undefined).
// Never shown while the installation guide or the reconnect screen is visible.

const PROMO_TOAST_DURATION = 12000; // ms the toast stays visible (pauses on hover)
const PROMO_TOAST_DELAY = 1200;     // ms after the dashboard has loaded
let screenshotPromoShown = false;

function maybeShowScreenshotPromo() {
    if (screenshotPromoShown) return;
    if (!dirHandle || !fileConnected) return;                        // installation guide / reconnect screen
    if (appData.settings.autoScreenshotEnabled) return;              // dashboard banner handles this case
    if (activeMediaStream && activeMediaStream.active) return;       // already connected
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return;

    screenshotPromoShown = true;
    setTimeout(showScreenshotPromo, PROMO_TOAST_DELAY);
}

function showScreenshotPromo() {
    if (document.getElementById('screenshot-promo-toast')) return;
    if (activeMediaStream && activeMediaStream.active) return;

    const toast = document.createElement('div');
    toast.id = 'screenshot-promo-toast';
    toast.className = 'promo-toast';
    toast.setAttribute('role', 'status');
    toast.style.setProperty('--promo-duration', `${PROMO_TOAST_DURATION}ms`);
    toast.innerHTML = `
        <button type="button" class="promo-toast-close" title="Close" aria-label="Close">&times;</button>
        <div class="promo-toast-header">
            <div class="promo-toast-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            </div>
            <span class="promo-toast-title">Instant Chart Captures</span>
        </div>
        <p class="promo-toast-text">Save time journaling! Connect your charting app window for 1-click auto-screenshots on every trade.</p>
        <button type="button" class="btn-primary btn-sm promo-toast-btn">Connect Window</button>
        <div class="promo-toast-progress"></div>
    `;

    getToastContainer().appendChild(toast);

    toast.querySelector('.promo-toast-close').addEventListener('click', hideScreenshotPromo);
    toast.querySelector('.promo-toast-btn').addEventListener('click', () => {
        // Same action as "Connect Window" on the Settings > Screenshot tab
        connectScreenshotWindow();
        hideScreenshotPromo();
    });
    // The progress bar drives the auto-hide timer (pauses while hovering)
    toast.querySelector('.promo-toast-progress').addEventListener('animationend', hideScreenshotPromo);

    // Double rAF so the slide-in transition actually plays
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('visible')));
}

function hideScreenshotPromo() {
    const toast = document.getElementById('screenshot-promo-toast');
    if (!toast || toast.classList.contains('hiding')) return;
    toast.classList.add('hiding');
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 500);
}
