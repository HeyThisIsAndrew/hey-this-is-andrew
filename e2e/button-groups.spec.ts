import { test, expect } from '@playwright/test';

/*
 * House rule: buttons that sit together are one size. Every visible button
 * group on every page must have members of equal width and equal height.
 * Groups are the shared `.btn-group` utility plus the components that hold
 * their own button rows.
 */
const PAGES = ['', 'about/', 'ccc/', 'gear/', 'kit/', 'build/', 'links/', 'sitemap/'];
const GROUPS = '.btn-group, .filter-tabs, .gear-category-chips, .bacc-actions';
const SIZES = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
];

for (const vp of SIZES) {
  test(`button groups are one size per group at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const bad: string[] = [];
    for (const path of PAGES) {
      await page.goto(`/hey-this-is-andrew/${path}`);
      const found = await page.evaluate((sel) => {
        const out: string[] = [];
        document.querySelectorAll<HTMLElement>(sel).forEach((g) => {
          if (g.closest('[hidden], [aria-hidden="true"]')) return;
          const kids = [...g.children].filter((c) => {
            const r = c.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && getComputedStyle(c).display !== 'none';
          });
          if (kids.length < 2) return;
          const rs = kids.map((c) => c.getBoundingClientRect());
          const dw = Math.max(...rs.map((r) => r.width)) - Math.min(...rs.map((r) => r.width));
          const dh = Math.max(...rs.map((r) => r.height)) - Math.min(...rs.map((r) => r.height));
          if (dw > 1 || dh > 1) {
            out.push(`${g.className}: ${kids.map((c, i) => `${(c.textContent || '').trim().slice(0, 24)} ${Math.round(rs[i].width)}x${Math.round(rs[i].height)}`).join(' | ')}`);
          }
        });
        return out;
      }, GROUPS);
      bad.push(...found.map((f) => `/${path} ${f}`));
    }
    expect(bad).toEqual([]);
  });
}
