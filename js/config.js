/**
 * Configuration helper for PWA deployment
 * Automatically detects the correct base URL and paths for GitHub Pages
 */
class PWAConfig {
    constructor() {
        this.baseUrl = this.detectBaseUrl();
        this.isGitHubPages = this.detectGitHubPages();
        this.repoName = this.extractRepoName();
    }

    detectBaseUrl() {
        const currentUrl = window.location.href;
        const currentPath = window.location.pathname;
        
        // Remove any trailing slashes and file names
        let basePath = currentPath;
        if (basePath.endsWith('/index.html')) {
            basePath = basePath.replace('/index.html', '/');
        }
        if (!basePath.endsWith('/')) {
            basePath += '/';
        }
        
        return window.location.origin + basePath;
    }

    detectGitHubPages() {
        const hostname = window.location.hostname;
        return hostname.includes('github.io') || hostname.includes('githubusercontent.com');
    }

    extractRepoName() {
        if (!this.isGitHubPages) return null;
        
        const pathParts = window.location.pathname.split('/').filter(part => part.length > 0);
        
        // For user.github.io/repo-name format
        if (pathParts.length > 0 && !pathParts[0].includes('.')) {
            return pathParts[0];
        }
        
        return null;
    }

    getManifestPath() {
        return this.baseUrl + 'manifest.json';
    }

    getServiceWorkerPath() {
        return './sw.js';
    }

    getStartUrl() {
        return './';
    }

    getScope() {
        return './';
    }

    // Update manifest dynamically if needed
    async updateManifest() {
        try {
            // Check if we need to update the manifest
            const response = await fetch('./manifest.json');
            const manifest = await response.json();
            
            // If the start_url is absolute and doesn't match current location, update it
            if (manifest.start_url.startsWith('http') && !manifest.start_url.startsWith(this.baseUrl)) {
                console.warn('Manifest start_url mismatch detected. Consider updating manifest.json');
                
                // Create a corrected manifest blob
                const correctedManifest = {
                    ...manifest,
                    start_url: this.getStartUrl(),
                    scope: this.getScope()
                };
                
                // Create a new manifest URL
                const manifestBlob = new Blob([JSON.stringify(correctedManifest, null, 2)], {
                    type: 'application/json'
                });
                const manifestUrl = URL.createObjectURL(manifestBlob);
                
                // Update the manifest link
                const manifestLink = document.querySelector('link[rel="manifest"]');
                if (manifestLink) {
                    manifestLink.href = manifestUrl;
                }
                
                return correctedManifest;
            }
            
            return manifest;
        } catch (error) {
            console.warn('Could not update manifest:', error);
            return null;
        }
    }

    // Register service worker with correct scope
    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.log('Service Worker not supported');
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.register(this.getServiceWorkerPath(), {
                scope: this.getScope()
            });

            console.log('Service Worker registered successfully:', {
                scope: registration.scope,
                baseUrl: this.baseUrl,
                repoName: this.repoName
            });

            return registration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            return false;
        }
    }

    // Check if PWA is installable and show appropriate UI
    checkInstallability() {
        let deferredPrompt;

        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('PWA install prompt available');
            e.preventDefault();
            deferredPrompt = e;
            
            // Show custom install button if needed
            this.showInstallButton(deferredPrompt);
        });

        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            this.hideInstallButton();
            
            // Track installation
            if (window.storage) {
                window.storage.saveSetting('pwa_installed', true);
            }
        });

        return deferredPrompt;
    }

    showInstallButton(deferredPrompt) {
        // Create or show install button
        let installBtn = document.getElementById('pwa-install-btn');
        
        if (!installBtn) {
            installBtn = document.createElement('button');
            installBtn.id = 'pwa-install-btn';
            installBtn.className = 'btn-primary';
            installBtn.innerHTML = '📱 Install App';
            installBtn.style.cssText = `
                position: fixed;
                bottom: 100px;
                right: 20px;
                z-index: 1000;
                border-radius: 25px;
                padding: 12px 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            
            document.body.appendChild(installBtn);
        }

        installBtn.style.display = 'block';
        
        installBtn.onclick = async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log('Install prompt outcome:', outcome);
                
                if (outcome === 'accepted') {
                    this.hideInstallButton();
                }
                
                deferredPrompt = null;
            }
        };
    }

    hideInstallButton() {
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    }

    // Debug information
    getDebugInfo() {
        return {
            baseUrl: this.baseUrl,
            currentUrl: window.location.href,
            pathname: window.location.pathname,
            isGitHubPages: this.isGitHubPages,
            repoName: this.repoName,
            startUrl: this.getStartUrl(),
            scope: this.getScope(),
            manifestPath: this.getManifestPath(),
            serviceWorkerPath: this.getServiceWorkerPath()
        };
    }

    // Log configuration for debugging
    logConfig() {
        console.group('PWA Configuration');
        console.table(this.getDebugInfo());
        console.groupEnd();
    }
}

// Create global instance
window.pwaConfig = new PWAConfig();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.pwaConfig.logConfig();
        window.pwaConfig.checkInstallability();
    });
} else {
    window.pwaConfig.logConfig();
    window.pwaConfig.checkInstallability();
}
