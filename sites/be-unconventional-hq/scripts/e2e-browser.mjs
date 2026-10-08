/**
 * Shared Puppeteer launcher for the e2e suites.
 *
 * ─── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * Every e2e file used to call `puppeteer.launch({ headless: true })` itself.
 * Seven identical calls, and any flag that turned out to be necessary had to
 * be added to all seven — which is exactly what went wrong: Chrome refuses to
 * start as root without `--no-sandbox`, so the suites ran fine on a laptop and
 * died immediately in a container. One launcher, one place to fix it.
 *
 * ─── ABOUT --no-sandbox ───────────────────────────────────────────────────
 * Chrome's sandbox is a real security boundary and this deliberately keeps it
 * ON wherever it can run. It is disabled in exactly two situations, both of
 * which are a CI machine loading pages from our own local build — no
 * untrusted content is involved.
 *
 *   1. Running as uid 0. Chrome will not start with the sandbox at all.
 *
 *   2. Running in CI as a NORMAL user. This one is not obvious, and checking
 *      only for root is what broke the first CI run of these suites:
 *
 *        FATAL:zygote_host_impl_linux.cc] No usable sandbox! If you are
 *        running on Ubuntu 23.10+ ... that has disabled unprivileged user
 *        namespaces with AppArmor ...
 *
 *      GitHub's ubuntu-latest runs as `runner`, not root, so the uid check
 *      did not fire — and the image restricts unprivileged user namespaces,
 *      so Chrome could neither use its sandbox nor fall back. Every one of
 *      the nineteen suites failed to launch a browser.
 *
 * `CI` is set by GitHub Actions and by every other CI provider worth naming.
 * A developer's laptop keeps the sandbox.
 *
 * ─── USAGE ────────────────────────────────────────────────────────────────
 *     import { launchTestBrowser } from './e2e-browser.mjs';
 *     const browser = await launchTestBrowser();
 */
import puppeteer from 'puppeteer';

/**
 * Can Chrome's sandbox work here?
 *
 * A PURE function of the two inputs, exported, so both causes can be tested
 * independently. The first version read `process.getuid()` and `process.env`
 * directly at module load, which made the CI branch untestable from a root
 * container: the flag was already true because of the uid, so a test for the
 * CI case passed without exercising it at all. That is the shape of a guard
 * that cannot fail.
 *
 * @param {{uid?: number|undefined, ci?: string|undefined}} env
 */
export function sandboxUnavailableFor({ uid, ci } = {}) {
  const isRoot = uid === 0;
  const isCI = ci === 'true' || ci === '1';
  return isRoot || isCI;
}

/** Chrome cannot use its sandbox here — see the header for both cases. */
export const sandboxUnavailable = sandboxUnavailableFor({
  uid: typeof process.getuid === 'function' ? process.getuid() : undefined,
  ci: process.env.CI,
});

/**
 * Flags every launch needs in CI.
 *
 * `--disable-dev-shm-usage` is not decoration: CI containers give /dev/shm
 * 64 MB, and Chrome writes its shared memory there. Without this a browser
 * that launches fine will crash partway through a page with a tab-crash that
 * reads like a test failure rather than an environment one.
 */
const CI_ARGS = ['--no-sandbox', '--disable-dev-shm-usage'];

/**
 * Launch a headless Chrome for an e2e suite.
 *
 * @param {import('puppeteer').LaunchOptions} [options] merged over the
 *        defaults; `args` are concatenated rather than replaced, so a caller
 *        adding a flag never silently drops the sandbox handling above.
 */
export async function launchTestBrowser(options = {}) {
  const { args = [], ...rest } = options;
  return puppeteer.launch({
    headless: true,
    args: [...(sandboxUnavailable ? CI_ARGS : []), ...args],
    ...rest,
  });
}
