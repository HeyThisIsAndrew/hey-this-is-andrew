/**
 * How to run pnpm from a Node script, whichever way pnpm was installed.
 *
 * Under `pnpm <script>`, npm_execpath names the running pnpm: a JavaScript
 * entry (pnpm.cjs, run with node) for the npm/corepack installs, or a native
 * executable for the standalone @pnpm/exe install (run it directly; handing a
 * binary to node fails). Started any other way, use `pnpm` from PATH, or
 * corepack's when there is none.
 */
import { execFileSync } from 'node:child_process';

export function pnpmCommand(env = process.env) {
  const execPath = env.npm_execpath;
  if (execPath && /pnpm/i.test(execPath)) {
    return /\.[cm]?js$/i.test(execPath) ? [process.execPath, [execPath]] : [execPath, []];
  }
  try {
    execFileSync('pnpm', ['--version'], { stdio: 'ignore' });
    return ['pnpm', []];
  } catch {
    return ['corepack', ['pnpm']];
  }
}
