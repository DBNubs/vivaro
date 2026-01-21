import React, { useEffect, useState, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import ClientDetail from './pages/ClientDetail';
import UpdateProgress from './components/UpdateProgress';

// Helper function to show native message box
async function showMessageBox(title, content, choice = 'OK', icon = 'INFO') {
  if (typeof window !== 'undefined' && window.Neutralino && window.Neutralino.os && window.Neutralino.os.showMessageBox) {
    try {
      return await window.Neutralino.os.showMessageBox(title, content, choice, icon);
    } catch (error) {
      console.error('Error showing native message box:', error);
      // Fallback to browser alert
      if (choice === 'OK') {
        alert(`${title}\n\n${content}`);
        return 'OK';
      } else {
        return window.confirm(`${title}\n\n${content}`) ? 'YES' : 'NO';
      }
    }
  } else {
    // Fallback to browser alert/confirm
    if (choice === 'OK') {
      alert(`${title}\n\n${content}`);
      return 'OK';
    } else {
      return window.confirm(`${title}\n\n${content}`) ? 'YES' : 'NO';
    }
  }
}

function App() {
  const [updateState, setUpdateState] = useState({
    isOpen: false,
    progress: 0,
    status: 'idle',
    message: '',
    error: null
  });

  const [downloadModal, setDownloadModal] = useState({
    isOpen: false,
    currentVersion: '',
    latestVersion: '',
    releasesUrl: 'https://github.com/DBNubs/vivaro/releases/latest'
  });

  // Store polling interval reference for cleanup
  const pollingIntervalRef = useRef(null);

  // Function to perform the update
  const performUpdate = useCallback(async () => {
    try {
      const result = await showMessageBox(
        'Confirm Update',
        'This will download and install the latest version.\n\nThe application will need to be restarted after the update completes.\n\nDo you want to continue?',
        'YES_NO',
        'QUESTION'
      );

      if (result !== 'YES') {
        return;
      }

      // First, verify the status endpoint is available
      try {
        const statusCheck = await fetch('http://localhost:3001/api/updates/status');
        if (!statusCheck.ok) {
          if (statusCheck.status === 404) {
            setUpdateState({
              isOpen: true,
              progress: 0,
              status: 'error',
              message: 'Update failed',
              error: 'Update status endpoint not found. Please restart the server to enable progress tracking, then try again.'
            });
            return;
          }
        }
      } catch (statusError) {
        console.warn('Could not verify status endpoint:', statusError);
        // Continue anyway - might be a temporary network issue
      }

      // Show progress dialog
      setUpdateState({
        isOpen: true,
        progress: 0,
        status: 'in_progress',
        message: 'Starting update...',
        error: null
      });

      const response = await fetch('http://localhost:3001/api/updates/perform', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await response.json();

      // Start polling for status
      let pollAttempts = 0;
      const maxPollAttempts = 60; // 30 seconds max (60 * 500ms)
      const pollInterval = setInterval(async () => {
        pollAttempts++;
        try {
          const statusResponse = await fetch('http://localhost:3001/api/updates/status');
          if (!statusResponse.ok) {
            // If we get a 404, the endpoint might not be available
            // This could happen if the server hasn't been restarted with the new endpoint
            if (statusResponse.status === 404) {
              if (pollAttempts >= maxPollAttempts) {
                clearInterval(pollInterval);
                pollingIntervalRef.current = null;
                setUpdateState(prev => ({
                  ...prev,
                  status: 'error',
                  error: 'Update status endpoint not found. Please restart the server and try again.'
                }));
              }
              return;
            }
            throw new Error(`HTTP error! status: ${statusResponse.status}`);
          }
          const statusData = await statusResponse.json();

          setUpdateState(prev => ({
            ...prev,
            progress: statusData.progress || 0,
            status: statusData.status || 'in_progress',
            message: statusData.message || 'Updating...',
            error: statusData.error || null
          }));

          // Stop polling if update is complete or failed
          if (statusData.status === 'completed' || statusData.status === 'error') {
            clearInterval(pollInterval);
            pollingIntervalRef.current = null;
          }
        } catch (error) {
          console.error('Error polling update status:', error);
          // Only fail after multiple attempts or if it's not a 404
          if (!error.message.includes('404') || pollAttempts >= maxPollAttempts) {
            clearInterval(pollInterval);
            pollingIntervalRef.current = null;
            setUpdateState(prev => ({
              ...prev,
              status: 'error',
              error: `Failed to check update status: ${error.message}`
            }));
          }
        }
      }, 500); // Poll every 500ms

      pollingIntervalRef.current = pollInterval;

    } catch (error) {
      console.error('Error performing update:', error);
      setUpdateState({
        isOpen: true,
        progress: 0,
        status: 'error',
        message: 'Update failed',
        error: `Failed to start update: ${error.message}\n\nPlease try again later.`
      });
    }
  }, []);

  // Function to restart the application
  const restartApplication = useCallback(async () => {
    console.log('restartApplication called');

    // Close the update dialog first to avoid UI conflicts
    setUpdateState({
      isOpen: false,
      progress: 0,
      status: 'idle',
      message: '',
      error: null
    });

    try {
      // First, test if server is running current code (optional check)
      console.log('Testing server endpoint...');
      let testEndpointAvailable = false;
      try {
        const testResponse = await fetch('http://localhost:3001/api/test');
        if (testResponse.ok) {
          const testData = await testResponse.json();
          testEndpointAvailable = true;
          console.log('Server test response:', testData);
          console.log('Server version:', testData.version || 'unknown');

          if (!testData.hasRestartRoute) {
            const routeList = testData.routes?.map(r => `${r.methods.join(', ').toUpperCase()} ${r.path}`).join('\n') || 'none';
            throw new Error(`Server is running but restart route is not available.\n\nServer version: ${testData.version || 'unknown'}\nServer file: ${testData.serverFile}\nAvailable routes:\n${routeList}`);
          }

          // Verify version
          if (testData.version !== '2026.01.12-with-restart') {
            console.warn('Server version mismatch. Expected: 2026.01.12-with-restart, Got:', testData.version);
          }
        } else {
          const errorText = await testResponse.text();
          console.warn('Test endpoint returned error:', testResponse.status, errorText);
          // Don't throw here - try the restart anyway
        }
      } catch (testError) {
        console.warn('Test endpoint error (non-fatal):', testError);
        // Continue to try restart anyway - the test endpoint might not exist in old code
        // but the restart endpoint might still work if it was added separately
      }

      console.log('Calling restart endpoint...');
      // Use the server-side restart endpoint to avoid thread issues
      // The server will launch a new instance, then we can close this one
      const response = await fetch('http://localhost:3001/api/restart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('Restart endpoint response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Restart endpoint error:', errorText);
        console.error('Response status:', response.status);

        // Check if it's a 404 - route doesn't exist
        if (response.status === 404) {
          let detailedError = `Restart endpoint not found (404).`;
          if (!testEndpointAvailable) {
            detailedError += `\n\nThe test endpoint also returned 404, confirming the server is running very old code.`;
          }
          detailedError += `\n\nThe server process needs to be killed and restarted to load the new code.`;
          throw new Error(detailedError);
        }

        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const result = await response.json();
      console.log('Restart initiated:', result);

      // Don't try to exit - just show a message and let the new instance take over
      // The new instance will start, and the old one can be closed manually or will
      // be replaced when the user opens the app again
      // This avoids the crash from calling app.exit() from a background thread

      // Show a message that the new instance is starting
      setTimeout(async () => {
        try {
          await showMessageBox(
            'Restarting Application',
            'A new instance of the application is starting.\n\nYou can close this window manually, or it will be replaced when you open the app again.',
            'OK',
            'INFO'
          );
        } catch (error) {
          console.error('Error showing message:', error);
        }
      }, 1000);
    } catch (error) {
      console.error('Error restarting application:', error);
      console.error('Error stack:', error.stack);

      let errorMessage = `Failed to restart: ${error.message}`;

      if (error.message.includes('404') || error.message.includes('not found') || error.message.includes('old code')) {
        errorMessage += `\n\nThe server is running old code that doesn't have the restart endpoint.`;
        errorMessage += `\n\n⚠️ IMPORTANT: You must kill the server process and restart it.`;
        errorMessage += `\n\nThe server process is currently running old code. Simply closing and reopening the app may not work if the server is started automatically.`;
        errorMessage += `\n\nTo fix this:`;
        errorMessage += `\n\n1. Open Terminal (Applications > Utilities > Terminal)`;
        errorMessage += `\n2. Run this command to kill the server:`;
        errorMessage += `\n   lsof -ti:3001 | xargs kill -9`;
        errorMessage += `\n3. Verify it's killed (should return nothing):`;
        errorMessage += `\n   lsof -ti:3001`;
        errorMessage += `\n4. Close this application completely`;
        errorMessage += `\n5. Reopen the application`;
        errorMessage += `\n\nIf you're running in development mode:`;
        errorMessage += `\n1. Find the terminal window running "npm run server"`;
        errorMessage += `\n2. Press Ctrl+C to stop it`;
        errorMessage += `\n3. Run: npm run server`;
        errorMessage += `\n\nAfter restarting, the test endpoint should work and show version "2026.01.12-with-restart".`;
      } else {
        errorMessage += `\n\nPlease manually close and reopen the application.`;
      }

      // Show error in update dialog
      setUpdateState({
        isOpen: true,
        progress: 100,
        status: 'error',
        message: 'Restart failed',
        error: errorMessage
      });
    }
  }, []);

  // Function to check for updates
  const checkForUpdates = useCallback(async () => {
    console.log('checkForUpdates function called');
    try {
      console.log('Fetching from http://localhost:3001/api/updates/check');
      const response = await fetch('http://localhost:3001/api/updates/check');

      console.log('Response status:', response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Update check response:', data);

      // Check if there was an error checking for updates
      if (data.error) {
        await showMessageBox(
          data.error,
          `${data.message || ''}\n\nCurrent version: ${data.currentVersion}`,
          'OK',
          'WARNING'
        );
        return;
      }

      // Check if up to date
      if (data.isUpToDate === true) {
        console.log('Version is up to date, showing message');
        await showMessageBox(
          'No Updates Available',
          `You are running version ${data.currentVersion}, which is the latest version.`,
          'OK',
          'INFO'
        );
      } else if (data.latestVersion) {
        // Update available
        const canPerformInApp = data.canPerformInApp === true;
        const releasesUrl = data.releasesUrl || 'https://github.com/DBNubs/vivaro/releases/latest';

        if (canPerformInApp) {
          console.log('Update available, showing in-app update prompt');
          const updateMessage = `Update available!\n\nCurrent version: ${data.currentVersion}\nLatest version: ${data.latestVersion}\n\nWould you like to update now?`;
          const result = await showMessageBox('Update Available', updateMessage, 'YES_NO', 'QUESTION');

          if (result === 'YES') {
            await performUpdate();
          }
        } else {
          console.log('Update available, in-app update not supported — showing download modal');
          setDownloadModal({
            isOpen: true,
            currentVersion: data.currentVersion,
            latestVersion: data.latestVersion,
            releasesUrl
          });
        }
      } else {
        // Fallback - shouldn't happen but just in case
        console.log('Unexpected response format');
        await showMessageBox(
          'Update Check',
          `Unable to determine update status.\n\nCurrent version: ${data.currentVersion || 'unknown'}`,
          'OK',
          'WARNING'
        );
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      await showMessageBox(
        'Update Check Failed',
        `Failed to check for updates: ${error.message}\n\nPlease check your internet connection and try again.`,
        'OK',
        'ERROR'
      );
    }
  }, [performUpdate]);

  useEffect(() => {
    let isNeutralinoReady = false;
    let checkInterval = null;

    // Initialize Neutralino if available
    if (typeof window !== 'undefined' && window.Neutralino) {
      try {
        // Initialize Neutralino
        if (typeof window.Neutralino.init === 'function') {
          window.Neutralino.init();
        }

        // Set up menu in the ready event
        if (window.Neutralino.events && typeof window.Neutralino.events.on === 'function') {
          window.Neutralino.events.on('ready', () => {
            const nl = window.Neutralino;

            // Set up system menu
            if (nl.window) {
              try {
                // Try different menu API methods based on Neutralino version
                if (typeof nl.window.setMainMenu === 'function') {
                  const menu = [
                    {
                      id: 'vivaro',
                      text: 'Vivaro',
                      menuItems: [
                        {
                          id: 'checkForUpdates',
                          text: 'Check for updates...'
                        }
                      ]
                    },
                    {
                      id: 'edit',
                      text: 'Edit',
                      menuItems: [
                        { id: 'cut', text: 'Cut', action: 'cut:', shortcut: 'x' },
                        { id: 'copy', text: 'Copy', action: 'copy:', shortcut: 'c' },
                        { id: 'paste', text: 'Paste', action: 'paste:', shortcut: 'v' },
                        { id: 'selectAll', text: 'Select All', action: 'selectAll:', shortcut: 'a' }
                      ]
                    }
                  ];
                  nl.window.setMainMenu(menu);
                } else if (typeof nl.window.setMenu === 'function') {
                  const menu = [
                    {
                      id: 'vivaro',
                      text: 'Vivaro',
                      menuItems: [
                        {
                          id: 'checkForUpdates',
                          text: 'Check for updates...'
                        }
                      ]
                    },
                    {
                      id: 'edit',
                      text: 'Edit',
                      menuItems: [
                        { id: 'cut', text: 'Cut', action: 'cut:', shortcut: 'x' },
                        { id: 'copy', text: 'Copy', action: 'copy:', shortcut: 'c' },
                        { id: 'paste', text: 'Paste', action: 'paste:', shortcut: 'v' },
                        { id: 'selectAll', text: 'Select All', action: 'selectAll:', shortcut: 'a' }
                      ]
                    }
                  ];
                  nl.window.setMenu(menu);
                }
              } catch (e) {
                console.error('Could not set up system menu:', e);
              }
            }

            // Listen for menu actions
            nl.events.on('mainMenuItemClicked', async (event) => {
              const id = event.detail?.id;
              // Edit menu: cut, copy, paste, selectAll (for Neutralino WebView where shortcuts may not work)
              if (['cut', 'copy', 'paste', 'selectAll'].includes(id)) {
                try {
                  const cmd = id === 'selectAll' ? 'selectAll' : id;
                  document.execCommand(cmd);
                } catch (e) {
                  console.error(`Error executing ${id}:`, e);
                }
                return;
              }
              if (id === 'checkForUpdates') {
                try {
                  await checkForUpdates();
                } catch (error) {
                  console.error('Error in checkForUpdates:', error);
                  alert(`Error checking for updates: ${error.message}`);
                }
              }
            });

            // Also try menuItemClicked as fallback
            nl.events.on('menuItemClicked', async (event) => {
              const id = event.detail?.id ?? event.detail?.action;
              if (['cut', 'copy', 'paste', 'selectAll'].includes(id)) {
                try {
                  const cmd = id === 'selectAll' ? 'selectAll' : id;
                  document.execCommand(cmd);
                } catch (e) {
                  console.error(`Error executing ${id}:`, e);
                }
                return;
              }
              if (id === 'checkForUpdates') {
                try {
                  await checkForUpdates();
                } catch (error) {
                  console.error('Error in checkForUpdates:', error);
                  alert(`Error checking for updates: ${error.message}`);
                }
              }
            });
          });
        }
      } catch (e) {
        console.error('Error initializing Neutralino:', e);
      }
    }

    // Wait for Neutralino to be ready (fallback for existing code)
    const waitForNeutralino = () => {
      return new Promise((resolve) => {
        if (typeof window !== 'undefined' && window.Neutralino && window.Neutralino.app) {
          isNeutralinoReady = true;
          resolve(window.Neutralino);
          return;
        }

        // Check periodically for Neutralino
        checkInterval = setInterval(() => {
          if (typeof window !== 'undefined' && window.Neutralino && window.Neutralino.app) {
            isNeutralinoReady = true;
            clearInterval(checkInterval);
            resolve(window.Neutralino);
          }
        }, 100);

        // Timeout after 5 seconds
        setTimeout(() => {
          if (checkInterval) {
            clearInterval(checkInterval);
          }
          resolve(null);
        }, 5000);
      });
    };

    // Initialize and wait for Neutralino (for other functionality)
    waitForNeutralino().then((nl) => {
      if (nl) {
        // Try to set up Neutralino-specific event handlers if available
        if (nl.events && typeof nl.events.on === 'function') {
          // Try to listen for window events
          try {
            // Listen for window close requests
            nl.events.on('windowClose', () => {
              nl.app.exit();
            });

            // Also try 'close' event
            nl.events.on('close', () => {
              nl.app.exit();
            });
          } catch (e) {
            // Silently fail if events can't be set up
          }
        }
      }
    });

    // Handle keyboard shortcuts
    const handleKeyDown = async (event) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      const key = event.key.toLowerCase();

      // Cmd+W or Ctrl+W: Close window (only in Neutralino)
      if (modifier && key === 'w' && !event.shiftKey && !event.altKey) {
        // Check directly each time instead of relying on isNeutralinoReady
        if (typeof window !== 'undefined' && window.Neutralino && window.Neutralino.app) {
          event.preventDefault();
          event.stopPropagation();
          try {
            // Try with await first (if API is async)
            const result = window.Neutralino.app.exit();
            if (result && typeof result.then === 'function') {
              await result;
            }
          } catch (error) {
            console.error('Error closing window:', error);
            // Fallback: try calling directly
            try {
              window.Neutralino.app.exit();
            } catch (e) {
              console.error('Fallback exit also failed:', e);
            }
          }
          return false;
        }
      }

      // Cmd+Q or Ctrl+Q: Quit application (only in Neutralino)
      if (modifier && key === 'q' && !event.shiftKey && !event.altKey) {
        // Check directly each time instead of relying on isNeutralinoReady
        if (typeof window !== 'undefined' && window.Neutralino && window.Neutralino.app) {
          event.preventDefault();
          event.stopPropagation();
          try {
            // Try with await first (if API is async)
            const result = window.Neutralino.app.exit();
            if (result && typeof result.then === 'function') {
              await result;
            }
          } catch (error) {
            console.error('Error quitting app:', error);
            // Fallback: try calling directly
            try {
              window.Neutralino.app.exit();
            } catch (e) {
              console.error('Fallback exit also failed:', e);
            }
          }
          return false;
        }
      }

      // Cmd+C, Cmd+V, Cmd+X, Cmd+A: Copy, paste, cut, select all
      // In Neutralino's WebView on macOS these often don't work; run execCommand explicitly.
      if (modifier && ['c', 'v', 'x', 'a'].includes(key) && !event.shiftKey && !event.altKey) {
        if (typeof window !== 'undefined' && window.Neutralino && window.Neutralino.app) {
          const cmd = { c: 'copy', v: 'paste', x: 'cut', a: 'selectAll' }[key];
          try {
            document.execCommand(cmd);
          } catch (e) {
            console.error(`Error executing ${cmd}:`, e);
          }
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
    };

    // Also add a window-level listener as fallback
    const windowKeyDown = (event) => {
      // Let the document handler take precedence, but this ensures we catch events
      // that might not bubble to document
      handleKeyDown(event);
    };

    // Add event listener with capture phase to catch events early
    // Use capture phase to ensure we handle events before they're blocked
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keydown', windowKeyDown, true);

    // Also listen at the body level as another fallback
    const bodyKeyDown = (event) => {
      handleKeyDown(event);
    };
    if (document.body) {
      document.body.addEventListener('keydown', bodyKeyDown, true);
    }

    // Cleanup
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keydown', windowKeyDown, true);
      document.body?.removeEventListener('keydown', bodyKeyDown, true);
    };
  }, [checkForUpdates]);

  return (
    <Router>
      <div className="App">
        <header className="app-header" role="banner">
          <div className="header-container">
            <Link to="/" className="header-brand" aria-label="Vivaro - Go to homepage">
              <div className="header-logo" aria-hidden="true">
                <img src="/logo64.png" alt="" className="header-logo-img" />
              </div>
              <div className="header-text">
                <h1>Vivaro</h1>
                <p className="subtitle">Where professionals manage clients</p>
              </div>
            </Link>
          </div>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/client/:id" element={<ClientDetail />} />
          </Routes>
        </main>

        <UpdateProgress
          isOpen={updateState.isOpen}
          progress={updateState.progress}
          status={updateState.status}
          message={updateState.message}
          error={updateState.error}
          onClose={() => setUpdateState({
            isOpen: false,
            progress: 0,
            status: 'idle',
            message: '',
            error: null
          })}
          onRestart={restartApplication}
        />

        {downloadModal.isOpen && (
          <div className="download-modal-overlay" role="dialog" aria-labelledby="download-modal-title" aria-modal="true">
            <div className="download-modal">
              <div className="download-modal-header">
                <h2 id="download-modal-title">Update Available</h2>
              </div>
              <div className="download-modal-content">
                <p>Current version: {downloadModal.currentVersion}</p>
                <p>Latest version: {downloadModal.latestVersion}</p>
                <p className="download-modal-hint">In-app update is not available for this installation. Download <strong>Vivaro-Installer.dmg</strong> from the Assets section and open it to install.</p>
                <div className="download-modal-actions">
                  <button
                    type="button"
                    className="btn-open-releases"
                    onClick={() => {
                      try {
                        if (window.Neutralino?.os?.open) {
                          window.Neutralino.os.open(downloadModal.releasesUrl);
                        } else {
                          window.open(downloadModal.releasesUrl, '_blank');
                        }
                      } catch (e) {
                        window.open(downloadModal.releasesUrl, '_blank');
                      }
                    }}
                  >
                    Open Releases Page
                  </button>
                  <button
                    type="button"
                    className="btn-close-download"
                    onClick={() => setDownloadModal(prev => ({ ...prev, isOpen: false }))}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;

