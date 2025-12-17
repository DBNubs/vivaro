import React, { useState, useEffect } from 'react';
import './ClientForm.css';

const ClientForm = ({ client, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    status: 'active',
    notes: '',
    contacts: [],
    sows: [],
  });
  const [newSow, setNewSow] = useState({
    startDate: '',
    endDate: '',
    amount: '',
    description: '',
    current: false,
  });
  const [showAddSow, setShowAddSow] = useState(false);
  const [editingSowIndex, setEditingSowIndex] = useState(null);
  const [showPastSows, setShowPastSows] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    title: '',
    primary: false,
  });
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContactIndex, setEditingContactIndex] = useState(null);

  useEffect(() => {
    if (client) {
      // Sort contacts: primary first, then by name
      const sortedContacts = (client.contacts || []).sort((a, b) => {
        if (a.primary && !b.primary) return -1;
        if (!a.primary && b.primary) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      // Sort SOWs: current first, then active, then by start date (newest first)
      const sortedSows = (client.sows || []).sort((a, b) => {
        // Current SOWs first
        if (a.current && !b.current) return -1;
        if (!a.current && b.current) return 1;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const isActiveA = a.startDate && new Date(a.startDate) <= today && (!a.endDate || new Date(a.endDate) >= today);
        const isActiveB = b.startDate && new Date(b.startDate) <= today && (!b.endDate || new Date(b.endDate) >= today);

        // Active SOWs next
        if (isActiveA && !isActiveB) return -1;
        if (!isActiveA && isActiveB) return 1;

        // Then sort by start date (newest first)
        const dateA = a.startDate ? new Date(a.startDate) : new Date(0);
        const dateB = b.startDate ? new Date(b.startDate) : new Date(0);
        return dateB - dateA;
      });

      setFormData({
        name: client.name || '',
        status: client.status || 'active',
        notes: client.notes || '',
        contacts: sortedContacts,
        sows: sortedSows,
      });
    }
  }, [client]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddContact = () => {
    if (!newContact.name.trim() || !newContact.email.trim()) {
      alert('Name and email are required');
      return;
    }
    // If this contact is marked as primary, unmark all other contacts
    let updatedContacts = [...formData.contacts];
    if (newContact.primary) {
      updatedContacts = updatedContacts.map(c => ({ ...c, primary: false }));
    }

    const contactToAdd = {
      id: Date.now().toString(),
      ...newContact,
    };
    updatedContacts.push(contactToAdd);

    // Sort contacts: primary first, then by name
    updatedContacts.sort((a, b) => {
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    setFormData({
      ...formData,
      contacts: updatedContacts,
    });
    setNewContact({ name: '', email: '', title: '', primary: false });
    setShowAddContact(false);
  };

  const handleEditContact = (index) => {
    setEditingContactIndex(index);
    const contactToEdit = formData.contacts[index];
    setNewContact({
      name: contactToEdit.name || '',
      email: contactToEdit.email || '',
      title: contactToEdit.title || '',
      primary: contactToEdit.primary || false,
    });
    setShowAddContact(true);
  };

  const handleUpdateContact = () => {
    if (!newContact.name.trim() || !newContact.email.trim()) {
      alert('Name and email are required');
      return;
    }
    // If this contact is marked as primary, unmark all other contacts
    let updatedContacts = [...formData.contacts];
    const contactId = updatedContacts[editingContactIndex].id;

    if (newContact.primary) {
      updatedContacts = updatedContacts.map((c, i) =>
        i !== editingContactIndex ? { ...c, primary: false } : c
      );
    }

    updatedContacts[editingContactIndex] = {
      ...updatedContacts[editingContactIndex],
      ...newContact,
      id: contactId, // Preserve the ID
    };

    // Sort contacts: primary first, then by name
    updatedContacts.sort((a, b) => {
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    setFormData({
      ...formData,
      contacts: updatedContacts,
    });
    setNewContact({ name: '', email: '', title: '', primary: false });
    setShowAddContact(false);
    setEditingContactIndex(null);
  };

  const handleDeleteContact = (index) => {
    if (window.confirm('Delete this contact?')) {
      const updatedContacts = formData.contacts.filter((_, i) => i !== index);
      setFormData({
        ...formData,
        contacts: updatedContacts,
      });
    }
  };

  const handleCancelContact = () => {
    setNewContact({ name: '', email: '', title: '', primary: false });
    setShowAddContact(false);
    setEditingContactIndex(null);
  };

  const handleAddSow = () => {
    if (!newSow.startDate) {
      alert('Start date is required');
      return;
    }
    // If this SOW is marked as current, unmark all other SOWs
    let updatedSows = [...formData.sows];
    if (newSow.current) {
      updatedSows = updatedSows.map(c => ({ ...c, current: false }));
    }

    const sowToAdd = {
      id: Date.now().toString(),
      startDate: new Date(newSow.startDate).toISOString(),
      endDate: newSow.endDate ? new Date(newSow.endDate).toISOString() : '',
      amount: newSow.amount || '',
      description: newSow.description || '',
      current: newSow.current || false,
    };

    updatedSows.push(sowToAdd);
    // Sort: current first, then active, then by start date (newest first)
    updatedSows.sort((a, b) => {
      // Current SOWs first
      if (a.current && !b.current) return -1;
      if (!a.current && b.current) return 1;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const isActiveA = a.startDate && new Date(a.startDate) <= today && (!a.endDate || new Date(a.endDate) >= today);
      const isActiveB = b.startDate && new Date(b.startDate) <= today && (!b.endDate || new Date(b.endDate) >= today);

      // Active SOWs next
      if (isActiveA && !isActiveB) return -1;
      if (!isActiveA && isActiveB) return 1;

      // Then sort by start date (newest first)
      const dateA = a.startDate ? new Date(a.startDate) : new Date(0);
      const dateB = b.startDate ? new Date(b.startDate) : new Date(0);
      return dateB - dateA;
    });

    setFormData({
      ...formData,
      sows: updatedSows,
    });
    setNewSow({ startDate: '', endDate: '', amount: '', description: '', current: false });
    setShowAddSow(false);
  };

  const handleEditSow = (index) => {
    setEditingSowIndex(index);
    const sowToEdit = formData.sows[index];
    setNewSow({
      startDate: sowToEdit.startDate ? sowToEdit.startDate.split('T')[0] : '',
      endDate: sowToEdit.endDate ? sowToEdit.endDate.split('T')[0] : '',
      amount: sowToEdit.amount || '',
      description: sowToEdit.description || '',
      current: sowToEdit.current || false,
    });
    setShowAddSow(true);
  };

  const handleUpdateSow = () => {
    if (!newSow.startDate) {
      alert('Start date is required');
      return;
    }
    // If this SOW is marked as current, unmark all other SOWs
    let updatedSows = [...formData.sows];
    const sowId = updatedSows[editingSowIndex].id;

    if (newSow.current) {
      updatedSows = updatedSows.map((c, i) =>
        i !== editingSowIndex ? { ...c, current: false } : c
      );
    }

    updatedSows[editingSowIndex] = {
      ...updatedSows[editingSowIndex],
      startDate: new Date(newSow.startDate).toISOString(),
      endDate: newSow.endDate ? new Date(newSow.endDate).toISOString() : '',
      amount: newSow.amount || '',
      description: newSow.description || '',
      current: newSow.current || false,
      id: sowId,
    };

    // Sort: current first, then active, then by start date (newest first)
    updatedSows.sort((a, b) => {
      // Current SOWs first
      if (a.current && !b.current) return -1;
      if (!a.current && b.current) return 1;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const isActiveA = a.startDate && new Date(a.startDate) <= today && (!a.endDate || new Date(a.endDate) >= today);
      const isActiveB = b.startDate && new Date(b.startDate) <= today && (!b.endDate || new Date(b.endDate) >= today);

      // Active SOWs next
      if (isActiveA && !isActiveB) return -1;
      if (!isActiveA && isActiveB) return 1;

      // Then sort by start date (newest first)
      const dateA = a.startDate ? new Date(a.startDate) : new Date(0);
      const dateB = b.startDate ? new Date(b.startDate) : new Date(0);
      return dateB - dateA;
    });

    setFormData({
      ...formData,
      sows: updatedSows,
    });
    setNewSow({ startDate: '', endDate: '', amount: '', description: '', current: false });
    setShowAddSow(false);
    setEditingSowIndex(null);
  };

  const handleDeleteSow = (index) => {
    if (window.confirm('Delete this SOW?')) {
      const updatedSows = formData.sows.filter((_, i) => i !== index);
      setFormData({
        ...formData,
        sows: updatedSows,
      });
    }
  };

  const handleCancelSow = () => {
    setNewSow({ startDate: '', endDate: '', amount: '', description: '', current: false });
    setShowAddSow(false);
    setEditingSowIndex(null);
  };

  const formatCurrency = (amount) => {
    if (!amount) return '';
    const num = parseFloat(amount);
    if (isNaN(num)) return amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Project name is required');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="client-form-overlay">
      <div className="client-form-container">
        <h2>{client ? 'Edit Client' : 'Add New Client'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Project Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter project name"
            />
          </div>

          <div className="form-group sows-section">
            <label>Statements of Work (SOWs)</label>
            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              const pastSows = formData.sows.filter(sow => {
                // Past SOWs are those with an end date that is before today
                return sow.endDate && new Date(sow.endDate) < today;
              });

              const currentAndActiveSows = formData.sows.filter(sow => {
                // Everything else (no end date, or end date >= today, or current)
                return !pastSows.includes(sow);
              });

              return (
                <>
                  {currentAndActiveSows.length > 0 && (
                    <div className="sows-list-form">
                      {currentAndActiveSows.map((sow, index) => {
                        const originalIndex = formData.sows.findIndex(s => s.id === sow.id);
                        return (
                          <div key={sow.id || index} className={`sow-item-form ${sow.current ? 'current-sow' : ''}`}>
                            <div className="sow-info-form">
                              {sow.current && (
                                <span className="current-sow-badge">Current</span>
                              )}
                              <div className="sow-dates-form">
                                <div className="sow-date-item">
                                  <span className="sow-date-label">Start:</span>
                                  <span className="sow-date-value">
                                    {sow.startDate ? new Date(sow.startDate).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    }) : 'N/A'}
                                  </span>
                                </div>
                                {sow.endDate && (
                                  <div className="sow-date-item">
                                    <span className="sow-date-label">End:</span>
                                    <span className="sow-date-value">
                                      {new Date(sow.endDate).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                      })}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {sow.amount && (
                                <div className="sow-amount-form">{formatCurrency(sow.amount)}</div>
                              )}
                              {sow.description && (
                                <div className="sow-description-form">{sow.description}</div>
                              )}
                            </div>
                            <div className="sow-actions-form">
                              <button
                                type="button"
                                onClick={() => handleEditSow(originalIndex)}
                                className="btn-icon-form btn-edit-form"
                                title="Edit SOW"
                              >
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M11.3333 2.00001C11.5084 1.8249 11.7163 1.68603 11.9447 1.59129C12.1731 1.49655 12.4173 1.44775 12.6637 1.44775C12.9101 1.44775 13.1543 1.49655 13.3827 1.59129C13.6111 1.68603 13.819 1.8249 13.9941 2.00001C14.1692 2.17512 14.3081 2.38304 14.4028 2.61143C14.4976 2.83982 14.5464 3.08401 14.5464 3.33043C14.5464 3.57685 14.4976 3.82104 14.4028 4.04943C14.3081 4.27782 14.1692 4.48574 13.9941 4.66085L5.05733 13.5975L1.33333 14.6642L2.4 10.9402L11.3333 2.00001Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSow(originalIndex)}
                                className="btn-icon-form btn-delete-form"
                                title="Delete SOW"
                              >
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M2 4H14M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0262 12.2761 14.2762C12.0261 14.5263 11.6869 14.6667 11.3333 14.6667H4.66667C4.31305 14.6667 3.97391 14.5263 3.72386 14.2762C3.47381 14.0262 3.33333 13.687 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2.31305 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31305 1.33333 6.66667 1.33333H9.33333C9.68696 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31305 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {pastSows.length > 0 && (
                    <fieldset className="past-sows-fieldset">
                      <legend
                        className="past-sows-legend"
                        onClick={() => setShowPastSows(!showPastSows)}
                      >
                        <span className="past-sows-toggle">
                          {showPastSows ? '▼' : '▶'}
                        </span>
                        Past SOWs ({pastSows.length})
                      </legend>
                      {showPastSows && (
                        <div className="sows-list-form">
                          {pastSows.map((sow, index) => {
                            const originalIndex = formData.sows.findIndex(s => s.id === sow.id);
                            return (
                              <div key={sow.id || index} className="sow-item-form past-sow">
                                <div className="sow-info-form">
                                  <div className="sow-dates-form">
                                    <div className="sow-date-item">
                                      <span className="sow-date-label">Start:</span>
                                      <span className="sow-date-value">
                                        {sow.startDate ? new Date(sow.startDate).toLocaleDateString('en-US', {
                                          year: 'numeric',
                                          month: 'short',
                                          day: 'numeric'
                                        }) : 'N/A'}
                                      </span>
                                    </div>
                                    {sow.endDate && (
                                      <div className="sow-date-item">
                                        <span className="sow-date-label">End:</span>
                                        <span className="sow-date-value">
                                          {new Date(sow.endDate).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                          })}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  {sow.amount && (
                                    <div className="sow-amount-form">{formatCurrency(sow.amount)}</div>
                                  )}
                                  {sow.description && (
                                    <div className="sow-description-form">{sow.description}</div>
                                  )}
                                </div>
                                <div className="sow-actions-form">
                                  <button
                                    type="button"
                                    onClick={() => handleEditSow(originalIndex)}
                                    className="btn-icon-form btn-edit-form"
                                    title="Edit SOW"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M11.3333 2.00001C11.5084 1.8249 11.7163 1.68603 11.9447 1.59129C12.1731 1.49655 12.4173 1.44775 12.6637 1.44775C12.9101 1.44775 13.1543 1.49655 13.3827 1.59129C13.6111 1.68603 13.819 1.8249 13.9941 2.00001C14.1692 2.17512 14.3081 2.38304 14.4028 2.61143C14.4976 2.83982 14.5464 3.08401 14.5464 3.33043C14.5464 3.57685 14.4976 3.82104 14.4028 4.04943C14.3081 4.27782 14.1692 4.48574 13.9941 4.66085L5.05733 13.5975L1.33333 14.6642L2.4 10.9402L11.3333 2.00001Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSow(originalIndex)}
                                    className="btn-icon-form btn-delete-form"
                                    title="Delete SOW"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M2 4H14M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0262 12.2761 14.2762C12.0261 14.5263 11.6869 14.6667 11.3333 14.6667H4.66667C4.31305 14.6667 3.97391 14.5263 3.72386 14.2762C3.47381 14.0262 3.33333 13.687 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2.31305 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31305 1.33333 6.66667 1.33333H9.33333C9.68696 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31305 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </fieldset>
                  )}
                </>
              );
            })()}
            {formData.sows.length > 0 && (() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              const pastSows = formData.sows.filter(sow =>
                sow.endDate && new Date(sow.endDate) < today
              );

              const futureSows = formData.sows.filter(sow =>
                sow.startDate && new Date(sow.startDate) > today
              );

              const presentSows = formData.sows.filter(sow => {
                const isPast = sow.endDate && new Date(sow.endDate) < today;
                const isFuture = sow.startDate && new Date(sow.startDate) > today;
                return !isPast && !isFuture;
              });

              const calculateTotal = (sows) => {
                return sows.reduce((sum, sow) => {
                  const amount = parseFloat(sow.amount) || 0;
                  return sum + amount;
                }, 0);
              };

              const pastTotal = calculateTotal(pastSows);
              const presentTotal = calculateTotal(presentSows);
              const futureTotal = calculateTotal(futureSows);
              const grandTotal = pastTotal + presentTotal + futureTotal;

              return (
                <div className="sows-summary">
                  <div className="sows-summary-row">
                    <span className="sows-summary-label">Past SOWs:</span>
                    <span className="sows-summary-amount">{formatCurrency(pastTotal)}</span>
                  </div>
                  <div className="sows-summary-row">
                    <span className="sows-summary-label">Present SOWs:</span>
                    <span className="sows-summary-amount">{formatCurrency(presentTotal)}</span>
                  </div>
                  <div className="sows-summary-row">
                    <span className="sows-summary-label">Future SOWs:</span>
                    <span className="sows-summary-amount">{formatCurrency(futureTotal)}</span>
                  </div>
                  <div className="sows-summary-row sows-summary-total">
                    <span className="sows-summary-label">Total:</span>
                    <span className="sows-summary-amount">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              );
            })()}
            {!showAddSow && (
              <button
                type="button"
                onClick={() => setShowAddSow(true)}
                className="btn btn-small btn-secondary"
                style={{ marginTop: '0.5rem' }}
              >
                + Add SOW
              </button>
            )}
            {showAddSow && (
              <div className="sow-form-inline-form">
                <div className="sow-form-dates-row">
                  <input
                    type="date"
                    value={newSow.startDate}
                    onChange={(e) => setNewSow({ ...newSow, startDate: e.target.value })}
                    placeholder="Start Date *"
                    className="sow-input-form"
                    required
                    autoFocus
                  />
                  <input
                    type="date"
                    value={newSow.endDate}
                    onChange={(e) => setNewSow({ ...newSow, endDate: e.target.value })}
                    placeholder="End Date"
                    className="sow-input-form"
                  />
                </div>
                <input
                  type="text"
                  value={newSow.amount}
                  onChange={(e) => setNewSow({ ...newSow, amount: e.target.value })}
                  placeholder="Amount (e.g., 50000)"
                  className="sow-input-form"
                />
                <input
                  type="text"
                  value={newSow.description}
                  onChange={(e) => setNewSow({ ...newSow, description: e.target.value })}
                  placeholder="Description (optional)"
                  className="sow-input-form"
                />
                <div className="sow-checkbox-form">
                  <label>
                    <input
                      type="checkbox"
                      checked={newSow.current}
                      onChange={(e) => setNewSow({ ...newSow, current: e.target.checked })}
                    />
                    <span>Current SOW</span>
                  </label>
                </div>
                <div className="sow-form-actions-form">
                  <button
                    type="button"
                    onClick={editingSowIndex !== null ? handleUpdateSow : handleAddSow}
                    className="btn btn-small btn-primary"
                  >
                    {editingSowIndex !== null ? 'Update' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelSow}
                    className="btn btn-small btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="4"
              placeholder="Additional notes about the client"
            />
          </div>

          <div className="form-group contacts-section">
            <label>Contacts</label>
            <div className="contacts-list-form">
              {formData.contacts.map((contact, index) => (
                <div key={contact.id || index} className={`contact-item-form ${contact.primary ? 'primary-contact' : ''}`}>
                  <div className="contact-info-form">
                    {contact.primary && (
                      <span className="primary-badge">Primary</span>
                    )}
                    <div className="contact-name-form">{contact.name}</div>
                    {contact.title && (
                      <div className="contact-title-form">{contact.title}</div>
                    )}
                    <div className="contact-email-form">{contact.email}</div>
                  </div>
                  <div className="contact-actions-form">
                    <button
                      type="button"
                      onClick={() => handleEditContact(index)}
                      className="btn-icon-form btn-edit-form"
                      title="Edit contact"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11.3333 2.00001C11.5084 1.8249 11.7163 1.68603 11.9447 1.59129C12.1731 1.49655 12.4173 1.44775 12.6637 1.44775C12.9101 1.44775 13.1543 1.49655 13.3827 1.59129C13.6111 1.68603 13.819 1.8249 13.9941 2.00001C14.1692 2.17512 14.3081 2.38304 14.4028 2.61143C14.4976 2.83982 14.5464 3.08401 14.5464 3.33043C14.5464 3.57685 14.4976 3.82104 14.4028 4.04943C14.3081 4.27782 14.1692 4.48574 13.9941 4.66085L5.05733 13.5975L1.33333 14.6642L2.4 10.9402L11.3333 2.00001Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(index)}
                      className="btn-icon-form btn-delete-form"
                      title="Delete contact"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 4H14M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0262 12.2761 14.2762C12.0261 14.5263 11.6869 14.6667 11.3333 14.6667H4.66667C4.31305 14.6667 3.97391 14.5263 3.72386 14.2762C3.47381 14.0262 3.33333 13.687 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2.31305 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31305 1.33333 6.66667 1.33333H9.33333C9.68696 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31305 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {!showAddContact && (
              <button
                type="button"
                onClick={() => setShowAddContact(true)}
                className="btn btn-small btn-secondary"
                style={{ marginTop: '0.5rem' }}
              >
                + Add Contact
              </button>
            )}
            {showAddContact && (
              <div className="contact-form-inline-form">
                <input
                  type="text"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="Name *"
                  className="contact-input-form"
                  autoFocus
                />
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="Email *"
                  className="contact-input-form"
                />
                <input
                  type="text"
                  value={newContact.title}
                  onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
                  placeholder="Title"
                  className="contact-input-form"
                />
                <div className="contact-checkbox-form">
                  <label>
                    <input
                      type="checkbox"
                      checked={newContact.primary}
                      onChange={(e) => setNewContact({ ...newContact, primary: e.target.checked })}
                    />
                    <span>Primary Contact</span>
                  </label>
                </div>
                <div className="contact-form-actions-form">
                  <button
                    type="button"
                    onClick={editingContactIndex !== null ? handleUpdateContact : handleAddContact}
                    className="btn btn-small btn-primary"
                  >
                    {editingContactIndex !== null ? 'Update' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelContact}
                    className="btn btn-small btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {client ? 'Update Client' : 'Add Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientForm;

