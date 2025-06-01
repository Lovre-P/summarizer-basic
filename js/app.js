/**
 * Main Application - Initializes and coordinates all modules
 */
class App {
    constructor() {
        this.storage = null;
        this.geminiProcessor = null;
        this.contentProcessor = null;
        this.ttsManager = null;
        this.uiManager = null;
        this.isInitialized = false;
    }

    async init() {
        try {
            console.log('Initializing Content Summarizer...');
            
            // Initialize storage first
            this.storage = new StorageManager();
            await this.storage.init();
            window.storage = this.storage;
            console.log('✓ Storage initialized');

            // Initialize Gemini processor
            this.geminiProcessor = new GeminiProcessor();
            await this.geminiProcessor.init();
            window.geminiProcessor = this.geminiProcessor;
            console.log('✓ Gemini processor initialized');

            // Initialize content processor
            this.contentProcessor = new ContentProcessor();
            window.contentProcessor = this.contentProcessor;
            console.log('✓ Content processor initialized');

            // Initialize TTS manager
            this.ttsManager = new TTSManager();
            await this.ttsManager.init();
            window.ttsManager = this.ttsManager;
            console.log('✓ TTS manager initialized');

            // Set up TTS callbacks
            this.ttsManager.setProgressCallback((progress) => {
                this.updateProgress(progress);
            });

            this.ttsManager.setPlaybackCallback((event) => {
                this.handlePlaybackEvent(event);
            });

            // Initialize UI manager
            this.uiManager = new UIManager();
            this.uiManager.init();
            window.uiManager = this.uiManager;
            console.log('✓ UI manager initialized');

            // Load saved settings
            await this.loadSettings();

            // Handle shared content if present
            await this.handleSharedContent();

            // Hide loading screen and show app
            this.showApp();

            this.isInitialized = true;
            console.log('✓ App initialization complete');

        } catch (error) {
            console.error('App initialization failed:', error);
            this.showError('Failed to initialize app: ' + error.message);
        }
    }

    async loadSettings() {
        try {
            // Load TTS settings
            const ttsSettings = {
                voice_rate: await this.storage.getSetting('voice_rate', 1.0),
                voice_pitch: await this.storage.getSetting('voice_pitch', 1.0),
                voice_index: await this.storage.getSetting('voice_index', 0),
                auto_play_next: await this.storage.getSetting('auto_play_next', true)
            };

            this.ttsManager.loadSettings(ttsSettings);

            // Load other app settings
            const showNotifications = await this.storage.getSetting('show_notifications', true);
            if (showNotifications && 'Notification' in window) {
                Notification.requestPermission();
            }

        } catch (error) {
            console.warn('Error loading settings:', error);
        }
    }

    async saveSettings() {
        try {
            if (this.ttsManager) {
                const settings = this.ttsManager.getSettings();
                await this.storage.saveSetting('voice_rate', settings.rate);
                await this.storage.saveSetting('voice_pitch', settings.pitch);
                await this.storage.saveSetting('voice_index', settings.voiceIndex);
                await this.storage.saveSetting('auto_play_next', settings.autoPlayNext);
            }
        } catch (error) {
            console.warn('Error saving settings:', error);
        }
    }

    async handleSharedContent() {
        try {
            // Check URL parameters for shared content
            const urlParams = new URLSearchParams(window.location.search);
            const sharedUrl = urlParams.get('url') || urlParams.get('text');
            
            if (sharedUrl) {
                console.log('Handling shared content:', sharedUrl);
                
                // Clear URL parameters
                window.history.replaceState({}, document.title, window.location.pathname);
                
                // Process the shared URL
                setTimeout(() => {
                    if (this.uiManager) {
                        document.getElementById('url-input').value = sharedUrl;
                        this.uiManager.showModal('url-modal');
                    }
                }, 1000);
            }

            // Handle shortcuts
            const action = urlParams.get('action');
            const page = urlParams.get('page');
            
            if (action === 'add-article') {
                setTimeout(() => {
                    if (this.uiManager) {
                        this.uiManager.showModal('url-modal');
                    }
                }, 1000);
            } else if (page === 'player') {
                setTimeout(() => {
                    if (this.uiManager) {
                        this.uiManager.showPage('player');
                    }
                }, 1000);
            }

        } catch (error) {
            console.warn('Error handling shared content:', error);
        }
    }

    updateProgress(progress) {
        const progressFill = document.getElementById('progress-fill');
        const currentTime = document.getElementById('current-time');
        const totalTime = document.getElementById('total-time');

        if (progressFill) {
            progressFill.style.width = `${progress.progress * 100}%`;
        }

        if (currentTime && this.ttsManager) {
            currentTime.textContent = this.ttsManager.formatTime(progress.elapsed);
        }

        if (totalTime && this.ttsManager) {
            totalTime.textContent = this.ttsManager.formatTime(progress.duration);
        }
    }

    handlePlaybackEvent(event) {
        console.log('Playback event:', event);

        switch (event.type) {
            case 'start':
                this.onPlaybackStart(event);
                break;
            case 'end':
                this.onPlaybackEnd(event);
                break;
            case 'pause':
                this.onPlaybackPause(event);
                break;
            case 'resume':
                this.onPlaybackResume(event);
                break;
            case 'error':
                this.onPlaybackError(event);
                break;
            case 'playlist_complete':
                this.onPlaylistComplete(event);
                break;
        }

        // Update UI
        if (this.uiManager) {
            this.uiManager.updatePlayerUI();
        }
    }

    onPlaybackStart(event) {
        console.log('Playback started:', event.title);
        
        // Show notification if enabled
        this.showNotification('Now Playing', event.title);
        
        // Update document title
        document.title = `Playing: ${event.title} - Content Summarizer`;
    }

    onPlaybackEnd(event) {
        console.log('Playback ended');
        
        // Reset document title
        document.title = 'Content Summarizer';
    }

    onPlaybackPause(event) {
        console.log('Playback paused');
        document.title = 'Paused - Content Summarizer';
    }

    onPlaybackResume(event) {
        console.log('Playback resumed');
        const currentItem = this.ttsManager.getCurrentItem();
        if (currentItem) {
            document.title = `Playing: ${currentItem.title} - Content Summarizer`;
        }
    }

    onPlaybackError(event) {
        console.error('Playback error:', event.error);
        if (this.uiManager) {
            this.uiManager.showToast(`Playback error: ${event.error}`, 'error');
        }
    }

    onPlaylistComplete(event) {
        console.log('Playlist complete');
        document.title = 'Content Summarizer';
        
        if (this.uiManager) {
            this.uiManager.showToast('Playlist complete', 'success');
        }
        
        this.showNotification('Playlist Complete', 'All summaries have been played');
    }

    async showNotification(title, body) {
        try {
            const showNotifications = await this.storage.getSetting('show_notifications', true);
            
            if (showNotifications && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(title, {
                    body: body,
                    icon: 'icons/icon-192.png',
                    badge: 'icons/icon-192.png',
                    tag: 'content-summarizer'
                });
            }
        } catch (error) {
            console.warn('Error showing notification:', error);
        }
    }

    showApp() {
        const loadingScreen = document.getElementById('loading-screen');
        const mainApp = document.getElementById('main-app');
        
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
        
        if (mainApp) {
            mainApp.classList.remove('hidden');
        }
    }

    showError(message) {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.innerHTML = `
                <div style="text-align: center; color: var(--error-color);">
                    <h3>Error</h3>
                    <p>${message}</p>
                    <button onclick="location.reload()" class="btn-primary" style="margin-top: 20px;">
                        Reload App
                    </button>
                </div>
            `;
        }
    }

    // Handle app lifecycle events
    onBeforeUnload() {
        // Save settings before unload
        this.saveSettings();
        
        // Stop any ongoing speech
        if (this.ttsManager && this.ttsManager.isCurrentlyPlaying()) {
            this.ttsManager.stop();
        }
    }

    onVisibilityChange() {
        if (document.hidden) {
            // App is hidden, save settings
            this.saveSettings();
        }
    }

    onOnline() {
        console.log('App is online');
        if (this.uiManager) {
            this.uiManager.showToast('Connection restored', 'success');
        }
    }

    onOffline() {
        console.log('App is offline');
        if (this.uiManager) {
            this.uiManager.showToast('App is offline - some features may not work', 'warning');
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    window.app = new App();
    await window.app.init();
});

// Handle app lifecycle events
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.onBeforeUnload();
    }
});

document.addEventListener('visibilitychange', () => {
    if (window.app) {
        window.app.onVisibilityChange();
    }
});

window.addEventListener('online', () => {
    if (window.app) {
        window.app.onOnline();
    }
});

window.addEventListener('offline', () => {
    if (window.app) {
        window.app.onOffline();
    }
});

// Handle unhandled errors
window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
    if (window.app && window.app.uiManager) {
        window.app.uiManager.showToast('An unexpected error occurred', 'error');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.app && window.app.uiManager) {
        window.app.uiManager.showToast('An unexpected error occurred', 'error');
    }
});

// Export app for debugging
window.App = App;
