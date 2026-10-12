const { spawn } = require('node:child_process');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const processes = [];
const services = [
  'services/auth-service.js',
  'services/inventory-service.js',
  'services/booking-service.js',
  'services/payment-service.js',
  'services/recommendation-service.js',
  'services/notification-service.js',
  'server.js',
];

let shuttingDown = false;

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of processes) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
  const forceExit = setTimeout(() => {
    for (const child of processes) {
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    process.exit(exitCode);
  }, 2500);
  forceExit.unref();
}

for (const service of services) {
  const env = { ...process.env };
  if (service === 'server.js') env.CINEBOOK_SERVICE_RUNNER = '1';
  const child = spawn(process.execPath, [path.join(__dirname, service)], {
    cwd: __dirname,
    env,
    stdio: 'inherit',
  });
  processes.push(child);
  child.on('error', (error) => {
    console.error(`Could not start ${service}:`, error);
    stopAll(1);
  });
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error(`${service} stopped unexpectedly (${signal || code}).`);
      stopAll(code || 1);
    }
  });
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
