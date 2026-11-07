// --- Rule check per setup: Stats › Rules tab, Settings › Chart sub-tabs, Win Rate by Grade ---
// Part of the rule check (rules.js). Loaded after rules-settings.js.

// ---------- Stats: Rules tab ----------

let rulesStatsTab = 'overview';
let rulesStatsTrades = [];

function rulesSetupStatsDom() {
    if (!rulesFeatureOn) return;
    const view = document.getElementById('view-stats');
    const filters = view && view.querySelector('.stats-filters');
    const grid = view && view.querySelector('.stats-grid');
    if (!filters || !grid || document.getElementById('stats-tabs')) return;

    const tabs = document.createElement('div');
    tabs.id = 'stats-tabs';
    tabs.className = 'settings-tabs stats-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.innerHTML = `
        <button type="button" class="settings-tab-btn active" role="tab" data-stats-tab="overview">Overview</button>
        <button type="button" class="settings-tab-btn" role="tab" data-stats-tab="rules">Rules</button>`;
    tabs.addEventListener('click', e => {
        const b = e.target.closest('[data-stats-tab]');
        if (!b || b.dataset.statsTab === rulesStatsTab) return;
        rulesStatsTab = b.dataset.statsTab;
        // Re-render everything: charts drawn while hidden need their real size
        renderStatsDashboard();
    });
    filters.before(tabs);

    const rulesView = document.createElement('div');
    rulesView.id = 'rules-stats';
    rulesView.className = 'rules-stats';
    rulesView.hidden = true;
    grid.after(rulesView);
}

// Called at the end of renderStatsDashboard() with the filtered trades
function rulesRenderStats(trades) {
    if (!rulesFeatureOn) return;
    rulesSetupStatsDom();
    const tabs = document.getElementById('stats-tabs');
    const rulesView = document.getElementById('rules-stats');
    if (!tabs || !rulesView) return;

    const active = rulesActive();
    if (!active) rulesStatsTab = 'overview';
    tabs.hidden = !active;
    const onRules = rulesStatsTab === 'rules';
    tabs.querySelectorAll('[data-stats-tab]').forEach(b => b.classList.toggle('active', b.dataset.statsTab === rulesStatsTab));
    if (active) slidePillIndicator(tabs, tabs.querySelector('.active'), 'statsTabs');

    const view = document.getElementById('view-stats');
    view.querySelector('.kpi-grid').hidden = onRules;
    view.querySelector('.stats-grid').hidden = onRules;
    const addBtn = document.getElementById('btn-stats-add-chart');
    if (addBtn) addBtn.hidden = onRules;
    rulesView.hidden = !onRules;

    rulesStatsTrades = trades || [];
    RULES_CHART_IDS.forEach(id => destroyChart(id));
    if (!onRules) { rulesView.innerHTML = ''; return; }
    rulesDrawStats(rulesView, rulesStatsTrades);
}

const RULES_CHART_IDS = ['rulesTrendChart', 'rulesFollowChart', 'rulesBrokenChart', 'rulesPhaseChart'];

// Charts on Stats > Rules. The 3 numbers at the top are fixed (like on Overview);
// these can be reordered (drag) and switched off in Settings > Chart > Rules.
// Saved in settings.rulesChartOrder / settings.rulesChartVisibility (only once changed).
const RULES_CHARTS = [
    { key: 'trend', label: 'Discipline vs Results', title: 'Discipline vs Results', span: 3 },
    { key: 'follow', label: 'Win Rate: Rules Followed vs Broken', title: 'Win rate: rules followed vs broken' },
    { key: 'broken', label: 'Top 5 Broken Rules', title: 'Top 5 broken rules' },
    { key: 'phase', label: 'Rules Followed per Phase', title: 'Rules followed per phase' },
    { key: 'setups', label: 'Setup Discipline', title: 'Setup discipline', span: 3 }
];

function rulesChartOrder() {
    const keys = RULES_CHARTS.map(c => c.key);
    const saved = Array.isArray(appData.settings.rulesChartOrder) ? appData.settings.rulesChartOrder : [];
    const order = saved.filter((k, i) => keys.includes(k) && saved.indexOf(k) === i);
    keys.forEach(k => { if (!order.includes(k)) order.push(k); });
    return order;
}

function rulesChartVisible(key) {
    const v = appData.settings.rulesChartVisibility;
    return !(v && v[key] === false);
}

function rulesChartCardsHtml(per, hasTrend) {
    return rulesChartOrder().map(key => {
        const c = RULES_CHARTS.find(x => x.key === key);
        if (!c || !rulesChartVisible(key)) return '';
        if (key === 'trend' && !hasTrend) return ''; // too little data for a line: hide the card
        const span = c.span === 3 ? ' chart-span-3' : '';
        const body = key === 'setups' ? '<div id="rules-setup-table"></div>'
            : `<div class="chart-wrapper"><canvas id="${{ trend: 'rulesTrendChart', follow: 'rulesFollowChart', broken: 'rulesBrokenChart', phase: 'rulesPhaseChart' }[key]}"></canvas></div>`;
        const head = key === 'trend'
            ? `<div class="rules-card-head"><h3 class="card-title">${c.title}</h3><span class="rules-card-note">per ${per}</span></div>`
            : `<h3 class="card-title">${c.title}</h3>`;
        return `<div class="stat-card${span}" data-chart-key="${key}">${head}${body}</div>`;
    }).join('');
}

// Drag & drop the chart cards, same as on Overview (charts.js); saves rulesChartOrder
let rulesDraggedCard = null;
function rulesSetupGridDrag(grid) {
    if (!grid) return;
    grid.querySelectorAll('.stat-card[data-chart-key]').forEach(card => {
        card.draggable = true;
        card.classList.add('is-orderable');
        if (typeof addCardDragHandle === 'function') addCardDragHandle(card);
    });
    grid.addEventListener('dragstart', e => {
        const card = e.target.closest && e.target.closest('.stat-card.is-orderable');
        if (!card || e.target.closest('button, a, input, select, textarea')) return;
        rulesDraggedCard = card;
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', card.dataset.chartKey); } catch (err) {}
        requestAnimationFrame(() => card.classList.add('is-dragging'));
    });
    grid.addEventListener('dragover', e => {
        if (!rulesDraggedCard) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const target = e.target.closest('.stat-card.is-orderable');
        if (!target || target === rulesDraggedCard) return;
        const r = target.getBoundingClientRect();
        const wide = r.width > grid.clientWidth * 0.7;
        const before = wide ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2;
        const ref = before ? target : target.nextSibling;
        if (ref !== rulesDraggedCard && rulesDraggedCard.nextSibling !== ref) grid.insertBefore(rulesDraggedCard, ref);
    });
    grid.addEventListener('drop', e => { if (rulesDraggedCard) e.preventDefault(); });
    grid.addEventListener('dragend', async () => {
        if (!rulesDraggedCard) return;
        rulesDraggedCard.classList.remove('is-dragging');
        rulesDraggedCard = null;
        const shown = [...grid.querySelectorAll('.stat-card.is-orderable')].map(c => c.dataset.chartKey);
        const old = rulesChartOrder();
        // Hidden charts keep their place relative to the others
        const next = [...shown];
        old.forEach((k, i) => { if (!next.includes(k)) next.splice(Math.min(i, next.length), 0, k); });
        if (JSON.stringify(old) !== JSON.stringify(next)) {
            appData.settings.rulesChartOrder = next;
            RULES_CHART_IDS.forEach(id => { if (chartInstances[id]) { try { chartInstances[id].resize(); } catch (err) {} } });
            await autoSave();
        }
    });
}

// ---------- Settings > Chart: Stats | Rules sub-tabs ----------

let rulesChartSettingsTab = 'stats';

// Called at the top of the Chart tab in Settings. Shows the sub-tabs while the
// rules are on. Returns true when it rendered the Rules list (Stats code is skipped).
function rulesChartSettingsTabs(container, onChange) {
    if (!rulesActive()) { rulesChartSettingsTab = 'stats'; return false; }
    const tabs = document.createElement('div');
    tabs.className = 'settings-tabs chart-sub-tabs';
    const mk = (key, label) => {
        const b = document.createElement('button');
        b.className = `settings-tab-btn ${rulesChartSettingsTab === key ? 'active' : ''}`;
        b.textContent = label;
        b.onclick = () => {
            if (rulesChartSettingsTab === key) return;
            rulesChartSettingsTab = key;
            renderSettingsUI();
            animateItems(settingsContainer.querySelectorAll(':scope > .info-banner, .chart-toggle-row'), 'enter');
        };
        tabs.appendChild(b);
        return b;
    };
    const bStats = mk('stats', 'Stats');
    const bRules = mk('rules', 'Rules');
    container.appendChild(tabs);
    slidePillIndicator(tabs, rulesChartSettingsTab === 'rules' ? bRules : bStats, 'chartSubTabs');
    if (rulesChartSettingsTab !== 'rules') return false;
    renderRulesChartSettings(container, onChange);
    return true;
}

// Same rows as the Stats list: drag handle, name, Enable / Disable
function renderRulesChartSettings(container, onChange) {
    const sets = appData.settings;
    const banner = document.createElement('div');
    banner.className = 'info-banner';
    banner.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg><span><strong>Tip:</strong> Drag a chart by its <span class="inline-drag-icon">${DRAG_ICON_SVG}</span> handle to change the order on the Stats page (Rules tab).</span>`;
    container.appendChild(banner);

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '8px';
    let dragged = null;

    rulesChartOrder().forEach(key => {
        const c = RULES_CHARTS.find(x => x.key === key);
        const row = document.createElement('div');
        row.className = 'chart-toggle-row';
        row.ondragstart = (e) => {
            dragged = key;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => row.classList.add('dragging-row'), 0);
        };
        row.ondragend = () => {
            dragged = null;
            row.draggable = false;
            row.classList.remove('dragging-row');
            wrap.querySelectorAll('.chart-toggle-row').forEach(r => r.classList.remove('row-drag-over'));
        };
        row.ondragover = (e) => {
            e.preventDefault();
            if (dragged && dragged !== key) row.classList.add('row-drag-over');
        };
        row.ondragleave = () => row.classList.remove('row-drag-over');
        row.ondrop = (e) => {
            e.preventDefault();
            row.classList.remove('row-drag-over');
            if (!dragged || dragged === key) return;
            const order = rulesChartOrder();
            const dropIdx = order.indexOf(key);
            order.splice(order.indexOf(dragged), 1);
            order.splice(dropIdx, 0, dragged);
            sets.rulesChartOrder = order;
            onChange();
            renderSettingsUI();
        };

        const left = document.createElement('div');
        left.className = 'chart-toggle-left';
        const handle = document.createElement('div');
        handle.innerHTML = DRAG_ICON_SVG;
        handle.className = 'row-drag-handle';
        handle.title = 'Drag to reorder chart';
        handle.onmousedown = () => { row.draggable = true; };
        handle.onmouseup = () => { row.draggable = false; };
        handle.onmouseleave = () => { if (!dragged) row.draggable = false; };
        const label = document.createElement('span');
        label.className = 'chart-toggle-label';
        label.textContent = c.label;
        left.appendChild(handle);
        left.appendChild(label);

        const on = rulesChartVisible(key);
        const btn = document.createElement('button');
        btn.className = on ? 'btn-secondary btn-sm' : 'btn-primary btn-sm';
        btn.textContent = on ? 'Disable' : 'Enable';
        btn.onclick = () => {
            if (!sets.rulesChartVisibility || typeof sets.rulesChartVisibility !== 'object') sets.rulesChartVisibility = {};
            sets.rulesChartVisibility[key] = !on;
            onChange();
            renderSettingsUI();
        };
        row.appendChild(left);
        row.appendChild(btn);
        wrap.appendChild(row);
    });
    container.appendChild(wrap);
}

function rulesSortChrono(trades) {
    return [...trades].sort((a, b) => (a.date || '').localeCompare(b.date || '') || ((parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0)));
}

function rulesPct(a, b) {
    return b > 0 ? Math.round((a / b) * 1000) / 10 : 0;
}

// ISO week number, used to group the trend line per week
function rulesIsoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { year: t.getUTCFullYear(), week: Math.ceil(((t - yearStart) / 86400000 + 1) / 7) };
}

function rulesDrawStats(el, trades) {
    const rated = rulesSortChrono(trades.filter(t => rulesTradeScore(t).rated > 0));
    const ratedScores = rated.map(t => ({ t, s: rulesTradeScore(t) }));

    if (!rated.length) {
        el.innerHTML = `
            <div class="stat-card rules-stats-empty">
                <strong>No rated trades in this period</strong>
                <span>Mark the rules in the Rules tab when you add or edit a trade. Your discipline stats show up here.</span>
            </div>`;
        return;
    }

    // KPIs
    const okSum = ratedScores.reduce((a, x) => a + x.s.ok, 0);
    const ratedSum = ratedScores.reduce((a, x) => a + x.s.rated, 0);
    const allOk = ratedScores.filter(x => x.s.no === 0);
    let streak = 0, best = 0, run = 0;
    ratedScores.forEach(x => { run = x.s.no === 0 ? run + 1 : 0; best = Math.max(best, run); });
    streak = run;

    // Trend: per week, per day when one week is picked, per trade when one day is picked
    const fW = filterWeek ? filterWeek.value : 'all';
    const fD = filterDay ? filterDay.value : 'all';
    const per = fD !== 'all' ? 'trade' : fW !== 'all' ? 'day' : 'week';
    const buckets = [];
    const bucketOf = {};
    ratedScores.forEach((x, i) => {
        let key, label;
        if (per === 'trade') { key = String(i); label = `#${x.t.number || i + 1}`; }
        else if (per === 'day') { key = x.t.date; const d = parseLocalDate(x.t.date); label = d ? d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }) : x.t.date; }
        else { const d = parseLocalDate(x.t.date) || new Date(x.t.date); const w = rulesIsoWeek(d); key = `${w.year}-${w.week}`; label = `W${w.week}`; }
        if (!bucketOf[key]) { bucketOf[key] = { label, ok: 0, rated: 0, trades: [] }; buckets.push(bucketOf[key]); }
        bucketOf[key].ok += x.s.ok;
        bucketOf[key].rated += x.s.rated;
        bucketOf[key].trades.push(x.t);
    });

    el.innerHTML = `
        <div class="kpi-grid">
            <div class="stat-card kpi-card"><h3>Rules Followed</h3><div class="kpi-value">${rulesPct(okSum, ratedSum)}%</div><div class="kpi-sub">${okSum} of ${ratedSum} rule checks</div></div>
            <div class="stat-card kpi-card"><h3>Trades all rules followed</h3><div class="kpi-value">${allOk.length}<span class="kpi-of"> / ${rated.length}</span></div><div class="kpi-sub">${Math.round(rulesPct(allOk.length, rated.length))}% of rated trades</div></div>
            <div class="stat-card kpi-card"><h3>Clean Streak</h3><div class="kpi-value">${streak}</div><div class="kpi-sub">all rules followed in a row · best ${best}</div></div>
        </div>
        <div class="rules-stats-grid" id="rules-stats-grid">${rulesChartCardsHtml(per, buckets.length > 1)}</div>`;
    rulesSetupGridDrag(document.getElementById('rules-stats-grid'));

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const colors = { win: '#44BD1E', loss: '#ee354e', accent: '#386af5', grey: isLight ? '#C1C8D1' : '#2b2c30' };
    const pctTip = { callbacks: { label: c => `${c.dataset.label ? c.dataset.label + ': ' : ''}${c.parsed.y ?? c.parsed.x}%` } };
    const round = { topLeft: 12, topRight: 12, bottomLeft: 12, bottomRight: 12 };

    // 1. Trend
    if (buckets.length > 1) {
        const discipline = buckets.map(b => rulesPct(b.ok, b.rated));
        const winRate = buckets.map(b => Number(getWinRateData(b.trades).winRate));
        if (document.getElementById('rulesTrendChart')) chartInstances.rulesTrendChart = new Chart(document.getElementById('rulesTrendChart'), {
            type: 'line',
            data: {
                labels: buckets.map(b => b.label),
                datasets: [
                    { label: 'Rules followed', data: discipline, borderColor: colors.accent, backgroundColor: 'rgba(56, 106, 245, 0.1)', fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4 },
                    { label: 'Win rate', data: winRate, borderColor: colors.win, backgroundColor: 'transparent', fill: false, tension: 0.3, pointRadius: 0, pointHoverRadius: 4 }
                ]
            },
            options: {
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: { y: { display: false, min: 0, max: 100 } },
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle' } }, tooltip: pctTip }
            }
        });
    }

    // 2. Win rate followed vs broken
    const followedTrades = allOk.map(x => x.t);
    const brokenTrades = ratedScores.filter(x => x.s.no > 0).map(x => x.t);
    if (document.getElementById('rulesFollowChart')) chartInstances.rulesFollowChart = new Chart(document.getElementById('rulesFollowChart'), {
        type: 'bar',
        data: {
            labels: [`All followed · ${followedTrades.length}`, `Rule broken · ${brokenTrades.length}`],
            datasets: [{ label: 'Win rate', data: [Number(getWinRateData(followedTrades).winRate), Number(getWinRateData(brokenTrades).winRate)], backgroundColor: [colors.win, colors.loss], borderRadius: round, borderSkipped: false, maxBarThickness: 56 }]
        },
        options: { maintainAspectRatio: false, scales: { y: { display: false, min: 0, max: 100 } }, plugins: { legend: { display: false }, tooltip: pctTip } }
    });

    // 3. Top 5 broken rules (by key, so "Rejection" in two setups counts together)
    const brokenCount = {};
    ratedScores.forEach(x => x.s.broken.forEach(c => { const k = String(c.key || '').trim() || 'Unnamed rule'; brokenCount[k] = (brokenCount[k] || 0) + 1; }));
    const topBroken = Object.entries(brokenCount).sort((a, b) => b[1] - a[1]).slice(0, TOP_CHART_SLOTS);
    const padded = padChartSlots(topBroken.map(x => x[0]), topBroken.map(x => x[1]));
    if (document.getElementById('rulesBrokenChart')) chartInstances.rulesBrokenChart = new Chart(document.getElementById('rulesBrokenChart'), {
        type: 'bar',
        data: { labels: padded.labels, datasets: [{ label: 'Times broken', data: padded.values, backgroundColor: colors.loss, borderRadius: round, borderSkipped: false }] },
        options: { clip: false, maintainAspectRatio: false, indexAxis: 'y', scales: { x: { display: false, beginAtZero: true }, y: { afterFit: alignTopChartRows } }, plugins: { legend: { display: false } } }
    });

    // 4. Per phase
    const phaseVals = RULE_PHASES.map(ph => {
        let ok = 0, n = 0;
        ratedScores.forEach(x => (x.t.ruleChecks || []).forEach(c => {
            if (!c || c.phase !== ph || typeof c.ok !== 'boolean') return;
            n += 1; if (c.ok) ok += 1;
        }));
        return n ? rulesPct(ok, n) : null;
    });
    if (document.getElementById('rulesPhaseChart')) chartInstances.rulesPhaseChart = new Chart(document.getElementById('rulesPhaseChart'), {
        type: 'bar',
        data: { labels: RULE_PHASES, datasets: [{ label: 'Rules followed', data: phaseVals, backgroundColor: colors.accent, borderRadius: round, borderSkipped: false, maxBarThickness: 40 }] },
        options: { maintainAspectRatio: false, scales: { y: { display: false, min: 0, max: 100 } }, plugins: { legend: { display: false }, tooltip: pctTip } }
    });

    // 5. Setup discipline (table with bars)
    const bySetup = {};
    ratedScores.forEach(x => {
        const k = x.t.setup || 'No setup';
        if (!bySetup[k]) bySetup[k] = { ok: 0, rated: 0, trades: [] };
        bySetup[k].ok += x.s.ok; bySetup[k].rated += x.s.rated; bySetup[k].trades.push(x.t);
    });
    const setupRows = Object.entries(bySetup)
        .map(([name, v]) => ({ name, score: rulesPct(v.ok, v.rated), win: getWinRateData(v.trades).winRate, n: v.trades.length }))
        .sort((a, b) => b.n - a.n || b.score - a.score);
    const setupTable = document.getElementById('rules-setup-table');
    if (setupTable) setupTable.innerHTML = `
        <div class="rules-setup-table">
            <div class="rules-setup-row is-head"><span>Setup</span><span>Rules followed</span><span>Score</span><span>Win rate</span><span>Trades</span></div>
            ${setupRows.map(r => `
            <div class="rules-setup-row">
                <span class="rules-setup-name" title="${escapeHTML(r.name)}">${escapeHTML(r.name)}</span>
                <span class="rules-setup-bar"><span style="width: ${r.score}%"></span></span>
                <span>${Math.round(r.score)}%</span>
                <span>${Math.round(Number(r.win))}%</span>
                <span class="is-muted">${r.n}</span>
            </div>`).join('')}
        </div>`;

}

// ---------- Overview: Win Rate by Grade ----------
// Replaces "Confluence Amount vs Win Rate" on the Overview tab while the
// feature is on (same chart key, so order and visibility stay as they were).
// Grade belongs to Location, so this chart doesn't depend on the rules switch.
const RULES_GRADES = ['C', 'C+', 'B', 'B+', 'A', 'A+'];
const RULES_GRADE_MIN_TRADES = 3; // fewer trades in a grade: faded bar (small sample)

function rulesDrawGradeChart(canvasId, trades, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const card = canvas.closest('.stat-card');
    const title = card && (card.querySelector('.card-title-text') || card.querySelector('.card-title'));
    if (title && !title.querySelector('.card-drag-handle')) title.textContent = 'Win Rate by Grade';

    const byGrade = {};
    RULES_GRADES.forEach(g => { byGrade[g] = []; });
    trades.forEach(t => { const g = rulesGrade(t.locations); if (g) byGrade[g.grade].push(t); });
    const count = g => byGrade[g].length;
    const enough = g => count(g) >= RULES_GRADE_MIN_TRADES;
    const faded = color + '59'; // same colour at 35 % for small samples

    destroyChart(canvasId);
    chartInstances[canvasId] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: RULES_GRADES.map(g => [g, count(g) ? String(count(g)) : '–']),
            // Every grade with trades gets a bar; fewer than 3 trades shows faded.
            // minBarLength keeps a 0 % grade visible as a small stub.
            datasets: [{ label: 'Win Rate %', data: RULES_GRADES.map(g => count(g) ? Number(getWinRateData(byGrade[g]).winRate) : null), backgroundColor: RULES_GRADES.map(g => enough(g) ? color : faded), borderRadius: { topLeft: 12, topRight: 12, bottomLeft: 12, bottomRight: 12 }, borderSkipped: false, maxBarThickness: 40, minBarLength: 6 }]
        },
        options: {
            maintainAspectRatio: false,
            scales: { y: { display: false, beginAtZero: true, max: 100 }, x: { ticks: { callback(v) { return this.getLabelForValue(v); } } } },
            plugins: { legend: { display: false }, tooltip: { callbacks: { title: items => `Grade ${RULES_GRADES[items[0].dataIndex]}`, label: c => { const n = count(RULES_GRADES[c.dataIndex]); return `Win rate: ${c.parsed.y}% (${n} ${n === 1 ? 'trade' : 'trades'}${n < RULES_GRADE_MIN_TRADES ? ', small sample' : ''})`; } } } }
        }
    });
}
