const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3001;
// Use environment variable for data directory if set (from Electron), otherwise use default
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const OLD_DATA_FILE = path.join(DATA_DIR, 'clients.json');

// Multer will be initialized after helper functions are defined
let upload;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/files', express.static(path.join(__dirname, 'data')));

// Serve React app in production (for Electron)
// Only serve static files if we're in Electron or production mode
if (process.env.ELECTRON || (process.env.NODE_ENV === 'production' && !process.env.STANDALONE_SERVER)) {
  const buildPath = path.join(__dirname, 'build');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    // Don't serve HTML for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

// Ensure data directory exists
async function ensureDataDirectory() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Convert project name to folder-safe name
function getFolderName(projectName) {
  if (!projectName) {
    return 'unnamed-project';
  }
  return projectName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/-+/g, '-') // Replace multiple dashes with single dash
    .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
}

// Get client directory path by project name
function getClientDirByProjectName(projectName) {
  const folderName = getFolderName(projectName);
  return path.join(DATA_DIR, folderName);
}

// Get client directory path by client ID (for lookup)
async function getClientDirById(clientId) {
  const clients = await readClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) {
    return null;
  }
  return getClientDirByProjectName(client.name);
}

// Get client directory path (wrapper that uses project name)
async function getClientDir(clientId) {
  return await getClientDirById(clientId);
}

// Get client file path
async function getClientFile(clientId) {
  const clientDir = await getClientDir(clientId);
  if (!clientDir) {
    return null;
  }
  return path.join(clientDir, 'client.json');
}

// Get notes directory path
async function getNotesDir(clientId) {
  const clientDir = await getClientDir(clientId);
  if (!clientDir) {
    return null;
  }
  return path.join(clientDir, 'notes');
}

// Get note file path
async function getNoteFile(clientId, noteId) {
  const notesDir = await getNotesDir(clientId);
  if (!notesDir) {
    return null;
  }
  return path.join(notesDir, `${noteId}.json`);
}

// Migrate old data structure to new structure
async function migrateOldData() {
  try {
    // Check if old file exists
    try {
      await fs.access(OLD_DATA_FILE);
    } catch {
      // No old file, nothing to migrate
      return;
    }

    // Read old data
    const oldData = JSON.parse(await fs.readFile(OLD_DATA_FILE, 'utf8'));

    if (!Array.isArray(oldData) || oldData.length === 0) {
      return;
    }

    console.log('Migrating old data structure to new folder structure...');

    // Migrate each client
    for (const client of oldData) {
      const clientDir = getClientDirByProjectName(client.name);
      const notesDir = path.join(clientDir, 'notes');

      // Create client directory
      await fs.mkdir(clientDir, { recursive: true });
      await fs.mkdir(notesDir, { recursive: true });

      // Extract meeting notes
      const meetingNotes = client.meetingNotes || [];
      delete client.meetingNotes;

      // Save client data
      await fs.writeFile(
        path.join(clientDir, 'client.json'),
        JSON.stringify(client, null, 2)
      );

      // Save each meeting note
      for (const note of meetingNotes) {
        await fs.writeFile(
          path.join(notesDir, `${note.id}.json`),
          JSON.stringify(note, null, 2)
        );
      }
    }

    // Backup old file
    const backupFile = path.join(DATA_DIR, 'clients.json.backup');
    await fs.copyFile(OLD_DATA_FILE, backupFile);
    console.log(`Migration complete! Old file backed up to ${backupFile}`);
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Read all clients
async function readClients() {
  try {
    const clients = [];
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });

    for (const entry of entries) {
      // Skip files and the old clients.json
      if (!entry.isDirectory() || entry.name === 'clients.json.backup') {
        continue;
      }

      const clientFile = path.join(DATA_DIR, entry.name, 'client.json');
      try {
        const clientData = JSON.parse(await fs.readFile(clientFile, 'utf8'));
        clients.push(clientData);
      } catch (error) {
        console.error(`Error reading client ${entry.name}:`, error);
      }
    }

    return clients;
  } catch (error) {
    console.error('Error reading clients:', error);
    return [];
  }
}

// Read a single client
async function readClient(clientId) {
  try {
    const clientFile = await getClientFile(clientId);
    if (!clientFile) {
      return null;
    }
    const data = await fs.readFile(clientFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

// Write a client
async function writeClient(client) {
  // Check if client already exists and get old folder name
  const existingClient = await readClient(client.id);
  let oldClientDir = null;
  if (existingClient) {
    oldClientDir = getClientDirByProjectName(existingClient.name);
  }

  let newClientDir = getClientDirByProjectName(client.name);

  // If folder name changed, move the entire directory
  if (oldClientDir && oldClientDir !== newClientDir) {
    try {
      // Check if new directory already exists (name conflict)
      try {
        await fs.access(newClientDir);
        // If it exists, append a number to make it unique
        let counter = 1;
        let uniqueDir = newClientDir;
        while (true) {
          try {
            await fs.access(uniqueDir);
            uniqueDir = `${newClientDir}-${counter}`;
            counter++;
          } catch {
            break;
          }
        }
        newClientDir = uniqueDir;
      } catch {
        // Directory doesn't exist, we can use it
      }

      // Move the directory
      await fs.rename(oldClientDir, newClientDir);
    } catch (error) {
      console.error('Error moving client directory:', error);
      // Fall through to create new directory
    }
  }

  const clientFile = path.join(newClientDir, 'client.json');
  await fs.mkdir(newClientDir, { recursive: true });
  await fs.writeFile(clientFile, JSON.stringify(client, null, 2));
}

// Read all meeting notes for a client
async function readMeetingNotes(clientId) {
  try {
    const notesDir = await getNotesDir(clientId);
    if (!notesDir) {
      return [];
    }
    const notes = [];

    try {
      const files = await fs.readdir(notesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const noteData = JSON.parse(
            await fs.readFile(path.join(notesDir, file), 'utf8')
          );
          notes.push(noteData);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    return notes;
  } catch (error) {
    console.error('Error reading meeting notes:', error);
    return [];
  }
}

// Write a meeting note
async function writeMeetingNote(clientId, note) {
  const notesDir = await getNotesDir(clientId);
  if (!notesDir) {
    throw new Error('Client not found');
  }
  const noteFile = path.join(notesDir, `${note.id}.json`);

  await fs.mkdir(notesDir, { recursive: true });
  await fs.writeFile(noteFile, JSON.stringify(note, null, 2));
}

// Delete a meeting note
async function deleteMeetingNote(clientId, noteId) {
  const noteFile = await getNoteFile(clientId, noteId);
  if (!noteFile) {
    return;
  }
  try {
    await fs.unlink(noteFile);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

// Get reminders file path
async function getRemindersFile(clientId) {
  const clientDir = await getClientDir(clientId);
  if (!clientDir) {
    return null;
  }
  return path.join(clientDir, 'reminders.json');
}

// Get milestones file path
async function getMilestonesFile(clientId) {
  const clientDir = await getClientDir(clientId);
  if (!clientDir) {
    return null;
  }
  return path.join(clientDir, 'milestones.json');
}

// Read milestones for a client
async function readMilestones(clientId) {
  try {
    const milestonesFile = await getMilestonesFile(clientId);
    if (!milestonesFile) {
      return [];
    }
    try {
      const data = await fs.readFile(milestonesFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  } catch (error) {
    console.error('Error reading milestones:', error);
    return [];
  }
}

// Write milestones for a client
async function writeMilestones(clientId, milestones) {
  const milestonesFile = await getMilestonesFile(clientId);
  if (!milestonesFile) {
    throw new Error('Client not found');
  }
  const clientDir = path.dirname(milestonesFile);
  await fs.mkdir(clientDir, { recursive: true });
  await fs.writeFile(milestonesFile, JSON.stringify(milestones, null, 2));
}

// Get resources file path
async function getResourcesFile(clientId) {
  const clientDir = await getClientDir(clientId);
  if (!clientDir) {
    return null;
  }
  return path.join(clientDir, 'resources.json');
}

// Get resources directory path
async function getResourcesDir(clientId) {
  const clientDir = await getClientDir(clientId);
  if (!clientDir) {
    return null;
  }
  return path.join(clientDir, 'resources');
}

// Read resources for a client
async function readResources(clientId) {
  try {
    const resourcesFile = await getResourcesFile(clientId);
    if (!resourcesFile) {
      return [];
    }
    try {
      const data = await fs.readFile(resourcesFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  } catch (error) {
    console.error('Error reading resources:', error);
    return [];
  }
}

// Write resources for a client
async function writeResources(clientId, resources) {
  const resourcesFile = await getResourcesFile(clientId);
  if (!resourcesFile) {
    throw new Error('Client not found');
  }
  const clientDir = path.dirname(resourcesFile);
  await fs.mkdir(clientDir, { recursive: true });
  await fs.writeFile(resourcesFile, JSON.stringify(resources, null, 2));
}

// Get contacts file path
async function getContactsFile(clientId) {
  const clientDir = await getClientDir(clientId);
  if (!clientDir) {
    return null;
  }
  return path.join(clientDir, 'contacts.json');
}

// Read contacts for a client
async function readContacts(clientId) {
  try {
    const contactsFile = await getContactsFile(clientId);
    if (!contactsFile) {
      return [];
    }
    try {
      const data = await fs.readFile(contactsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  } catch (error) {
    console.error('Error reading contacts:', error);
    return [];
  }
}

// Write contacts for a client
async function writeContacts(clientId, contacts) {
  const contactsFile = await getContactsFile(clientId);
  if (!contactsFile) {
    throw new Error('Client not found');
  }
  const clientDir = path.dirname(contactsFile);
  await fs.mkdir(clientDir, { recursive: true });
  await fs.writeFile(contactsFile, JSON.stringify(contacts, null, 2));
}

// Read reminders for a client
async function readReminders(clientId) {
  try {
    const remindersFile = await getRemindersFile(clientId);
    if (!remindersFile) {
      return [];
    }
    try {
      const data = await fs.readFile(remindersFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  } catch (error) {
    console.error('Error reading reminders:', error);
    return [];
  }
}

// Write reminders for a client
async function writeReminders(clientId, reminders) {
  const remindersFile = await getRemindersFile(clientId);
  if (!remindersFile) {
    throw new Error('Client not found');
  }
  const clientDir = path.dirname(remindersFile);
  await fs.mkdir(clientDir, { recursive: true });
  await fs.writeFile(remindersFile, JSON.stringify(reminders, null, 2));
}

// Initialize multer now that all helper functions are defined
initializeMulter();

// GET /api/clients - Get all clients
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await readClients();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read clients' });
  }
});

// POST /api/clients - Create a new client
app.post('/api/clients', async (req, res) => {
  try {
    const newClient = {
      id: Date.now().toString(),
      ...req.body,
      status: req.body.status || 'active',
      createdAt: new Date().toISOString(),
    };
    await writeClient(newClient);
    res.status(201).json(newClient);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// PUT /api/clients/:id - Update a client
app.put('/api/clients/:id', async (req, res) => {
  try {
    const clientId = req.params.id;
    const existingClient = await readClient(clientId);

    if (!existingClient) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const updatedClient = {
      ...existingClient,
      ...req.body,
      id: clientId, // Ensure ID doesn't change
    };

    await writeClient(updatedClient);
    res.json(updatedClient);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// PATCH /api/clients/:id/archive - Archive a client
app.patch('/api/clients/:id/archive', async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const updatedClient = {
      ...client,
      status: 'archived',
      archivedAt: new Date().toISOString(),
    };

    await writeClient(updatedClient);
    res.json(updatedClient);
  } catch (error) {
    console.error('Error archiving client:', error);
    res.status(500).json({ error: 'Failed to archive client' });
  }
});

// PATCH /api/clients/:id/unarchive - Unarchive a client
app.patch('/api/clients/:id/unarchive', async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const updatedClient = {
      ...client,
      status: 'active',
      archivedAt: null,
    };

    await writeClient(updatedClient);
    res.json(updatedClient);
  } catch (error) {
    console.error('Error unarchiving client:', error);
    res.status(500).json({ error: 'Failed to unarchive client' });
  }
});

// DELETE /api/clients/:id - Delete a client
app.delete('/api/clients/:id', async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get the client directory
    const clientDir = getClientDirByProjectName(client.name);

    // Delete the entire client directory and all its contents
    try {
      await fs.rm(clientDir, { recursive: true, force: true });
    } catch (error) {
      // If directory doesn't exist, that's okay - client is already deleted
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// GET /api/clients/:id/meeting-notes - Get all meeting notes for a client
app.get('/api/clients/:id/meeting-notes', async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const meetingNotes = await readMeetingNotes(clientId);
    res.json(meetingNotes);
  } catch (error) {
    console.error('Error reading meeting notes:', error);
    res.status(500).json({ error: 'Failed to read meeting notes' });
  }
});

// POST /api/clients/:id/meeting-notes - Create a new meeting note
app.post('/api/clients/:id/meeting-notes', async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const newNote = {
      id: Date.now().toString(),
      title: req.body.title || '',
      date: req.body.date || new Date().toISOString(),
      content: req.body.content || '',
      createdAt: new Date().toISOString(),
    };

    await writeMeetingNote(clientId, newNote);
    res.status(201).json(newNote);
  } catch (error) {
    console.error('Error creating meeting note:', error);
    res.status(500).json({ error: 'Failed to create meeting note', details: error.message });
  }
});

// PUT /api/clients/:id/meeting-notes/:noteId - Update a meeting note
app.put('/api/clients/:id/meeting-notes/:noteId', async (req, res) => {
  try {
    const clientId = req.params.id;
    const noteId = req.params.noteId;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Read existing note
    const noteFile = await getNoteFile(clientId, noteId);
    if (!noteFile) {
      return res.status(404).json({ error: 'Meeting note not found' });
    }
    let existingNote;
    try {
      existingNote = JSON.parse(await fs.readFile(noteFile, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Meeting note not found' });
      }
      throw error;
    }

    const updatedNote = {
      ...existingNote,
      ...req.body,
      id: noteId, // Ensure ID doesn't change
    };

    await writeMeetingNote(clientId, updatedNote);
    res.json(updatedNote);
  } catch (error) {
    console.error('Error updating meeting note:', error);
    res.status(500).json({ error: 'Failed to update meeting note' });
  }
});

// DELETE /api/clients/:id/meeting-notes/:noteId - Delete a meeting note
app.delete('/api/clients/:id/meeting-notes/:noteId', async (req, res) => {
  try {
    const clientId = req.params.id;
    const noteId = req.params.noteId;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    await deleteMeetingNote(clientId, noteId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting meeting note:', error);
    res.status(500).json({ error: 'Failed to delete meeting note' });
  }
});

// GET /api/clients/:id/reminders - Get all reminders for a client
app.get('/api/clients/:id/reminders', async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const reminders = await readReminders(clientId);
    res.json(reminders);
  } catch (error) {
    console.error('Error reading reminders:', error);
    res.status(500).json({ error: 'Failed to read reminders' });
  }
});

// POST /api/clients/:id/reminders - Create a new reminder
app.post('/api/clients/:id/reminders', async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const reminders = await readReminders(clientId);
    const newReminder = {
      id: Date.now().toString(),
      text: req.body.text || '',
      dueDate: req.body.dueDate || null,
      priority: req.body.priority || 'medium',
      completed: false,
      createdAt: new Date().toISOString(),
    };

    reminders.push(newReminder);
    await writeReminders(clientId, reminders);
    res.status(201).json(newReminder);
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// PUT /api/clients/:id/reminders/:reminderId - Update a reminder
app.put('/api/clients/:id/reminders/:reminderId', async (req, res) => {
  try {
    const clientId = req.params.id;
    const reminderId = req.params.reminderId;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const reminders = await readReminders(clientId);
    const reminderIndex = reminders.findIndex((r) => r.id === reminderId);

    if (reminderIndex === -1) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    reminders[reminderIndex] = {
      ...reminders[reminderIndex],
      ...req.body,
      id: reminderId, // Ensure ID doesn't change
    };

    await writeReminders(clientId, reminders);
    res.json(reminders[reminderIndex]);
  } catch (error) {
    console.error('Error updating reminder:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// DELETE /api/clients/:id/reminders/:reminderId - Delete a reminder
app.delete('/api/clients/:id/reminders/:reminderId', async (req, res) => {
  try {
    const clientId = req.params.id;
    const reminderId = req.params.reminderId;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const reminders = await readReminders(clientId);
    const filteredReminders = reminders.filter((r) => r.id !== reminderId);
    await writeReminders(clientId, filteredReminders);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

// GET /api/clients/:id/milestones - Get all milestones for a client
app.get('/api/clients/:id/milestones', async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const milestones = await readMilestones(clientId);
    res.json(milestones);
  } catch (error) {
    console.error('Error reading milestones:', error);
    res.status(500).json({ error: 'Failed to read milestones' });
  }
});

// POST /api/clients/:id/milestones - Create a new milestone
app.post('/api/clients/:id/milestones', async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const milestones = await readMilestones(clientId);
    const newMilestone = {
      id: Date.now().toString(),
      title: req.body.title || '',
      date: req.body.date || new Date().toISOString(),
      description: req.body.description || '',
      celebrated: false,
      createdAt: new Date().toISOString(),
    };

    milestones.push(newMilestone);
    await writeMilestones(clientId, milestones);
    res.status(201).json(newMilestone);
  } catch (error) {
    console.error('Error creating milestone:', error);
    res.status(500).json({ error: 'Failed to create milestone' });
  }
});

// PUT /api/clients/:id/milestones/:milestoneId - Update a milestone
app.put('/api/clients/:id/milestones/:milestoneId', async (req, res) => {
  try {
    const clientId = req.params.id;
    const milestoneId = req.params.milestoneId;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const milestones = await readMilestones(clientId);
    const milestoneIndex = milestones.findIndex((m) => m.id === milestoneId);

    if (milestoneIndex === -1) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    milestones[milestoneIndex] = {
      ...milestones[milestoneIndex],
      ...req.body,
      id: milestoneId, // Ensure ID doesn't change
    };

    await writeMilestones(clientId, milestones);
    res.json(milestones[milestoneIndex]);
  } catch (error) {
    console.error('Error updating milestone:', error);
    res.status(500).json({ error: 'Failed to update milestone' });
  }
});

// DELETE /api/clients/:id/milestones/:milestoneId - Delete a milestone
app.delete('/api/clients/:id/milestones/:milestoneId', async (req, res) => {
  try {
    const clientId = req.params.id;
    const milestoneId = req.params.milestoneId;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const milestones = await readMilestones(clientId);
    const filteredMilestones = milestones.filter((m) => m.id !== milestoneId);
    await writeMilestones(clientId, filteredMilestones);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting milestone:', error);
    res.status(500).json({ error: 'Failed to delete milestone' });
  }
});

// GET /api/clients/:id/resources - Get all resources for a client
app.get('/api/clients/:id/resources', async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const resources = await readResources(clientId);
    res.json(resources);
  } catch (error) {
    console.error('Error reading resources:', error);
    res.status(500).json({ error: 'Failed to read resources' });
  }
});

// POST /api/clients/:id/resources/link - Create a new link resource
app.post('/api/clients/:id/resources/link', async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const resources = await readResources(clientId);
    const newResource = {
      id: Date.now().toString(),
      type: 'link',
      title: req.body.title || '',
      url: req.body.url || '',
      description: req.body.description || '',
      createdAt: new Date().toISOString(),
    };

    resources.push(newResource);
    await writeResources(clientId, resources);
    res.status(201).json(newResource);
  } catch (error) {
    console.error('Error creating resource:', error);
    res.status(500).json({ error: 'Failed to create resource' });
  }
});

// POST /api/clients/:id/resources/file - Upload a file
app.post('/api/clients/:id/resources/file', upload.single('file'), async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const resources = await readResources(clientId);
    const folderName = getFolderName(client.name);
    const fileUrl = `/api/files/${folderName}/resources/${req.file.filename}`;

    const newResource = {
      id: Date.now().toString(),
      type: 'file',
      title: req.body.title || req.file.originalname,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      url: fileUrl,
      description: req.body.description || '',
      uploadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    resources.push(newResource);
    await writeResources(clientId, resources);
    res.status(201).json(newResource);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// PUT /api/clients/:id/resources/:resourceId - Update a resource
app.put('/api/clients/:id/resources/:resourceId', async (req, res) => {
  try {
    const clientId = req.params.id;
    const resourceId = req.params.resourceId;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const resources = await readResources(clientId);
    const resourceIndex = resources.findIndex((r) => r.id === resourceId);

    if (resourceIndex === -1) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Update resource fields (preserve type, file-specific fields, etc.)
    resources[resourceIndex] = {
      ...resources[resourceIndex],
      title: req.body.title || resources[resourceIndex].title,
      description: req.body.description || resources[resourceIndex].description,
      // Only update URL for links
      ...(resources[resourceIndex].type === 'link' && req.body.url
        ? { url: req.body.url }
        : {}),
    };

    await writeResources(clientId, resources);
    res.json(resources[resourceIndex]);
  } catch (error) {
    console.error('Error updating resource:', error);
    res.status(500).json({ error: 'Failed to update resource' });
  }
});

// DELETE /api/clients/:id/resources/:resourceId - Delete a resource
app.delete('/api/clients/:id/resources/:resourceId', async (req, res) => {
  try {
    const clientId = req.params.id;
    const resourceId = req.params.resourceId;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const resources = await readResources(clientId);
    const resource = resources.find((r) => r.id === resourceId);

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // If it's a file, delete the file from disk
    if (resource.type === 'file' && resource.url) {
      try {
        const urlPath = resource.url.replace('/api/files/', '');
        const filePath = path.join(__dirname, 'data', urlPath);
        await fs.unlink(filePath);
      } catch (error) {
        console.error('Error deleting file:', error);
        // Continue even if file deletion fails
      }
    }

    const filteredResources = resources.filter((r) => r.id !== resourceId);
    await writeResources(clientId, filteredResources);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting resource:', error);
    res.status(500).json({ error: 'Failed to delete resource' });
  }
});

// GET /api/clients/:id/contacts - Get all contacts for a client
app.get('/api/clients/:id/contacts', async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const contacts = await readContacts(clientId);
    res.json(contacts);
  } catch (error) {
    console.error('Error reading contacts:', error);
    res.status(500).json({ error: 'Failed to read contacts' });
  }
});

// POST /api/clients/:id/contacts - Create a new contact
app.post('/api/clients/:id/contacts', async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const contacts = await readContacts(clientId);
    const newContact = {
      id: Date.now().toString(),
      name: req.body.name || '',
      email: req.body.email || '',
      title: req.body.title || '',
      createdAt: new Date().toISOString(),
    };

    contacts.push(newContact);
    await writeContacts(clientId, contacts);
    res.status(201).json(newContact);
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// PUT /api/clients/:id/contacts/:contactId - Update a contact
app.put('/api/clients/:id/contacts/:contactId', async (req, res) => {
  try {
    const clientId = req.params.id;
    const contactId = req.params.contactId;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const contacts = await readContacts(clientId);
    const contactIndex = contacts.findIndex((c) => c.id === contactId);

    if (contactIndex === -1) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    contacts[contactIndex] = {
      ...contacts[contactIndex],
      name: req.body.name || contacts[contactIndex].name,
      email: req.body.email || contacts[contactIndex].email,
      title: req.body.title || contacts[contactIndex].title,
      id: contactId, // Ensure ID doesn't change
    };

    await writeContacts(clientId, contacts);
    res.json(contacts[contactIndex]);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE /api/clients/:id/contacts/:contactId - Delete a contact
app.delete('/api/clients/:id/contacts/:contactId', async (req, res) => {
  try {
    const clientId = req.params.id;
    const contactId = req.params.contactId;
    const client = await readClient(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const contacts = await readContacts(clientId);
    const filteredContacts = contacts.filter((c) => c.id !== contactId);
    await writeContacts(clientId, filteredContacts);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// Initialize multer after helper functions are defined
function initializeMulter() {
  upload = multer({
    storage: multer.diskStorage({
      destination: async (req, file, cb) => {
        const clientId = req.params.id;
        try {
          const clients = await readClients();
          const client = clients.find(c => c.id === clientId);
          if (!client) {
            return cb(new Error('Client not found'));
          }
          const clientDir = getClientDirByProjectName(client.name);
          const resourcesDir = path.join(clientDir, 'resources');
          await fs.mkdir(resourcesDir, { recursive: true });
          cb(null, resourcesDir);
        } catch (error) {
          cb(error);
        }
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_');
        cb(null, `${name}-${uniqueSuffix}${ext}`);
      }
    }),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
  });
}

// Initialize server
async function startServer() {
  await ensureDataDirectory();
  await migrateOldData();
  const server = app.listen(PORT, 'localhost', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${PORT} is already in use.`);
      console.error(`\nTo fix this, you can:`);
      console.error(`  1. Kill the process using port ${PORT}:`);
      console.error(`     lsof -ti:${PORT} | xargs kill -9`);
      console.error(`  2. Or use a different port:`);
      console.error(`     PORT=3002 npm run server\n`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

// Auto-start the server
// If ELECTRON is set, we're being forked by Electron, so start the server
// If ELECTRON is not set, we're running standalone, so also start the server
startServer().catch(console.error);

// Export for Electron to use
module.exports = { app, startServer };
