# Neutralino macOS Exit Fix

## Problem

On macOS, calling `Neutralino.app.exit()` or using Cmd+Q/Quit menu causes the application to crash with:

```
*** Terminating app due to uncaught exception 'NSInternalInconsistencyException',
reason: 'NSWindow geometry should only be modified on the main thread!'
```

This is a known Neutralino bug ([#1469](https://github.com/neutralinojs/neutralinojs/issues/1469)) where the `app.exit()` handler runs on a WebSocket/background thread, but AppKit/NSWindow operations must run on the main thread.

## Solution

This project includes a patched version of Neutralino that dispatches window close operations to the main thread on macOS using `dispatch_async(dispatch_get_main_queue(), ^{ ... })`.

## Applying the Fix

Run the fix script:

```bash
npm run neutralino:fix-exit
```

Or directly:

```bash
./fix-neutralino-exit.sh
```

This script will:
1. Clone the Neutralino source code
2. Apply the patch to `app.cpp` to wrap window operations in main-thread dispatch
3. Build the patched binary
4. Install it to `bin/neutralino-mac_arm64` (or `neutralino-mac_x64` for Intel Macs)

## What the Patch Does

The patch modifies `app::controllers::exit()` in `core/src/app.cpp` (or `src/app.cpp`) to:

1. Include `<dispatch/dispatch.h>` on macOS
2. Wrap the window close operations in:
   ```cpp
   #ifdef __APPLE__
   dispatch_async(dispatch_get_main_queue(), ^{
       // window close code here
   });
   #else
   // original code for other platforms
   #endif
   ```

This ensures that NSWindow operations happen on the main thread, preventing the crash.

## Requirements

- macOS (for building the macOS binary)
- Xcode Command Line Tools (`xcode-select --install`)
- CMake (`brew install cmake`)
- Git
- Python 3

## Testing

After applying the fix, test with:

```bash
npm run neutralino:dev
```

Then try:
- Cmd+Q to quit
- Quit from the Vivaro menu
- Cmd+W to close window

All should work without crashing.

## Restoring Original Binary

If you need to restore the original Neutralino binary:

```bash
# Find the backup
ls -la bin/neutralino-mac_arm64.backup.*

# Restore it
cp bin/neutralino-mac_arm64.backup.YYYYMMDD_HHMMSS bin/neutralino-mac_arm64
```

Or re-download:

```bash
npm run neutralino:get-binaries
```

## Technical Details

The crash occurs because:

1. JavaScript calls `Neutralino.app.exit()`
2. This sends a WebSocket message to the native C++ server
3. The server handles it on the WebSocket/asio thread (background thread)
4. The handler calls `window::_close()` which calls `window::__saveWindowProps()`
5. That calls `window::isMaximized()` which touches NSWindow
6. AppKit throws because NSWindow must only be accessed from the main thread

The fix dispatches step 4-6 to the main thread using Grand Central Dispatch.

## Updating Neutralino

If you update Neutralino (via `npm run neutralino:update`), you'll need to re-apply the fix:

```bash
npm run neutralino:fix-exit
```

## Contributing Back to Neutralino

This fix should be contributed back to the Neutralino project. The proper fix would be in:

- `core/src/app.cpp` - `app::controllers::exit()` function
- Possibly `core/src/window.cpp` - `window::_close()` function

The patch ensures window operations are dispatched to the main thread on macOS.
