// Date picker theme (files in vendor/, see index.html)
const FLATPICKR_THEMES = {
    dark: 'vendor/flatpickr-4.6.13/themes/dark.css',
    light: 'vendor/flatpickr-4.6.13/themes/light.css'
};
function setFlatpickrTheme(name) {
    if (!flatpickrTheme || !FLATPICKR_THEMES[name]) return;
    if (flatpickrTheme.getAttribute('href') !== FLATPICKR_THEMES[name]) flatpickrTheme.setAttribute('href', FLATPICKR_THEMES[name]);
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA'); 
    
    window.fpDatePicker = flatpickr(datePicker, {
        defaultDate: todayStr,
        dateFormat: "Y-m-d",
        disableMobile: true,
        onChange: function(selectedDates, dateStr) {
            alignWeekToDate(parseLocalDate(dateStr) || new Date());
            renderDashboard();
        }
    });
    window.fpTDate = flatpickr(document.getElementById('t-date'), {
        dateFormat: "Y-m-d",
        disableMobile: true
    });
    
    alignWeekToDate(today);
    setupNavigation();
    setupCalendarEvents();
    setupImageUploadEvents();
        setupImageViewer();
    setupThemeToggle();
    moveNavIndicator(btnNavDashboard, false);
    window.addEventListener('resize', () => moveNavIndicator(document.querySelector('.sidebar-nav .btn-icon.active'), false));
    tradesList.addEventListener('click', (e) => {
        const imgTarget = e.target.closest('.trade-img-trigger');
        if (imgTarget) {
            e.stopPropagation();
            openImageViewer(imgTarget.dataset.imgUrl);
            return;
        }
        
        const chevronWrapper = e.target.closest('.row-chevron-wrapper');
        if (chevronWrapper) {
            e.stopPropagation();
            const row = chevronWrapper.closest('.trade-row');
            const expanded = row.querySelector('.expanded-content');
            const chevron = row.querySelector('.row-chevron');
            if (expanded.style.display === 'none') {
                expanded.style.display = 'block';
                chevron.style.transform = 'rotate(90deg)';
            } else {
                expanded.style.display = 'none';
                chevron.style.transform = 'rotate(0deg)';
            }
            return;
        }
        
        const tradeCard = e.target.closest('.trade-card, .trade-row');
        if (tradeCard) {
            const tradeId = tradeCard.dataset.tradeId;
            if (tradeId) openTradeModal(tradeId);
        }
    });
    

    // --- Hotkeys ---
    document.addEventListener('keydown', (e) => {
        // No shortcuts while the folder connection popup is open
        if (typeof isGateOpen === 'function' && isGateOpen()) return;
        const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable;
        const isModalOpen = document.getElementById('trade-modal').classList.contains('active');
        const isDashboardOpen = document.getElementById('view-dashboard').classList.contains('active');

        // Alt/Option combinations
        if (e.altKey) {
            if (e.code === 'KeyN') {
                e.preventDefault();
                if (!isModalOpen) document.getElementById('btn-new-trade').click();
                return;
            }
            if (e.code === 'KeyM') {
                e.preventDefault();
                document.getElementById('btn-theme-toggle').click();
                return;
            }

            if (isModalOpen) {
                if (e.code === 'KeyS') {
                    e.preventDefault();
                    const saveBtn = document.getElementById('btn-save-trade');
                    if (saveBtn.disabled) {
                        // Too early: show what's still missing instead of doing nothing
                        const missing = tfValidate();
                        if (missing.length) showToast(`Still needed: ${missing.join(', ')}`, 'error');
                    } else {
                        saveBtn.click();
                    }
                    return;
                }
                if (e.code === 'KeyC') {
                    e.preventDefault();
                    document.getElementById('btn-cancel-modal').click();
                    return;
                }
                // Alt A: Auto-Capture the chart window, or connect it first (scalp.js release)
                if (e.code === 'KeyA' && typeof scalpCaptureShortcut === 'function' && scalpFeatureOn) {
                    e.preventDefault();
                    scalpCaptureShortcut();
                    return;
                }
                if (e.code === 'Backspace' || e.key === 'Backspace') {
                    e.preventDefault();
                    const btnDel = document.getElementById('btn-delete-trade');
                    if (btnDel && btnDel.style.display !== 'none') btnDel.click();
                    return;
                }
            } else if (isDashboardOpen) {
                if (e.code === 'KeyT') {
                    e.preventDefault();
                    const btnToday = document.getElementById('btn-today');
                    if (btnToday) btnToday.click();
                    return;
                }
            }
        }

        // Non-Alt shortcuts (Dashboard Navigation)
        if (!e.altKey && isDashboardOpen && !isModalOpen && !isInputFocused) {
            if (e.code === 'ArrowRight') {
                e.preventDefault();
                if (e.shiftKey) {
                    document.getElementById('cal-next-week').click();
                } else {
                    const picker = document.getElementById('date-picker');
                    let d = parseLocalDate(picker.value) || new Date();
                    d.setDate(d.getDate() + 1);
                    const dStr = d.toLocaleDateString('en-CA');
                    window.fpDatePicker.setDate(dStr);
                    alignWeekToDate(d);
                    renderDashboard();
                }
                return;
            }
            if (e.code === 'ArrowLeft') {
                e.preventDefault();
                if (e.shiftKey) {
                    document.getElementById('cal-prev-week').click();
                } else {
                    const picker = document.getElementById('date-picker');
                    let d = parseLocalDate(picker.value) || new Date();
                    d.setDate(d.getDate() - 1);
                    const dStr = d.toLocaleDateString('en-CA');
                    window.fpDatePicker.setDate(dStr);
                    alignWeekToDate(d);
                    renderDashboard();
                }
                return;
            }
        }
    });

    const btnToday =  document.getElementById('btn-today');
    if (btnToday) {
        btnToday.addEventListener('click', () => {
            const tStr = new Date().toLocaleDateString('en-CA');
            window.fpDatePicker.setDate(tStr);
            alignWeekToDate(parseLocalDate(tStr) || new Date());
            renderDashboard();
        });
    }
    
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const item = question.parentElement;
            item.classList.toggle('open');
        });
    });

    // From here on the gate may decide what to show (see updateConnectionGate)
    window.vwsStartupDone = true;
    try {
        const savedHandle = await getHandleFromDB();
        if (savedHandle && savedHandle.kind === 'directory') {
            dirHandle = savedHandle;
            if ((await dirHandle.queryPermission({ mode: 'readwrite' })) === 'granted') {
                fileConnected = true;
                await loadDataFromFile();
            } else {
                fileConnected = false;
                renderDashboard();
            }
        } else {
            renderDashboard();
        }
    } catch (e) {
        console.error("Error loading DB:", e);
        renderDashboard();
    }
});


function setupThemeToggle() {
    const savedTheme = localStorage.getItem('vwap-theme') || 'dark';
    applyTheme(savedTheme);

    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
            
            localStorage.setItem('vwap-theme', newTheme);
            if (appData && appData.settings) {
                appData.settings.theme = newTheme;
                autoSave();
            }
        });
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    if (theme === 'light') {
        if(iconSun) iconSun.style.display = 'none';
        if(iconMoon) iconMoon.style.display = 'block';
        setFlatpickrTheme('light');
    } else {
        if(iconSun) iconSun.style.display = 'block';
        if(iconMoon) iconMoon.style.display = 'none';
        setFlatpickrTheme('dark');
    }
    
    if (typeof renderStatsDashboard === 'function' && document.getElementById('view-stats').classList.contains('active')) {
        renderStatsDashboard();
    }
}

// --- Navigation ---

function setActiveNav(activeBtn) {
    const wasActive = activeBtn.classList.contains('active');
    [btnNavDashboard, btnNavStats, btnNavSettings, btnNavHelp].forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
    if (typeof closeShareViewState === 'function') closeShareViewState();

    // Motion: slide the sidebar indicator and play the page-enter animation
    moveNavIndicator(activeBtn, true);
    if (!wasActive) playViewEnter(document.querySelector('.view.active'));
}

// Pages opened from the sidebar always start at the top, so the title is visible
function startViewAtTop(view) {
    view.scrollTop = 0;
    requestAnimationFrame(() => { view.scrollTop = 0; });
}

function setupNavigation() {
    btnNavSettings.addEventListener('click', () => {
        [viewDashboard, viewStats, viewHelp, document.getElementById('view-share')].forEach(v => v.classList.remove('active'));
        viewSettings.classList.add('active');
        setActiveNav(btnNavSettings);
        renderSettingsUI();
        startViewAtTop(viewSettings);
    });

    btnNavStats.addEventListener('click', () => {
        [viewDashboard, viewSettings, viewHelp, document.getElementById('view-share')].forEach(v => v.classList.remove('active'));
        viewStats.classList.add('active');
        setActiveNav(btnNavStats);
        renderStatsDashboard();
        startViewAtTop(viewStats);
    });

    btnNavDashboard.addEventListener('click', () => {
        [viewSettings, viewStats, viewHelp, document.getElementById('view-share')].forEach(v => v.classList.remove('active'));
        viewDashboard.classList.add('active');
        setActiveNav(btnNavDashboard);
        renderDashboard();
        if (typeof syncReviewsSoon === 'function') syncReviewsSoon();
        startViewAtTop(viewDashboard);
    });
    
    btnNavHelp.addEventListener('click', () => {
        [viewDashboard, viewStats, viewSettings, document.getElementById('view-share')].forEach(v => v.classList.remove('active'));
        viewHelp.classList.add('active');
        setActiveNav(btnNavHelp);
        startViewAtTop(viewHelp);
    });

    if (btnViewCard) {
        btnViewCard.addEventListener('click', () => {
            if (appData.settings.viewMode !== 'card') pendingTradesAnimation = 'enter';
            appData.settings.viewMode = 'card';
            autoSave();
            renderDashboard();
        });
    }
    if (btnViewTable) {
        btnViewTable.addEventListener('click', () => {
            if (appData.settings.viewMode !== 'table') pendingTradesAnimation = 'enter';
            appData.settings.viewMode = 'table';
            autoSave();
            renderDashboard();
        });
    }
}

// --- Keyboard shortcuts overview (press ?) ---
// One list of every shortcut, opened with "?" (when not typing) or the keyboard
// button in the sidebar. Mac users see Option, Windows users see Alt.

const KEYS_IS_MAC = (navigator.userAgentData && navigator.userAgentData.platform === 'macOS') || /Mac|iPhone|iPad/.test(navigator.platform || '');
const KEYS_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 15.5h6"/><path d="M10 13h4"/></svg>';

function keysAlt() { return KEYS_IS_MAC ? 'Option' : 'Alt'; }

// [label, keys, note?]; a key "|" means "or"
function keysGroups() {
    const A = keysAlt();
    const groups = [
        { id: 'all', title: 'Everywhere', rows: [
            ['New trade', [A, 'N']],
            ['Dark / light mode', [A, 'M']],
            ['Show these shortcuts', ['?']],
            ['Close a popup', ['Esc']],
        ] },
        { id: 'dashboard', title: 'Dashboard', note: 'when you are not typing', rows: [
            ['Jump to today', [A, 'T']],
            ['Previous / next day', ['←', '|', '→']],
            ['Previous / next week', ['Shift', '←', '|', '→']],
        ] },
        { id: 'trade', title: 'Add Trade', rows: [
            ['Save trade', [A, 'S']],
            ['Close the form', [A, 'C']],
            ['Delete trade', [A, 'Backspace'], 'when you edit a trade'],
        ] },
    ];
    // Scalping mode release (scalp.js): Auto-Capture key, and the Quick trade keys while Scalp is on
    if (typeof scalpFeatureOn !== 'undefined' && scalpFeatureOn) {
        groups[2].rows.splice(2, 0, ['Capture the chart', [A, 'A'], 'Auto-Capture; connects the window the first time']);
        if (typeof scalpModeOn === 'function' && scalpModeOn()) groups.push({ id: 'quick', title: 'Quick trade', note: 'scalping mode', rows: [
            ['Long / Short', ['↑', '|', '↓']],
            ['Win / Loss / Break-even', ['W', '|', 'L', '|', 'B']],
            ['Capture the chart', [A, 'A']],
            ['Paste a screenshot', [A === 'Option' ? 'Cmd' : 'Ctrl', 'V']],
            ['Save & next trade', ['Enter']],
            ['Save & close', ['Shift', 'Enter']],
        ] });
    }
    if (typeof rulesFeatureOn !== 'undefined' && rulesFeatureOn) groups[2].rows.push(['Mark rule 1 to 9', ['1', '–', '9'], 'followed → not followed → open']);
    return groups;
}

function keysWhere() {
    if (document.getElementById('scalp-q-dialog')) return 'quick';
    if (document.getElementById('trade-modal').classList.contains('active')) return 'trade';
    if (document.getElementById('view-dashboard').classList.contains('active')) return 'dashboard';
    return 'all';
}

function keysKbd(keys) {
    return keys.map(k => k === '|' || k === '–' ? `<span class="keys-or">${k === '|' ? 'or' : 'to'}</span>` : `<kbd class="keys-kbd">${k}</kbd>`).join('');
}

function openKeysDialog() {
    if (document.getElementById('app-dialog')) return;
    const where = keysWhere();
    const before = document.activeElement;
    const overlay = document.createElement('div');
    overlay.id = 'app-dialog';
    overlay.className = 'app-dialog-overlay keys-overlay';
    overlay.innerHTML = `
        <div class="app-dialog keys-dialog" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title">
            <button type="button" class="rules-code-close" data-dialog="cancel" aria-label="Close">&times;</button>
            <div class="keys-head">
                <span class="app-dialog-icon is-primary">${KEYS_ICON}</span>
                <div class="app-dialog-copy">
                    <h2 id="app-dialog-title">Keyboard shortcuts</h2>
                    <p>Press <kbd class="keys-kbd is-inline">?</kbd> any time to see this list.</p>
                </div>
            </div>
            <div class="keys-groups">
                ${keysGroups().map(g => `
                <section class="keys-group ${g.id === where && where !== 'all' ? 'is-here' : ''}" aria-label="${g.title}">
                    <div class="keys-group-head"><span class="keys-group-title">${g.title}</span>${g.note ? `<span class="keys-group-note">${g.note}</span>` : ''}${g.id === where && where !== 'all' ? '<span class="keys-here">You are here</span>' : ''}</div>
                    ${g.rows.map(([label, keys, note]) => `<div class="keys-row"><span class="keys-label">${label}${note ? `<span class="keys-note">${note}</span>` : ''}</span><span class="keys-keys">${keysKbd(keys)}</span></div>`).join('')}
                </section>`).join('')}
            </div>
            <p class="keys-foot">${keysAlt() === 'Option' ? 'Option is the ⌥ key.' : 'On a Mac, use Option instead of Alt.'} All shortcuts are also in Help.</p>
        </div>`;
    let release = null;
    const close = () => { overlay.remove(); if (release) release(); };
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
    overlay.querySelectorAll('[data-dialog="cancel"]').forEach(b => b.addEventListener('click', close));
    document.body.appendChild(overlay);
    const box = overlay.querySelector('.app-dialog'); box.tabIndex = -1;
    release = appDialogTrap(box, { onEscape: close, initialFocus: box, returnFocus: before });
}

document.addEventListener('keydown', e => {
    if (e.key !== '?' || e.altKey || e.ctrlKey || e.metaKey) return;
    if (typeof isGateOpen === 'function' && isGateOpen()) return;
    const a = document.activeElement;
    if (a && (['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) || a.isContentEditable)) return;
    if (document.getElementById('app-dialog')) return;
    e.preventDefault();
    openKeysDialog();
});

// The buttons that have a shortcut show it in their tooltip
document.addEventListener('DOMContentLoaded', () => {
    const kb = document.getElementById('btn-keys');
    if (kb) kb.addEventListener('click', openKeysDialog);
    const A = keysAlt();
    [['btn-new-trade', 'New trade', 'N'], ['btn-today', 'Jump to today', 'T'], ['btn-theme-toggle', 'Dark / light mode', 'M'],
     ['btn-save-trade', 'Save trade', 'S'], ['btn-cancel-modal', 'Close the form', 'C']].forEach(([id, label, key]) => {
        const b = document.getElementById(id);
        if (b) b.title = `${label} (${A} ${key})`;
    });
    if (typeof scalpFeatureOn !== 'undefined' && scalpFeatureOn) {
        [['btn-auto-screenshot', 'Auto-Capture'], ['btn-connect-window', 'Connect the chart window']].forEach(([id, label]) => {
            const b = document.getElementById(id);
            if (b) b.title = `${label} (${A} A)`;
        });
    }
});

