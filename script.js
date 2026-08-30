/* ==========================================================================
   DevWyre Humanizer — Application
   Plain-ES6, no build step. Core processing runs offline via
   humanize-lib-standalone.js (humanizeString).
   ========================================================================== */

'use strict';

/* ----------------------------- Constants --------------------------------- */

const STORE = {
    settings: 'dh_settings_v2',
    theme: 'dh_theme',
    draft: 'dh_draft_v1',
};

const DEFAULT_SETTINGS = {
    transformHidden: true,
    transformTrailingWhitespace: true,
    transformNbs: true,
    transformDashes: true,
    transformQuotes: true,
    transformOther: true,
    keyboardOnly: false,
    naturalVariations: true,
    naturalIntensity: 0.6,
    spinWords: false,
    spinIntensity: 0.25,
    removeWatermarks: false,
    autoProcess: true,
    view: 'tidy',
};

const CHECKBOX_MAP = {
    optHidden: 'transformHidden',
    optWatermark: 'removeWatermarks',
    optWhitespace: 'transformTrailingWhitespace',
    optNbsp: 'transformNbs',
    optDashes: 'transformDashes',
    optQuotes: 'transformQuotes',
    optEllipsis: 'transformOther',
    optKeyboard: 'keyboardOnly',
    optNatural: 'naturalVariations',
    optSpin: 'spinWords',
};

const MAX_HISTORY = 20;

const ICONS = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="7.5" x2="12.01" y2="7.5"/></svg>',
};

/* ------------------------------ Utilities -------------------------------- */

const $ = (id) => document.getElementById(id);

function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

function debounce(fn, ms) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

function countWords(text) {
    const m = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
    return m ? m.length : 0;
}

function readingTimeMin(text) {
    return Math.max(1, Math.ceil(countWords(text) / 200));
}

function tokenize(text) {
    const parts = text.match(/\S+|\s+/g) || [];
    return parts.map((p) => ({ text: p, ws: /^\s+$/.test(p) }));
}

/* LCS-based word diff -> segments of {text, type: 'same'|'add'|'del'}.
   Non-space tokens only; whitespace is used purely as a joiner so insertions
   and removals never corrupt alignment (the old approach's bug). */
function diffWords(before, after) {
    const a = tokenize(before);
    const b = tokenize(after);
    const maxCells = 4_000_000;

    if (!a.length || !b.length) {
        return [{ text: after, type: b.length ? 'same' : 'same' }];
    }

    // Fallback for very large inputs: keep it fast and approximate.
    if (a.length * b.length > maxCells) {
        return simpleIndexDiff(a, b);
    }

    const m = b.length;
    const dp = new Uint32Array((a.length + 1) * (m + 1));

    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            const cell = i * (m + 1) + j;
            dp[cell] = (a[i].text === b[j].text)
                ? dp[(i + 1) * (m + 1) + j + 1] + 1
                : Math.max(dp[(i + 1) * (m + 1) + j], dp[i * (m + 1) + j + 1]);
        }
    }

    const out = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < m) {
        if (a[i].text === b[j].text) {
            out.push({ text: b[j].text, type: 'same' });
            i++; j++;
        } else if (dp[(i + 1) * (m + 1) + j] >= dp[i * (m + 1) + j + 1]) {
            if (!a[i].ws) out.push({ text: a[i].text, type: 'del' });
            i++;
        } else {
            if (!b[j].ws) out.push({ text: b[j].text, type: 'add' });
            j++;
        }
    }
    while (j < m) {
        if (!b[j].ws) out.push({ text: b[j].text, type: 'add' });
        j++;
    }
    return out;
}

function simpleIndexDiff(a, b) {
    const out = [];
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        if (a[i].text === b[i].text) {
            out.push({ text: b[i].text, type: 'same' });
        } else {
            if (!a[i].ws) out.push({ text: a[i].text, type: 'del' });
            if (!b[i].ws) out.push({ text: b[i].text, type: 'add' });
        }
    }
    for (let i = n; i < b.length; i++) {
        if (!b[i].ws) out.push({ text: b[i].text, type: 'add' });
    }
    return out;
}

function renderDiffHtml(segments) {
    return segments.map((s) => {
        if (s.type === 'add') return `<mark class="add">${esc(s.text)}</mark>`;
        if (s.type === 'del') return `<del>${esc(s.text)}</del>`;
        return esc(s.text);
    }).join('');
}

/* ------------------------------ Demo data -------------------------------- */

const DEMO_TEXTS = {
    ai: `Welcome to our revolutionary platform! We're thrilled to announce that our cutting-edge AI technology has been meticulously designed to transform the way you approach content creation. Additionally, our innovative solution leverages state-of-the-art algorithms to deliver unparalleled results that will exceed your expectations.

This means that, in order to streamline your workflow, you'll be able to achieve remarkable outcomes. "This is absolutely game-changing," said one of our satisfied customers. "I've never seen anything quite like this before."

It is important to note that the platform offers:
• Advanced machine learning capabilities
• Seamless integration with existing systems
• Real-time analytics and insights...
• 24/7 customer support

In conclusion, don't miss out on this incredible opportunity to revolutionize your business processes. Furthermore, we are thrilled to announce that thousands of satisfied customers have already experienced the transformative power of our solution.`,

    markers: `"Smart quotes and em-dashes — these are common AI markers that make text look artificial," explained the researcher.
 
The study found that AI-generated content often contains:
• Fancy quotation marks "like these"
• Em-dashes — instead of regular hyphens
• Ellipsis symbols… rather than three dots
• Non-breaking spaces and hidden Unicode characters
• Trailing whitespace at line ends   
 
"These subtle markers can be detected by both humans and algorithms," the expert noted. "Removing them makes text appear more natural and human-written."`,
};

/* -------------------------------- App ------------------------------------ */

class HumanizerApp {
    constructor() {
        this.el = this.grabElements();
        this.theme = document.documentElement.dataset.theme || 'light';
        this.settings = this.loadSettings();
        this.autoProcess = this.settings.autoProcess;
        this.rawOutput = '';
        this.history = [];
        this.isProcessing = false;
        this.diffCache = '';

        this.applySettingsToUi();
        this.applyTheme({
            save: false,
            animate: false,
        });
        this.bindEvents();
        this.restoreDraft();
        this.updateStats();
        this.updateModeUi();
        this.setStatus('Ready', 'idle');

        if (typeof humanizeString === 'undefined') {
            this.toast('Humanizer engine failed to load. Refresh the page.', 'error');
        }
    }

    grabElements() {
        const ids = [
            'themeToggle', 'status', 'statusChip', 'changesChip',
            'resetOptions', 'humanizeBtn',
            'optHidden', 'optWhitespace', 'optNbsp', 'optDashes', 'optQuotes',
            'optEllipsis', 'optKeyboard', 'optNatural', 'optSpin',
            'natIntensity', 'natIntensityVal', 'spinIntensity', 'spinIntensityVal',
            'spinSliderRow', 'autoProcess',
            'inputText', 'inputCharCount', 'inputWordBadge', 'inputReadTime',
            'uploadBtn', 'fileInput', 'pasteInput', 'clearInput', 'dropZone',
            'outputText', 'outputCharCount', 'outputWordBadge', 'outputSavedAt',
            'copyResult', 'downloadResult', 'undoBtn',
            'tidyView', 'plainView', 'diffView', 'outputEmpty',
            'changesText', 'toastContainer', 'inputPanel',
        ];
        const els = {};
        ids.forEach((id) => { els[camel(id)] = $(id); });
        els.tabButtons = Array.from(document.querySelectorAll('.tab[data-tab]'));
        els.viewButtons = Array.from(document.querySelectorAll('.seg-btn[data-view]'));
        els.demoButtons = Array.from(document.querySelectorAll('.demo-btn[data-demo]'));
        els.panels = {
            cleanup: $('panel-cleanup'),
            style: $('panel-style'),
        };
        return els;
    }

    /* ------------------------- Settings + theme ------------------------- */

    loadSettings() {
        try {
            const raw = localStorage.getItem(STORE.settings);
            if (raw) return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
        } catch (e) { /* ignore */ }
        return Object.assign({}, DEFAULT_SETTINGS);
    }

    saveSettings() {
        try { localStorage.setItem(STORE.settings, JSON.stringify(this.settings)); } catch (e) { /* ignore */ }
    }

    applySettingsToUi() {
        Object.entries(CHECKBOX_MAP).forEach(([id, key]) => {
            $(id).checked = !!this.settings[key];
        });
        $('natIntensity').value = Math.round(this.settings.naturalIntensity * 100);
        $('natIntensityVal').textContent = `${Math.round(this.settings.naturalIntensity * 100)}%`;
        $('spinIntensity').value = Math.round(this.settings.spinIntensity * 100);
        $('spinIntensityVal').textContent = `${Math.round(this.settings.spinIntensity * 100)}%`;
        $('spinSliderRow').hidden = !this.settings.spinWords;
        $('autoProcess').checked = this.settings.autoProcess;
        this.setModeUi(this.settings.view);
    }

    applyTheme({ save = true, animate = true } = {}) {
        document.documentElement.dataset.theme = this.theme;
        if (animate) {
            document.body.style.transition = 'background .3s ease';
        }
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = this.theme === 'dark' ? '#07070B' : '#F4F5FA';
        if (save) {
            try { localStorage.setItem(STORE.theme, this.theme); } catch (e) { /* ignore */ }
        }
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme();
    }

    /* ------------------------------ Events ------------------------------- */

    bindEvents() {
        this.el.themeToggle.addEventListener('click', () => this.toggleTheme());

        this.el.tabButtons.forEach((btn) => {
            btn.addEventListener('click', () => this.activateTab(btn.dataset.tab));
        });

        this.el.viewButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                this.settings.view = btn.dataset.view;
                this.setModeUi(this.settings.view);
                this.saveSettings();
            });
        });

        Object.entries(CHECKBOX_MAP).forEach(([id, key]) => {
            $(id).addEventListener('change', (e) => {
                this.settings[key] = e.target.checked;
                if (id === 'optSpin') {
                    $('spinSliderRow').hidden = !e.target.checked;
                }
                this.saveSettings();
                this.onSettingsChange();
            });
        });

        const bindSlider = (id, key, valId) => {
            $(id).addEventListener('input', () => {
                const pct = Number($(id).value);
                $(valId).textContent = `${pct}%`;
                this.settings[key] = pct / 100;
            });
            $(id).addEventListener('change', () => {
                this.saveSettings();
                this.onSettingsChange();
            });
        };
        bindSlider('natIntensity', 'naturalIntensity', 'natIntensityVal');
        bindSlider('spinIntensity', 'spinIntensity', 'spinIntensityVal');

        this.el.autoProcess.addEventListener('change', (e) => {
            this.autoProcess = e.target.checked;
            this.settings.autoProcess = e.target.checked;
            this.saveSettings();
            if (this.autoProcess && this.el.inputText.value.trim()) {
                this.scheduleProcess();
            } else if (!this.autoProcess) {
                this.setStatus('Manual', 'idle');
            }
        });

        this.el.resetOptions.addEventListener('click', () => this.resetSettings());

        // Input events
        this.el.inputText.addEventListener('input', () => {
            this.updateStats();
            this.saveDraft();
            if (this.autoProcess) this.scheduleProcess();
            else this.invalidateOutput();
        });
        this.el.inputText.addEventListener('paste', () => {
            setTimeout(() => {
                this.updateStats();
                this.saveDraft();
                if (this.autoProcess) this.scheduleProcess();
            }, 10);
        });

        // Action buttons
        this.el.humanizeBtn.addEventListener('click', () => this.processText());
        this.el.clearInput.addEventListener('click', () => this.clearInput());
        this.el.pasteInput.addEventListener('click', () => this.pasteFromClipboard());
        this.el.uploadBtn.addEventListener('click', () => this.el.fileInput.click());
        this.el.fileInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) this.loadFile(file);
            e.target.value = '';
        });
        this.el.copyResult.addEventListener('click', () => this.copyResult());
        this.el.downloadResult.addEventListener('click', () => this.downloadResult());
        this.el.undoBtn.addEventListener('click', () => this.undo());

        this.el.demoButtons.forEach((btn) => {
            btn.addEventListener('click', () => this.loadDemo(btn.dataset.demo));
        });

        // Drag & drop
        ['dragenter', 'dragover'].forEach((ev) => {
            this.el.dropZone.addEventListener(ev, (e) => {
                e.preventDefault();
                this.el.inputPanel.classList.add('is-dragover');
            });
        });
        ['dragleave', 'drop'].forEach((ev) => {
            this.el.dropZone.addEventListener(ev, (e) => {
                e.preventDefault();
                this.el.inputPanel.classList.remove('is-dragover');
            });
        });
        this.el.dropZone.addEventListener('drop', (e) => {
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file && /\.(txt|md|text)$/i.test(file.name)) {
                this.loadFile(file);
            } else if (file) {
                this.toast('Please drop a .txt or .md file', 'error');
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            const k = e.key.toLowerCase();
            if (k === 'enter') {
                e.preventDefault();
                this.processText();
            } else if (k === 'k') {
                e.preventDefault();
                this.clearInput();
            } else if (k === 'd' && e.shiftKey) {
                e.preventDefault();
                this.downloadResult();
            }
        });
    }

    activateTab(name) {
        this.el.tabButtons.forEach((b) => {
            const active = b.dataset.tab === name;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-selected', String(active));
        });
        Object.entries(this.el.panels).forEach(([key, panel]) => {
            panel.hidden = key !== name;
            panel.classList.toggle('is-active', key === name);
        });
    }

    onSettingsChange() {
        if (!this.el.inputText.value.trim()) return;
        if (this.autoProcess) {
            this.scheduleProcess();
        } else {
            this.processText();
        }
    }

    invalidateOutput() {
        this.rawOutput = '';
        this.el.outputText.value = '';
        this.diffCache = '';
        this.renderOutputViews();
        this.el.changesText.textContent = 'No changes yet';
        this.el.changesText.classList.remove('has-changes');
        $('outputWordBadge').textContent = '0 words';
        $('outputCharCount').textContent = '0 characters';
        $('outputSavedAt').textContent = 'Not processed';
        this.el.outputEmpty.hidden = !this.rawOutput;
    }

    resetSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS);
        this.autoProcess = this.settings.autoProcess;
        this.applySettingsToUi();
        this.saveSettings();
        this.toast('Settings restored to defaults', 'info');
        if (this.el.inputText.value.trim()) {
            this.scheduleProcess();
        }
    }

    /* --------------------------- Draft storage --------------------------- */

    restoreDraft() {
        try {
            const draft = localStorage.getItem(STORE.draft);
            if (draft) {
                this.el.inputText.value = draft;
                this.updateStats();
            }
        } catch (e) { /* ignore */ }
    }

    saveDraft() {
        try { localStorage.setItem(STORE.draft, this.el.inputText.value); } catch (e) { /* ignore */ }
    }

    /* ------------------------------ Processing ----------------------------- */

    scheduleProcess() {
        if (this.scheduleTimer) clearTimeout(this.scheduleTimer);
        this.scheduleTimer = setTimeout(() => this.processText(), 450);
    }

    processText() {
        const raw = this.el.inputText.value;
        if (!raw.trim()) {
            this.toast('Nothing to humanize — paste some text first', 'error');
            return;
        }
        if (this.isProcessing) return;

        this.isProcessing = true;
        this.setBusy(true);
        this.setStatus('Processing…', 'busy');

        try {
            const result = humanizeString(raw, this.buildOptions());
            this.rawOutput = result.text;
            this.diffCache = '';

            $('changesChip').textContent = `${result.count} change${result.count === 1 ? '' : 's'}`;
            this.el.changesText.textContent =
                result.count ? `${result.count} changes made` : 'No humanizing needed';
            this.el.changesText.classList.toggle('has-changes', result.count > 0);

            this.renderOutputViews();
            $('outputWordBadge').textContent = `${countWords(result.text)} words`;
            $('outputCharCount').textContent = `${result.text.length} characters`;
            $('outputSavedAt').textContent =
                `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

            this.pushHistory();
            this.setStatus(result.count ? 'Complete' : 'Clean', 'done');
        } catch (err) {
            console.error('Processing error:', err);
            this.setStatus('Error', 'error');
            this.toast('Something went wrong while processing. Try again.', 'error');
        } finally {
            this.isProcessing = false;
            this.setBusy(false);
        }
    }

    buildOptions() {
        return {
            transformHidden: this.settings.transformHidden,
            transformTrailingWhitespace: this.settings.transformTrailingWhitespace,
            transformNbs: this.settings.transformNbs,
            transformDashes: this.settings.transformDashes,
            transformQuotes: this.settings.transformQuotes,
            transformOther: this.settings.transformOther,
            keyboardOnly: this.settings.keyboardOnly,
            naturalVariations: this.settings.naturalVariations,
            naturalIntensity: this.settings.naturalIntensity,
            spinWords: this.settings.spinWords,
            spinIntensity: this.settings.spinIntensity,
            removeWatermarks: this.settings.removeWatermarks,
        };
    }

    renderOutputViews() {
        this.el.outputText.value = this.rawOutput;
        this.el.outputEmpty.hidden = !!this.rawOutput;
        if (this.rawOutput) {
            const input = this.el.inputText.value;
            this.diffCache = renderDiffHtml(diffWords(input, this.rawOutput));
            $('diffView').innerHTML = this.diffCache;
        } else {
            $('diffView').innerHTML = '';
        }
    }

    pushHistory() {
        this.history.push(this.rawOutput);
        if (this.history.length > MAX_HISTORY) this.history.shift();
    }

    undo() {
        const prev = this.history.pop();
        if (!prev) {
            this.toast('Nothing to undo', 'info');
            return;
        }
        this.rawOutput = prev;
        this.renderOutputViews();
        this.toast('Restored previous result', 'info');
    }

    setBusy(busy) {
        this.el.humanizeBtn.classList.toggle('loading', busy);
        this.el.humanizeBtn.disabled = busy;
    }

    setStatus(text, state) {
        $('status').textContent = text;
        this.el.statusChip.classList.remove('is-busy', 'is-done', 'is-error');
        if (state === 'busy') this.el.statusChip.classList.add('is-busy');
        if (state === 'done') this.el.statusChip.classList.add('is-done');
        if (state === 'error') this.el.statusChip.classList.add('is-error');
    }

    /* ------------------------------ View modes ----------------------------- */

    setModeUi(view) {
        this.el.viewButtons.forEach((b) => {
            b.classList.toggle('is-active', b.dataset.view === view);
        });
        const tidy = view === 'tidy';
        $('tidyView').hidden = !tidy;
        $('plainView').hidden = tidy;
    }

    updateModeUi() {
        this.setModeUi(this.settings.view);
    }

    /* ------------------------------ Stats --------------------------------- */

    updateStats() {
        const text = this.el.inputText.value;
        const words = countWords(text);
        $('inputCharCount').textContent = `${text.length} characters`;
        $('inputWordBadge').textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
        $('inputReadTime').textContent = text.trim()
            ? `${readingTimeMin(text)} min read`
            : '0 min read';
    }

    /* --------------------------- Clipboard & files ------------------------- */

    async pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) { this.toast('Clipboard is empty', 'error'); return; }
            this.el.inputText.value = text;
            this.updateStats();
            this.saveDraft();
            if (this.autoProcess) this.scheduleProcess();
            this.toast('Pasted from clipboard', 'success');
        } catch (err) {
            this.toast('Clipboard access denied', 'error');
        }
    }

    loadFile(file) {
        const reader = new FileReader();
        reader.onload = () => {
            this.el.inputText.value = String(reader.result || '');
            this.updateStats();
            this.saveDraft();
            if (this.autoProcess) this.scheduleProcess();
            this.toast(`Loaded ${file.name}`, 'success');
        };
        reader.onerror = () => this.toast('Could not read that file', 'error');
        reader.readAsText(file);
    }

    async copyResult() {
        if (!this.rawOutput) {
            this.toast('Nothing to copy yet', 'error');
            return;
        }
        try {
            await navigator.clipboard.writeText(this.rawOutput);
            this.toast('Result copied to clipboard', 'success');
        } catch (err) {
            $('outputText').select();
            document.execCommand('copy');
            this.toast('Result copied to clipboard', 'success');
        }
    }

    downloadResult() {
        if (!this.rawOutput) {
            this.toast('Nothing to download yet', 'error');
            return;
        }
        const blob = new Blob([this.rawOutput], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `humanized-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.toast('Downloaded as .txt', 'success');
    }

    clearInput() {
        this.el.inputText.value = '';
        this.history = [];
        this.rawOutput = '';
        this.saveDraft();
        this.invalidateOutput();
        this.updateStats();
        this.setStatus('Ready', 'idle');
        $('changesChip').textContent = '0 changes';
        $('outputSavedAt').textContent = 'Not processed';
        this.el.inputText.focus();
        this.toast('Input cleared', 'info');
    }

    loadDemo(key) {
        const text = DEMO_TEXTS[key];
        if (!text) return;
        this.el.inputText.value = text;
        this.updateStats();
        this.saveDraft();
        if (this.autoProcess) {
            this.processText();
        }
        this.el.inputText.focus();
    }

    /* ------------------------------- Toasts -------------------------------- */

    toast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-icon">${ICONS[type] || ICONS.info}</span><span></span>`;
        toast.lastElementChild.textContent = message;
        this.el.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('leaving');
            toast.addEventListener('animationend', () => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, { once: true });
        }, 3200);
    }
}

function camel(str) {
    return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new HumanizerApp();
    window.humanizerApp = app;

    setTimeout(() => {
        app.toast('Welcome to DevWyre Humanizer', 'info');
    }, 600);
});