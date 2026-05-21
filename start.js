const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log("\x1b[1;36mStarting Lyric Video Generator Services...\x1b[0m");

// Enforce Google Cloud Service Account Key presence
const keyPath = path.join(__dirname, 'service-account-key.json');
const envKeyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const hasKey = fs.existsSync(keyPath) || (envKeyPath && fs.existsSync(envKeyPath));

if (!hasKey) {
  console.error("\x1b[1;31m❌ ERROR: Google Cloud Service Account Key is missing!\x1b[0m");
  console.error("--------------------------------------------------------");
  console.error("Automatic lyric generation requires a Google Cloud Service Account");
  console.error("with the Cloud Speech-to-Text API enabled.");
  console.error("");
  console.error("How to get a key:");
  console.error("  1. Go to Google Cloud Console (https://console.cloud.google.com)");
  console.error("  2. Enable the 'Cloud Speech-to-Text API' for your project.");
  console.error("  3. Go to 'IAM & Admin' -> 'Service Accounts' and create a Service Account.");
  console.error("  4. Grant the Service Account appropriate access (e.g., 'Project Owner/Editor' or 'Speech-to-Text' specific roles).");
  console.error("  5. Go to the 'Keys' tab, click 'Add Key' -> 'Create new key', select JSON format, and download the key file.");
  console.error("  6. Save the downloaded file as 'service-account-key.json' in this folder:");
  console.error(`     ${keyPath}`);
  console.error("--------------------------------------------------------");
  process.exit(1);
}

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Ensure storage subdirectories exist (to prevent potential writing errors)
const storageDir = path.join(__dirname, 'storage');
const subdirs = ['audio', 'video', 'subtitles'];
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}
subdirs.forEach(dir => {
  const p = path.join(storageDir, dir);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
});

// Check if database exists, initialize if not
const dbPath = path.join(storageDir, 'database.sqlite');
if (!fs.existsSync(dbPath)) {
  console.log("\x1b[1;33m--> SQLite database not found. Initializing storage/database.sqlite...\x1b[0m");
  try {
    execSync('node -e "const { db } = require(\'./backend/database\'); db.close();"', { stdio: 'inherit' });
    console.log("\x1b[1;32m--> Database initialized successfully.\x1b[0m");
  } catch (error) {
    console.error("\x1b[1;31mFailed to automatically initialize SQLite database:\x1b[0m", error.message);
  }
}

// Ensure backend dependencies are installed
const backendDir = path.join(__dirname, 'backend');
if (!fs.existsSync(path.join(backendDir, 'node_modules'))) {
  console.log("\x1b[1;33m--> Installing backend dependencies (this may take a moment)...\x1b[0m");
  try {
    execSync('npm install', { cwd: backendDir, stdio: 'inherit' });
  } catch (error) {
    console.error("\x1b[1;31mFailed to install backend dependencies:\x1b[0m", error.message);
  }
}

// Ensure frontend dependencies are installed
const frontendDir = path.join(__dirname, 'frontend');
if (!fs.existsSync(path.join(frontendDir, 'node_modules'))) {
  console.log("\x1b[1;33m--> Installing frontend dependencies (this may take a moment)...\x1b[0m");
  try {
    execSync('npm install', { cwd: frontendDir, stdio: 'inherit' });
  } catch (error) {
    console.error("\x1b[1;31mFailed to install frontend dependencies:\x1b[0m", error.message);
  }
}

// Start backend server
const backendLogStream = fs.createWriteStream(path.join(logsDir, 'backend.log'), { flags: 'a' });
console.log("--> Starting Backend on port 3001...");
const backendProcess = spawn('node', ['server.js'], { cwd: backendDir, env: process.env });
backendProcess.stdout.pipe(backendLogStream);
backendProcess.stderr.pipe(backendLogStream);

// Start frontend server (vite)
const frontendLogStream = fs.createWriteStream(path.join(logsDir, 'frontend.log'), { flags: 'a' });
console.log("--> Starting Frontend on port 5173...");

// Use shell: true for spawning npm/vite correctly across platforms (especially Windows)
const frontendProcess = spawn('npm', ['run', 'dev', '--', '--host'], { 
  cwd: frontendDir, 
  shell: true,
  env: process.env 
});
frontendProcess.stdout.pipe(frontendLogStream);
frontendProcess.stderr.pipe(frontendLogStream);

const BACKEND_PID = backendProcess.pid;
const FRONTEND_PID = frontendProcess.pid;

// Construct clickable terminal hyperlinks
const FRONTEND_URL = "http://localhost:5173";
const BACKEND_URL = "http://localhost:3001";

// Support standard console coloring & clicking
const FRONTEND_LINK = `\x1b[4;34m\x1b]8;;${FRONTEND_URL}\x1b\\\\${FRONTEND_URL}\x1b]8;;\x1b\\\\\x1b[0m`;
const BACKEND_LINK = `\x1b[4;34m\x1b]8;;${BACKEND_URL}\x1b\\\\${BACKEND_URL}\x1b]8;;\x1b\\\\\x1b[0m`;

console.log("\x1b[1;36m========================================================\x1b[0m");
console.log("\x1b[1;32m🚀 Lyric Video Generator Services are now running!\x1b[0m");
console.log("\x1b[36m--------------------------------------------------------\x1b[0m");
console.log(`\x1b[1mFrontend URL:\x1b[0m ${FRONTEND_LINK}  \x1b[90m(PID: ${FRONTEND_PID}, Log: logs/frontend.log)\x1b[0m`);
console.log(`\x1b[1mBackend URL:\x1b[0m  ${BACKEND_LINK}   \x1b[90m(PID: ${BACKEND_PID}, Log: logs/backend.log)\x1b[0m`);
console.log("\x1b[36m--------------------------------------------------------\x1b[0m");
console.log("\x1b[1;33m👉 Press Ctrl+C to stop both services.\x1b[0m");
console.log("\x1b[1;36m========================================================\x1b[0m");

let isCleaningUp = false;
function cleanup() {
  if (isCleaningUp) return;
  isCleaningUp = true;
  console.log("\n\x1b[1;31mStopping services...\x1b[0m");
  
  try {
    if (backendProcess && !backendProcess.killed) {
      backendProcess.kill();
    }
  } catch (e) {}

  try {
    if (frontendProcess && !frontendProcess.killed) {
      // On Windows, killing the parent process alone might not kill child processes spawned under shell.
      // So we can kill the entire process tree if needed, or simply send the standard kill.
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${frontendProcess.pid} /t /f`, { stdio: 'ignore' });
      } else {
        frontendProcess.kill();
      }
    }
  } catch (e) {}
  
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
