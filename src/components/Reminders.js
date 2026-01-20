import React, { useState } from 'react';
import './Reminders.css';

const Reminders = ({ reminders, onAdd, onEdit, onComplete, onDelete, confirmDialog }) => {
  const doConfirm = async (title, message) => {
    if (confirmDialog) {
      const result = await confirmDialog(title, message, 'YES_NO', 'QUESTION');
      return result === 'YES';
    }
    return window.confirm(message);
  };
  const [showAddForm, setShowAddForm] = useState(false);
  const [newReminder, setNewReminder] = useState({
    text: '',
    dueDate: '',
    priority: 'medium',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newReminder.text.trim()) {
      alert('Reminder text is required');
      return;
    }
    // Create date at local midnight to avoid timezone issues
    let dueDateISO = null;
    if (newReminder.dueDate) {
      const [year, month, day] = newReminder.dueDate.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      dueDateISO = localDate.toISOString();
    }
    onAdd({
      ...newReminder,
      dueDate: dueDateISO,
    });
    setNewReminder({ text: '', dueDate: '', priority: 'medium' });
    setShowAddForm(false);
  };

  const activeReminders = reminders.filter(r => !r.completed);
  const completedReminders = reminders.filter(r => r.completed);

  // Sort by due date (overdue first, then by date)
  const sortedReminders = [...activeReminders].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    // Extract date from ISO string to avoid timezone shifts
    const dateStr = dueDate.split('T')[0];
    const [year, month, day] = dateStr.split('-').map(Number);
    const dueDateLocal = new Date(year, month - 1, day);
    const today = new Date();
    const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dueDateLocal < todayLocal;
  };

  const isDueToday = (dueDate) => {
    if (!dueDate) return false;
    // Extract date from ISO string to avoid timezone shifts
    const dateStr = dueDate.split('T')[0];
    const [year, month, day] = dateStr.split('-').map(Number);
    const dueDateLocal = new Date(year, month - 1, day);
    const today = new Date();
    const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dueDateLocal.getTime() === todayLocal.getTime();
  };

  return (
    <div className="reminders-section">
      <div className="reminders-header">
        <h3>Reminders</h3>
        {!showAddForm && (
          <button onClick={() => setShowAddForm(true)} className="btn btn-small btn-primary">
            + Add Reminder
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="reminder-form">
          <input
            type="text"
            value={newReminder.text}
            onChange={(e) => setNewReminder({ ...newReminder, text: e.target.value })}
            placeholder="What needs to be done?"
            className="reminder-input"
            autoFocus
          />
          <div className="reminder-form-fields">
            <input
              type="date"
              value={newReminder.dueDate}
              onChange={(e) => setNewReminder({ ...newReminder, dueDate: e.target.value })}
              className="reminder-date"
            />
            <select
              value={newReminder.priority}
              onChange={(e) => setNewReminder({ ...newReminder, priority: e.target.value })}
              className="reminder-priority"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <button type="submit" className="btn btn-small btn-primary">Add</button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewReminder({ text: '', dueDate: '', priority: 'medium' });
              }}
              className="btn btn-small btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {sortedReminders.length === 0 && completedReminders.length === 0 && (
        <div className="reminders-empty">
          <p>No reminders yet. Add one to get started!</p>
        </div>
      )}

      {sortedReminders.length > 0 && (
        <div className="reminders-list">
          {sortedReminders.map((reminder) => (
            <div
              key={reminder.id}
              className={`reminder-item reminder-${reminder.priority} ${isOverdue(reminder.dueDate) ? 'overdue' : ''} ${isDueToday(reminder.dueDate) ? 'due-today' : ''}`}
            >
              <div className="reminder-content">
                <button
                  onClick={() => onComplete(reminder.id)}
                  className="reminder-checkbox"
                  title="Mark as complete"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2"/>
                    {reminder.completed && (
                      <path d="M6 10L9 13L14 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    )}
                  </svg>
                </button>
                <div className="reminder-text">
                  <span>{reminder.text}</span>
                  {reminder.dueDate && (
                    <span className="reminder-date-badge">
                      {isOverdue(reminder.dueDate) && '⚠️ '}
                      {isDueToday(reminder.dueDate) && '📅 '}
                      {(() => {
                        // Extract date from ISO string to avoid timezone shifts
                        const dateStr = reminder.dueDate.split('T')[0];
                        const [year, month, day] = dateStr.split('-').map(Number);
                        const localDate = new Date(year, month - 1, day);
                        const currentYear = new Date().getFullYear();
                        return localDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: year !== currentYear ? 'numeric' : undefined
                        });
                      })()}
                    </span>
                  )}
                </div>
              </div>
              <div className="reminder-actions">
                <button
                  onClick={() => onComplete(reminder.id)}
                  className="btn-complete"
                  title="Mark as complete"
                >
                  Complete
                </button>
                <button
                  onClick={() => onEdit(reminder)}
                  className="btn-icon btn-edit"
                  title="Edit reminder"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.333 2.00004C11.5084 1.82468 11.7163 1.68605 11.9442 1.59231C12.1721 1.49857 12.4154 1.45166 12.6667 1.45471C12.9179 1.45776 13.1596 1.51069 13.3846 1.61004C13.6096 1.70939 13.8134 1.85314 13.9842 2.03337C14.155 2.2136 14.2894 2.4266 14.3799 2.65986C14.4704 2.89312 14.5151 3.14218 14.5113 3.39337C14.5075 3.64456 14.4553 3.8926 14.3578 4.12337C14.2603 4.35414 14.1195 4.56314 13.9427 4.73871L6.94267 11.7387L2.66667 13.3334L4.26133 9.05737L11.333 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (await doConfirm('Delete Reminder', 'Are you sure you want to delete this reminder?')) {
                      try {
                        await onDelete(reminder.id);
                      } catch (error) {
                        console.error('Delete reminder error:', error);
                        alert('Failed to delete: ' + (error.message || 'Unknown error'));
                      }
                    }
                  }}
                  className="btn-icon btn-delete"
                  title="Delete reminder"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ pointerEvents: 'none' }}>
                    <path d="M2 4H14M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0262 12.2761 14.2762C12.0261 14.5263 11.6869 14.6667 11.3333 14.6667H4.66667C4.31305 14.6667 3.97391 14.5263 3.72386 14.2762C3.47381 14.0262 3.33333 13.687 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2.31305 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31305 1.33333 6.66667 1.33333H9.33333C9.68696 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31305 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {completedReminders.length > 0 && (
        <details className="completed-reminders">
          <summary>Completed ({completedReminders.length})</summary>
          <div className="reminders-list">
            {completedReminders.map((reminder) => (
              <div key={reminder.id} className="reminder-item reminder-completed">
            <div className="reminder-content">
              <button
                onClick={() => onComplete(reminder.id)}
                className="reminder-checkbox"
                title="Mark as incomplete"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" fill="currentColor"/>
                  <path d="M6 10L9 13L14 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="reminder-text">
                <span className="completed-text">{reminder.text}</span>
              </div>
            </div>
            <div className="reminder-actions">
              <button
                onClick={() => onComplete(reminder.id)}
                className="btn-complete btn-complete-incomplete"
                title="Mark as incomplete"
              >
                Reopen
              </button>
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (await doConfirm('Delete Reminder', 'Are you sure you want to delete this reminder?')) {
                    try {
                      await onDelete(reminder.id);
                    } catch (error) {
                      console.error('Delete reminder error:', error);
                      alert('Failed to delete: ' + (error.message || 'Unknown error'));
                    }
                  }
                }}
                className="btn-icon btn-delete"
                title="Delete reminder"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ pointerEvents: 'none' }}>
                  <path d="M2 4H14M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0262 12.2761 14.2762C12.0261 14.5263 11.6869 14.6667 11.3333 14.6667H4.66667C4.31305 14.6667 3.97391 14.5263 3.72386 14.2762C3.47381 14.0262 3.33333 13.687 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2.31305 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31305 1.33333 6.66667 1.33333H9.33333C9.68696 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31305 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

export default Reminders;

