// Neutralino main process - spawns Express server
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let serverProcess = null;

// Get data directory
const os = require('os');
const appDataPath = path.join(os.homedir(), '.vivaro');
const dataDir = path.join(appDataPath, 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Spawn Express server
function startServer() {
  const serverPath = path.join(__dirname, 'server.js');

  if (!fs.existsSync(serverPath)) {
    console.error('server.js not found at:', serverPath);
    return;
  }

  const env = {
    ...process.env,
    PORT: '3001',
    NEUTRALINO: '1',
    DATA_DIR: dataDir
  };

  serverProcess = spawn('node', [serverPath], {
    env: env,
    cwd: __dirname,
    stdio: 'inherit'
  });

  serverProcess.on('error', (error) => {
    console.error('Failed to start server:', error);
  });

  serverProcess.on('exit', (code) => {
    console.log(`Server process exited with code ${code}`);
  });

  console.log('Express server started with PID:', serverProcess.pid);
}

// Cleanup on exit
process.on('exit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

process.on('SIGTERM', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(0);
});

// Start server
startServer();

// Wait a bit for server to start, then open Neutralino
setTimeout(() => {
  console.log('Server should be ready at http://localhost:3001');
}, 2000);

