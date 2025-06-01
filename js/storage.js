/**
 * Storage Manager - Handles IndexedDB operations for summaries and settings
 */
class StorageManager {
    constructor() {
        this.dbName = 'SummarizerDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create summaries store
                if (!db.objectStoreNames.contains('summaries')) {
                    const summariesStore = db.createObjectStore('summaries', { keyPath: 'id' });
                    summariesStore.createIndex('dateAdded', 'dateAdded');
                    summariesStore.createIndex('type', 'type');
                    summariesStore.createIndex('isPlayed', 'isPlayed');
                    summariesStore.createIndex('url', 'url');
                }
                
                // Create settings store
                if (!db.objectStoreNames.contains('settings')) {
                    const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    async saveSummary(summaryData) {
        const transaction = this.db.transaction(['summaries'], 'readwrite');
        const store = transaction.objectStore('summaries');
        
        const item = {
            id: Date.now() + Math.random(), // Ensure uniqueness
            url: summaryData.url,
            title: summaryData.title || this.extractTitleFromUrl(summaryData.url),
            type: summaryData.type,
            originalContent: summaryData.originalContent,
            summary: summaryData.summary,
            dateAdded: new Date(),
            isPlayed: false,
            estimatedDuration: this.estimateReadingTime(summaryData.summary),
            thumbnail: summaryData.thumbnail || null,
            source: summaryData.source || this.extractDomain(summaryData.url)
        };
        
        return new Promise((resolve, reject) => {
            const request = store.add(item);
            request.onsuccess = () => resolve(item);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllSummaries() {
        const transaction = this.db.transaction(['summaries'], 'readonly');
        const store = transaction.objectStore('summaries');
        const index = store.index('dateAdded');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll();
            request.onsuccess = () => {
                // Sort by date added (newest first)
                const summaries = request.result.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
                resolve(summaries);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getSummary(id) {
        const transaction = this.db.transaction(['summaries'], 'readonly');
        const store = transaction.objectStore('summaries');
        
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateSummary(id, updates) {
        const transaction = this.db.transaction(['summaries'], 'readwrite');
        const store = transaction.objectStore('summaries');
        
        return new Promise((resolve, reject) => {
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const summary = getRequest.result;
                if (summary) {
                    Object.assign(summary, updates);
                    const updateRequest = store.put(summary);
                    updateRequest.onsuccess = () => resolve(summary);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject(new Error('Summary not found'));
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async deleteSummary(id) {
        const transaction = this.db.transaction(['summaries'], 'readwrite');
        const store = transaction.objectStore('summaries');
        
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getSummariesByType(type) {
        const transaction = this.db.transaction(['summaries'], 'readonly');
        const store = transaction.objectStore('summaries');
        const index = store.index('type');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(type);
            request.onsuccess = () => {
                const summaries = request.result.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
                resolve(summaries);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async checkUrlExists(url) {
        const transaction = this.db.transaction(['summaries'], 'readonly');
        const store = transaction.objectStore('summaries');
        const index = store.index('url');
        
        return new Promise((resolve, reject) => {
            const request = index.get(url);
            request.onsuccess = () => resolve(request.result !== undefined);
            request.onerror = () => reject(request.error);
        });
    }

    // Settings management
    async saveSetting(key, value) {
        const transaction = this.db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        
        return new Promise((resolve, reject) => {
            const request = store.put({ key, value });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getSetting(key, defaultValue = null) {
        const transaction = this.db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.value : defaultValue);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getAllSettings() {
        const transaction = this.db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const settings = {};
                request.result.forEach(item => {
                    settings[item.key] = item.value;
                });
                resolve(settings);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async clearAllData() {
        const transaction = this.db.transaction(['summaries', 'settings'], 'readwrite');
        const summariesStore = transaction.objectStore('summaries');
        const settingsStore = transaction.objectStore('settings');
        
        return new Promise((resolve, reject) => {
            const clearSummaries = summariesStore.clear();
            const clearSettings = settingsStore.clear();
            
            let completed = 0;
            const checkComplete = () => {
                completed++;
                if (completed === 2) resolve();
            };
            
            clearSummaries.onsuccess = checkComplete;
            clearSettings.onsuccess = checkComplete;
            clearSummaries.onerror = () => reject(clearSummaries.error);
            clearSettings.onerror = () => reject(clearSettings.error);
        });
    }

    // Utility methods
    estimateReadingTime(text) {
        // Rough TTS estimation: ~150 words per minute at normal speed
        const wordCount = text.split(/\s+/).length;
        return Math.ceil(wordCount / 150 * 60); // Return seconds
    }

    extractTitleFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            
            // Extract meaningful part from pathname
            const parts = pathname.split('/').filter(part => part.length > 0);
            if (parts.length > 0) {
                const lastPart = parts[parts.length - 1];
                // Remove file extensions and convert dashes/underscores to spaces
                return lastPart
                    .replace(/\.[^/.]+$/, '')
                    .replace(/[-_]/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
            }
            
            return urlObj.hostname;
        } catch (error) {
            return 'Untitled';
        }
    }

    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch (error) {
            return 'Unknown';
        }
    }

    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    formatDate(date) {
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            return 'Today';
        } else if (diffDays === 2) {
            return 'Yesterday';
        } else if (diffDays <= 7) {
            return `${diffDays - 1} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    }
}

// Export for use in other modules
window.StorageManager = StorageManager;
