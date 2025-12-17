import React, { useState, useEffect } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import './MeetingNoteForm.css';

const MeetingNoteForm = ({ note, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    content: '',
    label: '',
  });

  useEffect(() => {
    if (note) {
      setFormData({
        title: note.title || '',
        date: note.date ? note.date.split('T')[0] : new Date().toISOString().split('T')[0],
        content: note.content || '',
        label: note.label || '',
      });
    }
  }, [note]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditorChange = (event, editor) => {
    const data = editor.getData();
    setFormData((prev) => ({
      ...prev,
      content: data,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }
    // Strip HTML tags to check if there's actual content
    const textContent = formData.content.replace(/<[^>]*>/g, '').trim();
    if (!textContent) {
      alert('Notes content is required');
      return;
    }
    // Convert date to ISO format for storage (preserve date without timezone shift)
    let dateISO;
    if (formData.date) {
      // Create date at midnight local time, then convert to ISO
      const dateParts = formData.date.split('-');
      const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
      dateISO = date.toISOString();
    } else {
      dateISO = new Date().toISOString();
    }

    const dataToSave = {
      ...formData,
      date: dateISO,
    };
    onSave(dataToSave);
  };

  return (
    <div className="meeting-note-form-overlay">
      <div className="meeting-note-form-container">
        <h2>{note ? 'Edit Note' : 'New Note'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="Enter note title"
            />
          </div>

          <div className="form-group">
            <label htmlFor="label">Type</label>
            <select
              id="label"
              name="label"
              value={formData.label}
              onChange={handleChange}
            >
              <option value="">Select type...</option>
              <option value="Note">Note</option>
              <option value="Slack">Slack</option>
              <option value="Email">Email</option>
              <option value="Sync Call">Sync Call</option>
              <option value="Brainstorming">Brainstorming</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="date">Date *</label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">Notes *</label>
            <div className="ckeditor-wrapper">
              <CKEditor
                editor={ClassicEditor}
                data={formData.content}
                onChange={handleEditorChange}
                config={{
                  toolbar: [
                    'heading', '|',
                    'bold', 'italic', 'link', '|',
                    'bulletedList', 'numberedList', '|',
                    'blockQuote', 'insertTable', '|',
                    'undo', 'redo'
                  ],
                  placeholder: 'Enter notes...'
                }}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {note ? 'Update Notes' : 'Save Notes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MeetingNoteForm;

