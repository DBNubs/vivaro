import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ClientForm from '../components/ClientForm';
import MeetingNotes from '../components/MeetingNotes';
import MeetingNoteForm from '../components/MeetingNoteForm';
import Reminders from '../components/Reminders';
import ReminderForm from '../components/ReminderForm';
import Milestones from '../components/Milestones';
import MilestoneForm from '../components/MilestoneForm';
import Resources from '../components/Resources';
import ResourceForm from '../components/ResourceForm';
import Contacts from '../components/Contacts';
import ContactForm from '../components/ContactForm';
import Tabs from '../components/Tabs';
import { getClients, updateClient, archiveClient, unarchiveClient, deleteClient, getMeetingNotes, createMeetingNote, updateMeetingNote, deleteMeetingNote, getReminders, createReminder, updateReminder, deleteReminder, getMilestones, createMilestone, updateMilestone, deleteMilestone, getResources, createLinkResource, uploadFileResource, updateResource, deleteResource, getContacts, createContact, updateContact, deleteContact } from '../utils/storage';
import './ClientDetail.css';

function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [meetingNotes, setMeetingNotes] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [resources, setResources] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [showPastSows, setShowPastSows] = useState(false);
  const [activeTab, setActiveTab] = useState('reminders');
  const [selectedNoteFolder, setSelectedNoteFolder] = useState('');
  const [selectedResourceFolder, setSelectedResourceFolder] = useState('');

  useEffect(() => {
    loadClient();
    loadMeetingNotes();
    loadReminders();
    loadMilestones();
    loadResources();
    loadContacts();
  }, [id]);

  const loadClient = async () => {
    try {
      setLoading(true);
      setError(null);
      const clients = await getClients();
      const foundClient = clients.find((c) => c.id === id);
      if (foundClient) {
        setClient(foundClient);
      } else {
        setError('Client not found');
      }
    } catch (err) {
      setError('Failed to load client. Make sure the server is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMeetingNotes = async () => {
    try {
      const notes = await getMeetingNotes(id);
      setMeetingNotes(notes);
    } catch (err) {
      console.error('Failed to load meeting notes:', err);
    }
  };

  const loadReminders = async () => {
    try {
      const reminderList = await getReminders(id);
      setReminders(reminderList);
    } catch (err) {
      console.error('Failed to load reminders:', err);
    }
  };

  const loadMilestones = async () => {
    try {
      const milestoneList = await getMilestones(id);
      setMilestones(milestoneList);
    } catch (err) {
      console.error('Failed to load milestones:', err);
    }
  };

  const loadResources = async () => {
    try {
      const resourceList = await getResources(id);
      setResources(resourceList);
    } catch (err) {
      console.error('Failed to load resources:', err);
    }
  };

  const loadContacts = async () => {
    try {
      const contactList = await getContacts(id);
      setContacts(contactList);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    }
  };

  const handleEdit = () => {
    setShowForm(true);
  };

  const handleSave = async (clientData) => {
    try {
      setError(null);
      await updateClient(id, clientData);
      await loadClient();
      setShowForm(false);
    } catch (err) {
      setError('Failed to update client. Please try again.');
      console.error(err);
    }
  };

  const handleArchive = async () => {
    if (window.confirm('Are you sure you want to archive this client?')) {
      try {
        setError(null);
        await archiveClient(id);
        navigate('/');
      } catch (err) {
        setError('Failed to archive client. Please try again.');
        console.error(err);
      }
    }
  };

  const handleUnarchive = async () => {
    try {
      setError(null);
      await unarchiveClient(id);
      await loadClient();
    } catch (err) {
      setError('Failed to unarchive client. Please try again.');
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this client? This action cannot be undone and will delete all associated data (notes, reminders, milestones, resources, contacts, SOWs).')) {
      try {
        setError(null);
        await deleteClient(id);
        navigate('/');
      } catch (err) {
        setError('Failed to delete client. Please try again.');
        console.error(err);
      }
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
  };

  const handleAddNote = () => {
    setEditingNote(null);
    setShowNoteForm(true);
  };

  const handleEditNote = (note) => {
    setEditingNote(note);
    setShowNoteForm(true);
  };

  const handleSaveNote = async (noteData) => {
    try {
      setError(null);
      if (editingNote) {
        // Preserve existing folder and label when editing
        await updateMeetingNote(id, editingNote.id, {
          ...noteData,
          folder: editingNote.folder || '',
          label: editingNote.label || '',
        });
      } else {
        // New notes start in the currently selected folder with no label
        await createMeetingNote(id, {
          ...noteData,
          folder: selectedNoteFolder || '',
          label: '',
        });
      }
      await loadMeetingNotes();
      setShowNoteForm(false);
      setEditingNote(null);
    } catch (err) {
      setError('Failed to save meeting notes. Please try again.');
      console.error(err);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      setError(null);
      await deleteMeetingNote(id, noteId);
      await loadMeetingNotes();
    } catch (err) {
      setError('Failed to delete meeting notes. Please try again.');
      console.error(err);
    }
  };

  const handleMoveNote = async (noteId, folderPath) => {
    try {
      setError(null);
      const note = meetingNotes.find(n => n.id === noteId);
      if (note) {
        await updateMeetingNote(id, noteId, {
          ...note,
          folder: folderPath,
        });
        await loadMeetingNotes();
      }
    } catch (err) {
      setError('Failed to move note. Please try again.');
      console.error(err);
    }
  };

  const handleCreateNoteFolder = async (folderPath) => {
    try {
      setError(null);

      // Create placeholder notes for all parent folders in the path
      const parts = folderPath.split('/').filter(Boolean);

      // Get all existing folders (both from .folder notes and from actual notes)
      const existingFolders = new Set();
      meetingNotes.forEach(note => {
        if (note.folder) {
          existingFolders.add(note.folder);
          // Also add all parent paths
          const noteParts = note.folder.split('/').filter(Boolean);
          for (let i = 1; i <= noteParts.length; i++) {
            existingFolders.add(noteParts.slice(0, i).join('/'));
          }
        }
      });

      // Create placeholders for each level of the path
      const createdFolders = [];
      for (let i = 0; i < parts.length; i++) {
        const currentPath = parts.slice(0, i + 1).join('/');

        // Only create if this folder doesn't already exist
        if (!existingFolders.has(currentPath)) {
          const folderNote = {
            title: `.folder`,
            date: new Date().toISOString(),
            content: '<p>Folder placeholder</p>', // Add content to avoid validation issues
            label: '',
            folder: currentPath,
          };
          try {
            const created = await createMeetingNote(id, folderNote);
            createdFolders.push(currentPath);
            console.log(`Created folder placeholder for: ${currentPath}`, created);
          } catch (err) {
            console.error(`Failed to create folder placeholder for ${currentPath}:`, err);
            // Continue creating other folders even if one fails
          }
        }
      }

      if (createdFolders.length === 0 && parts.length > 0) {
        console.warn(`No folders were created. Existing folders:`, Array.from(existingFolders));
      }

      await loadMeetingNotes();
    } catch (err) {
      setError('Failed to create folder. Please try again.');
      console.error(err);
    }
  };

  const handleDeleteNoteFolder = async (folderPath) => {
    try {
      setError(null);
      // Find all notes in this folder and subfolders
      const notesToDelete = meetingNotes.filter(note => {
        const noteFolder = note.folder || '';
        // Match exact folder or subfolders
        return noteFolder === folderPath || noteFolder.startsWith(folderPath + '/');
      });

      // Delete all notes in the folder
      for (const note of notesToDelete) {
        await deleteMeetingNote(id, note.id);
      }
      await loadMeetingNotes();
    } catch (err) {
      setError('Failed to delete folder. Please try again.');
      console.error(err);
    }
  };

  const handleCancelNoteForm = () => {
    setShowNoteForm(false);
    setEditingNote(null);
  };

  const handleAddReminder = async (reminderData) => {
    try {
      setError(null);
      await createReminder(id, reminderData);
      await loadReminders();
    } catch (err) {
      setError('Failed to create reminder. Please try again.');
      console.error(err);
    }
  };

  const handleEditReminder = (reminder) => {
    setEditingReminder(reminder);
    setShowReminderForm(true);
  };

  const handleSaveReminder = async (reminderData) => {
    try {
      setError(null);
      await updateReminder(id, editingReminder.id, reminderData);
      await loadReminders();
      setShowReminderForm(false);
      setEditingReminder(null);
    } catch (err) {
      setError('Failed to update reminder. Please try again.');
      console.error(err);
    }
  };

  const handleCompleteReminder = async (reminderId) => {
    try {
      setError(null);
      const reminder = reminders.find(r => r.id === reminderId);
      if (reminder) {
        await updateReminder(id, reminderId, { ...reminder, completed: !reminder.completed });
        await loadReminders();
      }
    } catch (err) {
      setError('Failed to update reminder. Please try again.');
      console.error(err);
    }
  };

  const handleDeleteReminder = async (reminderId) => {
    try {
      setError(null);
      await deleteReminder(id, reminderId);
      await loadReminders();
    } catch (err) {
      setError('Failed to delete reminder. Please try again.');
      console.error(err);
    }
  };

  const handleCancelReminderForm = () => {
    setShowReminderForm(false);
    setEditingReminder(null);
  };

  const handleAddMilestone = async (milestoneData) => {
    try {
      setError(null);
      await createMilestone(id, milestoneData);
      await loadMilestones();
    } catch (err) {
      setError('Failed to create milestone. Please try again.');
      console.error(err);
    }
  };

  const handleEditMilestone = (milestone) => {
    setEditingMilestone(milestone);
    setShowMilestoneForm(true);
  };

  const handleSaveMilestone = async (milestoneData) => {
    try {
      setError(null);
      await updateMilestone(id, editingMilestone.id, milestoneData);
      await loadMilestones();
      setShowMilestoneForm(false);
      setEditingMilestone(null);
    } catch (err) {
      setError('Failed to update milestone. Please try again.');
      console.error(err);
    }
  };

  const handleCelebrateMilestone = async (milestoneId) => {
    try {
      setError(null);
      const milestone = milestones.find(m => m.id === milestoneId);
      if (milestone) {
        await updateMilestone(id, milestoneId, { ...milestone, celebrated: !milestone.celebrated });
        await loadMilestones();
      }
    } catch (err) {
      setError('Failed to update milestone. Please try again.');
      console.error(err);
    }
  };

  const handleDeleteMilestone = async (milestoneId) => {
    try {
      setError(null);
      await deleteMilestone(id, milestoneId);
      await loadMilestones();
    } catch (err) {
      setError('Failed to delete milestone. Please try again.');
      console.error(err);
    }
  };

  const handleCancelMilestoneForm = () => {
    setShowMilestoneForm(false);
    setEditingMilestone(null);
  };

  const handleAddLink = async (linkData) => {
    try {
      setError(null);
      // New links go to the currently selected folder
      await createLinkResource(id, {
        ...linkData,
        folder: selectedResourceFolder || '',
      });
      await loadResources();
    } catch (err) {
      setError('Failed to add link. Please try again.');
      console.error(err);
    }
  };

  const handleAddFile = async (file, title, description, folder = '') => {
    try {
      setError(null);
      // Use provided folder or default to currently selected folder
      const targetFolder = folder || selectedResourceFolder || '';
      await uploadFileResource(id, file, title, description, targetFolder);
      await loadResources();
    } catch (err) {
      setError('Failed to upload file. Please try again.');
      console.error(err);
      throw err;
    }
  };

  const handleCreateResourceFolder = async (folderPath) => {
    try {
      setError(null);

      // Create placeholder resources for all parent folders in the path
      const parts = folderPath.split('/').filter(Boolean);

      // Get all existing folders (both from .folder resources and from actual resources)
      const existingFolders = new Set();
      resources.forEach(resource => {
        if (resource.folder) {
          existingFolders.add(resource.folder);
          // Also add all parent paths
          const resourceParts = resource.folder.split('/').filter(Boolean);
          for (let i = 1; i <= resourceParts.length; i++) {
            existingFolders.add(resourceParts.slice(0, i).join('/'));
          }
        }
      });

      // Create placeholders for each level of the path
      for (let i = 0; i < parts.length; i++) {
        const currentPath = parts.slice(0, i + 1).join('/');

        // Only create if this folder doesn't already exist
        if (!existingFolders.has(currentPath)) {
          const folderResource = {
            title: `.folder`,
            url: '',
            description: '',
            folder: currentPath,
          };
          await createLinkResource(id, folderResource);
        }
      }

      await loadResources();
    } catch (err) {
      setError('Failed to create folder. Please try again.');
      console.error(err);
    }
  };

  const handleDeleteResourceFolder = async (folderPath) => {
    try {
      setError(null);
      // Find all resources in this folder and subfolders
      const resourcesToDelete = resources.filter(resource => {
        const resourceFolder = resource.folder || '';
        // Match exact folder or subfolders
        return resourceFolder === folderPath || resourceFolder.startsWith(folderPath + '/');
      });

      // Delete all resources in the folder
      for (const resource of resourcesToDelete) {
        await deleteResource(id, resource.id);
      }
      await loadResources();
    } catch (err) {
      setError('Failed to delete folder. Please try again.');
      console.error(err);
    }
  };

  const handleMoveResource = async (resourceId, folderPath) => {
    try {
      setError(null);
      const resource = resources.find(r => r.id === resourceId);
      if (resource) {
        await updateResource(id, resourceId, {
          ...resource,
          folder: folderPath,
        });
        await loadResources();
      }
    } catch (err) {
      setError('Failed to move resource. Please try again.');
      console.error(err);
    }
  };

  const handleEditResource = (resource) => {
    setEditingResource(resource);
    setShowResourceForm(true);
  };

  const handleSaveResource = async (resourceData) => {
    try {
      setError(null);
      if (editingResource) {
        // Preserve existing folder when editing
        await updateResource(id, editingResource.id, {
          ...resourceData,
          folder: editingResource.folder || '',
        });
      }
      setShowResourceForm(false);
      setEditingResource(null);
      await loadResources();
    } catch (err) {
      setError('Failed to save resource. Please try again.');
      console.error(err);
    }
  };

  const handleCancelResourceForm = () => {
    setShowResourceForm(false);
    setEditingResource(null);
  };

  const handleDeleteResource = async (resourceId) => {
    try {
      setError(null);
      await deleteResource(id, resourceId);
      await loadResources();
    } catch (err) {
      setError('Failed to delete resource. Please try again.');
      console.error(err);
    }
  };

  const handleAddContact = async (contactData) => {
    try {
      setError(null);
      await createContact(id, contactData);
      await loadContacts();
    } catch (err) {
      setError('Failed to add contact. Please try again.');
      console.error(err);
    }
  };

  const handleEditContact = (contact) => {
    setEditingContact(contact);
    setShowContactForm(true);
  };

  const handleSaveContact = async (contactData) => {
    try {
      setError(null);
      if (editingContact) {
        await updateContact(id, editingContact.id, contactData);
      }
      setShowContactForm(false);
      setEditingContact(null);
      await loadContacts();
    } catch (err) {
      setError('Failed to save contact. Please try again.');
      console.error(err);
    }
  };

  const handleCancelContactForm = () => {
    setShowContactForm(false);
    setEditingContact(null);
  };

  const handleDeleteContact = async (contactId) => {
    try {
      setError(null);
      await deleteContact(id, contactId);
      await loadContacts();
    } catch (err) {
      setError('Failed to delete contact. Please try again.');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="client-detail-page">
        <div className="loading-state">
          <p>Loading client...</p>
        </div>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="client-detail-page">
        <div className="error-message">
          {error}
          <button onClick={() => navigate('/')} className="btn btn-secondary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  return (
    <div className="client-detail-page">
      <div className="client-detail-header">
        <button onClick={() => navigate('/')} className="btn-back">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Dashboard
        </button>
        <div className="client-detail-actions">
          {client.status === 'active' && (
            <button onClick={handleArchive} className="btn btn-secondary">
              Archive Client
            </button>
          )}
          {client.status === 'archived' && (
            <button onClick={handleUnarchive} className="btn btn-secondary">
              Unarchive Client
            </button>
          )}
          <button onClick={handleEdit} className="btn btn-primary">
            Edit Client
          </button>
          <button onClick={handleDelete} className="btn btn-danger">
            Delete Client
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}

      <div className="client-detail-card">
        <div className="client-detail-header-section">
          <div className="client-detail-title-group">
            <div className="client-detail-status">
              <span className={`status-badge ${client.status}`}>
                {client.status === 'active' ? 'Active' : 'Archived'}
              </span>
            </div>
            <h1 className="client-detail-name">{client.name}</h1>
          </div>
        </div>

        <div className="client-detail-info">
          {client.sows && client.sows.length > 0 && (
            <div className="info-section">
              <h3>Statements of Work</h3>
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const sortedSows = [...client.sows].sort((a, b) => {
                  // Current SOWs first
                  if (a.current && !b.current) return -1;
                  if (!a.current && b.current) return 1;

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

                const pastSows = sortedSows.filter(sow => {
                  // Past SOWs are those with an end date that is before today
                  return sow.endDate && new Date(sow.endDate) < today;
                });

                const currentAndActiveSows = sortedSows.filter(sow => {
                  // Everything else (no end date, or end date >= today, or current)
                  return !pastSows.includes(sow);
                });

                return (
                  <>
                    {currentAndActiveSows.length > 0 && (
                      <div className="sows-display">
                        {currentAndActiveSows.map((sow, index) => (
                          <div key={sow.id || index} className={`sow-display-item ${sow.current ? 'current-sow' : ''}`}>
                            {sow.current && (
                              <span className="current-sow-badge">Current</span>
                            )}
                            <div className="sow-display-dates">
                              <div className="sow-display-date">
                                <span className="sow-display-date-label">Start:</span>
                                <span className="sow-display-date-value">
                                  {sow.startDate ? new Date(sow.startDate).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  }) : 'N/A'}
                                </span>
                              </div>
                              {sow.endDate && (
                                <div className="sow-display-date">
                                  <span className="sow-display-date-label">End:</span>
                                  <span className="sow-display-date-value">
                                    {new Date(sow.endDate).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </span>
                                </div>
                              )}
                            </div>
                            {sow.amount && (
                              <div className="sow-display-amount">
                                {new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: 'USD',
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 0,
                                }).format(parseFloat(sow.amount) || 0)}
                              </div>
                            )}
                            {sow.description && (
                              <div className="sow-display-description">{sow.description}</div>
                            )}
                          </div>
                        ))}
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
                          <div className="sows-display">
                            {pastSows.map((sow, index) => (
                              <div key={sow.id || index} className="sow-display-item past-sow">
                                <div className="sow-display-dates">
                                  <div className="sow-display-date">
                                    <span className="sow-display-date-label">Start:</span>
                                    <span className="sow-display-date-value">
                                      {sow.startDate ? new Date(sow.startDate).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                      }) : 'N/A'}
                                    </span>
                                  </div>
                                  {sow.endDate && (
                                    <div className="sow-display-date">
                                      <span className="sow-display-date-label">End:</span>
                                      <span className="sow-display-date-value">
                                        {new Date(sow.endDate).toLocaleDateString('en-US', {
                                          year: 'numeric',
                                          month: 'long',
                                          day: 'numeric'
                                        })}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {sow.amount && (
                                  <div className="sow-display-amount">
                                    {new Intl.NumberFormat('en-US', {
                                      style: 'currency',
                                      currency: 'USD',
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 0,
                                    }).format(parseFloat(sow.amount) || 0)}
                                  </div>
                                )}
                                {sow.description && (
                                  <div className="sow-display-description">{sow.description}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </fieldset>
                    )}
                  </>
                );
              })()}
              {client.sows && client.sows.length > 0 && (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const pastSows = client.sows.filter(sow =>
                  sow.endDate && new Date(sow.endDate) < today
                );

                const futureSows = client.sows.filter(sow =>
                  sow.startDate && new Date(sow.startDate) > today
                );

                const presentSows = client.sows.filter(sow => {
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
                      <span className="sows-summary-amount">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }).format(pastTotal)}
                      </span>
                    </div>
                    <div className="sows-summary-row">
                      <span className="sows-summary-label">Present SOWs:</span>
                      <span className="sows-summary-amount">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }).format(presentTotal)}
                      </span>
                    </div>
                    <div className="sows-summary-row">
                      <span className="sows-summary-label">Future SOWs:</span>
                      <span className="sows-summary-amount">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }).format(futureTotal)}
                      </span>
                    </div>
                    <div className="sows-summary-row sows-summary-total">
                      <span className="sows-summary-label">Total:</span>
                      <span className="sows-summary-amount">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }).format(grandTotal)}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {client.notes && (
            <div className="info-section">
              <h3>Notes</h3>
              <p className="notes-text">{client.notes}</p>
            </div>
          )}

          {client.contacts && client.contacts.length > 0 && (
            <div className="info-section">
              <h3>Contacts</h3>
              <div className="contacts-display">
                {[...client.contacts].sort((a, b) => {
                  if (a.primary && !b.primary) return -1;
                  if (!a.primary && b.primary) return 1;
                  return (a.name || '').localeCompare(b.name || '');
                }).map((contact, index) => (
                  <div key={contact.id || index} className={`contact-display-item ${contact.primary ? 'primary-contact' : ''}`}>
                    {contact.primary && (
                      <span className="primary-badge">Primary</span>
                    )}
                    <div className="contact-display-name">{contact.name}</div>
                    {contact.title && (
                      <div className="contact-display-title">{contact.title}</div>
                    )}
                    <div className="contact-display-email">
                      <a href={`mailto:${contact.email}`}>{contact.email}</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="client-detail-info-meta">
            <div className="info-section">
              <h3>Created</h3>
              <p>{client.createdAt ? new Date(client.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : 'N/A'}</p>
            </div>

            {client.archivedAt && (
              <div className="info-section">
                <h3>Archived</h3>
                <p>{new Date(client.archivedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs
        tabs={[
          {
            id: 'reminders',
            label: 'Reminders',
            badge: reminders.filter(r => !r.completed).length,
          },
          {
            id: 'milestones',
            label: 'Milestones',
            badge: milestones.length,
          },
          {
            id: 'notes',
            label: 'Notes',
            badge: meetingNotes.length,
          },
          {
            id: 'resources',
            label: 'Resources',
            badge: resources.length,
          },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        <div className={`tab-panel ${activeTab === 'reminders' ? 'active' : ''}`}>
          <div className="tab-panel-content">
            <Reminders
              reminders={reminders}
              onAdd={handleAddReminder}
              onEdit={handleEditReminder}
              onComplete={handleCompleteReminder}
              onDelete={handleDeleteReminder}
            />
          </div>
        </div>
        <div className={`tab-panel ${activeTab === 'milestones' ? 'active' : ''}`}>
          <div className="tab-panel-content">
            <Milestones
              milestones={milestones}
              onAdd={handleAddMilestone}
              onEdit={handleEditMilestone}
              onCelebrate={handleCelebrateMilestone}
              onDelete={handleDeleteMilestone}
            />
          </div>
        </div>
        <div className={`tab-panel ${activeTab === 'notes' ? 'active' : ''}`}>
          <div className="tab-panel-content">
            <div className="meeting-notes-header">
              <button onClick={handleAddNote} className="btn btn-primary">
                + New Note
              </button>
            </div>
            <MeetingNotes
              notes={meetingNotes}
              onEdit={handleEditNote}
              onDelete={handleDeleteNote}
              onCreateFolder={handleCreateNoteFolder}
              onDeleteFolder={handleDeleteNoteFolder}
              onMoveNote={handleMoveNote}
              onSelectedFolderChange={setSelectedNoteFolder}
            />
          </div>
        </div>
        <div className={`tab-panel ${activeTab === 'resources' ? 'active' : ''}`}>
          <div className="tab-panel-content">
            <Resources
              resources={resources}
              onAddLink={handleAddLink}
              onAddFile={handleAddFile}
              onEdit={handleEditResource}
              onDelete={handleDeleteResource}
              onCreateFolder={handleCreateResourceFolder}
              onDeleteFolder={handleDeleteResourceFolder}
              onMoveResource={handleMoveResource}
              onSelectedFolderChange={setSelectedResourceFolder}
            />
          </div>
        </div>
      </Tabs>

      {showResourceForm && (
        <ResourceForm
          resource={editingResource}
          onSave={handleSaveResource}
          onCancel={handleCancelResourceForm}
          existingResources={resources}
        />
      )}

      {showContactForm && (
        <ContactForm
          contact={editingContact}
          onSave={handleSaveContact}
          onCancel={handleCancelContactForm}
        />
      )}

      {showForm && (
        <ClientForm
          client={client}
          onSave={handleSave}
          onCancel={handleCancelForm}
        />
      )}

      {showNoteForm && (
        <MeetingNoteForm
          note={editingNote}
          onSave={handleSaveNote}
          onCancel={handleCancelNoteForm}
          existingNotes={meetingNotes}
        />
      )}

      {showReminderForm && (
        <ReminderForm
          reminder={editingReminder}
          onSave={handleSaveReminder}
          onCancel={handleCancelReminderForm}
        />
      )}

      {showMilestoneForm && (
        <MilestoneForm
          milestone={editingMilestone}
          onSave={handleSaveMilestone}
          onCancel={handleCancelMilestoneForm}
        />
      )}
    </div>
  );
}

export default ClientDetail;

