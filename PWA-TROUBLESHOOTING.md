# PWA Installation Troubleshooting Guide

## Problem: PWA Opens Wrong Repository After Installation

### Symptoms
- You install the PWA from a GitHub Pages URL
- After installation, the app opens a different repository or the GitHub Pages root
- The app doesn't open your intended Content Summarizer app

### Root Cause
This happens because of PWA scope confusion when installing from redirected or proxied URLs. The browser sets the PWA scope based on where you initiated the installation, not where the app actually lives.

### Solutions

#### Solution 1: Install Directly from the Correct URL ✅ RECOMMENDED

1. **Uninstall the current PWA** from your phone:
   - Android: Long press the app icon → App info → Uninstall
   - iOS: Long press the app icon → Remove App

2. **Navigate directly to your app's URL**:
   ```
   https://yourusername.github.io/your-repo-name/
   ```
   NOT through any redirect or other repository

3. **Install the PWA** from this direct URL

#### Solution 2: Use the Updated Configuration (Already Applied)

The app now includes automatic scope detection:

1. **Commit and push** the updated files to your repository
2. **Wait for GitHub Pages** to update (usually 1-2 minutes)
3. **Clear your browser cache** or use incognito mode
4. **Uninstall the old PWA** and reinstall from the direct URL

#### Solution 3: Manual Manifest Fix

If you need to customize the paths manually, edit `manifest.json`:

```json
{
  "start_url": "/your-repo-name/",
  "scope": "/your-repo-name/"
}
```

Replace `your-repo-name` with your actual repository name.

### Verification Steps

1. **Open the app URL** in your browser
2. **Open Developer Tools** (F12)
3. **Check the Console** for PWA configuration logs
4. **Look for these messages**:
   ```
   PWA Configuration
   ├── baseUrl: https://yourusername.github.io/your-repo-name/
   ├── scope: ./
   ├── startUrl: ./
   └── Service Worker registered successfully
   ```

### GitHub Pages Specific Issues

#### Custom Domain
If you're using a custom domain:
```json
{
  "start_url": "/",
  "scope": "/"
}
```

#### Repository Path
If your app is in a repository subdirectory:
```json
{
  "start_url": "/repo-name/",
  "scope": "/repo-name/"
}
```

#### User vs Organization Pages
- **User pages** (username.github.io): Use `/repo-name/`
- **Organization pages**: Use `/repo-name/`
- **Project pages**: Use `/repo-name/`

### Testing Your PWA

1. **Check manifest accessibility**:
   ```
   https://yourusername.github.io/your-repo-name/manifest.json
   ```

2. **Verify service worker**:
   ```
   https://yourusername.github.io/your-repo-name/sw.js
   ```

3. **Test installation**:
   - Open the direct URL
   - Look for install prompt
   - Check browser's "Install app" option

### Common Mistakes

❌ **Installing from a redirect page**
❌ **Using absolute URLs in manifest when not needed**
❌ **Wrong scope configuration**
❌ **Not clearing cache after updates**

✅ **Install directly from the app URL**
✅ **Use relative paths (./)**
✅ **Clear cache after manifest changes**
✅ **Test in incognito mode**

### Debug Commands

Open browser console on your app page and run:

```javascript
// Check PWA configuration
console.table(window.pwaConfig.getDebugInfo());

// Check service worker
navigator.serviceWorker.getRegistrations().then(registrations => {
    console.log('Service Workers:', registrations);
});

// Check manifest
fetch('./manifest.json').then(r => r.json()).then(console.log);
```

### Still Having Issues?

1. **Clear all browser data** for the GitHub Pages domain
2. **Use a different browser** to test
3. **Check GitHub Pages build status** in your repository settings
4. **Verify all files are accessible** via direct URLs
5. **Test on desktop first** before mobile

### Prevention

- Always test PWA installation from the direct URL
- Use relative paths in manifest.json
- Test in multiple browsers
- Verify scope and start_url match your deployment structure
- Use the included PWA configuration helper

### Quick Fix Checklist

- [ ] Uninstall old PWA
- [ ] Clear browser cache
- [ ] Navigate to direct app URL
- [ ] Check console for configuration logs
- [ ] Install PWA from correct URL
- [ ] Test app opens correctly

The updated configuration should automatically handle most scope issues, but always install from the direct URL for best results.
