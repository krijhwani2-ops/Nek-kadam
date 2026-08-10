const { app, BrowserWindow } = require('electron');
// Re-enable GPU hardware acceleration to solve scroll rendering lag on the desktop app
// app.disableHardwareAcceleration();
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();
const { resolveBackend } = require('./lib/resolve_backend.cjs');
const backend = resolveBackend();

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Nek Kadam - Clinical Management",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  // Start the backend server automatically in development or if explicitly requested
  const shouldStartServer = !app.isPackaged || process.argv.includes('--start-server');
  if (shouldStartServer) {
    console.log(`[Electron] Backend: ${backend.mode} (${backend.script}) — ${backend.reason}`);
    backendProcess = spawn('node', [backend.script], {
      cwd: __dirname,
      shell: true
    });
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
