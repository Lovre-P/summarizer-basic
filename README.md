# Content Summarizer PWA

A Progressive Web App that summarizes articles and YouTube videos using Google's Gemini AI, with text-to-speech playback functionality.

## Features

- 📄 **Article Summarization**: Extract and summarize content from web articles
- 🎥 **YouTube Video Summarization**: Summarize YouTube videos directly from URLs
- 🔊 **Text-to-Speech Playback**: Listen to summaries with customizable voice settings
- 📱 **PWA Support**: Install as an app, works offline, share target integration
- 🎵 **Playlist Functionality**: Queue and play multiple summaries
- 💾 **Local Storage**: All data stored locally using IndexedDB
- 🌙 **Dark Mode Support**: Automatic dark/light theme based on system preference
- 📤 **Share Integration**: Receive shared URLs from other apps

## Setup Instructions

### 1. Get a Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the API key for later use

### 2. Generate App Icons

1. Open `generate-icons.html` in your browser
2. Click "Download" for each icon size
3. Save the icons to the `icons/` directory with the exact filenames shown
4. Alternatively, create your own icons or use an online PWA icon generator

### 3. Serve the App

The app must be served over HTTPS for PWA features to work. You can use:

#### Local Development:
```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (install http-server globally)
npx http-server -p 8000

# Using PHP
php -S localhost:8000
```

#### Production Deployment:
Deploy to any static hosting service:
- GitHub Pages
- Netlify
- Vercel
- Firebase Hosting
- Any web server with HTTPS

### 4. Configure the App

1. Open the app in your browser
2. Go to Settings
3. Enter your Gemini API key
4. Configure voice settings as desired
5. Test the voice to ensure it works

## Usage

### Adding Content

1. **Manual Entry**: Click the "+" button and enter a URL
2. **Share Target**: Share URLs from other apps directly to Content Summarizer
3. **Shortcuts**: Use app shortcuts for quick access

### Supported Content Types

- **Articles**: Most web articles and blog posts
- **YouTube Videos**: Any public YouTube video URL
- **Manual Input**: Copy/paste article text if automatic extraction fails

### Playing Summaries

1. **Individual**: Click "Play" on any summary card
2. **Playlist**: Use the player page to play all summaries in sequence
3. **Controls**: Play, pause, skip, adjust speed and pitch

### PWA Installation

1. **Chrome/Edge**: Look for the install prompt or use the menu option
2. **Safari**: Use "Add to Home Screen" from the share menu
3. **Firefox**: Use "Install" from the address bar menu

## Technical Details

### Architecture

- **Frontend**: Vanilla JavaScript with modern ES6+ features
- **Storage**: IndexedDB for local data persistence
- **AI**: Google Gemini 1.5 Flash API for summarization
- **TTS**: Web Speech API for text-to-speech
- **PWA**: Service Worker for offline functionality and caching

### Content Extraction Strategy

1. **Direct Fetch**: Attempt to fetch content directly (works for CORS-enabled sites)
2. **CORS Proxy**: Use proxy services for sites that block direct access
3. **Manual Input**: Fallback to user-provided content

### File Structure

```
├── index.html              # Main app HTML
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── styles.css              # App styles
├── js/
│   ├── app.js              # Main application logic
│   ├── storage.js          # IndexedDB storage manager
│   ├── gemini.js           # Gemini API client
│   ├── content-processor.js # URL processing and content extraction
│   ├── tts-manager.js      # Text-to-speech functionality
│   └── ui-manager.js       # User interface management
├── icons/                  # PWA icons (various sizes)
└── generate-icons.html     # Icon generator utility
```

### Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (iOS 11.3+)
- **Mobile**: Optimized for mobile browsers

## Troubleshooting

### Common Issues

1. **API Key Not Working**
   - Verify the key is correct
   - Check API quotas in Google Cloud Console
   - Ensure the key has Gemini API access

2. **Content Extraction Fails**
   - Try the manual input option
   - Some sites block automated access
   - CORS policies may prevent direct fetching

3. **Voice Not Working**
   - Check browser permissions
   - Try different voices in settings
   - Ensure device volume is up

4. **PWA Not Installing**
   - Ensure HTTPS is enabled
   - Check manifest.json is accessible
   - Verify service worker is registered

### Performance Tips

- Clear old summaries periodically
- Use shorter summaries for faster TTS
- Adjust speech rate for comfortable listening
- Enable auto-play for continuous listening

## Privacy & Security

- All data stored locally on your device
- No data sent to third parties except Gemini API
- API key stored securely in browser storage
- Content processing happens client-side when possible

## Contributing

This is a client-side PWA that can be easily modified:

1. Fork the repository
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT License - feel free to use and modify as needed.

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify API key and network connectivity
3. Try clearing browser data and reconfiguring
4. Test with different content types

---

**Note**: This app requires a Gemini API key to function. The API has usage quotas and may incur costs for heavy usage. Please review Google's pricing and terms of service.
