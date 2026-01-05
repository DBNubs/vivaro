import React, { useState } from 'react';
import './Milestones.css';

const Milestones = ({ milestones, onAdd, onEdit, onDelete, onCelebrate }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMilestone, setNewMilestone] = useState({
    title: '',
    date: '',
    description: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newMilestone.title.trim()) {
      alert('Milestone title is required');
      return;
    }
    if (!newMilestone.date) {
      alert('Milestone date is required');
      return;
    }
    onAdd(newMilestone);
    setNewMilestone({ title: '', date: '', description: '' });
    setShowAddForm(false);
  };

  // Sort milestones by date (most recent first)
  const sortedMilestones = [...milestones].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB - dateA; // Most recent first
  });

  // Helper to check if milestone is past
  const isPast = (date) => {
    if (!date) return false;
    const milestoneDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return milestoneDate < today;
  };

  const isToday = (date) => {
    if (!date) return false;
    const milestoneDate = new Date(date);
    const today = new Date();
    return milestoneDate.toDateString() === today.toDateString();
  };

  const isUpcoming = (date) => {
    if (!date) return false;
    const milestoneDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return milestoneDate > today;
  };

  return (
    <div className="milestones-section">
      <div className="milestones-header">
        <h3>Milestones & Celebrations</h3>
        {!showAddForm && (
          <button onClick={() => setShowAddForm(true)} className="btn btn-small btn-primary">
            + Add Milestone
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="milestone-form">
          <input
            type="text"
            value={newMilestone.title}
            onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
            placeholder="Milestone title (e.g., 'Project Launch', '1 Year Anniversary')"
            className="milestone-input"
            autoFocus
          />
          <div className="milestone-form-fields">
            <input
              type="date"
              value={newMilestone.date}
              onChange={(e) => setNewMilestone({ ...newMilestone, date: e.target.value })}
              className="milestone-date"
              required
            />
            <input
              type="text"
              value={newMilestone.description}
              onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
              placeholder="Description (optional)"
              className="milestone-description"
            />
            <button type="submit" className="btn btn-small btn-primary">Add</button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewMilestone({ title: '', date: '', description: '' });
              }}
              className="btn btn-small btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {sortedMilestones.length === 0 && (
        <div className="milestones-empty">
          <p>No milestones yet. Add one to celebrate achievements!</p>
        </div>
      )}

      {sortedMilestones.length > 0 && (
        <div className="milestones-list">
          {sortedMilestones.map((milestone) => {
            const milestoneIsPast = isPast(milestone.date);
            return (
              <div
                key={milestone.id}
                className={`milestone-item ${isToday(milestone.date) ? 'milestone-today' : ''} ${isUpcoming(milestone.date) ? 'milestone-upcoming' : ''} ${milestoneIsPast ? 'milestone-past' : ''} ${milestone.celebrated ? 'milestone-celebrated' : ''}`}
              >
                <div className="milestone-content">
                  <div className="milestone-icon">
                    {isToday(milestone.date) ? '🎉' : milestone.celebrated ? '🎉' : milestoneIsPast ? '📆' : '📅'}
                  </div>
                  <div className="milestone-info">
                    <h4 className="milestone-title">{milestone.title}</h4>
                    {milestone.description && (
                      <p className="milestone-description-text">{milestone.description}</p>
                    )}
                    <span className="milestone-date-badge">
                      {isToday(milestone.date) ? 'Today! 🎊' : new Date(milestone.date).toLocaleDateString('en-US', {
                        weekday: milestoneIsPast ? undefined : 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                      {milestone.celebrated && !isToday(milestone.date) && ' 🎊'}
                    </span>
                  </div>
                </div>
                <div className="milestone-actions">
                  {!milestone.celebrated && (isToday(milestone.date) || milestoneIsPast) && (
                    <button
                      onClick={() => onCelebrate(milestone.id)}
                      className="btn-celebrate"
                      title="Mark as celebrated"
                    >
                      🎊 Celebrate!
                    </button>
                  )}
                  <button
                    onClick={() => onEdit(milestone)}
                    className="btn-icon btn-edit"
                    title="Edit milestone"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.333 2.00004C11.5084 1.82468 11.7163 1.68605 11.9442 1.59231C12.1721 1.49857 12.4154 1.45166 12.6667 1.45471C12.9179 1.45776 13.1596 1.51069 13.3846 1.61004C13.6096 1.70939 13.8134 1.85314 13.9842 2.03337C14.155 2.2136 14.2894 2.4266 14.3799 2.65986C14.4704 2.89312 14.5151 3.14218 14.5113 3.39337C14.5075 3.64456 14.4553 3.8926 14.3578 4.12337C14.2603 4.35414 14.1195 4.56314 13.9427 4.73871L6.94267 11.7387L2.66667 13.3334L4.26133 9.05737L11.333 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this milestone?')) {
                        onDelete(milestone.id);
                      }
                    }}
                    className="btn-icon btn-delete"
                    title="Delete milestone"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 4H14M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0262 12.2761 14.2762C12.0261 14.5263 11.6869 14.6667 11.3333 14.6667H4.66667C4.31305 14.6667 3.97391 14.5263 3.72386 14.2762C3.47381 14.0262 3.33333 13.687 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2.31305 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31305 1.33333 6.66667 1.33333H9.33333C9.68696 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31305 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Milestones;

