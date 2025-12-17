import React, { useState } from 'react';
import './Resources.css';

const Resources = ({ resources, onAddLink, onAddFile, onEdit, onDelete }) => {
  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [showAddFileForm, setShowAddFileForm] = useState(false);
  const [newLink, setNewLink] = useState({
    title: '',
    url: '',
    description: '',
  });
  const [newFile, setNewFile] = useState({
    file: null,
    title: '',
    description: '',
  });
  const [uploading, setUploading] = useState(false);

  const handleLinkSubmit = (e) => {
    e.preventDefault();
    if (!newLink.title.trim() || !newLink.url.trim()) {
      alert('Title and URL are required');
      return;
    }
    onAddLink(newLink);
    setNewLink({ title: '', url: '', description: '' });
    setShowAddLinkForm(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewFile({
        ...newFile,
        file: file,
        title: newFile.title || file.name, // Default to filename if no title set
      });
      setShowAddFileForm(true);
    }
  };

  const handleFileSubmit = async (e) => {
    e.preventDefault();
    if (!newFile.file) {
      alert('Please select a file');
      return;
    }
    if (!newFile.title.trim()) {
      alert('Title is required');
      return;
    }

    setUploading(true);
    try {
      await onAddFile(newFile.file, newFile.title, newFile.description);
      setNewFile({ file: null, title: '', description: '' });
      setShowAddFileForm(false);
    } catch (error) {
      alert('Failed to upload file. Please try again.');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const links = resources.filter(r => r.type === 'link');
  const files = resources.filter(r => r.type === 'file');

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="resources-section">
      <div className="resources-header">
        <div className="resources-actions">
          <button
            onClick={() => {
              setShowAddLinkForm(true);
              setShowAddFileForm(false);
            }}
            className="btn btn-small btn-primary"
          >
            + Add Link
          </button>
          <label className="btn btn-small btn-secondary" style={{ cursor: 'pointer' }}>
            + Upload File
            <input
              type="file"
              onChange={handleFileSelect}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {showAddLinkForm && (
        <form onSubmit={handleLinkSubmit} className="resource-form">
          <input
            type="text"
            value={newLink.title}
            onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
            placeholder="Link title *"
            className="resource-input"
            autoFocus
            required
          />
          <input
            type="url"
            value={newLink.url}
            onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
            placeholder="URL *"
            className="resource-input"
            required
          />
          <input
            type="text"
            value={newLink.description}
            onChange={(e) => setNewLink({ ...newLink, description: e.target.value })}
            placeholder="Description (optional)"
            className="resource-input"
          />
          <div className="resource-form-actions">
            <button type="submit" className="btn btn-small btn-primary">Add</button>
            <button
              type="button"
              onClick={() => {
                setShowAddLinkForm(false);
                setNewLink({ title: '', url: '', description: '' });
              }}
              className="btn btn-small btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {showAddFileForm && (
        <form onSubmit={handleFileSubmit} className="resource-form">
          <div className="resource-file-input-wrapper">
            <label className="resource-file-label">
              Selected File: {newFile.file ? newFile.file.name : 'None'}
            </label>
            <label className="btn btn-small btn-secondary" style={{ cursor: 'pointer', display: 'inline-block' }}>
              Choose File
              <input
                type="file"
                onChange={handleFileSelect}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <input
            type="text"
            value={newFile.title}
            onChange={(e) => setNewFile({ ...newFile, title: e.target.value })}
            placeholder="File title *"
            className="resource-input"
            autoFocus
            required
          />
          <input
            type="text"
            value={newFile.description}
            onChange={(e) => setNewFile({ ...newFile, description: e.target.value })}
            placeholder="Description (optional)"
            className="resource-input"
          />
          <div className="resource-form-actions">
            <button type="submit" className="btn btn-small btn-primary" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddFileForm(false);
                setNewFile({ file: null, title: '', description: '' });
              }}
              className="btn btn-small btn-secondary"
              disabled={uploading}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {resources.length === 0 && (
        <div className="resources-empty">
          <p>No resources yet. Add a link or upload a file to get started!</p>
        </div>
      )}

      {links.length > 0 && (
        <div className="resources-group">
          <h4 className="resources-group-title">Links</h4>
          <div className="resources-list">
            {links.map((resource) => (
              <div key={resource.id} className="resource-item resource-link">
                <div className="resource-content">
                  <div className="resource-icon">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 13L13 10L10 7M7 10H13M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10C4 6.68629 6.68629 4 10 4C13.3137 4 16 6.68629 16 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="resource-info">
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="resource-title"
                    >
                      {resource.title}
                    </a>
                    {resource.description && (
                      <p className="resource-description">{resource.description}</p>
                    )}
                    <span className="resource-url">{resource.url}</span>
                  </div>
                </div>
                <div className="resource-actions">
                  <button
                    onClick={() => onEdit(resource)}
                    className="btn-icon btn-edit"
                    title="Edit resource"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.3333 2.00001C11.5084 1.8249 11.7163 1.68603 11.9447 1.59129C12.1731 1.49655 12.4173 1.44775 12.6637 1.44775C12.9101 1.44775 13.1543 1.49655 13.3827 1.59129C13.6111 1.68603 13.819 1.8249 13.9941 2.00001C14.1692 2.17512 14.3081 2.38304 14.4028 2.61143C14.4976 2.83982 14.5464 3.08401 14.5464 3.33043C14.5464 3.57685 14.4976 3.82104 14.4028 4.04943C14.3081 4.27782 14.1692 4.48574 13.9941 4.66085L5.05733 13.5975L1.33333 14.6642L2.4 10.9402L11.3333 2.00001Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this resource?')) {
                        onDelete(resource.id);
                      }
                    }}
                    className="btn-icon btn-delete"
                    title="Delete resource"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 4H14M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0262 12.2761 14.2762C12.0261 14.5263 11.6869 14.6667 11.3333 14.6667H4.66667C4.31305 14.6667 3.97391 14.5263 3.72386 14.2762C3.47381 14.0262 3.33333 13.687 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2.31305 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31305 1.33333 6.66667 1.33333H9.33333C9.68696 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31305 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="resources-group">
          <h4 className="resources-group-title">Files</h4>
          <div className="resources-list">
            {files.map((resource) => (
              <div key={resource.id} className="resource-item resource-file">
                <div className="resource-content">
                  <div className="resource-icon">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 3H11.6667L15 6.33333V15.6667C15 16.403 14.403 17 13.6667 17H5.33333C4.59695 17 4 16.403 4 15.6667V4.33333C4 3.59695 4.59695 3 5.33333 3H5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M11 3V6.33333H14.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="resource-info">
                    <a
                      href={resource.url}
                      download={resource.fileName}
                      className="resource-title"
                    >
                      {resource.title || resource.fileName}
                    </a>
                    {resource.description && (
                      <p className="resource-description">{resource.description}</p>
                    )}
                    <span className="resource-meta">
                      {resource.fileSize && formatFileSize(resource.fileSize)}
                      {resource.fileSize && resource.uploadedAt && ' • '}
                      {resource.uploadedAt && new Date(resource.uploadedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
                <div className="resource-actions">
                  <button
                    onClick={() => onEdit(resource)}
                    className="btn-icon btn-edit"
                    title="Edit file"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.3333 2.00001C11.5084 1.8249 11.7163 1.68603 11.9447 1.59129C12.1731 1.49655 12.4173 1.44775 12.6637 1.44775C12.9101 1.44775 13.1543 1.49655 13.3827 1.59129C13.6111 1.68603 13.819 1.8249 13.9941 2.00001C14.1692 2.17512 14.3081 2.38304 14.4028 2.61143C14.4976 2.83982 14.5464 3.08401 14.5464 3.33043C14.5464 3.57685 14.4976 3.82104 14.4028 4.04943C14.3081 4.27782 14.1692 4.48574 13.9941 4.66085L5.05733 13.5975L1.33333 14.6642L2.4 10.9402L11.3333 2.00001Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this file?')) {
                        onDelete(resource.id);
                      }
                    }}
                    className="btn-icon btn-delete"
                    title="Delete file"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 4H14M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0262 12.2761 14.2762C12.0261 14.5263 11.6869 14.6667 11.3333 14.6667H4.66667C4.31305 14.6667 3.97391 14.5263 3.72386 14.2762C3.47381 14.0262 3.33333 13.687 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2.31305 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31305 1.33333 6.66667 1.33333H9.33333C9.68696 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31305 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Resources;

