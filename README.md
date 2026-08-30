# DevWyre Humanizer

A modern, offline-first web app that converts AI-generated text into natural, human-sounding copy. Strip AI markers, fix formatting, add contractions and natural phrasing — all in the browser, nothing is uploaded.

🖤 [devwyre.com](https://devwyre.com/) · 💚 [Donate](https://flutterwave.com/store/devwyredonations) · ⭐ [GitHub](https://github.com/DevWyre/text-humanizer-website)

## Features

- **100% offline** — everything runs client-side via `humanize-lib-standalone.js`
- **Word-level diff view** — "Tidy" mode shows exactly what changed, with added/removed words highlighted
- **Deterministic output** — the same input always produces the same result (no flicker)
- **Auto-process** — live humanizing while you type, with debounce
- **Dark & light themes** — manual toggle, remembered, respects system preference
- **Settings persistence** — options and draft text survive refreshes (`localStorage`)
- **Undo** — step back through the last 20 results
- **Drag & drop** — drop a `.txt`/`.md` file straight onto the Input panel
- **Import / export** — paste, load files, copy, and download `.txt`
- **Live stats** — characters, word count, reading time, and change count
- **Shortcuts** — `Ctrl/⌘+Enter` humanize · `Ctrl/⌘+K` clear · `Ctrl/⌘+Shift+D` download

## Transform Options

**Cleanup tab**
- Hidden symbols — strips invisible Unicode characters
- **Hidden watermarks** — removes variation selectors, invisible format chars, and combining diacritics used to fingerprint AI text (opt-in)
- Trailing whitespace — removes spaces at line ends
- Non-breaking spaces — converted to regular spaces
- Fancy dashes — em/en dashes become hyphens
- Curly quotes — smart quotes/ellipses normalized to straight marks
- Ellipsis — `…` becomes `...`
- Keyboard-only — removes all non-typable symbols

**Style tab**
- Natural variations — contractions and human phrasing (intensity slider)
- Word spinning — swaps words for safe synonyms (intensity slider)

## Getting Started

Since this is a static site, any static server works:

```bash
# Python
python -m http.server 8000   # then open http://localhost:8000

# or Node
npx serve
```

Or just open `index.html` directly in your browser.

1. Paste your text into the Input panel.
2. Hit **Humanize text** (or rely on auto-process).
3. Review changes in the Tidy view, then copy or download.

## Project Structure

```
index.html                       # Layout, panels, settings tabs
styles.css                       # Design system (vars, dark/light themes, components)
script.js                        # App: diff, stats, persistence, toasts, shortcuts
humanize-lib-standalone.js       # Core text-humanizing engine (humanizeString)
```

## Technology Stack

- Vanilla HTML5 / CSS3 / JavaScript (ES6+) — no build step, no dependencies
- CSS custom properties power the dual-theme design system
- `Inter` + `JetBrains Mono` typography via Google Fonts
- LCS-based word diffing for the change-highlight view

## Notes

- All functionality stays client-side. No telemetry, no uploads.
- Output stays deterministic for identical input + settings, so auto-processing won't flicker.