// API utility functions for JSON file persistence

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const getClients = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients`);
    if (!response.ok) {
      throw new Error('Failed to fetch clients');
    }
    return await response.json();
  } catch (error) {
    console.error('Error reading clients from API:', error);
    return [];
  }
};

export const createClient = async (clientData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clientData),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to create client');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating client:', error);
    // Provide a more helpful error message if it's a network error
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('Unable to connect to server. Please make sure the server is running on port 3001.');
    }
    throw error;
  }
};

export const updateClient = async (clientId, clientData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clientData),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to update client');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating client:', error);
    // Provide a more helpful error message if it's a network error
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('Unable to connect to server. Please make sure the server is running on port 3001.');
    }
    throw error;
  }
};

export const archiveClient = async (clientId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/archive`, {
      method: 'PATCH',
    });
    if (!response.ok) {
      throw new Error('Failed to archive client');
    }
    return await response.json();
  } catch (error) {
    console.error('Error archiving client:', error);
    throw error;
  }
};

export const unarchiveClient = async (clientId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/unarchive`, {
      method: 'PATCH',
    });
    if (!response.ok) {
      throw new Error('Failed to unarchive client');
    }
    return await response.json();
  } catch (error) {
    console.error('Error unarchiving client:', error);
    throw error;
  }
};

export const deleteClient = async (clientId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to delete client');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting client:', error);
    throw error;
  }
};

// Meeting Notes API functions
export const getMeetingNotes = async (clientId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/meeting-notes`);
    if (!response.ok) {
      throw new Error('Failed to fetch meeting notes');
    }
    return await response.json();
  } catch (error) {
    console.error('Error reading meeting notes from API:', error);
    return [];
  }
};

export const createMeetingNote = async (clientId, noteData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/meeting-notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(noteData),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Failed to create meeting note: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating meeting note:', error);
    throw error;
  }
};

export const updateMeetingNote = async (clientId, noteId, noteData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/meeting-notes/${noteId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(noteData),
    });
    if (!response.ok) {
      throw new Error('Failed to update meeting note');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating meeting note:', error);
    throw error;
  }
};

export const deleteMeetingNote = async (clientId, noteId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/meeting-notes/${noteId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete meeting note');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting meeting note:', error);
    throw error;
  }
};

// Reminders API functions
export const getReminders = async (clientId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/reminders`);
    if (!response.ok) {
      throw new Error('Failed to fetch reminders');
    }
    return await response.json();
  } catch (error) {
    console.error('Error reading reminders from API:', error);
    return [];
  }
};

export const createReminder = async (clientId, reminderData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reminderData),
    });
    if (!response.ok) {
      throw new Error('Failed to create reminder');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating reminder:', error);
    throw error;
  }
};

export const updateReminder = async (clientId, reminderId, reminderData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/reminders/${reminderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reminderData),
    });
    if (!response.ok) {
      throw new Error('Failed to update reminder');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating reminder:', error);
    throw error;
  }
};

export const deleteReminder = async (clientId, reminderId) => {
  try {
    console.log(`Deleting reminder: clientId=${clientId}, reminderId=${reminderId}`);
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/reminders/${reminderId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Delete reminder failed:', response.status, errorData);
      throw new Error(errorData.error || `Failed to delete reminder: ${response.status} ${response.statusText}`);
    }
    const result = await response.json();
    console.log('Reminder deleted successfully:', result);
    return result;
  } catch (error) {
    console.error('Error deleting reminder:', error);
    throw error;
  }
};

// Milestones API functions
export const getMilestones = async (clientId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/milestones`);
    if (!response.ok) {
      throw new Error('Failed to fetch milestones');
    }
    return await response.json();
  } catch (error) {
    console.error('Error reading milestones from API:', error);
    return [];
  }
};

export const createMilestone = async (clientId, milestoneData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/milestones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(milestoneData),
    });
    if (!response.ok) {
      throw new Error('Failed to create milestone');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating milestone:', error);
    throw error;
  }
};

export const updateMilestone = async (clientId, milestoneId, milestoneData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/milestones/${milestoneId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(milestoneData),
    });
    if (!response.ok) {
      throw new Error('Failed to update milestone');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating milestone:', error);
    throw error;
  }
};

export const deleteMilestone = async (clientId, milestoneId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/milestones/${milestoneId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete milestone');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting milestone:', error);
    throw error;
  }
};

// Resources API functions
export const getResources = async (clientId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/resources`);
    if (!response.ok) {
      throw new Error('Failed to fetch resources');
    }
    return await response.json();
  } catch (error) {
    console.error('Error reading resources from API:', error);
    return [];
  }
};

export const createLinkResource = async (clientId, resourceData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/resources/link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resourceData),
    });
    if (!response.ok) {
      throw new Error('Failed to create link resource');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating link resource:', error);
    throw error;
  }
};

export const uploadFileResource = async (clientId, file, title = '', description = '', folder = '') => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (description) formData.append('description', description);
    if (folder) formData.append('folder', folder);

    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/resources/file`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to upload file');
    }
    return await response.json();
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

export const updateResource = async (clientId, resourceId, resourceData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/resources/${resourceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resourceData),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to update resource');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating resource:', error);
    throw error;
  }
};

export const deleteResource = async (clientId, resourceId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/resources/${resourceId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete resource');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting resource:', error);
    throw error;
  }
};

// Contacts API functions
export const getContacts = async (clientId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/contacts`);
    if (!response.ok) {
      throw new Error('Failed to fetch contacts');
    }
    return await response.json();
  } catch (error) {
    console.error('Error reading contacts from API:', error);
    return [];
  }
};

export const createContact = async (clientId, contactData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactData),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to create contact');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating contact:', error);
    throw error;
  }
};

export const updateContact = async (clientId, contactId, contactData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/contacts/${contactId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactData),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to update contact');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating contact:', error);
    throw error;
  }
};

export const deleteContact = async (clientId, contactId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/contacts/${contactId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete contact');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting contact:', error);
    throw error;
  }
};
