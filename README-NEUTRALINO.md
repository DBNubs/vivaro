# Neutralino Setup

Pure Node.js desktop app framework - no Rust, no Electron overhead!

## What is Neutralino?

- **Pure JavaScript/Node.js** - No Rust, no compilation needed
- **Lightweight** - ~5-15MB (vs 1.4GB for Electron)
- **Uses system webview** - Native performance
- **Simple setup** - Just Node.js required

## Setup

**Important:** The `npm run neutralino:update` command sometimes fails with a zip error. Use the workaround instead:

1. **Get Neutralino binaries** (use the workaround script):
   ```bash
   npm run neutralino:get-binaries
   ```
   Or if that doesn't work:
   ```bash
   ./get-neutralino-binaries.sh
   ```

2. **Build your React app**:
   ```bash
   npm run build
   ```

3. **Run in development**:
   ```bash
   npm run neutralino:dev
   ```
   This will:
   - Start the Express server on port 3001
   - Open Neutralino window pointing to the server

4. **Build for production**:
   ```bash
   npm run neutralino:build
   ```

5. **Create macOS installer** (creates .app bundle and DMG):
   ```bash
   npm run neutralino:installer
   ```
   This creates:
   - `dist/Vivaro.app` - Double-clickable macOS app
   - `dist/Vivaro-Installer.dmg` - DMG installer (users can drag to Applications)

## How It Works

1. `neutralino-main.js` spawns your Express server
2. Express serves both the API and the React build
3. Neutralino opens a window pointing to `http://localhost:3001`
4. Your React app works exactly as before!

## Configuration

- **Window size**: 1400x900 (matches Electron)
- **App ID**: `com.lullabot.pm-dashboard`
- **Server**: Automatically spawned on port 3001
- **Data directory**: `~/.vivaro/data`

## Troubleshooting

### Binaries not found
Run `npm run neutralino:update` to download Neutralino binaries.

### Server not starting
- Check that `server.js` exists
- Check that port 3001 is available
- Check console logs in Neutralino window (right-click → Inspect)

### Build errors
- Make sure React app is built: `npm run build`
- Check that `build/` directory exists

## Distribution

After building, you can create installers:

**macOS:**
```bash
npm run neutralino:installer
```
Creates:
- `dist/Vivaro.app` - Native macOS app bundle (~14MB)
- `dist/Vivaro-Installer.dmg` - DMG installer (~4.3MB)

Users can:
- Double-click the DMG to mount it
- Drag the app to Applications folder
- Launch from Applications like any other app

**Other platforms:**
The `dist/vivaro/` directory contains platform-specific executables that can be packaged as needed.

## Benefits vs Electron

- **99% smaller** (~14MB vs 1.4GB)
- **Lower memory usage**
- **Faster startup**
- **Pure Node.js** - no Rust compilation
- **Same React code** - no changes needed!
- **Native installers** - DMG for macOS, can create installers for other platforms

