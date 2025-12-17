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
          <Link to="/" className="header-link">
            <h1>Project Management Dashboard</h1>
            <p className="subtitle">Support & Maintenance Clients</p>
          </Link>
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
