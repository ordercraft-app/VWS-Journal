// --- Rule check per setup: Settings › Rules tab ---
// Part of the rule check (rules.js). Loaded right after rules.js.

// ---------- Settings: Rules tab ----------

let rulesSettingsScope = RULES_ALL;
let rulesDraggedId = null;
let rulesSaveTimer = null;

function rulesSaveSoon(onChange) {
    clearTimeout(rulesSaveTimer);
    rulesSaveTimer = setTimeout(() => onChange(), 400);
}

function renderRulesSettings(container, onChange) {
    const sets = appData.settings;
    if (!sets.features) sets.features = {};
    if (typeof sets.features.rules !== 'boolean') sets.features.rules = true;
    rulesEnsureShape();
    const enabled = sets.features.rules;

    const banner = document.createElement('div');
    banner.className = 'info-banner';
    banner.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg><span><strong>Tip:</strong> Each rule has a short <strong>key</strong> (what you scan) and a <strong>detail</strong>. Rules are grouped by phase in Add Trade. Editing a rule never changes trades you already logged.</span>`;
    container.appendChild(banner);

    const card = document.createElement('div');
    card.className = 'setting-category-card rules-settings';
    const head = document.createElement('div');
    head.className = 'rules-settings-head';
    head.innerHTML = '<h2 class="setting-cat-title" style="margin-bottom: 0;">Rules</h2>';
    const toggle = document.createElement('button');
    toggle.className = enabled ? 'btn-secondary btn-sm' : 'btn-primary btn-sm';
    toggle.textContent = enabled ? 'Disable' : 'Enable';
    toggle.onclick = () => {
        sets.features.rules = !enabled;
        onChange();
        renderSettingsUI();
    };
    head.appendChild(toggle);
    card.appendChild(head);
    container.appendChild(card);

    if (enabled) {
        // Tab (default) or inline in the Add Trade form: two small previews to pick from
        const current = rulesInline() ? 'inline' : 'tab';
        const row = document.createElement('div');
        row.className = 'rules-layout-row';
        row.innerHTML = `<div class="rules-layout-text"><span class="rules-layout-title">Rules layout in Add Trade</span><span class="rules-layout-note">Own tab: Trade and Rules tabs at the top. In the form: a Rules section below Direction.</span></div>`;
        const picks = document.createElement('div');
        picks.className = 'rules-layout-picks';
        picks.setAttribute('role', 'radiogroup');
        picks.setAttribute('aria-label', 'Rules layout in Add Trade');
        [['tab', 'Own tab'], ['inline', 'In the form']].forEach(([value, label]) => {
            const on = current === value;
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'rules-layout-pick' + (on ? ' is-active' : '');
            b.setAttribute('role', 'radio');
            b.setAttribute('aria-checked', on ? 'true' : 'false');
            const preview = value === 'tab'
                ? '<span class="rlp-tabs"><span></span><span class="rlp-accent"></span></span><span class="rlp-bar"></span><span class="rlp-bar"></span><span class="rlp-bar"></span>'
                : '<span class="rlp-bar"></span><span class="rlp-bar"></span><span class="rlp-block"></span><span class="rlp-bar"></span>';
            b.innerHTML = `<span class="rlp-thumb" aria-hidden="true">${preview}</span><span class="rlp-label">${label}</span>`;
            b.onclick = () => {
                if (on) return;
                sets.rulesLayout = value;
                onChange();
                renderSettingsUI();
            };
            picks.appendChild(b);
        });
        row.appendChild(picks);
        card.appendChild(row);
        if (!rulesOwnSystem()) card.appendChild(rulesUnlockRowEl());
    }

    if (!enabled) {
        const p = document.createElement('p');
        p.className = 'rules-off-note';
        p.textContent = 'Rules are off. They are hidden in Add Trade and rule stats are hidden on the Stats page. Your rules are kept.';
        card.appendChild(p);
        return;
    }

    // Which list to edit: all setups or one setup
    const setups = rulesSetupNames();
    const scopes = [RULES_ALL, ...setups];
    if (!scopes.includes(rulesSettingsScope)) rulesSettingsScope = RULES_ALL;
    const scope = rulesSettingsScope;
    const scopeKey = scope === RULES_ALL ? RULES_ALL : (rulesScopeKey(scope) || scope);

    const scopeWrap = document.createElement('div');
    scopeWrap.className = 'rules-scope';
    scopeWrap.innerHTML = '<span class="rules-label">Rules for</span>';
    const scopeChip = s => {
        const k = s === RULES_ALL ? RULES_ALL : rulesScopeKey(s);
        const count = k && Array.isArray(sets.rules[k]) ? sets.rules[k].length : 0;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip rules-scope-chip' + (s === scope ? ' is-selected' : '');
        b.setAttribute('aria-pressed', s === scope ? 'true' : 'false');
        const lock = s !== RULES_ALL && rulesSetupLocked(s) ? `<span class="rules-chip-lock" title="Default rules unlock with a code">${RULES_ICON_LOCK}</span>` : '';
        b.innerHTML = `${lock}<span class="rules-scope-name">${escapeHTML(s === RULES_ALL ? 'All setups' : s)}</span><span class="rules-chip-count">${count}</span>`;
        b.onclick = () => { rulesSettingsScope = s; renderSettingsUI(); };
        return b;
    };
    // One row per setup category, like the Setup list on the Journal tab
    const groups = [{ label: 'Every trade', setups: [RULES_ALL], locked: false }];
    const cfg = rulesIsObject(appData.settings.setup) ? appData.settings.setup : {};
    const seen = new Set();
    Object.keys(cfg).forEach(cat => {
        const list = (Array.isArray(cfg[cat]) ? cfg[cat] : []).map(x => String(x))
            .filter(x => setups.includes(x) && !seen.has(x));
        list.forEach(x => seen.add(x));
        if (list.length) groups.push({ label: cat, setups: list, locked: list.every(x => rulesSetupLocked(x)) });
    });
    const box = document.createElement('div');
    box.className = 'rules-scope-box';
    groups.forEach(g => {
        const row = document.createElement('div');
        row.className = 'rules-scope-row';
        const lab = document.createElement('span');
        lab.className = 'rules-scope-cat';
        lab.innerHTML = escapeHTML(g.label) + (g.locked ? `<span class="rules-chip-lock" title="Default rules unlock with a code">${RULES_ICON_LOCK}</span>` : '');
        const chips = document.createElement('div');
        chips.className = 'chip-row';
        g.setups.forEach(s => chips.appendChild(scopeChip(s)));
        row.append(lab, chips);
        box.appendChild(row);
    });
    scopeWrap.appendChild(box);
    const note = document.createElement('span');
    note.className = 'rules-scope-note';
    note.textContent = scope === RULES_ALL
        ? 'These rules are checked on every trade, whatever the setup.'
        : rulesSetupLocked(scope)
            ? `${scope} has default rules too: they unlock with ${rulesIsAdvancedSetup(scope) ? 'the premium code' : 'a free code'} from the ${RULES_DTG.name}. You can always add your own rules.`
            : `Shown together with the rules for all setups when you pick ${scope}. Setups come from the Setup list on the Journal tab.`;
    scopeWrap.appendChild(note);
    card.appendChild(scopeWrap);

    const list = () => {
        if (!Array.isArray(sets.rules[scopeKey])) sets.rules[scopeKey] = [];
        return sets.rules[scopeKey];
    };
    const globals = scope === RULES_ALL ? [] : (sets.rules[RULES_ALL] || []);

    RULE_PHASES.forEach(ph => {
        const box = document.createElement('div');
        box.className = 'rules-set-phase';
        const bh = document.createElement('div');
        bh.className = 'rules-set-phase-head';
        bh.innerHTML = `<span>${ph}</span>`;
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'btn-secondary btn-sm';
        add.textContent = '+ Add rule';
        add.onclick = () => {
            const r = { id: rulesNewId(), phase: ph, key: '', detail: '' };
            list().push(r);
            onChange();
            renderSettingsUI();
            const input = settingsContainer.querySelector(`[data-rule-row="${CSS.escape(r.id)}"] .rules-key-input`);
            if (input) input.focus();
        };
        bh.appendChild(add);
        box.appendChild(bh);

        // Rules for all setups, read-only here (edit them under All setups)
        globals.filter(r => r.phase === ph).forEach(r => {
            const row = document.createElement('div');
            row.className = 'rules-set-row is-locked';
            row.innerHTML = `
                <span class="rules-lock" title="Defined in All setups">${RULES_ICON_LOCK}</span>
                <span class="rules-locked-field is-key">${escapeHTML(r.key)}</span>
                <span class="rules-locked-field">${escapeHTML(r.detail)}</span>
                <span class="rules-all-tag">All setups</span>
                <button type="button" class="rules-icon-btn" title="Edit in All setups" aria-label="Edit in All setups">${RULES_ICON_PENCIL}</button>`;
            row.querySelector('button').onclick = () => { rulesSettingsScope = RULES_ALL; renderSettingsUI(); };
            box.appendChild(row);
        });

        const own = list().filter(r => r.phase === ph);
        if (!own.length && !globals.some(r => r.phase === ph)) {
            const empty = document.createElement('span');
            empty.className = 'rules-set-empty';
            empty.textContent = 'No rules in this phase.';
            box.appendChild(empty);
        }

        own.forEach(r => {
            const row = document.createElement('div');
            row.className = 'rules-set-row';
            row.dataset.ruleRow = r.id;
            row.innerHTML = `
                <span class="row-drag-handle" title="Drag to reorder">${DRAG_ICON_SVG}</span>
                <input type="text" class="linear-input rules-key-input" aria-label="Rule key" placeholder="Key, e.g. Rejection" maxlength="40">
                <input type="text" class="linear-input rules-detail-input" aria-label="Rule detail" placeholder="Detail, e.g. no acceptance outside" maxlength="60">
                <select class="linear-input rules-phase-select" aria-label="Phase">${RULE_PHASES.map(p => `<option value="${p}"${p === r.phase ? ' selected' : ''}>${p}</option>`).join('')}</select>
                <button type="button" class="rules-icon-btn rules-delete" title="Delete rule" aria-label="Delete rule">&times;</button>`;
            const keyIn = row.querySelector('.rules-key-input');
            const detIn = row.querySelector('.rules-detail-input');
            keyIn.value = r.key;
            detIn.value = r.detail;
            keyIn.oninput = () => { r.key = keyIn.value; rulesSaveSoon(onChange); };
            detIn.oninput = () => { r.detail = detIn.value; rulesSaveSoon(onChange); };
            row.querySelector('.rules-phase-select').onchange = (e) => {
                r.phase = e.target.value;
                onChange();
                renderSettingsUI();
            };
            row.querySelector('.rules-delete').onclick = () => {
                const arr = list();
                arr.splice(arr.indexOf(r), 1);
                onChange();
                renderSettingsUI();
            };

            // Drag & drop within the phase (handle only)
            const handle = row.querySelector('.row-drag-handle');
            handle.onmousedown = () => { row.draggable = true; };
            handle.onmouseup = () => { row.draggable = false; };
            row.ondragstart = (e) => {
                rulesDraggedId = r.id;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => row.classList.add('dragging-row'), 0);
            };
            row.ondragend = () => {
                rulesDraggedId = null;
                row.draggable = false;
                row.classList.remove('dragging-row');
                card.querySelectorAll('.row-drag-over').forEach(x => x.classList.remove('row-drag-over'));
            };
            row.ondragover = (e) => {
                const dragged = list().find(x => x.id === rulesDraggedId);
                if (!dragged || dragged.phase !== ph || dragged.id === r.id) return;
                e.preventDefault();
                row.classList.add('row-drag-over');
            };
            row.ondragleave = () => row.classList.remove('row-drag-over');
            row.ondrop = (e) => {
                e.preventDefault();
                row.classList.remove('row-drag-over');
                const arr = list();
                const from = arr.findIndex(x => x.id === rulesDraggedId);
                if (from < 0 || arr[from].id === r.id) return;
                const [moved] = arr.splice(from, 1);
                arr.splice(arr.indexOf(r), 0, moved);
                onChange();
                renderSettingsUI();
            };
            box.appendChild(row);
        });
        card.appendChild(box);
    });

    const foot = document.createElement('div');
    foot.className = 'rules-settings-foot';
    foot.innerHTML = '<span>Keep a key to 1–3 words and the detail to about 5. Drag to reorder.</span>';
    const restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'btn-secondary btn-sm';
    restore.textContent = 'Restore default rules';
    restore.onclick = async () => {
        if (!(await appConfirm({ title: 'Restore the default rules?', message: 'Default rules you changed or deleted are put back as they were. Rules you added yourself stay as they are. Trades you already logged keep their own rules.', confirmText: 'Restore defaults', tone: 'primary', icon: 'undo' }))) return;
        // Own rules (ids that don't start with "d-") stay, after the defaults
        const mine = {};
        Object.keys(sets.rules || {}).forEach(k => {
            const own = (Array.isArray(sets.rules[k]) ? sets.rules[k] : []).filter(r => !(r && typeof r.id === 'string' && r.id.startsWith('d-')));
            if (own.length) mine[k] = own;
        });
        sets.rules = rulesBuildDefaults();
        Object.keys(mine).forEach(k => { sets.rules[k] = [...(sets.rules[k] || []), ...mine[k]]; });
        rulesEnsureShape();
        onChange();
        renderSettingsUI();
        showToast('Default rules restored', 'success');
    };
    if (!rulesOwnSystem()) foot.appendChild(restore);
    card.appendChild(foot);
}
