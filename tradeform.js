// --- Trade Form (chip based) ---
// Builds the add/edit trade form from appData.settings, so everything the
// user adds, removes or reorders in Settings shows up here automatically.
// The saved trade object keeps the exact same shape as before.

const TF_RESULTS = ['WIN', 'LOST', 'B/E'];
const TF_RESULT_TONES = { 'WIN': 'win', 'LOST': 'loss', 'B/E': 'be' };
const TF_COLLAPSE_AFTER = 12; // chips shown before a "+ more" chip appears
// Minimum a trade needs before it can be saved (in form order)
const TF_REQUIRED = ['symbol', 'marketCondition', 'result', 'location', 'setup', 'direction'];
const TF_REQUIRED_LABELS = { symbol: 'Symbol', marketCondition: 'Market Condition', result: 'Result', location: 'Location', setup: 'Setup', direction: 'Direction' };

let tfState = null;

function tfEmptyState() {
    return {
        symbol: '',
        marketCondition: '',
        result: '',
        setup: '',
        setupCategory: '',
        direction: '',
        locations: [],
        locPath: { primary: '', sub1: '' },
        evidences: [],
        invalidations: [],
        target: { primary: '', sub1: '', sub2: '' },
        psychology: [],
        carried: {},
        expanded: {},
        // Tags (tags.js): Find or add text per section, the section in edit mode, the highlighted find result
        find: {},
        findHi: {},
        findCat: {},
        edit: ''
    };
}

// ---------- Init / read-out ----------

function tfInit(trade = null) {
    tfState = tfEmptyState();

    if (trade) {
        tfState.symbol = trade.symbol || '';
        tfState.marketCondition = trade.marketCondition || '';
        tfState.result = trade.result || '';
        tfState.setup = trade.setup || '';
        // Use the stored category, unless the setup was moved to another one in Settings
        const storedCat = trade.setupCategory || '';
        const stillThere = storedCat && (tfSetupConfig()[storedCat] || []).includes(tfState.setup);
        tfState.setupCategory = stillThere ? storedCat : (tfFindSetupCategory(tfState.setup) || storedCat);
        tfState.direction = trade.direction || '';
        tfState.locations = (trade.locations || [])
            .filter(l => l && l.primary)
            .map(l => ({ primary: l.primary, sub1: l.sub1 || '', sub2: l.sub2 || '' }));
        tfState.evidences = (trade.evidences || [])
            .filter(e => e && e.primary)
            .map(e => ({ primary: e.primary, sub: e.sub || '' }));
        tfState.invalidations = (trade.invalidations || [])
            .filter(i => i && i.primary)
            .map(i => ({ primary: i.primary, sub: i.sub || '' }));
        tfState.target = {
            primary: trade.target || '',
            sub1: trade.targetSub1 || '',
            sub2: trade.targetSub2 || ''
        };
        tfState.psychology = [...(trade.psychology || [])];
        if (tfState.locations.length) {
            tfState.locPath = { primary: tfState.locations[0].primary, sub1: tfState.locations[0].sub1 };
        }
    } else {
        tfApplySmartDefaults();
    }

    tfClearAllMissing();
    tfRenderAll();
    tfUpdateSaveState();
    // Rules tab + grade (rules.js)
    if (typeof rulesFormInit === 'function') rulesFormInit(trade);
}

// Symbol and market condition rarely change within a session:
// take them over from the latest trade on the same day.
function tfApplySmartDefaults() {
    const sets = appData.settings;
    const date = document.getElementById('t-date').value;
    const sameDay = appData.trades
        .filter(t => t.date === date)
        .sort((a, b) => (parseInt(b.number, 10) || 0) - (parseInt(a.number, 10) || 0));
    const previous = sameDay[0];

    ['symbol', 'marketCondition'].forEach(field => {
        const options = sets[field] || [];
        if (previous && previous[field] && options.includes(previous[field])) {
            tfState[field] = previous[field];
            tfState.carried[field] = true;
        } else if (options.length === 1) {
            tfState[field] = options[0];
        }
    });

    // A list with a single option needs no tap
    const directions = sets.direction || [];
    if (directions.length === 1) tfState.direction = directions[0];
    const setups = tfAllSetups();
    if (setups.length === 1) {
        tfState.setup = setups[0].item;
        tfState.setupCategory = setups[0].cat;
    }
}

function tfGetData() {
    const st = tfState;
    return {
        result: st.result,
        symbol: st.symbol,
        locations: st.locations.map(l => ({ ...l })),
        marketCondition: st.marketCondition,
        setup: st.setup,
        setupCategory: st.setup ? st.setupCategory : '',
        direction: st.direction,
        evidences: st.evidences.map(e => ({ ...e })),
        invalidations: st.invalidations.map(i => ({ ...i })),
        target: st.target.primary,
        targetSub1: st.target.sub1,
        targetSub2: st.target.sub2,
        psychology: [...st.psychology]
    };
}

// Returns the list of missing required sections (empty = valid)
// Required fields that are still empty. A field only counts when the user's
// settings actually offer options for it, so an emptied list never blocks saving.
function tfMissing() {
    if (!tfState) return [];
    const sets = appData.settings;
    return TF_REQUIRED.filter(field => {
        if (field === 'result') return !tfState.result;
        if (field === 'setup') return tfAllSetups().length > 0 && !tfState.setup;
        if (field === 'location') return Object.keys(sets.location || {}).length > 0 && !tfState.locations.length;
        return (sets[field] || []).length > 0 && !tfState[field];
    });
}

// Save stays disabled until the minimum is filled in; the hint says what's left
function tfUpdateSaveState() {
    const btn = document.getElementById('btn-save-trade');
    const hint = document.getElementById('tf-save-hint');
    const missing = tfMissing();
    if (btn) {
        btn.disabled = missing.length > 0;
        btn.title = missing.length ? `Still needed: ${missing.map(f => TF_REQUIRED_LABELS[f]).join(', ')}` : (typeof keysAlt === 'function' ? `Save trade (${keysAlt()} S)` : '');
    }
    if (hint) hint.textContent = missing.length ? `Still needed: ${missing.map(f => TF_REQUIRED_LABELS[f]).join(', ')}` : '';
    if (typeof scalpSyncSaveNext === 'function') scalpSyncSaveNext(); // Save & next (scalp.js)
}

// Highlights what's missing (used when Alt+S is pressed too early)
function tfValidate() {
    const missing = tfMissing();
    tfClearAllMissing();
    missing.forEach(field => {
        const sec = document.getElementById(`tf-sec-${field}`);
        if (sec) sec.classList.add('is-missing');
    });
    if (missing.length) {
        const first = document.getElementById(`tf-sec-${missing[0]}`);
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return missing.map(f => TF_REQUIRED_LABELS[f]);
}

function tfClearMissing(field) {
    const sec = document.getElementById(`tf-sec-${field}`);
    if (sec) sec.classList.remove('is-missing');
}

function tfClearAllMissing() {
    document.querySelectorAll('.chip-section.is-missing').forEach(s => s.classList.remove('is-missing'));
}

// ---------- Rendering helpers ----------

function tfMarkDirty() {
    isFormDirty = true;
    tfUpdateSaveState();
    if (typeof rulesFormSync === 'function') rulesFormSync();
}

function tfChip({ id, label, selected = false, tone = '', legacy = false, hasPicks = false, extraClass = '', onClick }) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = ['chip',
        selected ? 'is-selected' : '',
        tone ? `chip-${tone}` : '',
        legacy ? 'is-legacy' : '',
        hasPicks ? 'has-picks' : '',
        extraClass].filter(Boolean).join(' ');
    b.textContent = label;
    b.dataset.chipId = id;
    b.setAttribute('aria-pressed', selected ? 'true' : 'false');
    if (legacy) b.title = 'No longer in your settings';
    b.addEventListener('click', onClick);
    return b;
}

// Re-renders one section and keeps keyboard focus on the same chip
function tfRender(containerId, buildFn) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const active = document.activeElement;
    const focusId = active && el.contains(active) ? active.dataset.chipId : null;
    el.innerHTML = '';
    buildFn(el);
    if (focusId) {
        const again = el.querySelector(`[data-chip-id="${CSS.escape(focusId)}"]`);
        if (again) again.focus();
    }
}

// Adds values that are stored on the trade but no longer exist in settings
function tfWithLegacy(options, selectedValues) {
    const list = [...(options || [])];
    const legacy = new Set();
    selectedValues.filter(Boolean).forEach(v => {
        if (!list.includes(v)) {
            list.push(v);
            legacy.add(v);
        }
    });
    return { list, legacy };
}

// A wrapping row of chips, collapsed to TF_COLLAPSE_AFTER when the list is long
function tfChipRow(container, key, options, isSelected, onPick, rerender, opts = {}) {
    const row = document.createElement('div');
    row.className = 'chip-row' + (opts.sub ? ' is-sub' : '');

    const { list, legacy } = opts.legacyValues
        ? tfWithLegacy(options, opts.legacyValues)
        : { list: [...(options || [])], legacy: new Set() };

    let visible = list;
    let hidden = 0;
    if (!tfState.expanded[key] && list.length > TF_COLLAPSE_AFTER + 2) {
        visible = list.filter((v, i) => i < TF_COLLAPSE_AFTER || isSelected(v));
        hidden = list.length - visible.length;
    }

    visible.forEach(v => {
        row.appendChild(tfChip({
            id: `${key}::${v}`,
            label: v,
            selected: isSelected(v),
            tone: opts.tone ? opts.tone(v) : '',
            legacy: legacy.has(v),
            hasPicks: opts.hasPicks ? opts.hasPicks(v) : false,
            onClick: () => onPick(v)
        }));
    });

    if (hidden > 0) {
        row.appendChild(tfChip({
            id: `${key}::__more`,
            label: `Show ${hidden} more`,
            extraClass: 'chip-more',
            onClick: () => {
                tfState.expanded[key] = true;
                rerender();
            }
        }));
    }

    // + chip at the end of the row: add a tag to this list and pick it (tags.js)
    if (opts.add) row.appendChild(tfAddChip(opts.add));

    container.appendChild(row);
    return row;
}

function tfEmptyHint(container, text) {
    const p = document.createElement('p');
    p.className = 'chip-empty';
    p.textContent = text;
    container.appendChild(p);
}

// ---------- Single-choice sections ----------

function tfRenderSingle(field, options, toneFn) {
    const rerender = () => tfRenderSingle(field, options, toneFn);
    tfRender(`tf-${field}`, el => {
        if (field !== 'result' && tfTagsSpecial(field, el)) return;
        const opts = field === 'result' ? options : (appData.settings[field] || []);
        if (!opts.length && field === 'result') {
            tfEmptyHint(el, 'Add options for this in Settings.');
            return;
        }
        tfChipRow(el, field, opts,
            v => tfState[field] === v,
            v => {
                tfState[field] = tfState[field] === v ? '' : v;
                tfState.carried[field] = false;
                tfMarkDirty();
                tfClearMissing(field);
                rerender();
                tfUpdateNote(field);
            },
            rerender,
            { tone: toneFn, legacyValues: [tfState[field]], add: field === 'result' ? null : { a: { key: field, level: 'item' } } }
        );
    });
    tfUpdateNote(field);
}

// W / L / B in the form (app.js): sets the result, a second press keeps it
function tfSetResult(v) {
    if (!TF_RESULTS.includes(v)) return;
    tfState.result = v;
    tfState.carried.result = false;
    tfMarkDirty();
    tfClearMissing('result');
    tfRenderSingle('result', TF_RESULTS, r => TF_RESULT_TONES[r] || '');
}

function tfUpdateNote(field) {
    const note = document.getElementById(`tf-note-${field}`);
    if (!note) return;
    note.textContent = tfState.carried[field] ? 'From previous trade' : '';
}

// ---------- Setup: grouped, single choice ----------
// settings shape: { Category: [setup, setup] }; the trade stores the setup
// name (as before) plus setupCategory.

function tfSetupConfig() {
    const cfg = appData.settings.setup;
    return cfg && !Array.isArray(cfg) ? cfg : {};
}

function tfAllSetups() {
    const cfg = tfSetupConfig();
    return Object.keys(cfg).flatMap(cat => (Array.isArray(cfg[cat]) ? cfg[cat] : []).map(item => ({ cat, item })));
}

function tfFindSetupCategory(name) {
    if (!name) return '';
    const hit = tfAllSetups().find(s => s.item === name);
    return hit ? hit.cat : '';
}

function tfRenderSetup() {
    tfRender('tf-setup', el => {
        if (tfTagsSpecial('setup', el)) return;
        const cfg = tfSetupConfig();
        const st = tfState;
        const cats = Object.keys(cfg).filter(cat => Array.isArray(cfg[cat]));

        // A stored setup that is no longer in settings stays visible
        const known = st.setup && tfAllSetups().some(s => s.item === st.setup && (!st.setupCategory || s.cat === st.setupCategory));
        const legacyCat = st.setup && !known ? (st.setupCategory || 'Not in settings') : '';
        if (legacyCat && !cats.includes(legacyCat)) cats.push(legacyCat);

        if (!cats.length) {
            // No setups yet: start with a category, right here
            tfEmptyHint(el, 'No setups yet. Add a category with the pencil, or in Settings.');
            return;
        }

        cats.forEach(cat => {
            const group = document.createElement('div');
            group.className = 'chip-group';
            const label = document.createElement('span');
            label.className = 'chip-group-label';
            label.textContent = cat;
            group.appendChild(label);

            const items = Array.isArray(cfg[cat]) ? cfg[cat] : [];
            const legacyValues = cat === legacyCat ? [st.setup] : [];
            tfChipRow(group, `setup::${cat}`, items,
                item => st.setup === item && (st.setupCategory === cat || (!st.setupCategory && cat === legacyCat) || (!st.setupCategory && !legacyCat)),
                item => {
                    const same = st.setup === item && st.setupCategory === cat;
                    st.setup = same ? '' : item;
                    st.setupCategory = same ? '' : cat;
                    tfMarkDirty();
                    tfClearMissing('setup');
                    tfRenderSetup();
                },
                tfRenderSetup,
                { legacyValues, add: cat === legacyCat && !(cat in cfg) ? null : { a: { key: 'setup', level: 'gitem', cat } } }
            );
            el.appendChild(group);
        });
    });
}

// ---------- Multi-choice: psychology ----------

function tfRenderPsychology() {
    tfRender('tf-psychology', el => {
        if (tfTagsSpecial('psychology', el)) return;
        const opts = appData.settings.psychology || [];
        tfChipRow(el, 'psychology', opts,
            v => tfState.psychology.includes(v),
            v => {
                const has = tfState.psychology.includes(v);
                tfState.psychology = has ? tfState.psychology.filter(p => p !== v) : [...tfState.psychology, v];
                tfMarkDirty();
                tfRenderPsychology();
            },
            tfRenderPsychology,
            { legacyValues: tfState.psychology, add: { a: { key: 'psychology', level: 'item' } } }
        );
    });
}

// ---------- Multi-choice grouped: evidence & invalidation ----------
// settings shape: { Category: [item, item] }, stored as [{ primary, sub }]

function tfRenderGrouped(field, settingsKey) {
    const rerender = () => tfRenderGrouped(field, settingsKey);
    tfRender(`tf-${field}`, el => {
        if (tfTagsSpecial(settingsKey, el)) return;
        const config = appData.settings[settingsKey] || {};
        const picks = tfState[field];
        const isPicked = (cat, item) => picks.some(p => p.primary === cat && (p.sub || '') === item);
        const toggle = (cat, item) => {
            tfState[field] = isPicked(cat, item)
                ? picks.filter(p => !(p.primary === cat && (p.sub || '') === item))
                : [...picks, { primary: cat, sub: item }];
            tfMarkDirty();
            rerender();
        };

        // Categories from settings, plus categories only found on this trade
        const cats = Object.keys(config);
        picks.forEach(p => { if (!cats.includes(p.primary)) cats.push(p.primary); });

        if (!cats.length) {
            tfEmptyHint(el, 'No categories yet. Add one with the pencil, or in Settings.');
            return;
        }

        cats.forEach(cat => {
            const group = document.createElement('div');
            group.className = 'chip-group';

            const label = document.createElement('span');
            label.className = 'chip-group-label';
            label.textContent = cat;
            group.appendChild(label);

            const items = Array.isArray(config[cat]) ? config[cat] : [];
            const storedItems = picks.filter(p => p.primary === cat).map(p => p.sub || '');

            if (!items.length && !storedItems.some(Boolean)) {
                // Category without items: the category itself is the choice
                const row = document.createElement('div');
                row.className = 'chip-row';
                row.appendChild(tfChip({
                    id: `${field}::${cat}::`,
                    label: cat,
                    selected: isPicked(cat, ''),
                    legacy: !(cat in config),
                    onClick: () => toggle(cat, '')
                }));
                if (cat in config) row.appendChild(tfAddChip({ a: { key: settingsKey, level: 'gitem', cat } }));
                group.appendChild(row);
            } else {
                const row = tfChipRow(group, `${field}::${cat}`, items,
                    item => isPicked(cat, item),
                    item => toggle(cat, item),
                    rerender,
                    { legacyValues: storedItems, add: cat in config ? { a: { key: settingsKey, level: 'gitem', cat } } : null }
                );
                if (!(cat in config)) row.querySelectorAll('.chip').forEach(c => c.classList.add('is-legacy'));
            }
            el.appendChild(group);
        });
    });
}

// ---------- Location: cascade with multiple picks (confluence) ----------
// Picking an item on the deepest available level adds a location tag.

function tfRenderLocation() {
    tfRender('tf-location', el => {
        if (tfTagsSpecial('location', el)) return;
        const tree = appData.settings.location || {};
        const st = tfState;
        const sameLoc = (l, p, s1, s2) => l.primary === p && (l.sub1 || '') === s1 && (l.sub2 || '') === s2;
        const hasLoc = (p, s1, s2) => st.locations.some(l => sameLoc(l, p, s1, s2));
        const toggleLoc = (p, s1, s2) => {
            st.locations = hasLoc(p, s1, s2)
                ? st.locations.filter(l => !sameLoc(l, p, s1, s2))
                : [...st.locations, { primary: p, sub1: s1, sub2: s2 }];
            tfMarkDirty();
            tfClearMissing('location');
            tfRenderLocation();
        };

        // Chosen confluences
        const tags = document.createElement('div');
        tags.className = 'chip-tags';
        if (!st.locations.length) {
            const hint = document.createElement('span');
            hint.className = 'chip-empty';
            hint.textContent = 'No location yet. Tap through the levels below; every last-level pick adds one.';
            tags.appendChild(hint);
        }
        st.locations.forEach((l, i) => {
            const text = [l.primary, l.sub1, l.sub2].filter(Boolean).join(' › ');
            const tag = document.createElement('span');
            tag.className = 'chip-tag';
            const span = document.createElement('span');
            span.textContent = text;
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.className = 'chip-tag-remove';
            rm.dataset.chipId = `loctag::${text}`;
            rm.setAttribute('aria-label', `Remove ${text}`);
            rm.innerHTML = '&times;';
            rm.addEventListener('click', () => {
                st.locations = st.locations.filter((_, j) => j !== i);
                tfMarkDirty();
                tfRenderLocation();
            });
            tag.appendChild(span);
            tag.appendChild(rm);
            tags.appendChild(tag);
        });
        el.appendChild(tags);

        const primaries = Object.keys(tree);

        const picker = document.createElement('div');
        picker.className = 'chip-cascade';

        // Level 1
        tfChipRow(picker, 'loc-p', primaries,
            p => st.locPath.primary === p || (!(tree[p] && (tree[p].sub1 || []).length) && hasLoc(p, '', '')),
            p => {
                const sub1 = (tree[p] && tree[p].sub1) || [];
                if (!sub1.length) {
                    st.locPath = { primary: p, sub1: '' };
                    toggleLoc(p, '', '');
                } else {
                    st.locPath = { primary: st.locPath.primary === p ? '' : p, sub1: '' };
                    tfRenderLocation();
                }
            },
            tfRenderLocation,
            { hasPicks: p => st.locations.some(l => l.primary === p), add: { a: { key: 'location', level: 'cat' } } }
        );

        // Level 2
        const cfg = tree[st.locPath.primary];
        const sub1 = (cfg && cfg.sub1) || [];
        const sub2 = (cfg && cfg.sub2) || [];
        if (st.locPath.primary && sub1.length) {
            const p = st.locPath.primary;
            tfChipRow(picker, `loc-s1::${p}`, sub1,
                s => sub2.length ? st.locPath.sub1 === s : hasLoc(p, s, ''),
                s => {
                    if (!sub2.length) {
                        toggleLoc(p, s, '');
                    } else {
                        st.locPath.sub1 = st.locPath.sub1 === s ? '' : s;
                        tfRenderLocation();
                    }
                },
                tfRenderLocation,
                { sub: true, hasPicks: s => sub2.length > 0 && st.locations.some(l => l.primary === p && l.sub1 === s), add: { a: { key: 'location', level: 'sub1', cat: p } } }
            );
        }

        // Level 3
        if (st.locPath.primary && st.locPath.sub1 && sub2.length) {
            const p = st.locPath.primary;
            const s1 = st.locPath.sub1;
            tfChipRow(picker, `loc-s2::${p}::${s1}`, sub2,
                s2 => hasLoc(p, s1, s2),
                s2 => toggleLoc(p, s1, s2),
                tfRenderLocation,
                { sub: true, add: { a: { key: 'location', level: 'sub2', cat: p } } }
            );
        }

        el.appendChild(picker);
    });
}

// ---------- Target: cascade with a single pick ----------

function tfRenderTarget() {
    tfRender('tf-target', el => {
        if (tfTagsSpecial('target', el)) return;
        const tree = appData.settings.target || {};
        const t = tfState.target;
        const primaries = Object.keys(tree);

        const picker = document.createElement('div');
        picker.className = 'chip-cascade';

        tfChipRow(picker, 'tgt-p', primaries,
            p => t.primary === p,
            p => {
                tfState.target = t.primary === p ? { primary: '', sub1: '', sub2: '' } : { primary: p, sub1: '', sub2: '' };
                tfMarkDirty();
                tfRenderTarget();
            },
            tfRenderTarget,
            { legacyValues: [t.primary], add: { a: { key: 'target', level: 'cat' } } }
        );

        const cfg = tree[t.primary] || {};
        const sub1 = cfg.sub1 || [];
        const sub2 = cfg.sub2 || [];

        if (t.primary && (sub1.length || t.sub1)) {
            tfChipRow(picker, `tgt-s1::${t.primary}`, sub1,
                s => t.sub1 === s,
                s => {
                    t.sub1 = t.sub1 === s ? '' : s;
                    t.sub2 = '';
                    tfMarkDirty();
                    tfRenderTarget();
                },
                tfRenderTarget,
                { sub: true, legacyValues: [t.sub1], add: (t.primary in tree) ? { a: { key: 'target', level: 'sub1', cat: t.primary } } : null }
            );
        }

        if (t.primary && t.sub1 && (sub2.length || t.sub2)) {
            tfChipRow(picker, `tgt-s2::${t.primary}::${t.sub1}`, sub2,
                s => t.sub2 === s,
                s => {
                    t.sub2 = t.sub2 === s ? '' : s;
                    tfMarkDirty();
                    tfRenderTarget();
                },
                tfRenderTarget,
                { sub: true, legacyValues: [t.sub2], add: (t.primary in tree) ? { a: { key: 'target', level: 'sub2', cat: t.primary } } : null }
            );
        }

        el.appendChild(picker);
    });
}

// ---------- All ----------

function tfRenderAll() {
    tfRenderSingle('symbol');
    tfRenderSingle('marketCondition');
    tfRenderSingle('result', TF_RESULTS, v => TF_RESULT_TONES[v] || '');
    tfRenderLocation();
    tfRenderSetup();
    tfRenderSingle('direction');
    tfRenderGrouped('evidences', 'evidence');
    tfRenderGrouped('invalidations', 'invalidation');
    tfRenderTarget();
    tfRenderPsychology();
}

// Typing in date, trade # or notes also counts as an unsaved change
document.getElementById('trade-form').addEventListener('input', tfMarkDirty);

// ---------- Tags in the form (tags.js, 2026-11-15) ----------
// + chip at the end of every row, Find or add in the header (sections with 7+ tags),
// and the pencil that turns one section into the list editor. Not in Quick trade.

const TF_TAG_SECTIONS = [
    { key: 'symbol', sec: 'tf-sec-symbol', body: 'tf-symbol' },
    { key: 'marketCondition', sec: 'tf-sec-marketCondition', body: 'tf-marketCondition' },
    { key: 'location', sec: 'tf-sec-location', body: 'tf-location' },
    { key: 'setup', sec: 'tf-sec-setup', body: 'tf-setup' },
    { key: 'direction', sec: 'tf-sec-direction', body: 'tf-direction' },
    { key: 'evidence', sec: 'section-evidence', body: 'tf-evidences' },
    { key: 'invalidation', sec: 'section-invalidation', body: 'tf-invalidations' },
    { key: 'target', sec: 'section-target', body: 'tf-target' },
    { key: 'psychology', sec: 'section-psychology', body: 'tf-psychology' }
];
const TF_TAG_RENDER = {
    symbol: () => tfRenderSingle('symbol'),
    marketCondition: () => tfRenderSingle('marketCondition'),
    direction: () => tfRenderSingle('direction'),
    setup: () => tfRenderSetup(),
    evidence: () => tfRenderGrouped('evidences', 'evidence'),
    invalidation: () => tfRenderGrouped('invalidations', 'invalidation'),
    location: () => tfRenderLocation(),
    target: () => tfRenderTarget(),
    psychology: () => tfRenderPsychology()
};

function tfModalOpen() {
    const m = document.getElementById('trade-modal');
    return !!(m && m.classList.contains('active') && tfState);
}

// Pick a tag that was just added (or found)
function tfTagPick(a, name, opts = {}) {
    const st = tfState;
    const key = a.key;
    if (key === 'symbol' || key === 'marketCondition' || key === 'direction') {
        if (opts.toggle && st[key] === name) st[key] = '';
        else st[key] = name;
        st.carried[key] = false;
        tfClearMissing(key);
    } else if (key === 'psychology') {
        if (!st.psychology.includes(name)) st.psychology = [...st.psychology, name];
        else if (opts.toggle) st.psychology = st.psychology.filter(p => p !== name);
    } else if (key === 'setup') {
        if (opts.toggle && st.setup === name && st.setupCategory === a.cat) { st.setup = ''; st.setupCategory = ''; }
        else { st.setup = name; st.setupCategory = a.cat; }
        tfClearMissing('setup');
    } else if (key === 'evidence' || key === 'invalidation') {
        const f = key === 'evidence' ? 'evidences' : 'invalidations';
        const sub = a.level === 'cat' ? '' : name, primary = a.level === 'cat' ? name : a.cat;
        const has = st[f].some(p => p.primary === primary && (p.sub || '') === sub);
        if (!has) st[f] = [...st[f], { primary, sub }];
        else if (opts.toggle) st[f] = st[f].filter(p => !(p.primary === primary && (p.sub || '') === sub));
    } else if (key === 'location') {
        const tree = appData.settings.location || {};
        const has = (p, s1, s2) => st.locations.some(l => l.primary === p && (l.sub1 || '') === s1 && (l.sub2 || '') === s2);
        const add = (p, s1, s2) => { if (!has(p, s1, s2)) st.locations = [...st.locations, { primary: p, sub1: s1, sub2: s2 }]; else if (opts.toggle) st.locations = st.locations.filter(l => !(l.primary === p && (l.sub1 || '') === s1 && (l.sub2 || '') === s2)); };
        if (opts.path) {
            const [p, s1 = '', s2 = ''] = opts.path;
            st.locPath = { primary: p, sub1: s2 ? s1 : '' };
            add(p, s1, s2);
        } else if (a.level === 'cat') {
            st.locPath = { primary: name, sub1: '' };
            if (!((tree[name] || {}).sub1 || []).length) add(name, '', '');
        } else if (a.level === 'sub1') {
            st.locPath = { primary: a.cat, sub1: '' };
            if (((tree[a.cat] || {}).sub2 || []).length) st.locPath.sub1 = name;
            else add(a.cat, name, '');
        } else {
            const s1 = st.locPath.primary === a.cat ? st.locPath.sub1 : '';
            if (s1) add(a.cat, s1, name);
        }
        tfClearMissing('location');
    } else if (key === 'target') {
        if (opts.path) {
            const [p, s1 = '', s2 = ''] = opts.path;
            st.target = { primary: p, sub1: s1, sub2: s2 };
        } else if (a.level === 'cat') st.target = { primary: name, sub1: '', sub2: '' };
        else if (a.level === 'sub1') st.target = { primary: a.cat, sub1: name, sub2: '' };
        else st.target = { ...st.target, primary: a.cat, sub2: name };
    }
    tfMarkDirty();
}

// The + chip in a row (normal mode). Enter: add, pick, close; comma: add, pick, keep the field open.
function tfAddChip(add) {
    const a = add.a;
    const k = TAGS_KINDS[a.key];
    const where = tagsWhere(a);
    const label = a.level === 'cat'
        ? (k.type === 'tree' ? `Add a ${k.label}` : 'Add a category')
        : where ? `Add to ${where}` : `Add a ${k.label}`;
    const focusId = `tfadd|${a.key}|${a.level}|${a.cat || ''}`;
    return tagsAddChip({
        label, focusId, placeholder: a.level === 'cat' && k.type === 'group' ? 'Category name' : `New ${k.label}`,
        onAdd: async (names, how) => {
            const snap = tagsSnapshot(a.key, false);
            const added = [];
            let last = '';
            names.forEach(n => {
                const r = tagsAdd(a, n);
                if (!r.name) return;
                if (r.added) added.push(r.name);
                last = r.name;
                // single choice: only the last one is picked; multi: all of them
                if (k.multi || k.arr) tfTagPick(a, r.name);
            });
            if (last && !(k.multi || k.arr)) tfTagPick(a, last);
            const msg = !added.length ? '' : added.length === 1 ? `“${added[0]}” added${where ? ` to ${where}` : ''}.` : `${added.length} tags added${where ? ` to ${where}` : ''}.`;
            await tagsDone(snap, msg);
            setTimeout(() => {
                const plus = document.querySelector(`#trade-modal [data-tags-focus="${CSS.escape(focusId)}"]`);
                if (!plus) return;
                if (how === 'comma' && plus.parentElement && plus.parentElement.tagsOpen) plus.parentElement.tagsOpen();
                else plus.focus();
            }, 0);
        }
    });
}

// Edit mode or a Find text: the section shows the editor or the matches instead of the rows
function tfTagsSpecial(key, el) {
    tfTagsTools(key);
    if (tfState.edit === key) {
        el.classList.add('is-editing');
        tagsEditor(el, key, { query: tfState.find[key] || '', place: 'form' });
        return true;
    }
    el.classList.remove('is-editing', 'tags-editor');
    const q = tagsClean(tfState.find[key] || '');
    if (!q) return false;
    tfTagsFindResults(key, el, q);
    return true;
}

// Header: Find or add (7+ tags) and the pencil / Done button. Built once per section, updated after.
function tfTagsTools(key) {
    const def = TF_TAG_SECTIONS.find(d => d.key === key);
    const sec = def && document.getElementById(def.sec);
    const head = sec && sec.querySelector('.chip-section-head');
    if (!head) return;
    let tools = head.querySelector('.tf-tools');
    if (!tools) {
        tools = document.createElement('div');
        tools.className = 'tf-tools';
        const find = document.createElement('span');
        find.className = 'tags-find';
        find.innerHTML = `${TAGS_ICONS.search}<input type="text" class="tags-find-input" placeholder="Find or add" aria-label="Find or add a ${TAGS_KINDS[key].label}" autocomplete="off" spellcheck="false">`;
        const input = find.querySelector('input');
        input.addEventListener('input', e => {
            e.stopPropagation(); // typing here is not a change to the trade
            tfState.find[key] = input.value;
            tfState.findHi[key] = 0;
            TF_TAG_RENDER[key]();
        });
        input.addEventListener('keydown', e => tfTagsFindKey(key, e, input));
        const pen = document.createElement('button');
        pen.type = 'button';
        pen.className = 'tags-pen';
        pen.innerHTML = TAGS_ICONS.pen;
        pen.setAttribute('aria-label', `Edit the ${TAGS_KINDS[key].label} list`);
        pen.title = `Edit the ${TAGS_KINDS[key].label} list`;
        pen.addEventListener('click', () => tfTagsEdit(key, true));
        const done = document.createElement('button');
        done.type = 'button';
        done.className = 'btn-primary btn-sm tags-done';
        done.textContent = 'Done';
        done.addEventListener('click', () => tfTagsEdit(key, false));
        const badge = document.createElement('span');
        badge.className = 'tags-editing-badge';
        badge.textContent = 'Editing';
        tools.append(badge, find, pen, done);
        head.appendChild(tools);
    }
    const editing = tfState.edit === key;
    const findBox = tools.querySelector('.tags-find');
    findBox.hidden = tagsCount(key) < TAGS_FIND_FROM;
    const input = tools.querySelector('input');
    if (input.value !== (tfState.find[key] || '')) input.value = tfState.find[key] || '';
    tools.querySelector('.tags-pen').hidden = editing;
    tools.querySelector('.tags-done').hidden = !editing;
    tools.querySelector('.tags-editing-badge').hidden = !editing;
    sec.classList.toggle('is-tags-editing', editing);
}

function tfTagsEdit(key, on) {
    const prev = tfState.edit;
    tfState.edit = on ? key : '';
    tfState.find[key] = '';
    if (prev && prev !== key && TF_TAG_RENDER[prev]) { tfState.find[prev] = ''; TF_TAG_RENDER[prev](); }
    TF_TAG_RENDER[key]();
    const def = TF_TAG_SECTIONS.find(d => d.key === key);
    const sec = document.getElementById(def.sec);
    setTimeout(() => {
        const target = on ? sec.querySelector('.tags-chip-name, .tags-cat-name, .tags-add') : sec.querySelector('.tags-pen');
        if (target) target.focus();
    }, 0);
}

// Everything you can pick in a section, for Find: { label, a, name, path, selected }
function tfTagsEntries(key) {
    const sets = appData.settings, st = tfState, k = TAGS_KINDS[key];
    const out = [];
    if (k.type === 'flat') {
        (sets[key] || []).forEach(n => out.push({ label: n, a: { key, level: 'item' }, name: n,
            selected: k.multi ? st.psychology.includes(n) : st[key] === n }));
    } else if (k.type === 'group') {
        const cfg = tagsConfig(key);
        const names = Object.values(cfg).flat();
        Object.keys(cfg).forEach(cat => {
            const items = Array.isArray(cfg[cat]) ? cfg[cat] : [];
            if (!items.length && key !== 'setup') {
                const f = key === 'evidence' ? 'evidences' : 'invalidations';
                out.push({ label: cat, a: { key, level: 'cat' }, name: cat, selected: st[f].some(p => p.primary === cat && !p.sub) });
            }
            items.forEach(n => {
                const dup = names.filter(x => x === n).length > 1;
                const sel = key === 'setup' ? st.setup === n && st.setupCategory === cat
                    : st[key === 'evidence' ? 'evidences' : 'invalidations'].some(p => p.primary === cat && (p.sub || '') === n);
                out.push({ label: dup ? `${cat} › ${n}` : n, a: { key, level: 'gitem', cat }, name: n, selected: sel });
            });
        });
    } else {
        const cfg = tagsConfig(key);
        Object.keys(cfg).forEach(p => {
            const s1 = (cfg[p] && cfg[p].sub1) || [], s2 = (cfg[p] && cfg[p].sub2) || [];
            const paths = !s1.length ? [[p]] : s1.flatMap(a => !s2.length ? [[p, a]] : s2.map(b => [p, a, b]));
            paths.forEach(path => {
                const [x, y = '', z = ''] = path;
                const sel = key === 'location'
                    ? st.locations.some(l => l.primary === x && (l.sub1 || '') === y && (l.sub2 || '') === z)
                    : st.target.primary === x && st.target.sub1 === y && st.target.sub2 === z;
                out.push({ label: path.join(' › '), a: { key, level: 'cat' }, name: x, path, selected: sel });
            });
        });
    }
    return out;
}

// Where a new tag from Find goes in Location / Target: the deepest level that is open
function tfTagsFindAddTarget(key) {
    const k = TAGS_KINDS[key];
    if (k.type !== 'tree') return null;
    const cfg = tagsConfig(key);
    const p = key === 'location' ? tfState.locPath.primary : tfState.target.primary;
    const s1 = key === 'location' ? tfState.locPath.sub1 : tfState.target.sub1;
    if (p && cfg[p]) {
        if (s1 && (cfg[p].sub2 || []).length) return { key, level: 'sub2', cat: p };
        if ((cfg[p].sub1 || []).length) return { key, level: 'sub1', cat: p };
    }
    return { key, level: 'cat' };
}

function tfTagsFindModel(key, q) {
    const entries = tfTagsEntries(key);
    const scored = entries.map((e, i) => ({ e, i, s: tagsMatches(e.label, q) || (e.path ? Math.max(...e.path.map(x => tagsMatches(x, q))) : 0) }))
        .filter(x => x.s > 0)
        .sort((x, y) => (y.s - x.s) || (x.i - y.i))
        .map(x => x.e);
    const k = TAGS_KINDS[key];
    const exact = entries.some(e => tagsSame(e.name, q) || tagsSame(e.label, q));
    let addTo = null, cats = [];
    if (!exact) {
        if (k.type === 'flat') addTo = { key, level: 'item' };
        else if (k.type === 'group') {
            cats = Object.keys(tagsConfig(key));
            if (cats.length) {
                const c = cats.includes(tfState.findCat[key]) ? tfState.findCat[key] : cats[0];
                tfState.findCat[key] = c;
                addTo = { key, level: 'gitem', cat: c };
            }
        } else addTo = tfTagsFindAddTarget(key);
    }
    return { results: scored.slice(0, 24), more: Math.max(0, scored.length - 24), addTo, cats };
}

function tfTagsFindResults(key, el, q) {
    const m = tfTagsFindModel(key, q);
    const total = m.results.length + (m.addTo ? 1 : 0);
    const hi = Math.max(0, Math.min(tfState.findHi[key] || 0, Math.max(0, total - 1)));
    tfState.findHi[key] = hi;
    const row = document.createElement('div');
    row.className = 'chip-row tags-find-row';
    m.results.forEach((e, i) => {
        const c = tfChip({
            id: `find::${key}::${e.label}`, label: e.label, selected: e.selected,
            extraClass: i === hi ? 'is-find-hi' : '',
            onClick: () => tfTagsFindPick(key, e)
        });
        row.appendChild(c);
    });
    if (m.addTo) {
        const where = tagsWhere(m.addTo);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tags-add has-label' + (hi === m.results.length ? ' is-find-hi' : '');
        b.innerHTML = `${TAGS_ICONS.plus}<span></span>`;
        b.querySelector('span').textContent = `Add “${q}”${where && TAGS_KINDS[key].type === 'tree' ? ` to ${where}` : ''}`;
        b.addEventListener('click', () => tfTagsFindAdd(key, q));
        row.appendChild(b);
    }
    el.appendChild(row);
    if (m.addTo && m.cats.length) {
        const cr = document.createElement('div');
        cr.className = 'tags-find-cats';
        const lab = document.createElement('span');
        lab.className = 'tags-find-in';
        lab.textContent = 'in';
        cr.appendChild(lab);
        m.cats.forEach(c => {
            cr.appendChild(tfChip({ id: `findcat::${key}::${c}`, label: c, selected: false, extraClass: c === tfState.findCat[key] ? 'is-find-cat' : '',
                onClick: () => { tfState.findCat[key] = c; TF_TAG_RENDER[key](); } }));
        });
        el.appendChild(cr);
    }
    const hint = document.createElement('p');
    hint.className = 'chip-empty tags-find-hint';
    hint.textContent = !m.results.length
        ? (m.cats.length > 1 ? 'No match. ← → picks the category, Enter adds it there and picks it.' : 'No match. Enter adds it and picks it.')
        : `${m.more ? `${m.more} more match. ` : ''}← → move between matches · Enter picks the one with the white ring · Esc clears`;
    el.appendChild(hint);
}

function tfTagsFindKey(key, e, input) {
    e.stopPropagation();
    if (e.isComposing) return;
    const q = tagsClean(input.value);
    if (!q) return;
    const m = tfTagsFindModel(key, q);
    const total = m.results.length + (m.addTo ? 1 : 0);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const d = e.key === 'ArrowLeft' ? -1 : 1;
        if (!m.results.length && m.cats.length > 1) {
            const i = m.cats.indexOf(tfState.findCat[key]);
            tfState.findCat[key] = m.cats[(i + d + m.cats.length) % m.cats.length];
        } else if (total) {
            tfState.findHi[key] = ((tfState.findHi[key] || 0) + d + total) % total;
        }
        TF_TAG_RENDER[key]();
        return;
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        const hi = tfState.findHi[key] || 0;
        if (hi < m.results.length) tfTagsFindPick(key, m.results[hi]);
        else if (m.addTo) tfTagsFindAdd(key, q);
    }
}

function tfTagsFindClear(key) {
    tfState.find[key] = '';
    tfState.findHi[key] = 0;
    TF_TAG_RENDER[key]();
    const def = TF_TAG_SECTIONS.find(d => d.key === key);
    const input = document.querySelector(`#${def.sec} .tags-find-input`);
    if (input) { input.value = ''; input.focus(); }
}

function tfTagsFindPick(key, e) {
    tfTagPick(e.a, e.name, { path: e.path });
    tfTagsFindClear(key);
}

async function tfTagsFindAdd(key, q) {
    const m = tfTagsFindModel(key, q);
    if (!m.addTo) return;
    const a = m.addTo;
    const snap = tagsSnapshot(key, false);
    const r = tagsAdd(a, q);
    if (!r.name) return;
    tfTagPick(a, r.name);
    const where = tagsWhere(a);
    tfState.find[key] = '';
    tfState.findHi[key] = 0;
    await tagsDone(snap, r.added ? `“${r.name}” added${where ? ` to ${where}` : ''}.` : '');
    tfTagsFindClear(key);
}

// The open trade, for renames from tags.js: as a trade object and back
tagsForm = {
    get: () => tfModalOpen() ? tfGetData() : null,
    set: d => {
        if (!tfState) return;
        const st = tfState;
        st.symbol = d.symbol || ''; st.marketCondition = d.marketCondition || ''; st.direction = d.direction || '';
        st.setup = d.setup || ''; st.setupCategory = d.setupCategory || '';
        st.locations = (d.locations || []).map(l => ({ primary: l.primary, sub1: l.sub1 || '', sub2: l.sub2 || '' }));
        st.evidences = (d.evidences || []).map(x => ({ primary: x.primary, sub: x.sub || '' }));
        st.invalidations = (d.invalidations || []).map(x => ({ primary: x.primary, sub: x.sub || '' }));
        st.target = { primary: d.target || '', sub1: d.targetSub1 || '', sub2: d.targetSub2 || '' };
        st.psychology = [...(d.psychology || [])];
        const tree = appData.settings.location || {};
        if (st.locPath.primary && !tree[st.locPath.primary]) st.locPath = st.locations.length ? { primary: st.locations[0].primary, sub1: st.locations[0].sub1 } : { primary: '', sub1: '' };
        if (typeof rulesFormSync === 'function') rulesFormSync();
    }
};

tagsRefreshers.add(() => {
    if (!tfModalOpen()) return;
    tfRenderAll();
    tfUpdateSaveState();
});
