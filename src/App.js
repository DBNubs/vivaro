import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import ClientDetail from './pages/ClientDetail';

function App() {
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
