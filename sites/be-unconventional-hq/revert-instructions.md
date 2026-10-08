# Revert Instructions: Category Overlay

If the new full-screen immersive overlay for the Category menu needs to be rolled back in production, follow these exact steps to instantly restore the legacy `<dialog>` overlay.

**Target File:** `src/components/QuadrantFilter.astro`

### 1. HTML Restoration
1. Locate the block commented with `<!-- LEGACY CATEGORY DIALOG (COMMENTED OUT FOR REVERT IF NEEDED) -->`.
2. Remove the `<!--` and `-->` surrounding the `<dialog id="category-modal">` block to uncomment it.
3. Locate the block commented with `<!-- NEW FULL-SCREEN IMMERSIVE OVERLAY -->`.
4. Delete the entire `<div id="category-fullscreen-overlay">...</div>` block.

### 2. CSS Restoration
1. Locate the block commented with `/* LEGACY DIALOG STYLES (COMMENTED OUT FOR REVERT IF NEEDED) */`.
2. Remove the `/*` and `*/` surrounding the `#category-modal` and `.close-btn` styles.
3. Locate the block commented with `/* FULL-SCREEN IMMERSIVE OVERLAY STYLES */`.
4. Delete all the `.category-fullscreen-overlay` and `.close-fullscreen-btn` CSS rules beneath it.

### 3. JavaScript Restoration
1. Inside the `<script>` tag, locate the block commented with `/* LEGACY DIALOG LOGIC (COMMENTED OUT FOR REVERT IF NEEDED) */`.
2. Remove the `/*` and `*/` surrounding the legacy JS logic.
3. Locate the block commented with `/* NEW FULL-SCREEN IMMERSIVE LOGIC */`.
4. Delete the variables and functions handling `category-fullscreen-overlay` (`openFullscreenOverlay`, `closeFullscreenOverlay`, etc.).

> [!NOTE]
> The legacy `.close-btn` CSS was surgically updated before being commented out to fix a known clipping regression (`top: -3rem; right: -1rem; padding: 1rem;`). This fix will automatically be active upon revert, ensuring your fallback state is stable and fully functional!
