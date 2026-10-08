import fs from 'node:fs';
import path from 'node:path';

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM'; // Running but we don't own it
  }
}

export async function withFileLock(filePath, fn) {
  const lockDir = `${filePath}.lock`;
  const maxWait = 30000; // 30 seconds
  const start = Date.now();
  
  while (true) {
    try {
      fs.mkdirSync(lockDir);
      fs.writeFileSync(path.join(lockDir, String(process.pid)), '');
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;

      try {
        const files = fs.readdirSync(lockDir);
        // Look for a numeric filename representing the PID
        const pidFile = files.find(f => /^\d+$/.test(f));
        if (pidFile) {
          const lockedPid = parseInt(pidFile, 10);
          if (!isProcessRunning(lockedPid)) {
            // Atomically rename the dead PID file. If another process already cleared it
            // or re-acquired the lock (creating a new PID file), this will throw ENOENT.
            try {
              fs.renameSync(path.join(lockDir, pidFile), path.join(lockDir, 'cleared'));
              console.warn(`[file-lock] Stale lock detected (PID ${lockedPid} is dead). Clearing lock on ${filePath}.`);
              fs.rmSync(lockDir, { recursive: true, force: true });
            } catch (renameErr) {
              // Another process cleared it first, just continue
            }
          }
        }
      } catch (err) {
        // lockDir might have been deleted by another process between EEXIST and readdirSync
      }

      if (Date.now() - start > maxWait) {
        throw new Error(`Timeout waiting for lock on ${filePath}`);
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }

  try {
    return await fn();
  } finally {
    try {
      fs.rmSync(lockDir, { recursive: true, force: true });
    } catch (e) {}
  }
}
