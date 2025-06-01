/**
 * Text-to-Speech Manager - Handles speech synthesis and playlist functionality
 */
class TTSManager {
    constructor() {
        this.synth = window.speechSynthesis;
        this.currentUtterance = null;
        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.settings = {
            rate: 1.0,
            pitch: 1.0,
            voice: null,
            autoPlayNext: true
        };
        this.progressCallback = null;
        this.playbackCallback = null;
        this.currentText = '';
        this.currentPosition = 0;
        this.estimatedDuration = 0;
        this.startTime = 0;
    }

    async init() {
        // Wait for voices to load
        return new Promise((resolve) => {
            const voices = this.synth.getVoices();
            if (voices.length > 0) {
                this.selectDefaultVoice();
                resolve();
            } else {
                this.synth.onvoiceschanged = () => {
                    this.selectDefaultVoice();
                    resolve();
                };
            }
        });
    }

    selectDefaultVoice() {
        const voices = this.getAvailableVoices();
        if (voices.length > 0) {
            // Prefer English voices, then any voice
            const englishVoice = voices.find(voice => 
                voice.lang.startsWith('en') && voice.localService
            );
            this.settings.voice = englishVoice || voices[0];
        }
    }

    getAvailableVoices() {
        return this.synth.getVoices().filter(voice => 
            voice.lang.startsWith('en') || voice.lang === 'en'
        );
    }

    setVoice(voiceIndex) {
        const voices = this.getAvailableVoices();
        if (voiceIndex >= 0 && voiceIndex < voices.length) {
            this.settings.voice = voices[voiceIndex];
        }
    }

    setRate(rate) {
        this.settings.rate = Math.max(0.1, Math.min(10, rate));
    }

    setPitch(pitch) {
        this.settings.pitch = Math.max(0, Math.min(2, pitch));
    }

    setAutoPlayNext(enabled) {
        this.settings.autoPlayNext = enabled;
    }

    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    setPlaybackCallback(callback) {
        this.playbackCallback = callback;
    }

    speak(text, title = '', summary = null) {
        if (this.isPlaying) {
            this.stop();
        }

        this.currentText = text;
        this.currentPosition = 0;
        this.estimatedDuration = this.estimateReadingTime(text);
        this.startTime = Date.now();

        this.currentUtterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance.rate = this.settings.rate;
        this.currentUtterance.pitch = this.settings.pitch;
        this.currentUtterance.voice = this.settings.voice;

        // Set up event handlers
        this.currentUtterance.onstart = () => {
            this.isPlaying = true;
            this.isPaused = false;
            this.startProgressTracking();
            this.notifyPlaybackStart(title, summary);
        };

        this.currentUtterance.onend = () => {
            this.isPlaying = false;
            this.isPaused = false;
            this.stopProgressTracking();
            this.notifyPlaybackEnd();
            
            if (this.settings.autoPlayNext) {
                this.playNext();
            }
        };

        this.currentUtterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            this.isPlaying = false;
            this.isPaused = false;
            this.stopProgressTracking();
            this.notifyPlaybackError(event.error);
        };

        this.currentUtterance.onpause = () => {
            this.isPaused = true;
            this.stopProgressTracking();
            this.notifyPlaybackPause();
        };

        this.currentUtterance.onresume = () => {
            this.isPaused = false;
            this.startProgressTracking();
            this.notifyPlaybackResume();
        };

        // Start speaking
        this.synth.speak(this.currentUtterance);
    }

    pause() {
        if (this.isPlaying && !this.isPaused) {
            this.synth.pause();
        }
    }

    resume() {
        if (this.isPlaying && this.isPaused) {
            this.synth.resume();
        }
    }

    stop() {
        this.synth.cancel();
        this.isPlaying = false;
        this.isPaused = false;
        this.stopProgressTracking();
        this.currentUtterance = null;
    }

    playPlaylist(summaries, startIndex = 0) {
        this.playlist = summaries;
        this.currentIndex = startIndex;
        this.playCurrentItem();
    }

    playCurrentItem() {
        if (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) {
            const item = this.playlist[this.currentIndex];
            this.speak(item.summary, item.title, item);
            
            // Mark as played in storage
            if (window.storage && item.id) {
                window.storage.updateSummary(item.id, { isPlayed: true });
            }
        }
    }

    playNext() {
        if (this.currentIndex < this.playlist.length - 1) {
            this.currentIndex++;
            setTimeout(() => this.playCurrentItem(), 1000); // Brief pause between items
        } else {
            this.notifyPlaylistComplete();
        }
    }

    playPrevious() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.playCurrentItem();
        }
    }

    skipToItem(index) {
        if (index >= 0 && index < this.playlist.length) {
            this.currentIndex = index;
            this.playCurrentItem();
        }
    }

    getCurrentItem() {
        if (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) {
            return this.playlist[this.currentIndex];
        }
        return null;
    }

    getPlaylist() {
        return this.playlist;
    }

    getCurrentIndex() {
        return this.currentIndex;
    }

    isCurrentlyPlaying() {
        return this.isPlaying;
    }

    isCurrentlyPaused() {
        return this.isPaused;
    }

    // Progress tracking
    startProgressTracking() {
        this.stopProgressTracking(); // Clear any existing interval
        
        this.progressInterval = setInterval(() => {
            if (this.isPlaying && !this.isPaused) {
                const elapsed = (Date.now() - this.startTime) / 1000;
                const progress = Math.min(elapsed / this.estimatedDuration, 1);
                
                if (this.progressCallback) {
                    this.progressCallback({
                        progress: progress,
                        elapsed: elapsed,
                        duration: this.estimatedDuration,
                        remaining: Math.max(0, this.estimatedDuration - elapsed)
                    });
                }
            }
        }, 100); // Update every 100ms
    }

    stopProgressTracking() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    estimateReadingTime(text) {
        // Estimate based on speech rate and word count
        const wordCount = text.split(/\s+/).length;
        const wordsPerMinute = 150 * this.settings.rate; // Adjust for speech rate
        return (wordCount / wordsPerMinute) * 60; // Return seconds
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // Notification methods
    notifyPlaybackStart(title, summary) {
        if (this.playbackCallback) {
            this.playbackCallback({
                type: 'start',
                title: title,
                summary: summary,
                index: this.currentIndex,
                playlist: this.playlist
            });
        }

        // Update media session if available
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title || 'Content Summary',
                artist: 'Content Summarizer',
                album: summary?.source || 'Article Summary',
                artwork: summary?.thumbnail ? [
                    { src: summary.thumbnail, sizes: '512x512', type: 'image/jpeg' }
                ] : [
                    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }
                ]
            });

            // Set up media session action handlers
            navigator.mediaSession.setActionHandler('play', () => this.resume());
            navigator.mediaSession.setActionHandler('pause', () => this.pause());
            navigator.mediaSession.setActionHandler('stop', () => this.stop());
            navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrevious());
            navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext());
        }
    }

    notifyPlaybackEnd() {
        if (this.playbackCallback) {
            this.playbackCallback({
                type: 'end',
                index: this.currentIndex,
                playlist: this.playlist
            });
        }
    }

    notifyPlaybackPause() {
        if (this.playbackCallback) {
            this.playbackCallback({
                type: 'pause',
                index: this.currentIndex,
                playlist: this.playlist
            });
        }
    }

    notifyPlaybackResume() {
        if (this.playbackCallback) {
            this.playbackCallback({
                type: 'resume',
                index: this.currentIndex,
                playlist: this.playlist
            });
        }
    }

    notifyPlaybackError(error) {
        if (this.playbackCallback) {
            this.playbackCallback({
                type: 'error',
                error: error,
                index: this.currentIndex,
                playlist: this.playlist
            });
        }
    }

    notifyPlaylistComplete() {
        if (this.playbackCallback) {
            this.playbackCallback({
                type: 'playlist_complete',
                playlist: this.playlist
            });
        }
    }

    // Test voice functionality
    testVoice() {
        const testText = "This is a test of the text-to-speech voice. How does it sound?";
        this.speak(testText, "Voice Test");
    }

    // Get voice settings for storage
    getSettings() {
        return {
            rate: this.settings.rate,
            pitch: this.settings.pitch,
            voiceIndex: this.getAvailableVoices().indexOf(this.settings.voice),
            autoPlayNext: this.settings.autoPlayNext
        };
    }

    // Load voice settings from storage
    loadSettings(settings) {
        if (settings.rate !== undefined) this.setRate(settings.rate);
        if (settings.pitch !== undefined) this.setPitch(settings.pitch);
        if (settings.voiceIndex !== undefined) this.setVoice(settings.voiceIndex);
        if (settings.autoPlayNext !== undefined) this.setAutoPlayNext(settings.autoPlayNext);
    }
}

// Export for use in other modules
window.TTSManager = TTSManager;
