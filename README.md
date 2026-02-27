# DevWyre Humanize — Enterprise Text Refinement

A modern, responsive web application that converts AI-generated text into natural, human-like content by removing common AI markers and formatting inconsistencies. Built for teams that require clean, readable copy.

Website: https://devwyre.com/
Donate: https://flutterwave.com/store/devwyredonations

## Product Highlights

- Real-time in-browser processing (no server round-trips)
- Clean, enterprise-grade UI with responsive layout
- Keyboard shortcuts and helpful toasts
- Works entirely offline after the page loads

## Transform Options

- Remove Hidden Symbols: Eliminates invisible Unicode characters
- Fix Trailing Whitespace: Removes spaces at line ends
- Replace Non-Breaking Spaces: Converts special spaces to regular ones
- Convert Fancy Dashes: Replaces em-dashes (—) with regular dashes (-)
- Normalize Quotes: Converts curly quotes (“ ”) to straight ones (" ")
- Replace Ellipsis: Changes ellipsis (…) to three dots (...)
- Natural Variations: Adds contractions and natural phrasing
- Word Spinning (optional): Swaps some words for safe synonyms, with adjustable intensity
- Keyboard-Only Characters: Removes all non-keyboard typeable symbols

## Getting Started

1. Open `index.html` in your browser.
2. Paste your text into the Input panel.
3. Click "Start" or enable auto-processing for real-time conversion.

## Insert Your Logo

A dedicated, easily replaceable logo block is provided in the header.

Option A — Set background image via CSS (recommended):
- Open `styles.css` and locate the `.brand-logo` class.
- Add a background image:

  .brand-logo {
      background-image: url('images/your-logo.png');
      background-size: cover;        /* or contain */
      background-position: center;   /* adjust as needed */
  }

Option B — Replace the placeholder element in HTML:
- Open `index.html` and find:
  <div class="brand-logo" aria-label="DevWyre Logo"></div>
- Replace that element with your own `<img>` tag:

  <img class="brand-logo" src="images/your-logo.png" alt="Your Logo" />

The `.brand-logo` class defines sizing and rounded corners for a polished look. Adjust dimensions in CSS if required.

## Technology Stack

- Frontend: HTML5, CSS3, JavaScript (ES6+)
- Styling: CSS Grid, Flexbox, CSS Variables
- Typography: Inter + JetBrains Mono
- Processing: In-browser transformation via `humanize-lib-standalone.js`

## Notes

- All functionality remains client-side. No external build tools are required.
- The UI has been rebranded for a professional DevWyre experience.

## Support DevWyre

- Website: https://devwyre.com/
- Donate: https://flutterwave.com/store/devwyredonations
