const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn, fork, execFile } = require('child_process');
const fs = require('fs');

// Declare variables first
let mainWindow;
let serverProcess;
let serverCheckInterval = null;
let isCreatingWindow = false;
let windowCreated = false;

// Track if app is quitting (for macOS window close behavior)
app.isQuitting = false;

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
    console.log(`userData path: ${userDataPath}`);
    const dataPath = path.join(userDataPath, 'data');
    console.log(`dataPath: ${dataPath}`);
    if (!fs.existsSync(dataPath)) {
      try {
        fs.mkdirSync(dataPath, { recursive: true });
        console.log(`Created data directory: ${dataPath}`);
      } catch (mkdirError) {
        console.error(`Failed to create data directory: ${mkdirError.message}`);
        // Fallback to a writable location
        const os = require('os');
        const fallbackPath = path.join(os.tmpdir(), 'vivaro-data');
        console.log(`Using fallback data path: ${fallbackPath}`);
        if (!fs.existsSync(fallbackPath)) {
          fs.mkdirSync(fallbackPath, { recursive: true });
        }
      }
    }
  }

  // Declare server output variables outside the if/else block so they're accessible in the timeout handler
  let serverOutput = '';
  let serverErrors = '';

  // Only start server if it's not already running
  if (serverProcess && !serverProcess.killed) {
    console.log('Server already running, reusing existing process');
    // Still need to check if server is ready and load the URL
  } else {
    // Verify server file exists before spawning
    if (!fs.existsSync(serverPath)) {
      const errorMsg = `Server file not found at: ${serverPath}`;
      console.error(errorMsg);
      const errorHtml = `<html><body style="font-family: system-ui; padding: 40px; background: #f5f5f5;"><h1 style="color: #d32f2f;">Server File Not Found</h1><p>${errorMsg}</p><p><strong>Working directory:</strong> ${serverCwd}</p><p><strong>__dirname:</strong> ${__dirname}</p></body></html>`;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL('data:text/html,' + encodeURIComponent(errorHtml));
      }
      return;
    }

    console.log(`Spawning server process...`);
    console.log(`  Executable: ${process.execPath}`);
    console.log(`  Server path: ${serverPath}`);
    console.log(`  Working directory: ${serverCwd}`);
    console.log(`  Server file exists: ${fs.existsSync(serverPath)}`);

    // Check if node_modules exists
    const nodeModulesPath = path.join(serverCwd, 'node_modules');
    const nodeModulesExists = fs.existsSync(nodeModulesPath);
    console.log(`  node_modules exists: ${nodeModulesExists} at ${nodeModulesPath}`);

    if (!nodeModulesExists) {
      const errorMsg = `node_modules directory not found at ${nodeModulesPath}`;
      console.error(errorMsg);
      serverErrors += errorMsg + '\n';
    }

    // Try using fork first (better for Node.js scripts)
    // Fork uses the same Node.js runtime and handles module resolution better
    try {
      console.log('Attempting to fork server process...');
      // Get the actual userData path and ensure it's writable
      let dataDirPath;
      if (isDev) {
        dataDirPath = undefined; // Use default in development
      } else {
        const userDataPath = app.getPath('userData');
        dataDirPath = path.join(userDataPath, 'data');
        // Verify the path exists and is writable
        if (!fs.existsSync(dataDirPath)) {
          try {
            fs.mkdirSync(dataDirPath, { recursive: true });
          } catch (error) {
            // If we can't create in userData, use a fallback
            const os = require('os');
            dataDirPath = path.join(os.tmpdir(), 'vivaro-data');
            if (!fs.existsSync(dataDirPath)) {
              fs.mkdirSync(dataDirPath, { recursive: true });
            }
          }
        }
      }

      const env = {
        ...process.env,
        PORT: '3001',
        ELECTRON: '1',
        // Set data directory to user's app data folder in production
        DATA_DIR: dataDirPath,
        // Ensure NODE_PATH includes the app directory for module resolution
        NODE_PATH: serverCwd
      };

      console.log(`Setting DATA_DIR to: ${dataDirPath}`);

      // Use fork for Node.js scripts - it's better than spawn for this use case
      // Fork automatically uses the same Node.js runtime and handles module resolution
      serverProcess = fork(serverPath, [], {
        env: env,
        cwd: serverCwd,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'], // Add ipc for inter-process communication
        silent: false, // Don't silence output
      });

      console.log(`Forked server process with PID: ${serverProcess.pid}`);
      console.log(`Server path: ${serverPath}`);
      console.log(`Working directory: ${serverCwd}`);
    } catch (spawnError) {
      console.error('Error spawning server:', spawnError);
      serverErrors += `Spawn error: ${spawnError.message}\n`;
      const errorHtml = `<html><body style="font-family: system-ui; padding: 40px; background: #f5f5f5;"><h1 style="color: #d32f2f;">Spawn Error</h1><p>${spawnError.message}</p><pre>${spawnError.stack}</pre></body></html>`;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL('data:text/html,' + encodeURIComponent(errorHtml));
      }
      return;
    }

    console.log(`Server process spawned with PID: ${serverProcess.pid}`);
    console.log(`Process killed status: ${serverProcess.killed}`);
    console.log(`Process signal code: ${serverProcess.signalCode}`);
    console.log(`Process exit code: ${serverProcess.exitCode}`);

    // Check if process exited immediately
    setTimeout(() => {
      if (serverProcess.killed || serverProcess.exitCode !== null) {
        console.error(`Server process exited immediately! Exit code: ${serverProcess.exitCode}, Killed: ${serverProcess.killed}`);
        serverErrors += `Server process exited immediately. Exit code: ${serverProcess.exitCode}, Killed: ${serverProcess.killed}\n`;
      }
    }, 100);

      serverProcess.on('error', (error) => {
        console.error('Server process error:', error);
        serverErrors += `Process error: ${error.message}\n${error.stack || ''}\n`;
        // Show error in window
        const errorHtml = `<html><body style="font-family: system-ui; padding: 40px; background: #f5f5f5;"><h1 style="color: #d32f2f;">Server Error</h1><p>Failed to start server: ${error.message}</p><pre style="background: #fff; padding: 20px; border-radius: 4px; overflow: auto;">${error.stack || error.toString()}</pre></body></html>`;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL('data:text/html,' + encodeURIComponent(errorHtml));
        }
      });

      serverProcess.on('exit', (code, signal) => {
        console.log(`Server process exited with code ${code} and signal ${signal}`);
        if (code !== 0 && code !== null) {
          console.error(`Server process exited with code ${code} and signal ${signal}`);
          const errorHtml = `<html><body style="font-family: system-ui; padding: 40px; background: #f5f5f5;"><h1 style="color: #d32f2f;">Server Failed to Start</h1><p>Exit code: ${code}, Signal: ${signal}</p><h2>Server Output:</h2><pre style="background: #fff; padding: 20px; border-radius: 4px; overflow: auto; white-space: pre-wrap;">${serverOutput || '(no output)'}</pre><h2>Server Errors:</h2><pre style="background: #fff; padding: 20px; border-radius: 4px; overflow: auto; white-space: pre-wrap; color: #d32f2f;">${serverErrors || '(no errors)'}</pre><p><strong>Server path:</strong> ${serverPath}</p><p><strong>Working directory:</strong> ${serverCwd}</p><p><strong>PID:</strong> ${serverProcess.pid || 'N/A'}</p></body></html>`;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL('data:text/html,' + encodeURIComponent(errorHtml));
          }
        }
      });

      serverProcess.on('spawn', () => {
        console.log('Server process spawned successfully');
      });

      // Log server output for debugging
      if (serverProcess.stdout) {
        serverProcess.stdout.on('data', (data) => {
          const output = data.toString();
          serverOutput += output;
          console.log(`Server stdout: ${output}`);
        });
        serverProcess.stdout.on('error', (err) => {
          console.error('Server stdout error:', err);
        });
      } else {
        console.warn('Server stdout is not available');
      }

      if (serverProcess.stderr) {
        serverProcess.stderr.on('data', (data) => {
          const error = data.toString();
          serverErrors += error;
          console.error(`Server stderr: ${error}`);
        });
        serverProcess.stderr.on('error', (err) => {
          console.error('Server stderr error:', err);
        });
      } else {
        console.warn('Server stderr is not available');
      }
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

        // Try to read the log file if it exists - check multiple locations
        let logFileContent = '';
        let foundLogFile = null;
        const possibleLogLocations = [
          path.join(app.getPath('userData'), 'data', 'server-startup.log'), // Production DATA_DIR
          path.join(serverCwd, 'data', 'server-startup.log'), // Development or fallback
          path.join(require('os').tmpdir(), 'server-startup.log'), // OS temp directory
        ];

        for (const logFile of possibleLogLocations) {
          try {
            if (fs.existsSync(logFile)) {
              logFileContent = fs.readFileSync(logFile, 'utf8');
              foundLogFile = logFile;
              console.log(`Found log file at: ${logFile}`);
              break;
            }
          } catch (e) {
            // Continue to next location
          }
        }

        if (!logFileContent) {
          logFileContent = 'Log file not found in any of these locations:\n' + possibleLogLocations.join('\n');
        }

        // Show error message with server output
        const logFileInfo = foundLogFile || possibleLogLocations.join(', ');
        const errorHtml = `<html><body style="font-family: system-ui; padding: 40px; background: #f5f5f5;"><h1 style="color: #d32f2f;">Server Timeout</h1><p>The server failed to start after ${maxAttempts * 500}ms. Please check the console for errors.</p><p><strong>Server path:</strong> ${serverPath}</p><p><strong>Working directory:</strong> ${serverCwd}</p><p><strong>Log file locations checked:</strong> ${logFileInfo}</p><h2>Server Output:</h2><pre style="background: #fff; padding: 20px; border-radius: 4px; overflow: auto; white-space: pre-wrap; max-height: 200px;">${serverOutput || '(no output)'}</pre><h2>Server Errors:</h2><pre style="background: #fff; padding: 20px; border-radius: 4px; overflow: auto; white-space: pre-wrap; color: #d32f2f; max-height: 200px;">${serverErrors || '(no errors)'}</pre>${logFileContent ? `<h2>Log File Content:</h2><pre style="background: #fff; padding: 20px; border-radius: 4px; overflow: auto; white-space: pre-wrap; max-height: 300px;">${logFileContent}</pre>` : ''}</body></html>`;
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
    // But allow quit if the app is already quitting
    if (process.platform === 'darwin' && !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    } else {
      // Clean up when window is actually closing
      cleanupServer();
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

// Helper function to clean up server process
function cleanupServer() {
  // Clear server check interval
  if (serverCheckInterval) {
    clearInterval(serverCheckInterval);
    serverCheckInterval = null;
  }

  // Kill server process more forcefully
  if (serverProcess && !serverProcess.killed) {
    try {
      // Try graceful shutdown first
      serverProcess.kill('SIGTERM');

      // Force kill after a short delay if still running
      const forceKillTimeout = setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
          try {
            console.log('Force killing server process...');
            serverProcess.kill('SIGKILL');
          } catch (err) {
            console.error('Error force killing server:', err);
          }
        }
      }, 500);

      // Clear timeout if process exits before it fires
      if (serverProcess.listenerCount('exit') === 0) {
        serverProcess.once('exit', () => {
          clearTimeout(forceKillTimeout);
        });
      }
    } catch (err) {
      console.error('Error killing server process:', err);
      // Try force kill as fallback
      try {
        if (serverProcess && !serverProcess.killed) {
          serverProcess.kill('SIGKILL');
        }
      } catch (killErr) {
        console.error('Error force killing server:', killErr);
      }
    }
  }
}

app.on('window-all-closed', () => {
  cleanupServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  app.isQuitting = true;
  cleanupServer();
});

app.on('will-quit', (event) => {
  cleanupServer();
});

// Handle process termination signals
process.on('SIGTERM', () => {
  cleanupServer();
  app.quit();
});

process.on('SIGINT', () => {
  cleanupServer();
  app.quit();
});

// Ensure cleanup on exit
process.on('exit', () => {
  cleanupServer();
});
