/**
 * Automatically generates anchor links for all 'section-header' and '.sec-head' elements,
 * allowing users to deep-link directly to specific sections on the page with one click,
 * updating the browser URL and copying the permalink to the clipboard.
 */
export function initSectionAnchors(): void {
  if (typeof document === 'undefined') return;

  const headers = document.querySelectorAll<HTMLElement>(
    '.section-header, .sec-head, [data-section-header]'
  );

  headers.forEach((header) => {
    // Avoid double initialization or mobile menu labels
    if (header.classList.contains('mobile-section-header')) return;
    if (header.querySelector('.section-anchor-link, .section-anchor') || header.dataset.anchorInit === 'true') {
      return;
    }
    header.dataset.anchorInit = 'true';

    // 1. Determine or generate unique target ID
    let targetId = header.id;

    if (!targetId) {
      const childWithId = header.querySelector<HTMLElement>(
        '.section-title[id], h1[id], h2[id], h3[id], h4[id]'
      );
      if (childWithId && childWithId.id) {
        targetId = childWithId.id;
      }
    }

    if (!targetId) {
      const parentSection = header.closest<HTMLElement>('section[id]');
      if (parentSection && parentSection.id) {
        targetId = parentSection.id;
      }
    }

    if (!targetId) {
      const titleText = (
        header.querySelector('.section-title, h1, h2, h3')?.textContent ||
        header.textContent ||
        'section'
      ).trim();

      const slug = titleText
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      let uniqueSlug = slug || 'section';
      let count = 1;
      while (document.getElementById(uniqueSlug)) {
        uniqueSlug = `${slug}-${count++}`;
      }
      targetId = uniqueSlug;
      header.id = targetId;
    }

    // 2. Extract section title for accessible aria-label
    const sectionTitle = (
      header.querySelector('.section-title, h1, h2, h3')?.textContent ||
      header.textContent ||
      'this section'
    ).trim().replace(/#/g, '');

    // 3. Create anchor link element
    const anchor = document.createElement('a');
    anchor.className = 'section-anchor-link';
    anchor.href = `#${targetId}`;
    anchor.setAttribute('aria-label', `Direct link to ${sectionTitle} section (click to copy)`);
    anchor.title = `Copy link to ${sectionTitle}`;
    anchor.dataset.targetId = targetId;
    anchor.innerHTML = `
      <span class="anchor-symbol" aria-hidden="true">#</span>
      <span class="anchor-toast" aria-hidden="true">COPIED</span>
    `;

    // 4. Mount anchor link inside inner title or append to header
    const targetHeading = header.querySelector('.section-title, h1, h2, h3, h4');
    if (targetHeading) {
      targetHeading.appendChild(anchor);
    } else {
      header.appendChild(anchor);
    }

    // 5. Setup click & copy interaction
    anchor.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();

      const hash = `#${targetId}`;
      const url = new URL(window.location.href);
      url.hash = targetId;
      const fullUrl = url.toString();

      // Copy to clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullUrl).catch(() => {});
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fullUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      // Visual feedback
      anchor.classList.add('copied');
      window.setTimeout(() => {
        anchor.classList.remove('copied');
      }, 1800);

      // Smooth navigation with navbar offset
      history.pushState(null, '', hash);
      const targetEl = document.getElementById(targetId) || header;
      if (targetEl) {
        const nav = document.querySelector('.site-nav');
        const navH = nav ? nav.getBoundingClientRect().height : 72;
        const targetTop = targetEl.getBoundingClientRect().top + window.scrollY - navH - 12;
        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
      }
    });
  });
}
