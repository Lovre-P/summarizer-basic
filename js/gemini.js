/**
 * Gemini API Client - Handles content summarization using Google's Gemini API
 */
class GeminiProcessor {
    constructor() {
        this.apiKey = null;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
    }

    async init() {
        // Load API key from storage
        if (window.storage) {
            this.apiKey = await window.storage.getSetting('gemini_api_key');
        }
        return this.apiKey !== null;
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    isConfigured() {
        return this.apiKey !== null && this.apiKey.trim() !== '';
    }

    async summarizeContent(item) {
        if (!this.isConfigured()) {
            throw new Error('Gemini API key not configured');
        }

        if (item.type === 'video') {
            return await this.summarizeVideo(item.url);
        } else {
            return await this.summarizeArticle(item.content, item.url, item.title);
        }
    }

    async summarizeVideo(youtubeUrl) {
        const prompt = `Please provide a comprehensive summary of this YouTube video: ${youtubeUrl}

Please include:
- Main topics and themes discussed
- Key points and takeaways
- Important details, facts, or insights shared
- Overall conclusion or main message
- Any actionable advice or recommendations

Format the summary in a clear, engaging way that would work well for text-to-speech playback. Use natural language and avoid excessive formatting or bullet points.`;

        try {
            const response = await this.makeRequest(prompt);
            const summary = response.candidates[0].content.parts[0].text;
            
            // Validate that the summary seems relevant
            if (this.validateVideoSummary(summary, youtubeUrl)) {
                return { 
                    success: true, 
                    summary: this.cleanSummaryText(summary),
                    method: 'direct_url'
                };
            } else {
                throw new Error('Summary validation failed - content may not be accessible');
            }
        } catch (error) {
            console.error('Video summarization error:', error);
            return { 
                success: false, 
                error: error.message || 'Failed to summarize video'
            };
        }
    }

    async summarizeArticle(textContent, originalUrl, title = '') {
        // Limit content length to avoid API limits
        const maxContentLength = 30000;
        const truncatedContent = textContent.length > maxContentLength 
            ? textContent.substring(0, maxContentLength) + '...'
            : textContent;

        const prompt = `Please provide a concise but comprehensive summary of the following article:

Title: ${title}
URL: ${originalUrl}

Content:
${truncatedContent}

Please include:
- Main topic and central thesis
- Key points and arguments presented
- Important facts, data, or evidence
- Conclusions or implications
- Any actionable insights or recommendations

Format the summary in a natural, conversational style suitable for text-to-speech playback. Aim for clarity and engagement while maintaining accuracy.`;

        try {
            const response = await this.makeRequest(prompt);
            const summary = response.candidates[0].content.parts[0].text;
            
            return { 
                success: true, 
                summary: this.cleanSummaryText(summary),
                method: 'text_content'
            };
        } catch (error) {
            console.error('Article summarization error:', error);
            return { 
                success: false, 
                error: error.message || 'Failed to summarize article'
            };
        }
    }

    async makeRequest(prompt, retryCount = 0) {
        try {
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 2048,
                    },
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_HATE_SPEECH",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                if (response.status === 429 && retryCount < this.maxRetries) {
                    // Rate limited, retry with exponential backoff
                    const delay = this.retryDelay * Math.pow(2, retryCount);
                    await this.sleep(delay);
                    return this.makeRequest(prompt, retryCount + 1);
                }
                
                throw new Error(this.getErrorMessage(response.status, errorData));
            }

            const data = await response.json();
            
            if (!data.candidates || data.candidates.length === 0) {
                throw new Error('No response generated from Gemini API');
            }

            if (data.candidates[0].finishReason === 'SAFETY') {
                throw new Error('Content was blocked by safety filters');
            }

            return data;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error - please check your internet connection');
            }
            throw error;
        }
    }

    validateVideoSummary(summary, originalUrl) {
        const lowerSummary = summary.toLowerCase();
        
        // Check for common indicators that the video wasn't accessible
        const invalidIndicators = [
            'cannot access',
            'unable to access',
            'cannot view',
            'unable to view',
            'not available',
            'video is not accessible',
            'cannot retrieve',
            'unable to retrieve',
            'different video',
            'wrong video',
            'error accessing'
        ];
        
        const hasInvalidIndicator = invalidIndicators.some(indicator => 
            lowerSummary.includes(indicator)
        );
        
        // Check if summary is too short (likely an error message)
        const isTooShort = summary.trim().length < 100;
        
        // Check if summary seems generic
        const isGeneric = lowerSummary.includes('i cannot') || 
                         lowerSummary.includes('i am unable') ||
                         lowerSummary.includes('as an ai');
        
        return !hasInvalidIndicator && !isTooShort && !isGeneric;
    }

    cleanSummaryText(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
            .replace(/\*(.*?)\*/g, '$1')     // Remove italic markdown
            .replace(/#{1,6}\s/g, '')        // Remove markdown headers
            .replace(/\n{3,}/g, '\n\n')      // Limit consecutive newlines
            .replace(/^\s+|\s+$/g, '')       // Trim whitespace
            .replace(/\s+/g, ' ')            // Normalize spaces
            .trim();
    }

    getErrorMessage(status, errorData) {
        switch (status) {
            case 400:
                return 'Invalid request - please check the content and try again';
            case 401:
                return 'Invalid API key - please check your Gemini API key in settings';
            case 403:
                return 'API access forbidden - please verify your API key permissions';
            case 404:
                return 'API endpoint not found - please try again later';
            case 429:
                return 'Rate limit exceeded - please wait a moment and try again';
            case 500:
                return 'Gemini API server error - please try again later';
            case 503:
                return 'Gemini API temporarily unavailable - please try again later';
            default:
                return errorData.error?.message || `API error (${status}) - please try again`;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Test API key validity
    async testApiKey(apiKey = null) {
        const testKey = apiKey || this.apiKey;
        if (!testKey) {
            return { success: false, error: 'No API key provided' };
        }

        const testPrompt = 'Please respond with "API test successful" to confirm the connection.';
        
        try {
            const response = await fetch(`${this.baseUrl}?key=${testKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: testPrompt
                        }]
                    }]
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.candidates && data.candidates.length > 0) {
                    return { success: true, message: 'API key is valid' };
                }
            }
            
            const errorData = await response.json().catch(() => ({}));
            return { 
                success: false, 
                error: this.getErrorMessage(response.status, errorData)
            };
        } catch (error) {
            return { 
                success: false, 
                error: 'Network error - please check your connection'
            };
        }
    }
}

// Export for use in other modules
window.GeminiProcessor = GeminiProcessor;
