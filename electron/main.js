const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Declare variables first
let mainWindow;
let serverProcess;
let serverCheckInterval = null;
let isCreatingWindow = false;
let windowCreated = false;

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else {
      // Window doesn't exist, wait for app to be ready then create it
      app.whenReady().then(() => {
        createWindow();
      });
    }
  });
}

function createWindow() {
  // Prevent multiple simultaneous window creations
  if (isCreatingWindow) {
    console.log('Window creation already in progress, skipping...');
    return;
  }

  // If we've already created a window and it still exists, don't create another
  if (windowCreated && mainWindow && !mainWindow.isDestroyed()) {
    console.log('Window already created and exists, focusing...');
    mainWindow.focus();
    return;
  }

  // Check if any windows already exist
  const existingWindows = BrowserWindow.getAllWindows();
  if (existingWindows.length > 0) {
    console.log('Window already exists, focusing it...');
    existingWindows[0].focus();
    // Update mainWindow reference if it's null
    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = existingWindows[0];
      windowCreated = true;
    }
    return;
  }

  // Don't create a new window if one already exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('mainWindow exists and is not destroyed, focusing...');
    mainWindow.focus();
    return;
  }

  console.log('Creating new window...');
  isCreatingWindow = true;
  windowCreated = true;

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: true, // Show immediately
  });

  console.log('Window created, ID:', mainWindow.id);

  // Show loading screen immediately
  mainWindow.loadURL('data:text/html,<html><body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5;"><div style="text-align: center;"><h1>Vivaro</h1><p>Starting server...</p></div></body></html>');

  // Start the Express server as a child process
  const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === '1';

  // Determine paths based on environment
  let serverPath;
  let serverCwd;

  if (isDev) {
    serverPath = path.join(__dirname, '..', 'server.js');
    serverCwd = path.join(__dirname, '..');
  } else {
    // In production, files are in app.asar or app folder
    // Try app folder first (unpacked), then app.asar
    const appPath = app.getAppPath();
    serverPath = path.join(appPath, 'server.js');
    serverCwd = appPath;

    // Ensure data directory exists in a writable location
    const userDataPath = app.getPath('userData');
    const dataPath = path.join(userDataPath, 'data');
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
    }
  }

  // Only start server if it's not already running
  if (serverProcess && !serverProcess.killed) {
    console.log('Server already running, reusing existing process');
    // Still need to check if server is ready and load the URL
  } else {
    // Use spawn with Electron's Node.js executable to ensure proper module resolution
    const nodeExecutable = process.execPath; // This is Electron's Node.js
    serverProcess = spawn(nodeExecutable, [serverPath], {
      env: {
        ...process.env,
        PORT: '3001',
        ELECTRON: '1',
        // Set data directory to user's app data folder in production
        DATA_DIR: isDev ? undefined : path.join(app.getPath('userData'), 'data'),
        // Ensure NODE_PATH includes the app directory for module resolution
        NODE_PATH: serverCwd
      },
      cwd: serverCwd,
      stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout and stderr
    });

      serverProcess.on('error', (error) => {
        console.error('Server process error:', error);
        // Show error in window
        const errorHtml = `<html><body style="font-family: system-ui; padding: 40px; background: #f5f5f5;"><h1 style="color: #d32f2f;">Server Error</h1><p>Failed to start server: ${error.message}</p><pre style="background: #fff; padding: 20px; border-radius: 4px; overflow: auto;">${error.stack || error.toString()}</pre></body></html>`;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL('data:text/html,' + encodeURIComponent(errorHtml));
        }
      });

      let serverOutput = '';
      let serverErrors = '';

      serverProcess.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          console.error(`Server process exited with code ${code} and signal ${signal}`);
          const errorHtml = `<html><body style="font-family: system-ui; padding: 40px; background: #f5f5f5;"><h1 style="color: #d32f2f;">Server Failed to Start</h1><p>Exit code: ${code}, Signal: ${signal}</p><h2>Server Output:</h2><pre style="background: #fff; padding: 20px; border-radius: 4px; overflow: auto; white-space: pre-wrap;">${serverOutput || '(no output)'}</pre><h2>Server Errors:</h2><pre style="background: #fff; padding: 20px; border-radius: 4px; overflow: auto; white-space: pre-wrap; color: #d32f2f;">${serverErrors || '(no errors)'}</pre><p><strong>Server path:</strong> ${serverPath}</p><p><strong>Working directory:</strong> ${serverCwd}</p></body></html>`;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL('data:text/html,' + encodeURIComponent(errorHtml));
          }
        }
      });

      // Log server output for debugging
      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        serverOutput += output;
        console.log(`Server stdout: ${output}`);
      });

      serverProcess.stderr?.on('data', (data) => {
        const error = data.toString();
        serverErrors += error;
        console.error(`Server stderr: ${error}`);
      });
    }

  // Wait for server to be ready, then load the app
  // Clear any existing interval first
  if (serverCheckInterval) {
    clearInterval(serverCheckInterval);
    serverCheckInterval = null;
  }

  let attempts = 0;
  const maxAttempts = 40; // 20 seconds max wait

  serverCheckInterval = setInterval(() => {
    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(serverCheckInterval);
      serverCheckInterval = null;
      console.error('Server failed to start after', maxAttempts * 500, 'ms');
      // Show error message
      const errorHtml = `<html><body style="font-family: system-ui; padding: 40px; background: #f5f5f5;"><h1 style="color: #d32f2f;">Server Timeout</h1><p>The server failed to start after ${maxAttempts * 500}ms. Please check the console for errors.</p><p>Server path: ${serverPath}</p><p>Working directory: ${serverCwd}</p></body></html>`;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL('data:text/html,' + encodeURIComponent(errorHtml));
      }
      return;
    }

    const http = require('http');
    const req = http.get('http://localhost:3001/api/clients', (res) => {
      clearInterval(serverCheckInterval);
      serverCheckInterval = null;
      const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === '1';

      console.log('Server is ready! Loading application...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (isDev) {
          // In development, load from React dev server
          mainWindow.loadURL('http://localhost:3000');
          mainWindow.webContents.openDevTools();
        } else {
          // In production, load from Express server which serves the React build
          mainWindow.loadURL('http://localhost:3001');
        }
      }
    });
    req.on('error', (err) => {
      // Server not ready yet, keep waiting
      if (attempts === 1) {
        console.log('Waiting for server to start...');
      }
    });
    req.setTimeout(1000, () => {
      req.destroy();
    });
  }, 500);

  mainWindow.on('closed', () => {
    console.log('Window closed');
    mainWindow = null;
    isCreatingWindow = false;
    windowCreated = false;
  });

  // Prevent window from being closed accidentally
  mainWindow.on('close', (event) => {
    // On macOS, don't quit when window is closed, just hide it
    if (process.platform === 'darwin') {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Reset flag after a short delay to allow window to be created
  setTimeout(() => {
    isCreatingWindow = false;
  }, 1000);
}

// Only proceed if we got the lock
if (gotTheLock) {
  app.whenReady().then(() => {
    console.log('Electron app is ready, creating window...');
    // Small delay to ensure everything is initialized
    setTimeout(() => {
      createWindow();
    }, 100);
  });
}

// Handle macOS dock icon click - only create window if none exist
let activateDebounce = null;
app.on('activate', (event) => {
  // Debounce activate events to prevent rapid firing
  if (activateDebounce) {
    clearTimeout(activateDebounce);
  }

  activateDebounce = setTimeout(() => {
    const allWindows = BrowserWindow.getAllWindows();
    console.log('App activated, current windows:', allWindows.length);

    if (allWindows.length === 0 && !isCreatingWindow) {
      console.log('No windows exist, creating new window...');
      createWindow();
    } else if (allWindows.length > 0) {
      // Focus existing window
      allWindows[0].focus();
      if (allWindows[0].isMinimized()) {
        allWindows[0].restore();
      }
    }
    activateDebounce = null;
  }, 100);
});

// Remove duplicate ready handler - we're already using whenReady()

app.on('window-all-closed', () => {
  // Clear server check interval
  if (serverCheckInterval) {
    clearInterval(serverCheckInterval);
    serverCheckInterval = null;
  }
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Clear server check interval
  if (serverCheckInterval) {
    clearInterval(serverCheckInterval);
    serverCheckInterval = null;
  }
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});
