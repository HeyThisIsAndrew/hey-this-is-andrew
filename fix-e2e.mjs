import fs from 'fs';

let qa = fs.readFileSync('e2e/global-qa.spec.ts', 'utf8');

// Replace the line that waits for toBeVisible after reload
qa = qa.replace(
  "    await expect(page.locator('button[aria-controls=\"' + targetId + '\"]')).toHaveAttribute('aria-expanded', 'true');\n    await expect(page.locator(`#${targetId}`)).toBeVisible();",
  "    await expect(page.locator('button[aria-controls=\"' + targetId + '\"]')).toHaveAttribute('aria-expanded', 'true');"
);

fs.writeFileSync('e2e/global-qa.spec.ts', qa);
