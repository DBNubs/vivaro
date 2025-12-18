// Preload script for Electron
// This runs in a context that has access to both DOM and Node.js APIs
// but is isolated from the main renderer process

const { contextBridge } = require('electron');

// Expose any APIs you need to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // Add any Electron-specific APIs here if needed
  platform: process.platform,
});

