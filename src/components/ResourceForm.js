import React, { useState, useEffect } from 'react';
import './ResourceForm.css';

const ResourceForm = ({ resource, onSave, onCancel, existingResources = [] }) => {
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    description: '',
  });

  useEffect(() => {
    if (resource) {
      setFormData({
        title: resource.title || '',
        url: resource.url || '',
        description: resource.description || '',
      });
    }
  }, [resource]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (resource && resource.type === 'link') {
      if (!formData.title.trim() || !formData.url.trim()) {
        alert('Title and URL are required');
        return;
      }
    } else {
      // For files or new resources, title is required
      if (!formData.title.trim()) {
        alert('Title is required');
        return;
      }
    }
    onSave(formData);
  };

  return (
    <div className="resource-form-overlay">
      <div className="resource-form-container">
        <h2>{resource ? `Edit ${resource.type === 'link' ? 'Link' : 'File'}` : 'New Resource'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="Resource title"
            />
          </div>

          {resource && resource.type === 'link' && (
            <div className="form-group">
              <label htmlFor="url">URL *</label>
              <input
                type="url"
                id="url"
                name="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                required
                placeholder="https://example.com"
              />
            </div>
          )}

          {resource && resource.type === 'file' && (
            <div className="form-group">
              <label htmlFor="url">File URL</label>
              <input
                type="text"
                id="url"
                name="url"
                value={formData.url}
                disabled
                className="disabled-input"
              />
              <small className="form-help-text">File URL cannot be changed. Upload a new file to replace it.</small>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              rows="3"
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {resource ? 'Update Resource' : 'Save Resource'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResourceForm;

