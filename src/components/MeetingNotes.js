import React, { useState } from 'react';
import './MeetingNotes.css';

const MeetingNotes = ({ notes, onEdit, onDelete }) => {
  const [expandedNote, setExpandedNote] = useState(null);
  const [filterLabel, setFilterLabel] = useState('');

  const toggleExpand = (noteId) => {
    setExpandedNote(expandedNote === noteId ? null : noteId);
  };

  // Get unique labels from notes
  const availableLabels = [...new Set(notes.map(note => note.label).filter(Boolean))].sort();

  // Filter notes by label
  const filteredNotes = filterLabel
    ? notes.filter(note => note.label === filterLabel)
    : notes;

  // Sort notes by date, most recent first
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    const dateA = new Date(a.date || a.createdAt);
    const dateB = new Date(b.date || b.createdAt);
    return dateB - dateA;
  });

  if (!notes || notes.length === 0) {
    return (
      <div className="meeting-notes-empty">
        <p>No notes yet. Create your first note to get started.</p>
      </div>
    );
  }

  return (
    <div className="meeting-notes-list">
      {availableLabels.length > 0 && (
        <div className="notes-filter">
          <label htmlFor="label-filter">Filter by type:</label>
          <select
            id="label-filter"
            value={filterLabel}
            onChange={(e) => setFilterLabel(e.target.value)}
            className="notes-filter-select"
          >
            <option value="">All Notes</option>
            {availableLabels.map(label => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </div>
      )}
      {sortedNotes.length === 0 ? (
        <div className="meeting-notes-empty">
          <p>No notes found with the selected filter.</p>
        </div>
      ) : (
        sortedNotes.map((note) => (
          <div key={note.id} className="meeting-note-card">
            <div className="meeting-note-header" onClick={() => toggleExpand(note.id)}>
              <div className="meeting-note-info">
                <div className="meeting-note-title-row">
                  <h3 className="meeting-note-title">{note.title}</h3>
                  {note.label && (
                    <span className="note-label-badge">{note.label}</span>
                  )}
                </div>
                <p className="meeting-note-date">
                  {new Date(note.date || note.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            <div className="meeting-note-actions">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(note);
                }}
                className="btn-icon btn-edit"
                title="Edit notes"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.333 2.00004C11.5084 1.82468 11.7163 1.68605 11.9442 1.59231C12.1721 1.49857 12.4154 1.45166 12.6667 1.45471C12.9179 1.45776 13.1596 1.51069 13.3846 1.61004C13.6096 1.70939 13.8134 1.85314 13.9842 2.03337C14.155 2.2136 14.2894 2.4266 14.3799 2.65986C14.4704 2.89312 14.5151 3.14218 14.5113 3.39337C14.5075 3.64456 14.4553 3.8926 14.3578 4.12337C14.2603 4.35414 14.1195 4.56314 13.9427 4.73871L6.94267 11.7387L2.66667 13.3334L4.26133 9.05737L11.333 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Are you sure you want to delete this note?')) {
                    onDelete(note.id);
                  }
                }}
                className="btn-icon btn-delete"
                title="Delete note"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4H14M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0262 12.2761 14.2762C12.0261 14.5263 11.6869 14.6667 11.3333 14.6667H4.66667C4.31305 14.6667 3.97391 14.5263 3.72386 14.2762C3.47381 14.0262 3.33333 13.687 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2.31305 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31305 1.33333 6.66667 1.33333H9.33333C9.68696 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31305 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
          {expandedNote === note.id && (
            <div className="meeting-note-content">
              <div
                className="meeting-note-text"
                dangerouslySetInnerHTML={{ __html: note.content || '' }}
              />
            </div>
          )}
        </div>
        ))
      )}
    </div>
  );
};

export default MeetingNotes;

