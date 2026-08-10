const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');
require('dotenv').config();
const { resolveBackend } = require('./lib/resolve_backend.cjs');
const backend = resolveBackend();

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m"
};

console.clear();
console.log(`${COLORS.bright}${COLORS.cyan}========================================================`);
console.log(`   NEK KADAM - OPERATIONAL CONTROL SYSTEM (v1.2)`);
console.log(`========================================================${COLORS.reset}\n`);

let backendProcess = null;
let frontendProcess = null;
let desktopProcess = null;

function startBackend() {
  console.log(`${COLORS.yellow}[SYSTEM] Starting ${backend.mode.toUpperCase()} backend (${backend.script}) — ${backend.reason}${COLORS.reset}`);
  backendProcess = spawn('node', [backend.script], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });

  backendProcess.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${COLORS.red}[CRASH] Backend exited with code ${code}. Restarting in 3s...${COLORS.reset}`);
      setTimeout(startBackend, 3000);
    }
  });
}

function startFrontend() {
  console.log(`${COLORS.blue}[SYSTEM] Initializing Vite Frontend...${COLORS.reset}`);
  const viteCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  frontendProcess = spawn(viteCmd, ['run', 'dev'], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });
}

function startDesktop() {
  console.log(`${COLORS.green}[SYSTEM] Launching Electron Desktop...${COLORS.reset}`);
  const electronCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  desktopProcess = spawn(electronCmd, ['run', 'electron:dev'], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });

  desktopProcess.on('close', () => {
    console.log(`${COLORS.yellow}[SHUTDOWN] Desktop closed. Cleaning up ecosystem...${COLORS.reset}`);
    shutdownAll();
  });
}

function shutdownAll() {
  console.log(`${COLORS.yellow}[SYSTEM] Closing all processes...${COLORS.reset}`);
  if (process.platform === 'win32') {
    // Force kill all node processes in this tree to avoid orphans
    // We use /T to kill child processes (like npm and shells)
    exec('taskkill /F /T /IM node.exe', () => {
       process.exit(0);
    });
  } else {
    if (frontendProcess) frontendProcess.kill();
    if (backendProcess) backendProcess.kill();
    process.exit(0);
  }
}

// ─── EXECUTION FLOW ───
startBackend();

setTimeout(() => {
  startFrontend();
  
  // Show connection info
  const networkInterfaces = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name in networkInterfaces) {
    for (const iface of networkInterfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) { localIP = iface.address; break; }
    }
  }

  console.log(`\n${COLORS.bright}${COLORS.green}📱 MOBILE ACCESS URL: http://${localIP}:5173${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.green}🖥️  LOCAL DASHBOARD:   http://localhost:5173${COLORS.reset}\n`);

  setTimeout(startDesktop, 2000);
}, 3000);

process.on('SIGINT', shutdownAll);
process.on('SIGTERM', shutdownAll);
