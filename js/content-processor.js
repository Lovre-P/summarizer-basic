/**
 * Content Processor - Handles URL processing and content extraction
 */
class ContentProcessor {
    constructor() {
        this.corsProxies = [
            'https://api.allorigins.win/get?url=',
            'https://cors-anywhere.herokuapp.com/',
            'https://thingproxy.freeboard.io/fetch/'
        ];
        this.currentProxyIndex = 0;
    }

    async processUrl(url) {
        try {
            // Validate URL
            const validatedUrl = this.validateAndNormalizeUrl(url);
            
            // Determine content type
            const contentType = this.determineContentType(validatedUrl);
            
            if (contentType === 'video') {
                return await this.processYouTubeUrl(validatedUrl);
            } else {
                return await this.processArticleUrl(validatedUrl);
            }
        } catch (error) {
            console.error('URL processing error:', error);
            return {
                success: false,
                error: error.message || 'Failed to process URL'
            };
        }
    }

    validateAndNormalizeUrl(url) {
        if (!url || typeof url !== 'string') {
            throw new Error('Please enter a valid URL');
        }

        // Add protocol if missing
        if (!url.match(/^https?:\/\//)) {
            url = 'https://' + url;
        }

        try {
            const urlObj = new URL(url);
            return urlObj.href;
        } catch (error) {
            throw new Error('Please enter a valid URL');
        }
    }

    determineContentType(url) {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        // YouTube detection
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            return 'video';
        }
        
        // Default to article
        return 'article';
    }

    async processYouTubeUrl(url) {
        try {
            const videoId = this.extractYouTubeVideoId(url);
            if (!videoId) {
                throw new Error('Invalid YouTube URL - could not extract video ID');
            }

            // Try to get video title using oEmbed API
            let title = 'YouTube Video';
            try {
                const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
                const response = await fetch(oEmbedUrl);
                if (response.ok) {
                    const data = await response.json();
                    title = data.title || title;
                }
            } catch (error) {
                console.warn('Could not fetch video title:', error);
            }

            return {
                success: true,
                type: 'video',
                url: url,
                videoId: videoId,
                title: title,
                content: url, // We'll send the URL directly to Gemini
                method: 'youtube_url',
                thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Failed to process YouTube URL'
            };
        }
    }

    extractYouTubeVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
            /youtube\.com\/watch\?v=([^"&?\/\s]{11})/,
            /youtu\.be\/([^"&?\/\s]{11})/,
            /youtube\.com\/embed\/([^"&?\/\s]{11})/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }

        return null;
    }

    async processArticleUrl(url) {
        const errors = [];
        
        // Strategy 1: Direct fetch
        try {
            const result = await this.directFetch(url);
            if (result.success) {
                return result;
            }
            errors.push(`Direct fetch: ${result.error}`);
        } catch (error) {
            errors.push(`Direct fetch: ${error.message}`);
        }

        // Strategy 2: CORS proxies
        for (let i = 0; i < this.corsProxies.length; i++) {
            try {
                const result = await this.proxyFetch(url, i);
                if (result.success) {
                    return result;
                }
                errors.push(`Proxy ${i + 1}: ${result.error}`);
            } catch (error) {
                errors.push(`Proxy ${i + 1}: ${error.message}`);
            }
        }

        // Strategy 3: Manual input fallback
        return {
            success: false,
            error: 'Automatic extraction failed',
            errors: errors,
            requiresManualInput: true,
            url: url
        };
    }

    async directFetch(url) {
        try {
            const response = await fetch(url, {
                mode: 'cors',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ContentSummarizer/1.0)'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const extractedContent = this.extractMainContent(html, url);
            
            if (extractedContent.content.length < 100) {
                throw new Error('Extracted content too short');
            }

            return {
                success: true,
                type: 'article',
                url: url,
                title: extractedContent.title,
                content: extractedContent.content,
                method: 'direct_fetch'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async proxyFetch(url, proxyIndex) {
        const proxy = this.corsProxies[proxyIndex];
        let proxyUrl;

        try {
            if (proxy.includes('allorigins.win')) {
                proxyUrl = `${proxy}${encodeURIComponent(url)}`;
                const response = await fetch(proxyUrl);
                
                if (!response.ok) {
                    throw new Error(`Proxy response: ${response.status}`);
                }

                const data = await response.json();
                if (!data.contents) {
                    throw new Error('No content returned from proxy');
                }

                const extractedContent = this.extractMainContent(data.contents, url);
                
                if (extractedContent.content.length < 100) {
                    throw new Error('Extracted content too short');
                }

                return {
                    success: true,
                    type: 'article',
                    url: url,
                    title: extractedContent.title,
                    content: extractedContent.content,
                    method: `proxy_${proxyIndex + 1}`
                };
            } else {
                // For other proxies, try direct concatenation
                proxyUrl = proxy + url;
                const response = await fetch(proxyUrl);
                
                if (!response.ok) {
                    throw new Error(`Proxy response: ${response.status}`);
                }

                const html = await response.text();
                const extractedContent = this.extractMainContent(html, url);
                
                if (extractedContent.content.length < 100) {
                    throw new Error('Extracted content too short');
                }

                return {
                    success: true,
                    type: 'article',
                    url: url,
                    title: extractedContent.title,
                    content: extractedContent.content,
                    method: `proxy_${proxyIndex + 1}`
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    extractMainContent(html, url) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Remove unwanted elements
        const elementsToRemove = [
            'script', 'style', 'nav', 'footer', 'aside', 'header',
            '.advertisement', '.ads', '.social-share', '.comments',
            '.sidebar', '.menu', '.navigation', '.breadcrumb'
        ];
        
        elementsToRemove.forEach(selector => {
            doc.querySelectorAll(selector).forEach(el => el.remove());
        });

        // Extract title
        let title = '';
        const titleSelectors = [
            'h1',
            '.title',
            '.post-title',
            '.article-title',
            '.entry-title',
            'title'
        ];

        for (const selector of titleSelectors) {
            const element = doc.querySelector(selector);
            if (element && element.textContent.trim()) {
                title = element.textContent.trim();
                break;
            }
        }

        // If no title found, extract from URL
        if (!title) {
            title = this.extractTitleFromUrl(url);
        }

        // Extract main content
        const contentSelectors = [
            'article',
            '[role="main"]',
            'main',
            '.content',
            '.post-content',
            '.entry-content',
            '.article-body',
            '.article-content',
            '.post-body',
            '.story-body'
        ];
        
        let content = '';
        for (const selector of contentSelectors) {
            const element = doc.querySelector(selector);
            if (element && element.textContent.trim().length > 500) {
                content = this.cleanText(element.textContent);
                break;
            }
        }
        
        // Fallback: get body text
        if (!content || content.length < 500) {
            content = this.cleanText(doc.body.textContent);
        }

        return {
            title: title,
            content: content
        };
    }

    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')           // Multiple spaces to single
            .replace(/\n\s*\n/g, '\n\n')    // Multiple newlines to double
            .replace(/^\s+|\s+$/g, '')      // Trim whitespace
            .replace(/\t/g, ' ')            // Tabs to spaces
            .trim();
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
            
            return urlObj.hostname.replace('www.', '');
        } catch (error) {
            return 'Untitled Article';
        }
    }

    // Manual content input handler
    async processManualContent(url, manualContent) {
        if (!manualContent || manualContent.trim().length < 100) {
            throw new Error('Please provide at least 100 characters of content');
        }

        const title = this.extractTitleFromUrl(url);
        
        return {
            success: true,
            type: 'article',
            url: url,
            title: title,
            content: this.cleanText(manualContent),
            method: 'manual_input'
        };
    }
}

// Export for use in other modules
window.ContentProcessor = ContentProcessor;
