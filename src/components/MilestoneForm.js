import React, { useState, useEffect } from 'react';
import './MilestoneForm.css';

const MilestoneForm = ({ milestone, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    description: '',
  });

  useEffect(() => {
    if (milestone) {
      setFormData({
        title: milestone.title || '',
        date: milestone.date ? milestone.date.split('T')[0] : '',
        description: milestone.description || '',
      });
    }
  }, [milestone]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Milestone title is required');
      return;
    }
    if (!formData.date) {
      alert('Milestone date is required');
      return;
    }
    const dataToSave = {
      ...formData,
      date: new Date(formData.date).toISOString(),
    };
    onSave(dataToSave);
  };

  return (
    <div className="milestone-form-overlay">
      <div className="milestone-form-container">
        <h2>{milestone ? 'Edit Milestone' : 'New Milestone'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Milestone Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="e.g., Project Launch, 1 Year Anniversary"
            />
          </div>

          <div className="form-group">
            <label htmlFor="date">Date *</label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
              placeholder="Optional description or notes about this milestone"
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {milestone ? 'Update Milestone' : 'Save Milestone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MilestoneForm;

