import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import ClientDetail from './pages/ClientDetail';

function App() {
  useEffect(() => {
    let isNeutralinoReady = false;
    let checkInterval = null;

    // Wait for Neutralino to be ready
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

    // Initialize and wait for Neutralino
    waitForNeutralino().then((nl) => {
      if (nl) {
        console.log('Neutralino API ready', nl);
        console.log('Available APIs:', Object.keys(nl));

        // Try to set up Neutralino-specific event handlers if available
        if (nl.events && typeof nl.events.on === 'function') {
          console.log('Neutralino events API available');
          // Try to listen for window events
          try {
            // Listen for window close requests
            nl.events.on('windowClose', () => {
              console.log('Window close event from Neutralino');
              nl.app.exit();
            });

            // Also try 'close' event
            nl.events.on('close', () => {
              console.log('Close event from Neutralino');
              nl.app.exit();
            });
          } catch (e) {
            console.log('Could not set up window events:', e);
          }
        }

        // Also try to use Neutralino's window API if available
        if (nl.window) {
          console.log('Neutralino window API available', Object.keys(nl.window));
        }

        // Check if there's a way to enable keyboard shortcuts
        if (nl.os) {
          console.log('Neutralino OS API available', Object.keys(nl.os));
        }
      } else {
        console.log('Running in browser mode (Neutralino not available)');
      }
    });

    // Test: Log ALL keyboard events to see if ANY are being caught
    const testAllKeys = (event) => {
      console.log('KEY EVENT CAUGHT:', {
        key: event.key,
        code: event.code,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        target: event.target?.tagName,
        type: event.type
      });
    };

    // Handle keyboard shortcuts
    const handleKeyDown = async (event) => {
      // Log all modifier key combinations to debug
      if (event.metaKey || event.ctrlKey) {
        testAllKeys(event);
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      const key = event.key.toLowerCase();

      // Debug: log keyboard events (remove in production)
      if (modifier && (key === 'w' || key === 'q' || key === 'c' || key === 'v')) {
        console.log('Keyboard shortcut detected:', { key, modifier, isNeutralinoReady, hasNeutralino: !!window.Neutralino });
      }

      // Cmd+W or Ctrl+W: Close window (only in Neutralino)
      if (modifier && key === 'w' && !event.shiftKey && !event.altKey) {
        // Check directly each time instead of relying on isNeutralinoReady
        if (typeof window !== 'undefined' && window.Neutralino && window.Neutralino.app) {
          event.preventDefault();
          event.stopPropagation();
          console.log('Attempting to close window via Neutralino...');
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
        } else {
          console.log('Neutralino not available for Cmd+W', {
            hasWindow: typeof window !== 'undefined',
            hasNeutralino: typeof window !== 'undefined' && !!window.Neutralino,
            hasApp: typeof window !== 'undefined' && window.Neutralino && !!window.Neutralino.app
          });
        }
      }

      // Cmd+Q or Ctrl+Q: Quit application (only in Neutralino)
      if (modifier && key === 'q' && !event.shiftKey && !event.altKey) {
        // Check directly each time instead of relying on isNeutralinoReady
        if (typeof window !== 'undefined' && window.Neutralino && window.Neutralino.app) {
          event.preventDefault();
          event.stopPropagation();
          console.log('Attempting to quit app via Neutralino...');
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
        } else {
          console.log('Neutralino not available for Cmd+Q', {
            hasWindow: typeof window !== 'undefined',
            hasNeutralino: typeof window !== 'undefined' && !!window.Neutralino,
            hasApp: typeof window !== 'undefined' && window.Neutralino && !!window.Neutralino.app
          });
        }
      }

      // For copy/paste/cut/select all, ensure they work everywhere
      // These should work by default, but we make sure they're not blocked
      if (modifier && ['c', 'v', 'x', 'a'].includes(key)) {
        // Don't prevent default - let browser/webview handle it
        // This ensures shortcuts work in text inputs and contenteditable areas
        // But log if we detect the event
        if (key === 'c' || key === 'v') {
          console.log('Copy/paste shortcut detected, allowing default behavior');
        }

        // If we're in Neutralino and clipboard isn't working, try Neutralino's clipboard API
        if (typeof window !== 'undefined' && window.Neutralino && window.Neutralino.clipboard) {
          // Don't override - let the default behavior work first
          // Only use Neutralino API as fallback if needed
          console.log('Neutralino clipboard API available');
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

    // First, add a simple test listener to see if ANY keyboard events work
    const testListener = (event) => {
      console.log('TEST: Keyboard event received', event.key, event.metaKey, event.ctrlKey);
    };

    // Try adding listener immediately to body if it exists
    if (document.body) {
      document.body.addEventListener('keydown', testListener, true);
    } else {
      // Wait for body to be ready
      const observer = new MutationObserver(() => {
        if (document.body) {
          document.body.addEventListener('keydown', testListener, true);
          observer.disconnect();
        }
      });
      observer.observe(document.documentElement, { childList: true });
    }

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
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keydown', windowKeyDown, true);
      document.body?.removeEventListener('keydown', bodyKeyDown, true);
    };
  }, []);

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
      </div>
    </Router>
  );
}

export default App;
