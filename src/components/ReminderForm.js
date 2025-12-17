import React, { useState, useEffect } from 'react';
import './ReminderForm.css';

const ReminderForm = ({ reminder, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    text: '',
    dueDate: '',
    priority: 'medium',
  });

  useEffect(() => {
    if (reminder) {
      setFormData({
        text: reminder.text || '',
        dueDate: reminder.dueDate ? reminder.dueDate.split('T')[0] : '',
        priority: reminder.priority || 'medium',
      });
    }
  }, [reminder]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.text.trim()) {
      alert('Reminder text is required');
      return;
    }
    const dataToSave = {
      ...formData,
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
    };
    onSave(dataToSave);
  };

  return (
    <div className="reminder-form-overlay">
      <div className="reminder-form-container">
        <h2>{reminder ? 'Edit Reminder' : 'New Reminder'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="text">Reminder *</label>
            <input
              type="text"
              id="text"
              name="text"
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              required
              placeholder="What needs to be done?"
            />
          </div>

          <div className="form-group">
            <label htmlFor="dueDate">Due Date</label>
            <input
              type="date"
              id="dueDate"
              name="dueDate"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="priority">Priority</label>
            <select
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {reminder ? 'Update Reminder' : 'Save Reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReminderForm;

