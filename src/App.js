import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import ClientDetail from './pages/ClientDetail';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="app-header">
          <div className="header-container">
            <Link to="/" className="header-brand">
              <div className="header-logo">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255, 255, 255, 1)" />
                      <stop offset="100%" stopColor="rgba(255, 255, 255, 0.85)" />
                    </linearGradient>
                  </defs>
                  <rect width="36" height="36" rx="8" fill="rgba(255, 255, 255, 0.12)"/>
                  <path d="M18 9L12 13.5V22.5L18 27L24 22.5V13.5L18 9Z" stroke="url(#logoGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M12 13.5L18 18L24 13.5" stroke="url(#logoGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M18 18V27" stroke="url(#logoGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="18" cy="18" r="1.5" fill="url(#logoGradient)"/>
                </svg>
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
