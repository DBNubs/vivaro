import React from 'react';
import './UpdateProgress.css';

function UpdateProgress({ isOpen, progress, status, message, error, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="update-progress-overlay">
      <div className="update-progress-modal">
        <div className="update-progress-header">
          <h2>Updating Application</h2>
        </div>

        <div className="update-progress-content">
          {error ? (
            <div className="update-progress-error">
              <div className="error-icon">⚠️</div>
              <h3>Update Failed</h3>
              <p>{error}</p>
              <button className="btn-close-update" onClick={onClose}>
                Close
              </button>
            </div>
          ) : status === 'completed' ? (
            <div className="update-progress-success">
              <div className="success-icon">✓</div>
              <h3>Update Complete!</h3>
              <p>{message || 'The application has been updated successfully.'}</p>
              <p className="restart-message">
                Please restart the application to use the new version.
              </p>
              <button className="btn-close-update" onClick={onClose}>
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="update-progress-status">
                <p className="status-message">{message || 'Preparing update...'}</p>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="progress-percentage">{Math.round(progress)}%</p>
              </div>
              <div className="update-progress-steps">
                <div className={`step ${progress >= 20 ? 'completed' : progress >= 10 ? 'active' : ''}`}>
                  <span className="step-icon">{progress >= 20 ? '✓' : progress >= 10 ? '⟳' : '○'}</span>
                  <span className="step-label">Pulling latest code</span>
                </div>
                <div className={`step ${progress >= 40 ? 'completed' : progress >= 30 ? 'active' : ''}`}>
                  <span className="step-icon">{progress >= 40 ? '✓' : progress >= 30 ? '⟳' : '○'}</span>
                  <span className="step-label">Installing dependencies</span>
                </div>
                <div className={`step ${progress >= 60 ? 'completed' : progress >= 50 ? 'active' : ''}`}>
                  <span className="step-icon">{progress >= 60 ? '✓' : progress >= 50 ? '⟳' : '○'}</span>
                  <span className="step-label">Rebuilding React app</span>
                </div>
                <div className={`step ${progress >= 80 ? 'completed' : progress >= 70 ? 'active' : ''}`}>
                  <span className="step-icon">{progress >= 80 ? '✓' : progress >= 70 ? '⟳' : '○'}</span>
                  <span className="step-label">Updating resources</span>
                </div>
                <div className={`step ${progress >= 100 ? 'completed' : progress >= 90 ? 'active' : ''}`}>
                  <span className="step-icon">{progress >= 100 ? '✓' : progress >= 90 ? '⟳' : '○'}</span>
                  <span className="step-label">Rebuilding application</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default UpdateProgress;

