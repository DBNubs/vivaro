# Installer Notes

## Current Status

The installer creates:
- ✅ `dist/Vivaro.app` - macOS app bundle (~14MB)
- ✅ `dist/Vivaro-Installer.dmg` - DMG installer (~4.4MB)

## Known Issue

The app bundle includes:
- ✅ Neutralino binary
- ✅ React build files
- ✅ server.js
- ✅ Essential node_modules

**However:** The app currently opens the Neutralino website instead of your app because:
1. The Express server needs to start before Neutralino loads the URL
2. The extension system should handle this, but may need adjustment
3. Node.js must be installed on the user's system (not bundled)

## Solutions

### Option 1: Test the Extension (Recommended First)
The extension in `neutralino.config.json` should automatically start the server. Try running the app and check:
- Open Console.app to see server logs
- Check `~/.vivaro/data/server.log` for errors
- The extension should start `node server.js` automatically

### Option 2: Manual Server Start
If the extension doesn't work, users can:
1. Open Terminal
2. Navigate to the app: `cd /Applications/Vivaro.app/Contents/Resources`
3. Run: `node server.js`
4. Then launch the app

### Option 3: Bundle Node.js (Larger but Standalone)
To make it fully standalone, you'd need to bundle Node.js, which would increase size significantly (~50-100MB).

### Option 4: Use Electron (Original - Larger but Works)
The original Electron setup works but is 1.4GB.

## Testing the Current Installer

1. Install from DMG: `dist/Vivaro-Installer.dmg`
2. Check if server starts automatically (check Console.app)
3. If not, the extension may need path adjustments

## Next Steps

The extension configuration in `neutralino.config.json` uses:
```json
{
  "id": "js.neutralino.server",
  "command": "sh",
  "args": ["-c", "cd \"${NL_PATH}\" && node server.js"]
}
```

This should work, but if it doesn't, we may need to:
- Adjust the extension command paths
- Add a delay before loading the URL
- Or use a different approach to start the server

