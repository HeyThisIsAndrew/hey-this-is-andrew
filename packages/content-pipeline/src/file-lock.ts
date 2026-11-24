import fs from 'node:fs';
import path from 'node:path';

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e: unknown) {
    return (e as NodeJS.ErrnoException)?.code === 'EPERM';
  }
}

/**
 * Acquire an exclusive directory-based lock beside `filePath`, run `fn`, and release it.
 * Clears stale locks left behind by dead PIDs and waits up to 30 seconds before timing out.
 */
export async function withFileLock<T>(filePath: string, fn: () => Promise<T> | T): Promise<T> {
  const lockDir = `${filePath}.lock`;
  const maxWait = 30000;
  const start = Date.now();

  while (true) {
    try {
      fs.mkdirSync(lockDir, { recursive: false });
      fs.writeFileSync(path.join(lockDir, String(process.pid)), '');
      break;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException)?.code !== 'EEXIST') throw e;

      try {
        const files = fs.readdirSync(lockDir);
        const pidFile = files.find((f) => /^\d+$/.test(f));
        if (pidFile) {
          const lockedPid = parseInt(pidFile, 10);
          if (!isProcessRunning(lockedPid)) {
            try {
              fs.renameSync(path.join(lockDir, pidFile), path.join(lockDir, 'cleared'));
              console.warn(`[file-lock] Stale lock detected (PID ${lockedPid} is dead). Clearing lock on ${filePath}.`);
              fs.rmSync(lockDir, { recursive: true, force: true });
            } catch {
              // Another process cleared it first
            }
          }
        }
      } catch {
        // lockDir may have been deleted between EEXIST and readdirSync
      }

      if (Date.now() - start > maxWait) {
        throw new Error(`Timeout waiting for lock on ${filePath}`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  try {
    return await fn();
  } finally {
    try {
      fs.rmSync(lockDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failure
    }
  }
}
