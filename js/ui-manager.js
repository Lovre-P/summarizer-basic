/**
 * UI Manager - Handles user interface interactions and updates
 */
class UIManager {
    constructor() {
        this.currentPage = 'home';
        this.modals = {};
        this.toastContainer = null;
    }

    init() {
        this.setupEventListeners();
        this.setupModals();
        this.toastContainer = document.getElementById('toast-container');
        this.showPage('home');
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.showPage(page);
            });
        });

        // Add URL buttons
        document.getElementById('add-url-btn').addEventListener('click', () => {
            this.showModal('url-modal');
        });

        document.getElementById('add-first-url').addEventListener('click', () => {
            this.showModal('url-modal');
        });

        // URL Modal
        document.getElementById('close-modal').addEventListener('click', () => {
            this.hideModal('url-modal');
        });

        document.getElementById('cancel-url').addEventListener('click', () => {
            this.hideModal('url-modal');
        });

        document.getElementById('process-url').addEventListener('click', () => {
            this.handleUrlSubmission();
        });

        // URL input enter key
        document.getElementById('url-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleUrlSubmission();
            }
        });

        // Settings
        document.getElementById('save-api-key').addEventListener('click', () => {
            this.handleApiKeySave();
        });

        document.getElementById('toggle-api-key').addEventListener('click', () => {
            this.toggleApiKeyVisibility();
        });

        document.getElementById('test-voice').addEventListener('click', () => {
            if (window.ttsManager) {
                window.ttsManager.testVoice();
            }
        });

        document.getElementById('clear-data').addEventListener('click', () => {
            this.handleClearData();
        });

        // Voice settings
        document.getElementById('speed-range').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('speed-value').textContent = value.toFixed(1) + 'x';
            if (window.ttsManager) {
                window.ttsManager.setRate(value);
            }
        });

        document.getElementById('pitch-range').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('pitch-value').textContent = value.toFixed(1);
            if (window.ttsManager) {
                window.ttsManager.setPitch(value);
            }
        });

        document.getElementById('voice-select').addEventListener('change', (e) => {
            const voiceIndex = parseInt(e.target.value);
            if (window.ttsManager && !isNaN(voiceIndex)) {
                window.ttsManager.setVoice(voiceIndex);
            }
        });

        document.getElementById('auto-play-next').addEventListener('change', (e) => {
            if (window.ttsManager) {
                window.ttsManager.setAutoPlayNext(e.target.checked);
            }
        });

        // Player controls
        document.getElementById('play-pause-btn').addEventListener('click', () => {
            this.handlePlayPause();
        });

        document.getElementById('prev-btn').addEventListener('click', () => {
            if (window.ttsManager) {
                window.ttsManager.playPrevious();
            }
        });

        document.getElementById('next-btn').addEventListener('click', () => {
            if (window.ttsManager) {
                window.ttsManager.playNext();
            }
        });

        // Modal backdrop clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideAllModals();
            }
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAllModals();
            }
        });
    }

    setupModals() {
        this.modals = {
            'url-modal': document.getElementById('url-modal'),
            'processing-modal': document.getElementById('processing-modal')
        };
    }

    showPage(pageName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageName);
        });

        // Update pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.toggle('active', page.id === `${pageName}-page`);
        });

        // Update page title
        const titles = {
            'home': 'My Summaries',
            'player': 'Player',
            'settings': 'Settings'
        };
        document.getElementById('page-title').textContent = titles[pageName] || 'Content Summarizer';

        this.currentPage = pageName;

        // Load page-specific content
        if (pageName === 'home') {
            this.loadSummaries();
        } else if (pageName === 'player') {
            this.updatePlayerUI();
        } else if (pageName === 'settings') {
            this.loadSettings();
        }
    }

    showModal(modalId) {
        const modal = this.modals[modalId];
        if (modal) {
            modal.classList.remove('hidden');
            
            // Focus first input if available
            const firstInput = modal.querySelector('input, textarea, select');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    hideModal(modalId) {
        const modal = this.modals[modalId];
        if (modal) {
            modal.classList.add('hidden');
            
            // Clear form data
            if (modalId === 'url-modal') {
                document.getElementById('url-input').value = '';
                document.getElementById('url-error').classList.add('hidden');
            }
        }
    }

    hideAllModals() {
        Object.keys(this.modals).forEach(modalId => {
            this.hideModal(modalId);
        });
    }

    async handleUrlSubmission() {
        const urlInput = document.getElementById('url-input');
        const errorDiv = document.getElementById('url-error');
        const url = urlInput.value.trim();

        if (!url) {
            this.showError(errorDiv, 'Please enter a URL');
            return;
        }

        // Check if URL already exists
        if (window.storage) {
            const exists = await window.storage.checkUrlExists(url);
            if (exists) {
                this.showError(errorDiv, 'This URL has already been processed');
                return;
            }
        }

        this.hideModal('url-modal');
        this.showProcessingModal('Processing URL...', 'Extracting content...');

        try {
            // Process the URL
            const result = await window.contentProcessor.processUrl(url);
            
            if (!result.success) {
                if (result.requiresManualInput) {
                    this.hideModal('processing-modal');
                    this.handleManualContentInput(url, result.errors);
                    return;
                }
                throw new Error(result.error);
            }

            // Update processing status
            this.updateProcessingModal('Generating Summary...', 'Using AI to create summary...');

            // Generate summary
            const summaryResult = await window.geminiProcessor.summarizeContent(result);
            
            if (!summaryResult.success) {
                throw new Error(summaryResult.error);
            }

            // Save to storage
            const summaryData = {
                url: result.url,
                title: result.title,
                type: result.type,
                originalContent: result.content,
                summary: summaryResult.summary,
                thumbnail: result.thumbnail,
                source: result.source
            };

            const savedSummary = await window.storage.saveSummary(summaryData);
            
            this.hideModal('processing-modal');
            this.showToast('Summary created successfully!', 'success');
            
            // Refresh summaries if on home page
            if (this.currentPage === 'home') {
                this.loadSummaries();
            }

        } catch (error) {
            this.hideModal('processing-modal');
            this.showToast(`Error: ${error.message}`, 'error');
        }
    }

    handleManualContentInput(url, errors) {
        // Create manual input modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Manual Content Input</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <p>Unable to automatically extract content from: <strong>${url}</strong></p>
                    <p>Please copy and paste the article text below:</p>
                    <textarea id="manual-content" rows="10" placeholder="Paste article content here..."></textarea>
                    <div class="error-details" style="margin-top: 10px; font-size: 0.8em; color: var(--text-secondary);">
                        <details>
                            <summary>Error details</summary>
                            <ul>
                                ${errors.map(error => `<li>${error}</li>`).join('')}
                            </ul>
                        </details>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="btn-primary" onclick="window.uiManager.processManualContent('${url}')">Process Content</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.querySelector('#manual-content').focus(), 100);
    }

    async processManualContent(url) {
        const textarea = document.getElementById('manual-content');
        const content = textarea.value.trim();
        
        if (content.length < 100) {
            this.showToast('Please provide at least 100 characters of content', 'error');
            return;
        }

        // Remove the manual input modal
        textarea.closest('.modal').remove();
        
        this.showProcessingModal('Processing Content...', 'Generating summary...');

        try {
            const result = await window.contentProcessor.processManualContent(url, content);
            
            if (!result.success) {
                throw new Error(result.error);
            }

            const summaryResult = await window.geminiProcessor.summarizeContent(result);
            
            if (!summaryResult.success) {
                throw new Error(summaryResult.error);
            }

            const summaryData = {
                url: result.url,
                title: result.title,
                type: result.type,
                originalContent: result.content,
                summary: summaryResult.summary
            };

            await window.storage.saveSummary(summaryData);
            
            this.hideModal('processing-modal');
            this.showToast('Summary created successfully!', 'success');
            
            if (this.currentPage === 'home') {
                this.loadSummaries();
            }

        } catch (error) {
            this.hideModal('processing-modal');
            this.showToast(`Error: ${error.message}`, 'error');
        }
    }

    showProcessingModal(title, message) {
        document.getElementById('processing-title').textContent = title;
        document.getElementById('processing-message').textContent = message;
        this.showModal('processing-modal');
    }

    updateProcessingModal(title, message) {
        document.getElementById('processing-title').textContent = title;
        document.getElementById('processing-message').textContent = message;
    }

    async loadSummaries() {
        const summariesList = document.getElementById('summaries-list');
        const emptyState = document.getElementById('empty-state');
        
        try {
            const summaries = await window.storage.getAllSummaries();
            
            if (summaries.length === 0) {
                summariesList.innerHTML = '';
                emptyState.style.display = 'block';
            } else {
                emptyState.style.display = 'none';
                this.renderSummaries(summaries);
            }
        } catch (error) {
            console.error('Error loading summaries:', error);
            this.showToast('Error loading summaries', 'error');
        }
    }

    renderSummaries(summaries) {
        const summariesList = document.getElementById('summaries-list');
        
        summariesList.innerHTML = summaries.map(summary => `
            <div class="summary-card" data-id="${summary.id}">
                <div class="summary-header">
                    <div class="summary-icon">
                        ${summary.type === 'video' ? 
                            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5,3 19,12 5,21"></polygon></svg>' :
                            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline></svg>'
                        }
                    </div>
                    <div class="summary-info">
                        <h3 class="summary-title">${summary.title}</h3>
                        <div class="summary-meta">
                            <span class="summary-type">${summary.type}</span>
                            <span>${window.storage.formatDate(new Date(summary.dateAdded))}</span>
                            <span>${window.storage.formatDuration(summary.estimatedDuration)}</span>
                        </div>
                    </div>
                </div>
                <div class="summary-content">${summary.summary}</div>
                <div class="summary-actions">
                    <button class="btn-primary btn-small" onclick="window.uiManager.playSummary(${summary.id})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="5,3 19,12 5,21"></polygon>
                        </svg>
                        Play
                    </button>
                    <button class="btn-secondary btn-small" onclick="window.uiManager.viewSummary(${summary.id})">View</button>
                    <button class="btn-secondary btn-small" onclick="window.uiManager.deleteSummary(${summary.id})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    async playSummary(id) {
        try {
            const summary = await window.storage.getSummary(id);
            if (summary && window.ttsManager) {
                window.ttsManager.playPlaylist([summary], 0);
                this.showPage('player');
            }
        } catch (error) {
            this.showToast('Error playing summary', 'error');
        }
    }

    async viewSummary(id) {
        try {
            const summary = await window.storage.getSummary(id);
            if (summary) {
                // Create view modal
                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.innerHTML = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>${summary.title}</h3>
                            <button class="close-btn" onclick="this.closest('.modal').remove()">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div class="modal-body">
                            <p><strong>Source:</strong> <a href="${summary.url}" target="_blank">${summary.url}</a></p>
                            <p><strong>Type:</strong> ${summary.type}</p>
                            <p><strong>Added:</strong> ${window.storage.formatDate(new Date(summary.dateAdded))}</p>
                            <p><strong>Duration:</strong> ${window.storage.formatDuration(summary.estimatedDuration)}</p>
                            <hr>
                            <h4>Summary:</h4>
                            <div style="max-height: 300px; overflow-y: auto; padding: 10px; background: var(--surface-color); border-radius: 4px;">
                                ${summary.summary.replace(/\n/g, '<br>')}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn-primary" onclick="window.uiManager.playSummary(${summary.id}); this.closest('.modal').remove();">Play</button>
                            <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }
        } catch (error) {
            this.showToast('Error viewing summary', 'error');
        }
    }

    async deleteSummary(id) {
        if (confirm('Are you sure you want to delete this summary?')) {
            try {
                await window.storage.deleteSummary(id);
                this.showToast('Summary deleted', 'success');
                this.loadSummaries();
            } catch (error) {
                this.showToast('Error deleting summary', 'error');
            }
        }
    }

    showError(element, message) {
        element.textContent = message;
        element.classList.remove('hidden');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        this.toastContainer.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
        
        // Click to dismiss
        toast.addEventListener('click', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }

    toggleApiKeyVisibility() {
        const input = document.getElementById('api-key-input');
        const button = document.getElementById('toggle-api-key');
        
        if (input.type === 'password') {
            input.type = 'text';
            button.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
            `;
        } else {
            input.type = 'password';
            button.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            `;
        }
    }

    async handleApiKeySave() {
        const input = document.getElementById('api-key-input');
        const apiKey = input.value.trim();
        
        if (!apiKey) {
            this.showToast('Please enter an API key', 'error');
            return;
        }

        try {
            // Test the API key
            const testResult = await window.geminiProcessor.testApiKey(apiKey);
            
            if (testResult.success) {
                // Save the API key
                await window.storage.saveSetting('gemini_api_key', apiKey);
                window.geminiProcessor.setApiKey(apiKey);
                
                this.showToast('API key saved successfully!', 'success');
            } else {
                this.showToast(`API key test failed: ${testResult.error}`, 'error');
            }
        } catch (error) {
            this.showToast(`Error saving API key: ${error.message}`, 'error');
        }
    }

    async handleClearData() {
        if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            try {
                await window.storage.clearAllData();
                this.showToast('All data cleared', 'success');
                this.loadSummaries();
            } catch (error) {
                this.showToast('Error clearing data', 'error');
            }
        }
    }

    handlePlayPause() {
        if (!window.ttsManager) return;
        
        if (window.ttsManager.isCurrentlyPlaying()) {
            if (window.ttsManager.isCurrentlyPaused()) {
                window.ttsManager.resume();
            } else {
                window.ttsManager.pause();
            }
        } else {
            // Start playing all summaries
            this.playAllSummaries();
        }
    }

    async playAllSummaries() {
        try {
            const summaries = await window.storage.getAllSummaries();
            if (summaries.length > 0 && window.ttsManager) {
                window.ttsManager.playPlaylist(summaries, 0);
            }
        } catch (error) {
            this.showToast('Error loading summaries for playback', 'error');
        }
    }

    updatePlayerUI() {
        if (!window.ttsManager) return;
        
        const currentItem = window.ttsManager.getCurrentItem();
        const playlist = window.ttsManager.getPlaylist();
        
        // Update now playing
        const titleElement = document.getElementById('current-title');
        const sourceElement = document.getElementById('current-source');
        
        if (currentItem) {
            titleElement.textContent = currentItem.title;
            sourceElement.textContent = currentItem.source || 'Unknown source';
        } else {
            titleElement.textContent = 'No content playing';
            sourceElement.textContent = 'Select content to play';
        }
        
        // Update play/pause button
        const playBtn = document.getElementById('play-pause-btn');
        const playIcon = document.getElementById('play-icon');
        const pauseIcon = document.getElementById('pause-icon');
        
        if (window.ttsManager.isCurrentlyPlaying() && !window.ttsManager.isCurrentlyPaused()) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
        
        // Update playlist
        this.updatePlaylist(playlist, window.ttsManager.getCurrentIndex());
    }

    updatePlaylist(playlist, currentIndex) {
        const playlistElement = document.getElementById('playlist');
        
        if (!playlist || playlist.length === 0) {
            playlistElement.innerHTML = '<p>No items in playlist</p>';
            return;
        }
        
        playlistElement.innerHTML = playlist.map((item, index) => `
            <div class="playlist-item ${index === currentIndex ? 'active' : ''}" onclick="window.ttsManager.skipToItem(${index})">
                <div class="playlist-icon">
                    ${item.type === 'video' ? 
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5,3 19,12 5,21"></polygon></svg>' :
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>'
                    }
                </div>
                <div class="playlist-info">
                    <div class="playlist-title">${item.title}</div>
                    <div class="playlist-meta">${item.source || 'Unknown'} • ${window.storage.formatDuration(item.estimatedDuration)}</div>
                </div>
            </div>
        `).join('');
    }

    async loadSettings() {
        try {
            // Load API key
            const apiKey = await window.storage.getSetting('gemini_api_key', '');
            document.getElementById('api-key-input').value = apiKey;
            
            // Load voice settings
            if (window.ttsManager) {
                const voices = window.ttsManager.getAvailableVoices();
                const voiceSelect = document.getElementById('voice-select');
                
                voiceSelect.innerHTML = voices.map((voice, index) => 
                    `<option value="${index}">${voice.name} (${voice.lang})</option>`
                ).join('');
                
                // Load saved settings
                const settings = await window.storage.getAllSettings();
                
                if (settings.voice_rate !== undefined) {
                    document.getElementById('speed-range').value = settings.voice_rate;
                    document.getElementById('speed-value').textContent = settings.voice_rate.toFixed(1) + 'x';
                    window.ttsManager.setRate(settings.voice_rate);
                }
                
                if (settings.voice_pitch !== undefined) {
                    document.getElementById('pitch-range').value = settings.voice_pitch;
                    document.getElementById('pitch-value').textContent = settings.voice_pitch.toFixed(1);
                    window.ttsManager.setPitch(settings.voice_pitch);
                }
                
                if (settings.voice_index !== undefined) {
                    voiceSelect.value = settings.voice_index;
                    window.ttsManager.setVoice(settings.voice_index);
                }
                
                if (settings.auto_play_next !== undefined) {
                    document.getElementById('auto-play-next').checked = settings.auto_play_next;
                    window.ttsManager.setAutoPlayNext(settings.auto_play_next);
                }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
}

// Export for use in other modules
window.UIManager = UIManager;
