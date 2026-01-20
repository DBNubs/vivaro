// Immediate output to verify script is running
// Also write to a log file as backup
const fsSync = require('fs');
const path = require('path');
const os = require('os');

// Determine log directory - try multiple locations
let logDir = null;
let logFile = null;

// Try DATA_DIR first (set by Neutralino in production)
if (process.env.DATA_DIR) {
  logDir = process.env.DATA_DIR;
} else {
  // Fallback to __dirname/data (development)
  logDir = path.join(__dirname, 'data');
}

// If that doesn't work, try OS temp directory
try {
  if (!fsSync.existsSync(logDir)) {
    try {
      fsSync.mkdirSync(logDir, { recursive: true });
    } catch (mkdirError) {
      // If we can't create the directory, use temp directory
      logDir = os.tmpdir();
    }
  }
  logFile = path.join(logDir, 'server-startup.log');
} catch (error) {
  // Final fallback to temp directory
  logDir = os.tmpdir();
  logFile = path.join(logDir, 'server-startup.log');
}

try {
  const startupInfo = `=== SERVER.JS STARTING ===
Timestamp: ${new Date().toISOString()}
__dirname: ${__dirname}
process.cwd(): ${process.cwd()}
process.argv: ${JSON.stringify(process.argv)}
NODE_ENV: ${process.env.NODE_ENV}
NEUTRALINO: ${process.env.NEUTRALINO}
NODE_PATH: ${process.env.NODE_PATH}
DATA_DIR: ${process.env.DATA_DIR || '(not set)'}
PID: ${process.pid}
Log file: ${logFile}
\n`;

  fsSync.appendFileSync(logFile, startupInfo);
} catch (logError) {
  // If we can't write to log file, that's okay, continue
  console.error('Could not write to log file:', logError.message);
}

// Note: fsSync and path are already required above for logging
// Wrap requires in try-catch to catch module loading errors
let express, fs, cors, multer, execAsync, https;

try {
  express = require('express');
  fs = require('fs').promises;
  // fsSync and path already required above
  cors = require('cors');
  multer = require('multer');
  const { exec } = require('child_process');
  const { promisify } = require('util');
  execAsync = promisify(exec);
  https = require('https');
} catch (error) {
  const errorMsg = `ERROR LOADING DEPENDENCIES: ${error.message}\nStack: ${error.stack}\n__dirname: ${__dirname}\nprocess.cwd(): ${process.cwd()}\n`;
  console.error(errorMsg);

  // Write error to log file
  try {
    fsSync.appendFileSync(logFile, errorMsg);
  } catch (e) { }

  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;
// Use environment variable for data directory if set (from Neutralino), otherwise use default
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const OLD_DATA_FILE = path.join(DATA_DIR, 'clients.json');

// Update progress tracking
let updateProgress = {
  status: 'idle', // 'idle', 'in_progress', 'completed', 'error'
  progress: 0,
  message: '',
  error: null
};

// Multer will be initialized after helper functions are defined
let upload;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/files', express.static(path.join(__dirname, 'data')));

// Serve React app in production (for Neutralino)
// Only serve static files if we're in Neutralino or production mode
const shouldServeStatic = process.env.NEUTRALINO || (process.env.NODE_ENV === 'production' && !process.env.STANDALONE_SERVER);

if (shouldServeStatic) {
  const buildPath = path.join(__dirname, 'build');
  // Check if build directory exists
  try {
    if (fsSync.existsSync(buildPath)) {
      app.use(express.static(buildPath));
    } else {
      console.warn(`⚠ Warning: Build directory not found at ${buildPath}. Static files will not be served.`);
    }
  } catch (error) {
    console.error(`Error checking build directory: ${error.message}`);
  }
  // Note: Catch-all route for serving index.html is defined after all API routes
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
      label: req.body.label || '',
      folder: req.body.folder || '',
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
    const reminderIndex = reminders.findIndex((r) => String(r.id) === String(reminderId));

    if (reminderIndex === -1) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    const filteredReminders = reminders.filter((r) => String(r.id) !== String(reminderId));
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
      folder: req.body.folder || '',
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
      folder: req.body.folder || '',
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
      folder: req.body.folder !== undefined ? req.body.folder : resources[resourceIndex].folder,
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

// Update check and update endpoints
const GITHUB_RELEASES_URL = 'https://github.com/DBNubs/vivaro/releases';

function isGitRepository(dir) {
  try {
    return fsSync.existsSync(path.join(dir, '.git'));
  } catch {
    return false;
  }
}

// Helper function to get current git tag or version
async function getCurrentVersion() {
  try {
    // Try to get the current git tag
    try {
      const { stdout: tag } = await execAsync('git describe --tags --exact-match 2>/dev/null || git describe --tags 2>/dev/null || echo ""', {
        cwd: __dirname,
        shell: '/bin/bash'
      });
      let currentTag = tag.trim();
      if (currentTag && currentTag !== '') {
        // Remove 'v' prefix if present for consistency
        currentTag = currentTag.replace(/^v/, '');

        // Strip git commit hash suffix (e.g., "-2-g18b1ded" from "release--2026-01-07.01-2-g18b1ded")
        // This pattern matches: -<number>-g<hash> at the end of the string
        // We want to keep just the tag part (e.g., "release--2026-01-07.01")
        currentTag = currentTag.replace(/-\d+-g[a-f0-9]+$/i, '');

        return currentTag;
      }
    } catch (gitError) {
      // Git command failed, fall through to package.json
    }

    // Fallback to package.json version
    const packageJson = JSON.parse(await fs.readFile(path.join(__dirname, 'package.json'), 'utf8'));
    return packageJson.version;
  } catch (error) {
    // Final fallback
    try {
      const packageJson = JSON.parse(await fs.readFile(path.join(__dirname, 'package.json'), 'utf8'));
      return packageJson.version;
    } catch (e) {
      return '0.1.0';
    }
  }
}

// Helper function to get latest GitHub release
async function getLatestGitHubRelease() {
  return new Promise((resolve, reject) => {
    // First try to get the latest release
    const releaseOptions = {
      hostname: 'api.github.com',
      path: '/repos/DBNubs/vivaro/releases/latest',
      method: 'GET',
      headers: {
        'User-Agent': 'Vivaro-Update-Checker',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const releaseReq = https.request(releaseOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const release = JSON.parse(data);
            resolve({
              tag: release.tag_name,
              name: release.name,
              published_at: release.published_at,
              body: release.body
            });
          } catch (e) {
            reject(new Error('Failed to parse GitHub API response'));
          }
        } else if (res.statusCode === 404) {
          // No releases found, try to get the latest tag instead
          getLatestGitHubTag().then(resolve).catch(reject);
        } else {
          reject(new Error(`GitHub API returned status ${res.statusCode}: ${data}`));
        }
      });
    });

    releaseReq.on('error', (error) => {
      reject(error);
    });

    releaseReq.end();
  });
}

// Helper function to get latest GitHub tag (fallback when no releases exist)
async function getLatestGitHubTag() {
  return new Promise((resolve, reject) => {
    // Use the tags endpoint which returns tags sorted by creation date (newest first)
    const options = {
      hostname: 'api.github.com',
      path: '/repos/DBNubs/vivaro/tags?per_page=1',
      method: 'GET',
      headers: {
        'User-Agent': 'Vivaro-Update-Checker',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const tags = JSON.parse(data);
            if (tags.length > 0) {
              // Tags endpoint returns tag name directly
              const tagName = tags[0].name;
              resolve({
                tag: tagName,
                name: tagName,
                published_at: new Date().toISOString(),
                body: ''
              });
            } else {
              reject(new Error('No tags found in repository'));
            }
          } catch (e) {
            reject(new Error('Failed to parse GitHub tags API response'));
          }
        } else {
          reject(new Error(`GitHub Tags API returned status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// GET /api/updates/check - Check for updates
app.get('/api/updates/check', async (req, res) => {
  try {
    const currentVersion = await getCurrentVersion();

    try {
      const latestRelease = await getLatestGitHubRelease();

      // Normalize versions by removing 'v' prefix and git commit hash for comparison
      const normalizeVersion = (version) => {
        return version
          .replace(/^v/, '') // Remove 'v' prefix
          .replace(/-\d+-g[a-f0-9]+$/i, '') // Strip git commit hash suffix (e.g., "-2-g18b1ded")
          .trim();
      };
      const normalizedCurrent = normalizeVersion(currentVersion);
      const normalizedLatest = normalizeVersion(latestRelease.tag);
      const isUpToDate = normalizedCurrent === normalizedLatest;

      res.json({
        currentVersion,
        latestVersion: latestRelease.tag,
        isUpToDate,
        canPerformInApp: isGitRepository(__dirname),
        releasesUrl: GITHUB_RELEASES_URL,
        releaseInfo: {
          name: latestRelease.name,
          published_at: latestRelease.published_at,
          body: latestRelease.body
        }
      });
    } catch (githubError) {
      // If GitHub API fails (private repo, no tags, network error),
      // return current version and indicate we couldn't check
      console.error('Error fetching from GitHub:', githubError.message);
      res.json({
        currentVersion,
        latestVersion: null,
        isUpToDate: true, // Assume up to date if we can't check
        canPerformInApp: isGitRepository(__dirname),
        releasesUrl: GITHUB_RELEASES_URL,
        error: 'Unable to check for updates',
        message: 'Could not connect to GitHub to check for updates. This may be because the repository is private or there are no releases/tags available.',
        releaseInfo: null
      });
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
    res.status(500).json({
      error: 'Failed to check for updates',
      message: error.message
    });
  }
});

// GET /api/updates/status - Get update progress status
console.log('Registering route: GET /api/updates/status');
app.get('/api/updates/status', (req, res) => {
  console.log('GET /api/updates/status - Request received');
  console.log('Request path:', req.path);
  console.log('Request method:', req.method);
  try {
    // Ensure updateProgress is initialized
    if (!updateProgress) {
      updateProgress = {
        status: 'idle',
        progress: 0,
        message: '',
        error: null
      };
    }
    // Add CORS headers if needed
    res.setHeader('Content-Type', 'application/json');
    console.log('GET /api/updates/status - Returning:', updateProgress);
    res.json(updateProgress);
  } catch (error) {
    console.error('Error getting update status:', error);
    res.status(500).json({
      status: 'error',
      progress: 0,
      message: 'Error retrieving update status',
      error: error.message
    });
  }
});

// POST /api/updates/perform - Perform the update
app.post('/api/updates/perform', async (req, res) => {
  try {
    // Reset progress state
    updateProgress = {
      status: 'in_progress',
      progress: 0,
      message: 'Starting update...',
      error: null
    };

    // Start the update process asynchronously
    res.json({
      message: 'Update started',
      status: 'in_progress'
    });

    // Perform update in background
    (async () => {
      try {
        // Step 1: Get the latest tag from GitHub
        updateProgress.progress = 5;
        updateProgress.message = 'Checking for latest version...';
        console.log('Checking for latest version...');
        let latestRelease;
        try {
          latestRelease = await getLatestGitHubRelease();
        } catch (githubError) {
          // If GitHub API fails, try to get latest tag from git
          console.warn('GitHub API failed, trying to get latest tag from git:', githubError.message);
          try {
            // Fetch tags from remote
            await execAsync('git fetch --tags', {
              cwd: __dirname,
              maxBuffer: 10 * 1024 * 1024
            });
            // Get the latest tag
            const { stdout: latestTag } = await execAsync('git describe --tags --abbrev=0', {
              cwd: __dirname,
              maxBuffer: 10 * 1024 * 1024
            });
            latestRelease = {
              tag: latestTag.trim()
            };
          } catch (gitTagError) {
            throw new Error(`Failed to get latest version: ${githubError.message}. Please ensure you have a git repository and are connected to the remote.`);
          }
        }

        const targetTag = latestRelease.tag;
        console.log(`Target tag for update: ${targetTag}`);

        // In-app update requires a git repository. Packaged/installed apps don't have .git.
        if (!isGitRepository(__dirname)) {
          updateProgress.status = 'error';
          updateProgress.progress = 0;
          updateProgress.message = '';
          updateProgress.error = `In-app updates are only available when running from a development copy of the source. This installation does not have access to the Git repository.\n\nPlease download the latest version from:\n${GITHUB_RELEASES_URL}`;
          return;
        }

        // Step 2: Fetch tags and checkout the specific tag
        updateProgress.progress = 10;
        updateProgress.message = `Fetching tags and checking out ${targetTag}...`;
        console.log(`Fetching tags and checking out ${targetTag}...`);

        // First, fetch all tags from remote
        try {
          await execAsync('git fetch --tags origin', {
            cwd: __dirname,
            maxBuffer: 10 * 1024 * 1024
          });
        } catch (fetchError) {
          // Try without origin
          try {
            await execAsync('git fetch --tags', {
              cwd: __dirname,
              maxBuffer: 10 * 1024 * 1024
            });
          } catch (e) {
            console.warn('Could not fetch tags, continuing anyway:', e.message);
          }
        }

        // Checkout the specific tag
        // First, stash any local changes to avoid checkout conflicts
        try {
          const { stdout: statusOutput } = await execAsync('git status --porcelain', {
            cwd: __dirname,
            maxBuffer: 10 * 1024 * 1024
          });
          if (statusOutput.trim()) {
            console.log('Stashing local changes before checkout...');
            await execAsync('git stash push -m "Auto-stash before update checkout"', {
              cwd: __dirname,
              maxBuffer: 10 * 1024 * 1024
            });
          }
        } catch (stashError) {
          // If stash fails, continue anyway - might be no changes to stash
          console.log('No changes to stash or stash failed:', stashError.message);
        }

        try {
          await execAsync(`git checkout ${targetTag}`, {
            cwd: __dirname,
            maxBuffer: 10 * 1024 * 1024
          });
        } catch (checkoutError) {
          // If checkout fails, try with 'v' prefix or without
          try {
            const tagWithV = targetTag.startsWith('v') ? targetTag : `v${targetTag}`;
            const tagWithoutV = targetTag.startsWith('v') ? targetTag.substring(1) : targetTag;

            try {
              await execAsync(`git checkout ${tagWithV}`, {
                cwd: __dirname,
                maxBuffer: 10 * 1024 * 1024
              });
            } catch (e1) {
              await execAsync(`git checkout ${tagWithoutV}`, {
                cwd: __dirname,
                maxBuffer: 10 * 1024 * 1024
              });
            }
          } catch (e2) {
            throw new Error(`Failed to checkout tag ${targetTag}: ${checkoutError.message}. Please ensure the tag exists in the repository.`);
          }
        }

        updateProgress.progress = 20;
        updateProgress.message = `Successfully checked out ${targetTag}`;
        console.log(`Successfully checked out ${targetTag}`);

        // Step 3: Install dependencies (in case package.json changed)
        updateProgress.progress = 30;
        updateProgress.message = 'Installing dependencies...';
        console.log('=== INSTALLING DEPENDENCIES ===');
        console.log('Current __dirname:', __dirname);
        console.log('Current process.cwd():', process.cwd());
        console.log('process.execPath:', process.execPath);
        console.log('process.env.PATH (original):', process.env.PATH);
        console.log('process.env.HOME:', process.env.HOME);
        console.log('process.env.NEUTRALINO:', process.env.NEUTRALINO);

        // When running from app bundle, process.execPath points to the app binary, not node
        // We need to find the actual node executable
        // Declare these outside try block so they're available in catch block
        let nodeDir, npmPath, npmCmd, npmEnv;

        // Try to find node executable
        let nodePath = null;

        // Method 1: Check if execPath is actually node (development)
        if (process.execPath.includes('node') && (process.execPath.endsWith('node') || process.execPath.endsWith('node.exe'))) {
          nodePath = process.execPath;
          console.log('✓ process.execPath is node:', nodePath);
        } else {
          console.log('process.execPath is not node, searching for node...');

          // Method 2: Try to find node using which (with expanded PATH that includes common node locations)
          try {
            const homeDir = process.env.HOME || os.homedir();
            const basePath = process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin';
            // Build expanded PATH with common node locations
            const nvmBaseDir = path.join(homeDir, '.nvm/versions/node');
            let expandedPath = basePath;

            // Add NVM paths if they exist
            if (fsSync.existsSync(nvmBaseDir)) {
              try {
                const versions = fsSync.readdirSync(nvmBaseDir);
                // Add versions in reverse order (newest first)
                const versionPaths = versions.map(v => path.join(nvmBaseDir, v, 'bin')).reverse();
                expandedPath = versionPaths.join(':') + ':' + expandedPath;
              } catch (e) {
                // Ignore readdir errors
              }
            }

            // Add common node locations
            expandedPath = '/usr/local/bin:/opt/homebrew/bin:' + expandedPath;

            console.log('Searching for node with expanded PATH:', expandedPath);
            const { stdout } = await execAsync('which node', {
              env: { ...process.env, PATH: expandedPath },
              shell: '/bin/bash'
            });
            const foundNode = stdout.trim();
            if (foundNode && fsSync.existsSync(foundNode)) {
              nodePath = foundNode;
              console.log('✓ Found node via which:', nodePath);
            } else {
              console.log('which node returned empty or invalid path');
            }
          } catch (whichError) {
            console.log('which node failed:', whichError.message);
            if (whichError.stderr) {
              console.log('which node stderr:', whichError.stderr);
            }
          }

          // Method 3: Check common node locations
          if (!nodePath) {
            const commonNodePaths = [
              '/usr/local/bin/node',
              '/opt/homebrew/bin/node',
              path.join(process.env.HOME || os.homedir(), '.nvm/versions/node', process.version, 'bin/node')
            ];

            // Also check NVM versions directory
            const nvmDir = path.join(process.env.HOME || os.homedir(), '.nvm/versions/node');
            if (fsSync.existsSync(nvmDir)) {
              try {
                const versions = fsSync.readdirSync(nvmDir);
                // Add current version first, then others
                const currentVersionPath = path.join(nvmDir, process.version, 'bin/node');
                if (fsSync.existsSync(currentVersionPath)) {
                  commonNodePaths.unshift(currentVersionPath);
                }
                // Add a few other versions
                for (const version of versions.slice(0, 3)) {
                  const versionPath = path.join(nvmDir, version, 'bin/node');
                  if (fsSync.existsSync(versionPath) && !commonNodePaths.includes(versionPath)) {
                    commonNodePaths.push(versionPath);
                  }
                }
              } catch (e) {
                console.log('Error reading NVM versions:', e.message);
              }
            }

            for (const testPath of commonNodePaths) {
              if (fsSync.existsSync(testPath)) {
                nodePath = testPath;
                console.log('✓ Found node at common location:', nodePath);
                break;
              }
            }
          }
        }

        if (!nodePath) {
          throw new Error('Could not find node executable. Please ensure Node.js is installed.');
        }

        nodeDir = path.dirname(nodePath);
        npmPath = path.join(nodeDir, 'npm');

        console.log('Node path:', nodePath);
        console.log('Node directory:', nodeDir);
        console.log('npm path (calculated):', npmPath);
        console.log('npm exists:', fsSync.existsSync(npmPath));

        if (!fsSync.existsSync(npmPath)) {
          throw new Error(`npm not found at ${npmPath}. Please ensure npm is installed with Node.js.`);
        }

        // Build enhanced PATH with node directory first
        const basePath = process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin';
        npmEnv = {
          ...process.env,
          PATH: `${nodeDir}:${basePath}`
        };

        console.log('Base PATH:', basePath);
        console.log('Enhanced PATH:', npmEnv.PATH);

        // Always use full path to npm
        npmCmd = npmPath;
        console.log('Using npm command (full path):', npmCmd);
        console.log('Full command:', `${npmCmd} install`);
        console.log('Working directory:', __dirname);
        console.log('Shell:', '/bin/bash');

        try {
          await execAsync(`${npmCmd} install`, {
            cwd: __dirname,
            env: npmEnv,
            maxBuffer: 10 * 1024 * 1024,
            shell: '/bin/bash'
          });
          console.log('✓ npm install completed successfully');
        } catch (npmError) {
          console.error('=== NPM INSTALL ERROR ===');
          console.error('Error message:', npmError.message);
          console.error('Error code:', npmError.code);
          console.error('Error stdout:', npmError.stdout || '(empty)');
          console.error('Error stderr:', npmError.stderr || '(empty)');
          console.error('Command that failed:', npmError.cmd || `${npmCmd} install`);
          console.error('Environment PATH used:', npmEnv.PATH);
          console.error('Node directory:', nodeDir);
          console.error('npm path:', npmPath);
          console.error('npm exists:', fsSync.existsSync(npmPath));

          // Try to verify node is accessible
          try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const testExec = promisify(exec);
            const nodeTest = await testExec('node --version', { env: npmEnv, shell: '/bin/bash' });
            console.error('Node test result:', nodeTest.stdout.trim());
          } catch (nodeTestError) {
            console.error('Node test failed:', nodeTestError.message);
          }

          // Try to verify npm is accessible
          try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const testExec = promisify(exec);
            const npmTest = await testExec(`${npmCmd} --version`, { env: npmEnv, shell: '/bin/bash' });
            console.error('npm test result:', npmTest.stdout.trim());
          } catch (npmTestError) {
            console.error('npm test failed:', npmTestError.message);
            console.error('npm test stderr:', npmTestError.stderr);
          }

          throw npmError;
        }
        updateProgress.progress = 40;
        updateProgress.message = 'Dependencies installed';

        // Step 4: Rebuild React app
        updateProgress.progress = 50;
        updateProgress.message = 'Rebuilding React app...';
        console.log('=== REBUILDING REACT APP ===');
        console.log('Using npm command:', npmCmd);
        console.log('Full command:', `${npmCmd} run build`);

        try {
          await execAsync(`${npmCmd} run build`, {
            cwd: __dirname,
            env: npmEnv,
            maxBuffer: 10 * 1024 * 1024,
            shell: '/bin/bash'
          });
          console.log('✓ npm run build completed successfully');
        } catch (buildError) {
          console.error('=== NPM RUN BUILD ERROR ===');
          console.error('Error message:', buildError.message);
          console.error('Error code:', buildError.code);
          console.error('Error stdout:', buildError.stdout || '(empty)');
          console.error('Error stderr:', buildError.stderr || '(empty)');
          throw buildError;
        }
        updateProgress.progress = 60;
        updateProgress.message = 'React app rebuilt';
        console.log('✓ React app rebuilt');

        // Step 5: Copy neutralino.js and update resources
        updateProgress.progress = 70;
        updateProgress.message = 'Updating Neutralino resources...';
        console.log('Updating Neutralino resources...');
        // Check if neutralino.js exists before copying
        const neutralinoJsPath = path.join(__dirname, 'neutralino.js');
        const buildNeutralinoJsPath = path.join(__dirname, 'build', 'neutralino.js');
        if (fsSync.existsSync(neutralinoJsPath)) {
          fsSync.copyFileSync(neutralinoJsPath, buildNeutralinoJsPath);
          console.log('✓ Copied neutralino.js to build/');
        } else {
          console.log('⚠ Warning: neutralino.js not found, skipping copy');
        }
        // Clean up and copy resources
        const resourcesPath = path.join(__dirname, 'resources');
        if (fsSync.existsSync(resourcesPath)) {
          fsSync.rmSync(resourcesPath, { recursive: true, force: true });
        }
        const buildPath = path.join(__dirname, 'build');
        fsSync.cpSync(buildPath, resourcesPath, { recursive: true });
        updateProgress.progress = 80;
        updateProgress.message = 'Resources updated';

        // Step 6: Rebuild Neutralino app
        updateProgress.progress = 90;
        updateProgress.message = 'Rebuilding Neutralino app...';
        console.log('=== REBUILDING NEUTRALINO APP ===');
        console.log('Using npx with enhanced PATH:', npmEnv.PATH);

        // npx also needs node in PATH
        try {
          await execAsync('npx @neutralinojs/neu build', {
            cwd: __dirname,
            env: npmEnv,
            maxBuffer: 10 * 1024 * 1024,
            shell: '/bin/bash'
          });
          console.log('✓ npx @neutralinojs/neu build completed successfully');
        } catch (npxError) {
          console.error('=== NPX BUILD ERROR ===');
          console.error('Error message:', npxError.message);
          console.error('Error code:', npxError.code);
          console.error('Error stdout:', npxError.stdout || '(empty)');
          console.error('Error stderr:', npxError.stderr || '(empty)');
          throw npxError;
        }
        updateProgress.progress = 95;
        updateProgress.message = 'Neutralino app rebuilt';

        // Step 7: Update the .app bundle with the new binary and resources
        updateProgress.progress = 97;
        updateProgress.message = 'Updating app bundle...';
        console.log('Updating app bundle...');
        console.log('Current __dirname:', __dirname);
        console.log('Current process.cwd():', process.cwd());

        // Find the .app bundle location
        // When running from the app bundle, __dirname will be something like:
        // /path/to/Vivaro.app/Contents/Resources
        let appBundlePath = null;
        let appResourcesPath = null;

        // Method 1: Check if we're inside a .app bundle (most reliable)
        if (__dirname.includes('.app/Contents/Resources')) {
          const appMatch = __dirname.match(/(.*\.app)/);
          if (appMatch) {
            appBundlePath = appMatch[1];
            appResourcesPath = path.join(appBundlePath, 'Contents/Resources');
            console.log('✓ Found app bundle from __dirname:', appBundlePath);
            console.log('  App resources path:', appResourcesPath);
          }
        }

        // Method 2: Try to find it relative to __dirname
        if (!appBundlePath || !fsSync.existsSync(appBundlePath)) {
          // Try going up from __dirname to find .app
          let currentPath = __dirname;
          for (let i = 0; i < 5; i++) {
            const testPath = path.join(currentPath, '..', '..', 'Vivaro.app');
            if (fsSync.existsSync(testPath)) {
              appBundlePath = testPath;
              appResourcesPath = path.join(appBundlePath, 'Contents/Resources');
              console.log(`✓ Found app bundle by going up ${i} levels:`, appBundlePath);
              break;
            }
            currentPath = path.join(currentPath, '..');
            if (!currentPath || currentPath === '/' || currentPath === path.dirname(currentPath)) {
              break;
            }
          }
        }

        // Method 3: Try common locations
        if (!appBundlePath || !fsSync.existsSync(appBundlePath)) {
          const possibleAppPaths = [
            '/Applications/Vivaro.app',
            path.join(process.env.HOME || os.homedir(), 'Applications/Vivaro.app'),
            path.join(__dirname, '../../Vivaro.app'),
            path.join(__dirname, '../Vivaro.app'),
            path.join(__dirname, '../../../Vivaro.app'),
            path.join(__dirname, '../../../../Vivaro.app')
          ];

          for (const possiblePath of possibleAppPaths) {
            if (fsSync.existsSync(possiblePath)) {
              appBundlePath = possiblePath;
              appResourcesPath = path.join(appBundlePath, 'Contents/Resources');
              console.log('✓ Found app bundle in common location:', appBundlePath);
              break;
            }
          }
        }

        if (appBundlePath && appResourcesPath && fsSync.existsSync(appBundlePath)) {
          const distPath = path.join(__dirname, 'dist/vivaro');
          console.log('Dist path:', distPath);
          console.log('App resources path:', appResourcesPath);

          // Copy the new binary
          const binaryName = fsSync.existsSync(path.join(distPath, 'vivaro-mac_arm64'))
            ? 'vivaro-mac_arm64'
            : 'vivaro-mac_x64';
          const binaryPath = path.join(distPath, binaryName);

          if (fsSync.existsSync(binaryPath)) {
            const destBinaryPath = path.join(appResourcesPath, binaryName);
            console.log(`Copying binary from ${binaryPath} to ${destBinaryPath}`);
            fsSync.copyFileSync(binaryPath, destBinaryPath);
            fsSync.chmodSync(destBinaryPath, 0o755);
            console.log(`✓ Copied new binary to app bundle: ${destBinaryPath}`);
          } else {
            console.warn(`Binary not found at: ${binaryPath}`);
          }

          // Copy resources.neu
          const resourcesNeuPath = path.join(distPath, 'resources.neu');
          if (fsSync.existsSync(resourcesNeuPath)) {
            const destResourcesNeu = path.join(appResourcesPath, 'resources.neu');
            console.log(`Copying resources.neu from ${resourcesNeuPath} to ${destResourcesNeu}`);
            fsSync.copyFileSync(resourcesNeuPath, destResourcesNeu);
            console.log('✓ Copied resources.neu to app bundle');
          } else {
            console.warn(`resources.neu not found at: ${resourcesNeuPath}`);
          }

          // Copy updated resources directory (React build)
          const resourcesDir = path.join(__dirname, 'resources');
          if (fsSync.existsSync(resourcesDir)) {
            const appResourcesDir = path.join(appResourcesPath, 'resources');
            console.log(`Copying resources from ${resourcesDir} to ${appResourcesDir}`);
            // Remove old resources and copy new ones
            if (fsSync.existsSync(appResourcesDir)) {
              fsSync.rmSync(appResourcesDir, { recursive: true, force: true });
            }
            fsSync.cpSync(resourcesDir, appResourcesDir, { recursive: true });
            console.log('✓ Copied updated resources directory to app bundle');
          } else {
            console.warn(`Resources directory not found at: ${resourcesDir}`);
          }

          // Copy updated server.js
          const serverPath = path.join(__dirname, 'server.js');
          if (fsSync.existsSync(serverPath)) {
            const destServerPath = path.join(appResourcesPath, 'server.js');
            console.log(`Copying server.js from ${serverPath} to ${destServerPath}`);
            fsSync.copyFileSync(serverPath, destServerPath);
            console.log('✓ Copied updated server.js to app bundle');
          }

          // Copy package.json (needed for npm install if node_modules are missing)
          const packageJsonPath = path.join(__dirname, 'package.json');
          if (fsSync.existsSync(packageJsonPath)) {
            const destPackageJson = path.join(appResourcesPath, 'package.json');
            fsSync.copyFileSync(packageJsonPath, destPackageJson);
            console.log('✓ Copied package.json to app bundle');
          }

          // Copy neutralino.config.json (needed for Neutralino)
          const neutralinoConfigPath = path.join(__dirname, 'neutralino.config.json');
          if (fsSync.existsSync(neutralinoConfigPath)) {
            const destNeutralinoConfig = path.join(appResourcesPath, 'neutralino.config.json');
            fsSync.copyFileSync(neutralinoConfigPath, destNeutralinoConfig);
            console.log('✓ Copied neutralino.config.json to app bundle');
          }

          // Copy neutralino.js (needed for Neutralino)
          const neutralinoJsPath = path.join(__dirname, 'neutralino.js');
          if (fsSync.existsSync(neutralinoJsPath)) {
            const destNeutralinoJs = path.join(appResourcesPath, 'neutralino.js');
            fsSync.copyFileSync(neutralinoJsPath, destNeutralinoJs);
            console.log('✓ Copied neutralino.js to app bundle');
          }

          // Note: We don't copy node_modules during update to save time
          // The existing node_modules should still work, or npm install can be run if needed

          // Verify the files were copied
          const binaryExists = fsSync.existsSync(path.join(appResourcesPath, binaryName));
          const resourcesNeuExists = fsSync.existsSync(path.join(appResourcesPath, 'resources.neu'));
          const resourcesDirExists = fsSync.existsSync(path.join(appResourcesPath, 'resources'));
          const serverExists = fsSync.existsSync(path.join(appResourcesPath, 'server.js'));

          console.log('Verification:');
          console.log(`  Binary exists: ${binaryExists}`);
          console.log(`  resources.neu exists: ${resourcesNeuExists}`);
          console.log(`  resources directory exists: ${resourcesDirExists}`);
          console.log(`  server.js exists: ${serverExists}`);

          if (binaryExists && resourcesNeuExists && resourcesDirExists && serverExists) {
            console.log('✓ App bundle updated successfully - all files verified');
          } else {
            console.warn('⚠ Some files may not have been copied correctly');
          }
        } else {
          console.warn('Could not find app bundle to update.');
          console.warn('Current __dirname:', __dirname);
          console.warn('Searched paths:', [
            __dirname.includes('.app') ? `Found in __dirname: ${__dirname.match(/(.*\.app)/)?.[1]}` : 'Not in .app bundle',
            '/Applications/Vivaro.app',
            path.join(process.env.HOME || os.homedir(), 'Applications/Vivaro.app')
          ]);
          console.warn('App may need to be manually reinstalled.');
          updateProgress.message = `Update completed, but app bundle not found. Please manually reinstall the app.`;
        }

        updateProgress.progress = 100;
        updateProgress.status = 'completed';
        updateProgress.message = `Update completed successfully! Current version: ${targetTag}`;
        console.log(`Update completed successfully! Current version: ${targetTag}`);
        console.log('Please restart the application to use the new version.');

        // Verify the current version after update
        try {
          const newCurrentVersion = await getCurrentVersion();
          console.log(`Verified current version after update: ${newCurrentVersion}`);
        } catch (versionError) {
          console.warn('Could not verify version after update:', versionError.message);
        }

        // Note: We can't automatically restart the app from here since we're running inside it
        // The user will need to manually restart

      } catch (error) {
        console.error('=== ERROR DURING UPDATE ===');
        console.error('Error during update:', error);
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        // Log environment at time of error
        console.error('=== ENVIRONMENT AT ERROR TIME ===');
        console.error('__dirname:', __dirname);
        console.error('process.cwd():', process.cwd());
        console.error('process.execPath:', process.execPath);
        console.error('process.env.PATH:', process.env.PATH);
        console.error('process.env.HOME:', process.env.HOME);
        console.error('process.env.NEUTRALINO:', process.env.NEUTRALINO);

        // Log npm-related variables if they exist
        if (typeof nodeDir !== 'undefined') {
          console.error('nodeDir (from earlier):', nodeDir);
        }
        if (typeof npmPath !== 'undefined') {
          console.error('npmPath (from earlier):', npmPath);
          console.error('npmPath exists:', fsSync.existsSync(npmPath));
        }
        if (typeof npmCmd !== 'undefined') {
          console.error('npmCmd (from earlier):', npmCmd);
        }
        if (typeof npmEnv !== 'undefined') {
          console.error('npmEnv.PATH (from earlier):', npmEnv.PATH);
        }

        if (error.stdout) {
          console.error('Command stdout:', error.stdout);
          console.error('Command stdout length:', error.stdout.length);
        }
        if (error.stderr) {
          console.error('Command stderr:', error.stderr);
          console.error('Command stderr length:', error.stderr.length);
        }
        if (error.cmd) {
          console.error('Command that failed:', error.cmd);
        }
        if (error.code) {
          console.error('Exit code:', error.code);
        }
        console.error('=== END ERROR DETAILS ===');

        updateProgress.status = 'error';
        // Provide more helpful error message
        let errorMessage = error.message || 'Update failed. Please check the logs and try again.';

        // Check for npm-related errors
        const errorText = (error.stderr || '') + (error.stdout || '') + (error.message || '') + (error.cmd || '');
        console.log('Checking error text for npm issues. Error text length:', errorText.length);
        console.log('Error text contains "npm: command not found":', errorText.includes('npm: command not found'));
        console.log('Error text contains "/bin/sh: npm":', errorText.includes('/bin/sh: npm'));

        if (errorText.includes('npm: command not found') || errorText.includes('/bin/sh: npm: command not found')) {
          errorMessage = `npm not found. The update process tried to use npm but it was not found. This usually means Node.js/npm are not in the system PATH when running from the app bundle. Please check the server console logs for details about which npm path was attempted.`;
        } else if (error.message && error.message.includes('npm')) {
          errorMessage = error.message;
        } else if (error.stderr) {
          // Include stderr in the error message for more context
          const stderrPreview = error.stderr.length > 200 ? error.stderr.substring(0, 200) + '...' : error.stderr;
          errorMessage = `${error.message || 'Update failed'}. ${stderrPreview}`;
        }

        updateProgress.error = errorMessage;
        updateProgress.message = 'Update failed';
      }
    })();

  } catch (error) {
    console.error('Error starting update:', error);
    updateProgress.status = 'error';
    updateProgress.error = error.message;
    updateProgress.message = 'Failed to start update';
    res.status(500).json({
      error: 'Failed to start update',
      message: error.message
    });
  }
});

// GET /api/test - Simple test endpoint to verify server is running current code
// This endpoint should exist in all versions to help diagnose server issues
app.get('/api/test', (req, res) => {
  // Check if restart route exists
  let hasRestartRoute = false;
  app._router.stack.forEach((middleware) => {
    if (middleware.route && middleware.route.path === '/api/restart') {
      const methods = Object.keys(middleware.route.methods);
      if (methods.includes('post')) {
        hasRestartRoute = true;
      }
    }
  });

  res.json({
    message: 'Server is running current code',
    version: '2026.01.12-with-restart', // Version identifier
    timestamp: new Date().toISOString(),
    hasRestartRoute: hasRestartRoute,
    serverFile: __filename,
    serverDir: __dirname,
    routes: app._router.stack
      .filter(m => m.route)
      .map(m => ({
        path: m.route.path,
        methods: Object.keys(m.route.methods)
      }))
      .filter(r => r.path.startsWith('/api/'))
  });
});

// POST /api/restart - Restart the application
// This route was added on 2026-01-12
console.log('Registering /api/restart route...');
console.log('Route registration timestamp:', new Date().toISOString())
app.post('/api/restart', async (req, res) => {
  console.log('=== /api/restart ROUTE CALLED ===');
  try {
    console.log('Restart request received');
    console.log('__dirname:', __dirname);
    console.log('process.execPath:', process.execPath);

    // Send response immediately before restarting
    res.json({ success: true, message: 'Restarting application...' });

    // Launch a new instance of the app (macOS)
    // This runs in the background, so the response is sent first
    // Use setImmediate to ensure it runs, but don't wait for it
    setImmediate(async () => {
      try {
        console.log('=== RESTART PROCESS STARTING ===');
        // Try to find the app by looking at where we're running from
        // In a .app bundle, __dirname will be inside Contents/Resources
        let appPath = null;

        // Check if we're inside a .app bundle
        if (__dirname.includes('.app/Contents')) {
          // Extract the .app path
          const appMatch = __dirname.match(/(.*\.app)/);
          if (appMatch) {
            appPath = appMatch[1];
            console.log('Found app path from __dirname:', appPath);
          }
        }

        // If not found, try common locations
        if (!appPath || !fsSync.existsSync(appPath)) {
          const possiblePaths = [
            '/Applications/Vivaro.app',
            path.join(process.env.HOME || os.homedir(), 'Applications/Vivaro.app'),
            path.join(__dirname, '../../Vivaro.app'),
            path.join(__dirname, '../Vivaro.app'),
            path.join(__dirname, '../../../../Vivaro.app') // If in Contents/Resources
          ];

          for (const possiblePath of possiblePaths) {
            if (fsSync.existsSync(possiblePath)) {
              appPath = possiblePath;
              console.log('Found app path in common location:', appPath);
              break;
            }
          }
        }

        // Use osascript for a more reliable macOS restart
        // This approach uses AppleScript to quit and reopen the app
        const appPathForScript = appPath && fsSync.existsSync(appPath) ? appPath : 'Vivaro';
        const logFile = path.join(os.tmpdir(), `vivaro-restart-${Date.now()}.log`);

        // Create an AppleScript that will quit and reopen the app
        const appleScript = `
tell application "${appPathForScript}"
  quit
end tell

delay 2

tell application "${appPathForScript}"
  activate
end tell
`;

        // Also create a bash script as backup that uses killall + open
        // Need to escape $ signs that are NOT meant for template interpolation
        const scriptContent = `#!/bin/bash
# Restart script for Vivaro app
# This script runs independently and will restart the app

LOG_FILE="${logFile}"
APP_PATH="${(appPath || '').replace(/"/g, '\\"')}"
APP_NAME="Vivaro"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log "=== Vivaro Restart Script ==="
log "Starting restart process"
log "Script PID: $$"

# Function to find app path
find_app() {
  if [ -n "$APP_PATH" ] && [ -d "$APP_PATH" ]; then
    echo "$APP_PATH"
    return 0
  fi

  TEST_PATHS=(
    "/Applications/Vivaro.app"
    "$HOME/Applications/Vivaro.app"
  )

  for test_path in "\${TEST_PATHS[@]}"; do
    if [ -d "$test_path" ]; then
      echo "$test_path"
      return 0
    fi
  done

  return 1
}

FOUND_APP=$(find_app)
APP_TO_USE="${appPathForScript}"

# Step 1: Launch new instance FIRST (before killing old one)
# Use open -n to force a new instance even if one is running
log "Step 1: Launching new instance..."
if [ -n "$FOUND_APP" ] && [ -d "$FOUND_APP" ]; then
  log "Found app at: $FOUND_APP"
  log "Launching with: open -n \"$FOUND_APP\""
  open -n "$FOUND_APP" 2>&1 | tee -a "$LOG_FILE"
  APP_TO_USE="$FOUND_APP"
else
  log "App path not found, trying by name..."
  log "Launching with: open -n -a \"$APP_NAME\""
  open -n -a "$APP_NAME" 2>&1 | tee -a "$LOG_FILE"
  APP_TO_USE="$APP_NAME"
fi
log "✓ Launch command executed"

# Step 2: Wait for new instance to fully start
log "Step 2: Waiting for new instance to start (5 seconds)..."
sleep 5
log "✓ Wait complete"

# Step 3: Kill all old instances (this will kill the old app, but new one should be running)
log "Step 3: Killing old app instances..."
log "Running: killall vivaro-mac_arm64"
killall vivaro-mac_arm64 2>&1 | tee -a "$LOG_FILE" || true
sleep 2
log "✓ Killall executed"

# Step 4: Double-check and ensure fresh instance is running
log "Step 4: Ensuring fresh instance is running..."
if [ -n "$FOUND_APP" ] && [ -d "$FOUND_APP" ]; then
  log "Opening: $FOUND_APP"
  open "$FOUND_APP" 2>&1 | tee -a "$LOG_FILE"
else
  log "Opening by name: $APP_NAME"
  open -a "$APP_NAME" 2>&1 | tee -a "$LOG_FILE"
fi
log "✓ Final launch command executed"

log "=== Restart Complete ==="
`;

        // Write both scripts to temp files
        const scriptPath = path.join(os.tmpdir(), `vivaro-restart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.sh`);
        const appleScriptPath = path.join(os.tmpdir(), `vivaro-restart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.scpt`);

        fsSync.writeFileSync(scriptPath, scriptContent);
        fsSync.chmodSync(scriptPath, 0o755);

        // Step 1: Launch new instance FIRST
        console.log('=== Step 1: Launching new instance ===');
        console.log('App path:', appPath);
        console.log('App path for script:', appPathForScript);

        if (appPath && fsSync.existsSync(appPath)) {
          console.log(`Executing: open -n "${appPath}"`);
          const { stdout, stderr } = await execAsync(`open -n "${appPath}"`, { shell: '/bin/bash' });
          if (stdout) console.log('open stdout:', stdout);
          if (stderr) console.log('open stderr:', stderr);
          console.log('✓ New instance launched from path');
        } else {
          console.log(`Executing: open -n -a "${appPathForScript}"`);
          const { stdout, stderr } = await execAsync(`open -n -a "${appPathForScript}"`, { shell: '/bin/bash' });
          if (stdout) console.log('open -a stdout:', stdout);
          if (stderr) console.log('open -a stderr:', stderr);
          console.log('✓ New instance launched by name');
        }

        // Step 2: Wait for new instance to start
        console.log('=== Step 2: Waiting for new instance to start (4 seconds) ===');
        await new Promise(resolve => setTimeout(resolve, 4000));
        console.log('✓ Wait complete');

        // Step 3: Create a script that will quit the old instance
        // This script runs independently and will quit the app
        const appNameEscaped = appPathForScript.replace(/'/g, "'\\''");
        const quitScript = `#!/bin/bash
# Quit script - runs independently
osascript -e 'tell application "${appNameEscaped}" to quit' 2>/dev/null || killall vivaro-mac_arm64 2>/dev/null || true
`;

        const quitScriptPath = path.join(os.tmpdir(), `vivaro-quit-${Date.now()}.sh`);
        fsSync.writeFileSync(quitScriptPath, quitScript);
        fsSync.chmodSync(quitScriptPath, 0o755);

        // Step 4: Execute quit script in background (this will quit the old instance)
        console.log('=== Step 3: Quitting old instance ===');
        console.log('Quit script path:', quitScriptPath);
        console.log('Quit script content:', quitScript);

        try {
          const { spawn } = require('child_process');
          console.log('Spawning quit script process...');
          const quitProcess = spawn('bash', [quitScriptPath], {
            detached: true,
            stdio: 'pipe' // Change to 'pipe' so we can see output
          });

          // Log output from quit script
          quitProcess.stdout.on('data', (data) => {
            console.log('Quit script stdout:', data.toString());
          });
          quitProcess.stderr.on('data', (data) => {
            console.log('Quit script stderr:', data.toString());
          });

          quitProcess.unref();
          console.log('✓ Quit command launched (PID:', quitProcess.pid, ')');
        } catch (quitError) {
          console.error('Error launching quit command:', quitError);
          console.error('Error stack:', quitError.stack);
          // Fallback: try direct osascript
          try {
            console.log('Trying fallback: direct osascript quit');
            await execAsync(`osascript -e 'tell application "${appNameEscaped}" to quit'`, {
              shell: '/bin/bash',
              timeout: 1000
            });
            console.log('✓ Fallback quit succeeded');
          } catch (e) {
            console.error('Fallback quit also failed:', e);
            console.error('Fallback error stack:', e.stack);
          }
        }

        console.log('=== RESTART PROCESS COMPLETE ===');

        // Exit this Node.js process after giving the quit command time to execute
        // The new instance should already be running, and the quit command will close the old one
        console.log('Exiting Node.js process (new instance should be running, quit command will close old one)...');
        setTimeout(() => {
          process.exit(0);
        }, 1000); // Give quit command 1 second to execute
      } catch (error) {
        console.error('=== ERROR IN RESTART PROCESS ===');
        console.error('Error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('=== END RESTART ERROR ===');
      }
    });

  } catch (error) {
    console.error('Error handling restart request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restart application',
      message: error.message
    });
  }
});

// Serve React app catch-all route (must be after all API routes)
// Only serve static files if we're in Neutralino or production mode
if (process.env.NEUTRALINO || (process.env.NODE_ENV === 'production' && !process.env.STANDALONE_SERVER)) {
  const buildPath = path.join(__dirname, 'build');
  const indexHtmlPath = path.join(buildPath, 'index.html');
  console.log('Registering catch-all route: GET *');
  app.get('*', (req, res) => {
    // Don't serve HTML for API routes that weren't matched by specific routes
    if (req.path.startsWith('/api/')) {
      console.log('Catch-all route: API route not found:', req.path);
      return res.status(404).json({ error: 'Not found' });
    }
    // Check if index.html exists before trying to serve it
    if (fsSync.existsSync(indexHtmlPath)) {
      res.sendFile(indexHtmlPath);
    } else {
      console.error(`index.html not found at ${indexHtmlPath}`);
      res.status(500).send(`
        <html>
          <body style="font-family: system-ui; padding: 40px; background: #f5f5f5;">
            <h1 style="color: #d32f2f;">Build Not Found</h1>
            <p>The application build files were not found.</p>
            <p><strong>Expected path:</strong> ${indexHtmlPath}</p>
            <p><strong>Build directory:</strong> ${buildPath}</p>
            <p><strong>__dirname:</strong> ${__dirname}</p>
          </body>
        </html>
      `);
    }
  });
}

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
  try {
    await ensureDataDirectory();
    await migrateOldData();

    // Log all registered routes for debugging before starting server
    console.log('Registered API routes:');
    let hasRestartRoute = false;
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
        const path = middleware.route.path;
        console.log(`  ${methods} ${path}`);
        if (path === '/api/restart' && methods.includes('POST')) {
          hasRestartRoute = true;
        }
      }
    });
    if (hasRestartRoute) {
      console.log('✓ /api/restart route is registered');
    } else {
      console.error('✗ WARNING: /api/restart route is NOT registered!');
    }
    console.log('=== Starting server ===');

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
  } catch (error) {
    console.error('Error starting server:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Auto-start the server
// If NEUTRALINO is set, we're being run by Neutralino, so start the server
// If NEUTRALINO is not set, we're running standalone, so also start the server
startServer().catch((error) => {
  console.error('Fatal error starting server:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Export for use by other modules if needed
module.exports = { app, startServer };
