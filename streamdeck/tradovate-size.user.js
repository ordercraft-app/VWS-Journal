// ==UserScript==
// @name         Tradovate · jump to Quantity (Ctrl+Shift+1)
// @namespace    order-craft
// @version      2.0.0
// @description  Ctrl+Shift+1 puts the cursor in the DOM Quantity field and selects its value. Type a size and press Enter: the value is kept and the cursor leaves the field, so your Tradovate hotkeys work again. Mac and Windows, QWERTY and AZERTY, Chrome and Edge.
// @author       Order Craft
// @match        https://*.tradovate.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const DIGIT = '1';        // Ctrl + Shift + this number key (top row)
    const BLUR_DELAY = 150;   // ms after Enter before the cursor leaves the field
    const GUARD_MS = 1500;    // after a failed jump: ignore the size + Enter that follow
    const QTY = [             // the Quantity field in the DOM header (first match wins)
        '.info-column-qty .select-input.combobox input',
        '.info-column-qty input',
    ];

    // Always work on the main Tradovate page, also when the key arrives in a frame of it.
    const top = (() => { try { void window.top.document; return window.top; } catch (e) { return window; } })();
    const doc = top.document;
    const S = top.__ocQty || (top.__ocQty = { lastDom: null, armed: null, guardUntil: 0, watching: false });

    // Remember the DOM you last clicked in, so the right DOM is used when you have several.
    if (!S.watching) {
        S.watching = true;
        doc.addEventListener('pointerdown', (e) => {
            const d = e.target && e.target.closest && e.target.closest('.module-dom');
            if (d) S.lastDom = d;
        }, true);
    }

    const visible = (el) => el && el.isConnected && el.getClientRects().length > 0;

    function qtyIn(dom) {
        for (const sel of QTY) {
            const el = dom.querySelector(sel);
            if (visible(el) && !el.disabled && !el.readOnly) return el;
        }
        return null;
    }

    // Which DOM? 1) the one you are typing in, 2) the one you last clicked,
    // 3) the DOM in the active panel, 4) the first visible DOM.
    function findQtyInput() {
        const a = doc.activeElement;
        const candidates = [
            a && a.closest && a.closest('.module-dom'),
            visible(S.lastDom) ? S.lastDom : null,
            doc.querySelector('.lm_stack.active .module-dom'),
            ...doc.querySelectorAll('.module-dom'),
        ];
        for (const d of candidates) {
            if (!d) continue;
            const el = qtyIn(d);
            if (el) return el;
        }
        return null;
    }

    function flash(el) {
        const old = el.style.boxShadow;
        el.style.boxShadow = '0 0 0 2px #386af5';
        setTimeout(() => { el.style.boxShadow = old; }, 600);
    }

    function toast(text) {
        if (!doc.body) return;
        const t = doc.createElement('div');
        t.textContent = text;
        t.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483647;' +
            'background:#ee354e;color:#fff;font:600 13px/1.3 system-ui,sans-serif;padding:8px 14px;border-radius:8px;' +
            'box-shadow:0 6px 20px rgba(0,0,0,.4);pointer-events:none';
        doc.body.appendChild(t);
        setTimeout(() => t.remove(), 1800);
    }

    // Ctrl + Shift + 1, Control on a Mac (not Cmd). The number keys sit in the same place on
    // QWERTY and AZERTY, so the key position (Digit1) is checked, with the character as backup.
    // AltGr on Windows counts as Ctrl + Alt, so it never matches.
    function isJumpKey(e) {
        if (!e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey) return false;
        return e.code === 'Digit' + DIGIT || e.key === DIGIT;
    }

    const isSizeKey = (e) => /^(Digit|Numpad)\d$/.test(e.code) || /^\d$/.test(e.key) ||
        e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete';

    function onKey(e) {
        if (e.isComposing) return;

        if (isJumpKey(e)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (e.repeat) return;
            const input = findQtyInput();
            if (input) {
                input.focus({ preventScroll: true });
                if (doc.activeElement === input) {
                    input.select();
                    flash(input);
                    S.armed = input;
                    S.guardUntil = 0;
                    return;
                }
            }
            // Not found or not focusable: block the size and Enter the Stream Deck sends next,
            // so they can't land in another field, and say so.
            S.armed = null;
            S.guardUntil = Date.now() + GUARD_MS;
            toast('Quantity field not found: size not changed');
            return;
        }

        if (Date.now() < S.guardUntil && !e.ctrlKey && !e.metaKey && !e.altKey && isSizeKey(e)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (e.key === 'Enter') S.guardUntil = 0;
            return;
        }

        // Enter in the Quantity field: let Tradovate save the value first, then leave the field.
        if (e.key === 'Enter' && S.armed && doc.activeElement === S.armed) {
            const input = S.armed;
            S.armed = null;
            setTimeout(() => { if (doc.activeElement === input) input.blur(); }, BLUR_DELAY);
        }
    }

    window.addEventListener('keydown', onKey, true);
})();
