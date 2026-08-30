(function(global) {
    'use strict';

    // Default options
    const DefaultOptions = {
        transformHidden: true,
        transformTrailingWhitespace: true,
        transformNbs: true,
        transformDashes: true,
        transformQuotes: true,
        transformOther: true,
        keyboardOnly: false,

        // Natural variations (phrase-level + contractions)
        naturalVariations: true,
        naturalIntensity: 0.6, // 0..1

        // Aggressive steganography / text-watermark stripping
        removeWatermarks: false,

        // Word spinning (offline)
        spinWords: false,
        spinIntensity: 0.25, // 0..1 probability per eligible token
    };

    // Unicode constants for ignorable symbols (expanded from original)
    const IGNORABLE_SYMBOLS = [
        '\u00AD', '\u180E', '\u200B', '\u200C', '\u200D', '\u200E', '\u200F',
        '\u202A', '\u202B', '\u202C', '\u202D', '\u202E', '\u2060', '\u2066',
        '\u2067', '\u2068', '\u2069', '\uFEFF'
    ].join('');

    // Unicode ranges used by AI text watermarking / steganography to embed
    // invisible fingerprints in text. Opt-in via `removeWatermarks`.
    //   1. Variation selectors        (U+FE00–U+FE0F) — primary LLM watermark carrier
    //   2. Invisible format chars     (U+061C, U+2061–U+2064, U+FFF9–U+FFFB)
    //   3. Inactive tag characters    (U+E0000–U+E007F)
    //   4. Combining diacritical marks(U+0300–U+036F) — hide bits on base letters
    const WATERMARK_SYMBOLS = [
        '\u0300-\u036F',
        '\u061C',
        '\u2061-\u2064',
        '\u206A-\u206F',
        '\uFE00-\uFE0F',
        '\uFFF9-\uFFFB',
        '\u{E0000}-\u{E007F}'
    ].join('');

    // Conservative phrase rewrites to reduce “AI cadence” while preserving meaning.
    // Applied probabilistically per occurrence via naturalIntensity.
    const NATURAL_PHRASES = [
        // ---- "AI tone" phrase patterns ----
        { re: /\bIn today's (?:fast-?paced|rapidly evolving|digital) world\b/gi, to: ["These days", "Nowadays", "Right now"] },
        { re: /\bIt is important to note that\b/gi, to: ["Worth noting:", "Keep in mind:", "One thing to know:"] },
        { re: /\bIt (?:should|is going to) be noted that\b/gi, to: ["Notably,", "One note:", "Worth saying:"] },
        { re: /\bThis means that\b/gi, to: ["So", "In other words,", "Bottom line:"] },
        { re: /\bIn conclusion\b/gi, to: ["Bottom line", "To wrap up", "In short"] },
        { re: /\bIn summary\b/gi, to: ["In short", "Summing up"] },
        { re: /\bAs (?:previously|already) mentioned\b/gi, to: ["As I said earlier", "Like I mentioned"] },
        { re: /\bPlease note that\b/gi, to: ["Note that", "Just so you know,"] },
        { re: /\bFor your reference\b/gi, to: ["For reference"] },
        { re: /\bThere is a (?:significant|growing|clear) need for\b/gi, to: ["There's a real need for", "We could really use"] },

        // ---- sentence connectors / openers ----
        { re: /\bFurthermore\b/gi, to: ["Also", "On top of that", "Plus,"] },
        { re: /\bHowever\b/gi, to: ["That said", "Still", "But"] },
        { re: /\bTherefore\b/gi, to: ["So", "As a result", "That's why"] },
        { re: /\bAdditionally\b/gi, to: ["Also", "Plus,", "And"] },
        { re: /\bMoreover\b/gi, to: ["More importantly,", "And", "On top of that"] },
        { re: /\bOverall\b/gi, to: ["All in all", "On balance", "Looking at the big picture,"] },
        { re: /\bAs a matter of fact\b/gi, to: ["In fact"] },
        { re: /\bin order to\b/gi, to: ["to"] },
        { re: /\b(?:There are|There is) a number of\b/gi, to: ["There are several", "There are a few"] },

        // ---- marketing-hype verbs & nouns ----
        { re: /\butilize\b/gi, to: ["use"] },
        { re: /\bleverage\b/gi, to: ["use", "tap into", "put to work"] },
        { re: /\bstate-of-the-art\b/gi, to: ["modern", "up-to-date", "latest"] },
        { re: /\bcutting-edge\b/gi, to: ["modern", "advanced", "new"] },
        { re: /\bmeticulously\b/gi, to: ["carefully"] },
        { re: /\bunparalleled\b/gi, to: ["strong", "standout"] },
        { re: /\bcomprehensive\b/gi, to: ["complete", "full"] },
        { re: /\bseamless\b/gi, to: ["smooth", "easy", "effortless"] },
        { re: /\bseamlessly\b/gi, to: ["smoothly", "easily"] },
        { re: /\bstreamline\b/gi, to: ["simplify", "speed up"] },
        { re: /\brevolutionize\b/gi, to: ["change", "shake up", "redo"] },
        { re: /\bgame-?changing\b/gi, to: ["huge", "major", "big"] },
        { re: /\bgame-?changer\b/gi, to: ["big deal", "turning point"] },
        { re: /\bdelve\b/gi, to: ["dig into", "get into", "look into"] },
        { re: /\btapestry\b/gi, to: ["mix", "blend", "range"] },
        { re: /\bunlock\b/gi, to: ["open up", "get to", "tap into"] },
        { re: /\bempower\b/gi, to: ["help", "make it easier for"] },
        { re: /\bharness\b/gi, to: ["use", "tap"] },
        { re: /\bunderscore\b/gi, to: ["show", "highlight", "point to"] },
        { re: /\brobust\b/gi, to: ["solid", "strong", "dependable"] },
        { re: /\bholistic\b/gi, to: ["big-picture", "all-around"] },
        { re: /\bin the realm of\b/gi, to: ["when it comes to", "around"] },
        { re: /\bplays a (?:crucial|key|vital|pivotal) role\b/gi, to: ["is a big part of", "matters", "counts"] },
        { re: /\ba testament to\b/gi, to: ["proof of", "a sign of"] },
        { re: /\bfacilitate\b/gi, to: ["help with", "make easier"] },
        { re: /\bamplify\b/gi, to: ["boost", "strengthen"] },
        { re: /\belevate\b/gi, to: ["boost", "lift", "raise"] },
        { re: /\benhance\b/gi, to: ["improve", "boost"] },
        { re: /\boptimize\b/gi, to: ["improve", "tune up", "get the most out of"] },
        { re: /\boptimal\b/gi, to: ["best", "ideal"] },
        { re: /\bimpactful\b/gi, to: ["powerful", "strong", "worthwhile"] },
        { re: /\bfoster\b/gi, to: ["encourage", "build"] },
        { re: /\btransformative\b/gi, to: ["major", "big"] },
        { re: /\bmeaningful\b/gi, to: ["real", "worthwhile"] },
        { re: /\bengaging\b/gi, to: ["interesting", "fun"] },
        { re: /\bvaluable insights\b/gi, to: ["useful takeaways", "handy lessons"] },
        { re: /\blearnings\b/gi, to: ["lessons"] },
        { re: /\bjourney\b/gi, to: ["experience", "process"] },
        { re: /\buser-friendly\b/gi, to: ["easy to use"] },
        { re: /\bintuitive\b/gi, to: ["easy to use", "natural"] },
        { re: /\bbest-in-class\b/gi, to: ["top-notch", "leading"] },
        { re: /\bworld-class\b/gi, to: ["top-notch", "excellent"] },
        { re: /\bever-?evolving\b/gi, to: ["changing", "fast-moving"] },
        { re: /\binnovative solution\b/gi, to: ["new approach", "fresh idea"] },
        { re: /\bexceed your expectations\b/gi, to: ["beat what you'd expect", "impress you"] },
        { re: /\bbusiness processes\b/gi, to: ["processes", "how you work"] },
        { re: /\bdeliver (?:unparalleled|exceptional) results\b/gi, to: ["get strong results", "deliver better results"] },
        { re: /\b(We are|We're) thrilled to announce that\b/gi, to: ["Quick update:", "Good news:", "Excited to share:"] },
        { re: /\bThis revolutionary\b/gi, to: ["This new", "This updated"] },
        { re: /\bthe way you approach\b/gi, to: ["how you handle", "how you think about"] },
    ];

    // Contractions (applied per occurrence with naturalIntensity)
    const CONTRACTIONS = [
        { re: /\bdo not\b/gi, to: "don't" },
        { re: /\bdoes not\b/gi, to: "doesn't" },
        { re: /\bdid not\b/gi, to: "didn't" },
        { re: /\bwill not\b/gi, to: "won't" },
        { re: /\bcannot\b/gi, to: "can't" },
        { re: /\bcan not\b/gi, to: "can't" },
        { re: /\bshould not\b/gi, to: "shouldn't" },
        { re: /\bwould not\b/gi, to: "wouldn't" },
        { re: /\bcould not\b/gi, to: "couldn't" },
        { re: /\bare not\b/gi, to: "aren't" },
        { re: /\bwas not\b/gi, to: "wasn't" },
        { re: /\bwere not\b/gi, to: "weren't" },
        { re: /\bhas not\b/gi, to: "hasn't" },
        { re: /\bhave not\b/gi, to: "haven't" },
        { re: /\bwould have\b/gi, to: "would've" },
        { re: /\bcould have\b/gi, to: "could've" },
        { re: /\bshould have\b/gi, to: "should've" },
        { re: /\bI am\b/gi, to: "I'm" },
        { re: /\bI have\b/gi, to: "I've" },
        { re: /\bI will\b/gi, to: "I'll" },
        { re: /\bI would\b/gi, to: "I'd" },
        { re: /\byou are\b/gi, to: "you're" },
        { re: /\byou will\b/gi, to: "you'll" },
        { re: /\byou would\b/gi, to: "you'd" },
        { re: /\bwe are\b/gi, to: "we're" },
        { re: /\bwe have\b/gi, to: "we've" },
        { re: /\bwe will\b/gi, to: "we'll" },
        { re: /\bwe would\b/gi, to: "we'd" },
        { re: /\bthey are\b/gi, to: "they're" },
        { re: /\bthey have\b/gi, to: "they've" },
        { re: /\bthey will\b/gi, to: "they'll" },
        { re: /\bthey would\b/gi, to: "they'd" },
        { re: /\bit is\b/gi, to: "it's" },
        { re: /\bit will\b/gi, to: "it'll" },
        { re: /\bthat is\b/gi, to: "that's" },
        { re: /\bthere is\b/gi, to: "there's" },
    ];

    // Small offline synonym map (expanded, still conservative)
    // Keys are lowercase single tokens.
    const SPIN_SYNONYMS = {
        // verbs
        'use': ['use', 'employ'],
        'make': ['create', 'produce'],
        'get': ['get', 'obtain', 'receive'],
        'help': ['help', 'assist', 'support'],
        'show': ['show', 'display', 'demonstrate'],
        'need': ['need', 'require'],
        'improve': ['improve', 'enhance', 'boost'],
        'increase': ['increase', 'raise', 'grow'],
        'reduce': ['reduce', 'lower', 'decrease'],
        'fix': ['fix', 'resolve', 'correct'],
        'start': ['start', 'begin', 'launch'],
        'end': ['end', 'finish', 'conclude'],
        'change': ['change', 'adjust', 'modify'],
        'build': ['build', 'create', 'develop'],
        'create': ['create', 'make', 'produce'],
        'provide': ['provide', 'offer', 'deliver'],
        'offer': ['offer', 'provide'],
        'ensure': ['ensure', 'make sure'],
        'allow': ['allow', 'let', 'enable'],
        'enable': ['enable', 'allow', 'let'],
        'consider': ['consider', 'think about', 'weigh'],
        'explain': ['explain', 'break down', 'walk through'],
        'discover': ['discover', 'find', 'uncover'],

        // adjectives
        'important': ['important', 'key', 'crucial'],
        'different': ['different', 'distinct', 'varied'],
        'simple': ['simple', 'easy', 'straightforward'],
        'easy': ['easy', 'simple', 'straightforward'],
        'hard': ['hard', 'difficult', 'challenging'],
        'fast': ['fast', 'quick', 'rapid'],
        'slow': ['slow', 'gradual'],
        'big': ['big', 'large', 'major'],
        'small': ['small', 'minor', 'compact'],
        'good': ['good', 'solid', 'strong'],
        'bad': ['bad', 'poor', 'subpar'],
        'new': ['new', 'fresh', 'recent'],
        'old': ['old', 'previous', 'earlier'],
        'natural': ['natural', 'genuine', 'organic'],
        'human': ['human', 'real', 'natural'],
        'clear': ['clear', 'obvious', 'evident'],
        'useful': ['useful', 'handy', 'helpful'],
        'effective': ['effective', 'reliable', 'solid'],
        'efficient': ['efficient', 'streamlined'],

        // nouns
        'text': ['text', 'content', 'copy'],
        'idea': ['idea', 'concept', 'notion'],
        'result': ['result', 'outcome', 'output'],
        'problem': ['problem', 'issue', 'challenge'],
        'solution': ['solution', 'approach', 'fix'],
        'tool': ['tool', 'utility', 'app'],
        'method': ['method', 'approach', 'technique'],
        'example': ['example', 'sample', 'instance'],
        'feature': ['feature', 'capability', 'function'],
        'platform': ['platform', 'system', 'service'],
        'workflow': ['workflow', 'process', 'routine'],

        // adverbs
        'really': ['really', 'truly', 'genuinely'],
        'very': ['very', 'highly', 'extremely'],
        'often': ['often', 'frequently', 'regularly'],
        'also': ['also', 'too'],
        'basically': ['basically', 'pretty much'],
    };

    const SPIN_STOPWORDS = new Set([
        'a','an','the','and','or','but','if','then','else','when','while','as','at','by','for','from','in','into','of','on','onto','to','up','down','with','without',
        'is','am','are','was','were','be','been','being','do','does','did','done','doing','have','has','had','having',
        'i','you','he','she','it','we','they','me','him','her','us','them','my','your','his','its','our','their',
        'this','that','these','those','there','here','who','whom','which','what','why','how',
        'not','no','yes','can','could','should','would','will','just','than','too','so'
    ]);

    function clamp01(n) {
        const x = Number(n);
        if (!Number.isFinite(x)) return 0;
        return Math.max(0, Math.min(1, x));
    }

    function mulberry32(seed) {
        let t = seed >>> 0;
        return function() {
            t += 0x6D2B79F5;
            let r = Math.imul(t ^ (t >>> 15), 1 | t);
            r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
            return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
        };
    }

    function hashStringToSeed(str) {
        // FNV-1a 32-bit
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return h >>> 0;
    }

    function matchCasing(fromWord, toWord) {
        if (!fromWord) return toWord;
        if (fromWord.toUpperCase() === fromWord) return toWord.toUpperCase();
        if (fromWord[0] && fromWord[0].toUpperCase() === fromWord[0] && fromWord.slice(1).toLowerCase() === fromWord.slice(1)) {
            return toWord[0].toUpperCase() + toWord.slice(1);
        }
        return toWord;
    }

    function pick(rng, arr) {
        return arr[Math.floor(rng() * arr.length)];
    }

    function applyNaturalVariations(text, opts, rng) {
        if (!opts.naturalVariations) return { text, count: 0 };
        const intensity = clamp01(opts.naturalIntensity);
        if (intensity <= 0) return { text, count: 0 };

        let out = text;
        let count = 0;

        // Phrase rewrites — every rule is *considered*; each occurrence is
        // rewritten with probability `intensity` so the result reads varied
        // but clearly more human at sane default intensities.
        for (const rule of NATURAL_PHRASES) {
            out = out.replace(rule.re, (m) => {
                if (rng() > intensity) return m;
                const repl = pick(rng, rule.to);
                count++;
                if (m && m[0] === m[0].toUpperCase()) {
                    return repl[0].toUpperCase() + repl.slice(1);
                }
                return repl;
            });
        }

        // Contractions
        for (const c of CONTRACTIONS) {
            out = out.replace(c.re, (m) => {
                if (rng() > intensity) return m;
                count++;
                return matchCasing(m, c.to);
            });
        }

        // Collapse doubled spaces left behind by rewrites
        const beforeSpace = out;
        out = out.replace(/ {2,}/g, ' ');
        if (out !== beforeSpace) {
            const matches = beforeSpace.match(/ {2,}/g);
            if (matches) count += matches.length;
        }

        // Deflate hype punctuation (!!), a strong machine-written tell
        const beforeHype = out;
        out = out.replace(/!{2,}/g, '!');
        if (out !== beforeHype) {
            const matches = beforeHype.match(/!{2,}/g);
            if (matches) count += matches.length;
        }

        // Fix doubled commas left when a rewrite replaces a connector that sat
// right before another clause (e.g. "This means that, ").
        const beforePunct = out;
        out = out.replace(/,{2,}/g, ',');
        if (out !== beforePunct) {
            const matches = beforePunct.match(/,{2,}/g);
            if (matches) count += matches.length;
        }

        return { text: out, count };
    }

    function spinWordsInText(text, opts, rng) {
        const intensity = clamp01(opts.spinIntensity);
        if (!opts.spinWords || intensity <= 0) return { text, count: 0 };

        // Tokenize into words, whitespace, punctuation.
        // Keep apostrophes inside words (don't -> don't)
        const tokens = text.match(/\p{L}+(?:['’ʼ]\p{L}+)*|\p{N}+|\s+|[^\s\p{L}\p{N}]+/gu) || [text];

        let count = 0;
        const out = tokens.map((tok) => {
            // Only consider word tokens that start with a letter
            if (!/^\p{L}/u.test(tok)) return tok;

            const lower = tok.toLowerCase();
            if (SPIN_STOPWORDS.has(lower)) return tok;
            if (lower.length < 4) return tok;

            const choices = SPIN_SYNONYMS[lower];
            if (!choices || choices.length === 0) return tok;

            // Avoid replacing with itself too often at higher intensities
            if (rng() > intensity) return tok;

            let replacement = pick(rng, choices);
            if (replacement.toLowerCase() === lower && choices.length > 1) {
                replacement = pick(rng, choices.filter(c => c.toLowerCase() !== lower));
            }

            if (!replacement) return tok;

            count++;
            return matchCasing(tok, replacement);
        });

        return { text: out.join(''), count };
    }

    /**
     * Humanize AI-generated text by removing common AI markers
     * @param {string} text - Input text to humanize
     * @param {Object} options - Transform options
     * @returns {Object} - Result with text and count of changes
     */
    function humanizeString(text, options) {
        if (typeof text !== 'string') {
            throw new Error('Input must be a string');
        }

        const useOptions = { ...DefaultOptions, ...(options || {}) };
        let count = 0;
        let resultText = text;

        // Define patterns for different transformations (matching original library)
        const patterns = [
            // Transform hidden symbols (expanded Unicode range)
            {
                condition: 'transformHidden',
                regex: new RegExp(`[${IGNORABLE_SYMBOLS}]`, 'g'),
                replacement: ''
            },
            // Transform trailing whitespace (includes tabs, form feeds)
            {
                condition: 'transformTrailingWhitespace',
                regex: /[ \t\x0B\f]+$/gm,
                replacement: ''
            },
            // Transform non-breaking spaces
            {
                condition: 'transformNbs',
                regex: /[\u00A0]/g,
                replacement: ' '
            },
            // Transform dashes (all types: em-dash, en-dash, figure dash)
            {
                condition: 'transformDashes',
                regex: /[���—–]/g,
                replacement: '-'
            },
            // Transform quotes (all curly quote types including guillemets)
            {
                condition: 'transformQuotes',
                regex: /[“”«»„]/g,
                replacement: '"'
            },
            // Transform apostrophes (all curly apostrophe types)
            {
                condition: 'transformQuotes',
                regex: /[‘’ʼ]/g,
                replacement: "'"
            },
            // Transform other symbols (ellipsis to three dots)
            {
                condition: 'transformOther',
                regex: /[…]/g,
                replacement: '...'
            }
        ];

        // Apply transformations
        for (const pattern of patterns) {
            if (useOptions[pattern.condition]) {
                const matches = resultText.match(pattern.regex);
                if (matches) {
                    count += matches.length;
                    resultText = resultText.replace(pattern.regex, pattern.replacement);
                }
            }
        }

        // Keyboard-only transformation (removes all non-keyboard typeable symbols)
        if (useOptions.keyboardOnly) {
            // Allow: letters, numbers, basic punctuation, whitespace, emojis
            const keyboardOnlyRegex = /[^\x20-\x7E\n\r\t\p{L}\p{N}\p{Emoji}\u00A0-\u00FF]/gu;
            const matches = resultText.match(keyboardOnlyRegex);
            if (matches) {
                count += matches.length;
                resultText = resultText.replace(keyboardOnlyRegex, '');
            }
        }

        // Hidden watermark removal (steganography / AI fingerprint stripping)
        if (useOptions.removeWatermarks) {
            const watermarkRegex = new RegExp(`[${WATERMARK_SYMBOLS}]`, 'gu');
            const matches = resultText.match(watermarkRegex);
            if (matches) {
                count += matches.length;
                resultText = resultText.replace(watermarkRegex, '');
            }
        }

        // Deterministic RNG per text so the same input yields the same output (reduces "flicker" in auto-process)
        const rng = mulberry32(hashStringToSeed(resultText));

        // Natural variations (reduces AI-esque phrasing)
        const natural = applyNaturalVariations(resultText, useOptions, rng);
        resultText = natural.text;
        count += natural.count;

        // Word spinning (runs after natural variations)
        const spun = spinWordsInText(resultText, useOptions, rng);
        resultText = spun.text;
        count += spun.count;

        return {
            text: resultText,
            count: count
        };
    }

    // Export to global scope
    if (typeof module !== 'undefined' && module.exports) {
        // Node.js
        module.exports = { humanizeString };
    } else {
        // Browser
        global.humanizeString = humanizeString;
    }

})(typeof window !== 'undefined' ? window : this);
