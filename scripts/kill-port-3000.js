#!/usr/bin/env node

const { exec } = require('child_process');
const os = require('os');

const port = 3000;

function killPort() {
  const isWindows = os.platform() === 'win32';
  
  if (isWindows) {
    // Windows: use netstat and taskkill
    exec(`netstat -ano | findstr :${port}`, (error, stdout, stderr) => {
      if (stdout) {
        const lines = stdout.trim().split('\n');
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 0) {
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(pid)) {
              console.log(`Killing process ${pid} on port ${port}...`);
              exec(`taskkill /PID ${pid} /F`, (err) => {
                if (err) {
                  console.log(`Could not kill process ${pid}: ${err.message}`);
                } else {
                  console.log(`Successfully killed process ${pid}`);
                }
              });
            }
          }
        });
      }
    });
  } else {
    // Unix-like (Linux, macOS): use lsof and kill
    exec(`lsof -ti:${port}`, (error, stdout, stderr) => {
      if (stdout) {
        const pid = stdout.trim();
        if (pid) {
          console.log(`Killing process ${pid} on port ${port}...`);
          exec(`kill -9 ${pid}`, (err) => {
            if (err) {
              console.log(`Could not kill process ${pid}: ${err.message}`);
            } else {
              console.log(`Successfully killed process ${pid}`);
            }
          });
        }
      }
    });
  }
}

// Wait a moment to ensure clean kill, then exit
killPort();
setTimeout(() => {
  process.exit(0);
}, 500);
