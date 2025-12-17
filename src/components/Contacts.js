import React, { useState } from 'react';
import './Contacts.css';

const Contacts = ({ contacts, onAdd, onEdit, onDelete }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    title: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newContact.name.trim() || !newContact.email.trim()) {
      alert('Name and email are required');
      return;
    }
    onAdd(newContact);
    setNewContact({ name: '', email: '', title: '' });
    setShowAddForm(false);
  };

  return (
    <div className="contacts-section">
      <div className="contacts-header">
        <h3>Contacts</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn btn-small btn-primary"
        >
          + Add Contact
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="contact-form-inline">
          <input
            type="text"
            value={newContact.name}
            onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
            placeholder="Name *"
            className="contact-input"
            autoFocus
            required
          />
          <input
            type="email"
            value={newContact.email}
            onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
            placeholder="Email *"
            className="contact-input"
            required
          />
          <input
            type="text"
            value={newContact.title}
            onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
            placeholder="Title"
            className="contact-input"
          />
          <div className="contact-form-actions">
            <button type="submit" className="btn btn-small btn-primary">Add</button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewContact({ name: '', email: '', title: '' });
              }}
              className="btn btn-small btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {contacts.length === 0 && !showAddForm && (
        <div className="contacts-empty">
          <p>No contacts yet. Add a contact to get started!</p>
        </div>
      )}

      {contacts.length > 0 && (
        <div className="contacts-list">
          {contacts.map((contact) => (
            <div key={contact.id} className="contact-item">
              <div className="contact-info">
                <div className="contact-name">{contact.name}</div>
                {contact.title && (
                  <div className="contact-title">{contact.title}</div>
                )}
                <div className="contact-email">
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </div>
              </div>
              <div className="contact-actions">
                <button
                  onClick={() => onEdit(contact)}
                  className="btn-icon btn-edit"
                  title="Edit contact"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.3333 2.00001C11.5084 1.8249 11.7163 1.68603 11.9447 1.59129C12.1731 1.49655 12.4173 1.44775 12.6637 1.44775C12.9101 1.44775 13.1543 1.49655 13.3827 1.59129C13.6111 1.68603 13.819 1.8249 13.9941 2.00001C14.1692 2.17512 14.3081 2.38304 14.4028 2.61143C14.4976 2.83982 14.5464 3.08401 14.5464 3.33043C14.5464 3.57685 14.4976 3.82104 14.4028 4.04943C14.3081 4.27782 14.1692 4.48574 13.9941 4.66085L5.05733 13.5975L1.33333 14.6642L2.4 10.9402L11.3333 2.00001Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Delete this contact?')) {
                      onDelete(contact.id);
                    }
                  }}
                  className="btn-icon btn-delete"
                  title="Delete contact"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 4H14M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0262 12.2761 14.2762C12.0261 14.5263 11.6869 14.6667 11.3333 14.6667H4.66667C4.31305 14.6667 3.97391 14.5263 3.72386 14.2762C3.47381 14.0262 3.33333 13.687 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2.31305 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31305 1.33333 6.66667 1.33333H9.33333C9.68696 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31305 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Contacts;

