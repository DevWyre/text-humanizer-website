// DevWyre's Humanizer, Main JavaScript File
class TextHumanizer {
    constructor() {
        this.elements = this.initializeElements();
        this.state = {
            autoProcess: true,
            isProcessing: false,
            debounceTimer: null
        };
        
        this.initializeEventListeners();
        this.updateStats();
        this.initializeSpinUI();
        
        // Check if humanize-ai-lib is available
        if (typeof humanizeString === 'undefined') {
            this.showToast('Library not loaded. Please refresh the page.', 'error');
            console.error('humanize-ai-lib not found');
        }
    }
    
    initializeElements() {
        return {
            // Text areas
            inputText: document.getElementById('inputText'),
            outputText: document.getElementById('outputText'),
            
            // Buttons
            humanizeBtn: document.getElementById('humanizeBtn'),
            clearInput: document.getElementById('clearInput'),
            pasteInput: document.getElementById('pasteInput'),
            copyResult: document.getElementById('copyResult'),
            downloadResult: document.getElementById('downloadResult'),
            
            // Options
            transformHidden: document.getElementById('transformHidden'),
            transformTrailingWhitespace: document.getElementById('transformTrailingWhitespace'),
            transformNbs: document.getElementById('transformNbs'),
            transformDashes: document.getElementById('transformDashes'),
            transformQuotes: document.getElementById('transformQuotes'),
            transformOther: document.getElementById('transformOther'),
            naturalVariations: document.getElementById('naturalVariations'),
            keyboardOnly: document.getElementById('keyboardOnly'),
            autoProcess: document.getElementById('autoProcess'),

            // New: Spinning
            spinWords: document.getElementById('spinWords'),
            spinIntensity: document.getElementById('spinIntensity'),
            spinIntensityValue: document.getElementById('spinIntensityValue'),
            spinIntensityRow: document.getElementById('spinIntensityRow'),
            
            // Stats and indicators
            charCount: document.getElementById('charCount'),
            changeCount: document.getElementById('changeCount'),
            status: document.getElementById('status'),
            inputCharCount: document.getElementById('inputCharCount'),
            outputCharCount: document.getElementById('outputCharCount'),
            changesIndicator: document.getElementById('changesIndicator'),
            btnLoader: document.getElementById('btnLoader'),
            
            // Containers
            toastContainer: document.getElementById('toastContainer')
        };
    }

    initializeSpinUI() {
        if (!this.elements.spinWords || !this.elements.spinIntensity || !this.elements.spinIntensityValue || !this.elements.spinIntensityRow) {
            return;
        }

        const updateSpinIntensityLabel = () => {
            const pct = Number(this.elements.spinIntensity.value || 0);
            this.elements.spinIntensityValue.textContent = `${pct}%`;
        };

        const updateSpinRowVisibility = () => {
            const enabled = !!this.elements.spinWords.checked;
            this.elements.spinIntensityRow.style.display = enabled ? '' : 'none';
        };

        updateSpinIntensityLabel();
        updateSpinRowVisibility();

        this.elements.spinWords.addEventListener('change', () => {
            updateSpinRowVisibility();
        });

        this.elements.spinIntensity.addEventListener('input', () => {
            updateSpinIntensityLabel();
        });
    }
    
    initializeEventListeners() {
        // Text input events
        this.elements.inputText.addEventListener('input', () => {
            this.updateStats();
            if (this.state.autoProcess) {
                this.debounceProcess();
            }
        });
        
        this.elements.inputText.addEventListener('paste', () => {
            // Small delay to allow paste to complete
            setTimeout(() => {
                this.updateStats();
                if (this.state.autoProcess) {
                    this.debounceProcess();
                }
            }, 10);
        });
        
        // Button events
        this.elements.humanizeBtn.addEventListener('click', () => this.processText());
        this.elements.clearInput.addEventListener('click', () => this.clearInput());
        this.elements.pasteInput.addEventListener('click', () => this.pasteFromClipboard());
        this.elements.copyResult.addEventListener('click', () => this.copyToClipboard());
        this.elements.downloadResult.addEventListener('click', () => this.downloadResult());
        
        // Auto-process toggle
        this.elements.autoProcess.addEventListener('change', (e) => {
            this.state.autoProcess = e.target.checked;
            this.updateStatus(this.state.autoProcess ? 'Auto-processing enabled' : 'Manual processing');
            
            if (this.state.autoProcess && this.elements.inputText.value.trim()) {
                this.debounceProcess();
            }
        });
        
        // Option changes
        const optionElements = [
            this.elements.transformHidden,
            this.elements.transformTrailingWhitespace,
            this.elements.transformNbs,
            this.elements.transformDashes,
            this.elements.transformQuotes,
            this.elements.transformOther,
            this.elements.naturalVariations,
            this.elements.spinWords,
            this.elements.spinIntensity,
            this.elements.keyboardOnly
        ].filter(Boolean);
        
        optionElements.forEach(element => {
            element.addEventListener('change', () => {
                if (this.elements.inputText.value.trim()) {
                    if (this.state.autoProcess) {
                        this.debounceProcess();
                    } else {
                        this.processText();
                    }
                }
            });
        });

        // Range should re-process while sliding
        if (this.elements.spinIntensity) {
            this.elements.spinIntensity.addEventListener('input', () => {
                if (this.elements.inputText.value.trim()) {
                    if (this.state.autoProcess) {
                        this.debounceProcess();
                    }
                }
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'Enter':
                        e.preventDefault();
                        this.processText();
                        break;
                    case 'k':
                        e.preventDefault();
                        this.clearInput();
                        break;
                }
            }
        });
    }
    
    debounceProcess() {
        clearTimeout(this.state.debounceTimer);
        this.state.debounceTimer = setTimeout(() => {
            this.processText();
        }, 500);
    }
    
    async processText() {
        const inputText = this.elements.inputText.value.trim();
        
        if (!inputText) {
            this.showToast('Please enter some text to humanize', 'error');
            return;
        }
        
        if (this.state.isProcessing) {
            return;
        }
        
        this.state.isProcessing = true;
        this.setLoadingState(true);
        this.updateStatus('Processing...');
        
        try {
            // Get options
            const options = this.getOptions();
            
            // Check if humanizeString is available
            if (typeof humanizeString === 'undefined') {
                throw new Error('humanize-ai-lib not loaded');
            }
            
            // Process text
            const result = humanizeString(inputText, options);
            
            // Update output.
            // NOTE: The previous word-by-word highlighter compared mismatched token arrays
            // (because transformations can insert/remove characters), which caused nearly
            // everything to be wrapped in <mark>. That made the output look "weird" even
            // when the underlying transforms (hidden symbols/ellipsis/etc) were correct.
            //
            // Keep the output clean and readable by default.
            this.elements.outputText.value = result.text;
            this.elements.changeCount.textContent = result.count;
            this.elements.outputCharCount.textContent = `${result.text.length} characters`;
            
            // Update changes indicator
            if (result.count > 0) {
                this.elements.changesIndicator.textContent = `${result.count} changes made`;
                this.elements.changesIndicator.style.color = 'var(--color-success)';
            } else {
                this.elements.changesIndicator.textContent = 'No changes needed';
                this.elements.changesIndicator.style.color = 'var(--color-text-muted)';
            }
            
            this.updateStatus('Complete');
            
            if (!this.state.autoProcess) {
                this.showToast(`Text processed successfully! ${result.count} changes made.`, 'success');
            }
            
        } catch (error) {
            console.error('Processing error:', error);
            this.showToast('Error processing text. Please try again.', 'error');
            this.updateStatus('Error');
        } finally {
            this.state.isProcessing = false;
            this.setLoadingState(false);
        }
    }
    
    getOptions() {
        const intensityPct = this.elements.spinIntensity ? Number(this.elements.spinIntensity.value || 0) : 0;

        return {
            transformHidden: this.elements.transformHidden.checked,
            transformTrailingWhitespace: this.elements.transformTrailingWhitespace.checked,
            transformNbs: this.elements.transformNbs.checked,
            transformDashes: this.elements.transformDashes.checked,
            transformQuotes: this.elements.transformQuotes.checked,
            transformOther: this.elements.transformOther.checked,
            naturalVariations: this.elements.naturalVariations.checked,
            keyboardOnly: this.elements.keyboardOnly.checked,

            // New
            spinWords: this.elements.spinWords ? this.elements.spinWords.checked : false,
            spinIntensity: intensityPct / 100
        };
    }
    
    clearInput() {
        this.elements.inputText.value = '';
        this.elements.outputText.value = '';
        this.state.lastProcessedText = '';
        this.updateStats();
        this.elements.changesIndicator.textContent = '';
        this.updateStatus('Ready');
        this.elements.inputText.focus();
        this.showToast('Input cleared', 'info');
    }
    
    async pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                this.elements.inputText.value = text;
                this.updateStats();
                if (this.state.autoProcess) {
                    this.debounceProcess();
                }
                this.showToast('Text pasted from clipboard', 'success');
            }
        } catch (error) {
            console.error('Paste error:', error);
            this.showToast('Unable to paste from clipboard', 'error');
        }
    }
    
    async copyToClipboard() {
        const outputText = (this.elements.outputText.value || '').trimEnd();

        if (!outputText) {
            this.showToast('No text to copy', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(outputText);
            this.showToast('Text copied to clipboard!', 'success');
        } catch (error) {
            console.error('Copy error:', error);
            // Fallback for older browsers
            this.elements.outputText.focus();
            this.elements.outputText.select();
            document.execCommand('copy');
            this.showToast('Text copied to clipboard!', 'success');
        }
    }
    
    downloadResult() {
        const outputText = (this.elements.outputText.value || '').trimEnd();

        if (!outputText) {
            this.showToast('No text to download', 'error');
            return;
        }

        const blob = new Blob([outputText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `devwyre-humanize-text-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Text file downloaded!', 'success');
    }
    
    updateStats() {
        const inputLength = this.elements.inputText.value.length;
        this.elements.charCount.textContent = inputLength;
        this.elements.inputCharCount.textContent = `${inputLength} characters`;
        
        if (inputLength === 0) {
            this.elements.outputCharCount.textContent = '0 characters';
            this.elements.changeCount.textContent = '0';
            this.elements.changesIndicator.textContent = '';
        }
    }
    
    updateStatus(status) {
        this.elements.status.textContent = status;
    }
    
    setLoadingState(loading) {
        if (loading) {
            this.elements.humanizeBtn.classList.add('loading');
            this.elements.humanizeBtn.disabled = true;
        } else {
            this.elements.humanizeBtn.classList.remove('loading');
            this.elements.humanizeBtn.disabled = false;
        }
    }
    
    showToast(message, type = 'info') {
        const maxLength = 50;
        const displayMessage = message.length > maxLength
            ? message.substring(0, maxLength) + '...'
            : message;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = displayMessage;
        
        this.elements.toastContainer.appendChild(toast);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOut 0.25s ease-out forwards';
                setTimeout(() => {
                    if (toast.parentNode) {
                        this.elements.toastContainer.removeChild(toast);
                    }
                }, 250);
            }
        }, 3000);
    }
}

// Utility functions for demo text
const demoTexts = {
    aiGenerated: `Welcome to our revolutionary platform! We're thrilled to announce that our cutting-edge AI technology has been meticulously designed to transform the way you approach content creation.

Our innovative solution leverages state-of-the-art algorithms to deliver unparalleled results that will exceed your expectations. With our comprehensive suite of tools, you'll be able to streamline your workflow and achieve remarkable outcomes.

"This is absolutely game-changing," said one of our satisfied customers. "I've never seen anything quite like this before."

The platform offers:
• Advanced machine learning capabilities
• Seamless integration with existing systems  
• Real-time analytics and insights...
• 24/7 customer support

Don't miss out on this incredible opportunity to revolutionize your business processes. Join thousands of satisfied customers who have already experienced the transformative power of our solution.`,

    withMarkers: `"Smart quotes and em-dashes — these are common AI markers that make text look artificial," explained the researcher. 

The study found that AI-generated content often contains:
• Fancy quotation marks "like these"
• Em-dashes — instead of regular hyphens
• Ellipsis symbols… rather than three dots
• Non-breaking spaces and hidden Unicode characters
• Trailing whitespace at line ends   

"These subtle markers can be detected by both humans and algorithms," the expert noted. "Removing them makes text appear more natural and human-written."`
};

// Add demo text functionality
function addDemoTextButtons() {
    // try to inject into dedicated action-section if present, else fall back to sidebar
    let container = document.querySelector('.action-section');
    if (!container) {
        container = document.querySelector('.sidebar');
    }
    if (!container) return;
    
    const demoSection = document.createElement('div');
    demoSection.className = 'demo-section';
    demoSection.style.marginTop = 'var(--spacing-lg)';
    
    const demoTitle = document.createElement('p');
    demoTitle.textContent = 'Try with sample text:';
    demoTitle.style.color = 'var(--color-text-muted)';
    demoTitle.style.fontSize = '0.875rem';
    demoTitle.style.marginBottom = 'var(--spacing-sm)';
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = 'var(--spacing-sm)';
    buttonContainer.style.justifyContent = 'center';
    buttonContainer.style.flexWrap = 'wrap';
    
    // Create demo buttons
    Object.entries(demoTexts).forEach(([key, text]) => {
        const button = document.createElement('button');
        button.textContent = key === 'aiGenerated' ? 'AI-Generated Text' : 'Text with Markers';
        button.className = 'demo-btn';
        button.style.cssText = `
            padding: var(--spacing-sm) var(--spacing-md);
            background: transparent;
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            color: var(--color-text-muted);
            font-size: 0.75rem;
            cursor: pointer;
            transition: all var(--transition-fast);
        `;
        
        button.addEventListener('mouseenter', () => {
            button.style.borderColor = 'var(--color-accent)';
            button.style.color = 'var(--color-accent)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.borderColor = 'var(--color-border)';
            button.style.color = 'var(--color-text-muted)';
        });
        
        button.addEventListener('click', () => {
            const inputText = document.getElementById('inputText');
            if (inputText) {
                inputText.value = text;
                inputText.dispatchEvent(new Event('input'));
                inputText.focus();
            }
        });
        
        buttonContainer.appendChild(button);
    });
    
    demoSection.appendChild(demoTitle);
    demoSection.appendChild(buttonContainer);
    actionSection.appendChild(demoSection);
}

// Add slideOut animation to CSS
const style = document.createElement('style');
style.textContent = `
@keyframes slideOut {
    to {
        transform: translateX(100%);
        opacity: 0;
    }
}
`;
document.head.appendChild(style);

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize main application
    const app = new TextHumanizer();
    
    // Add demo text buttons
    addDemoTextButtons();
    
    // Add some initial guidance
    setTimeout(() => {
        app.showToast('Welcome to DevWyre\'s Humanizer');
    }, 1000);
    
    // Make app globally available for debugging
    window.textHumanizer = app;
});
