#!/bin/bash
# Optimize site images for GitHub Pages deployment
# Run from project root: bash scripts/optimize-images.sh
# Requires: macOS with sips (built-in)

set -e
cd "$(dirname "$0")/.."

echo "Optimizing images..."

# Remove unused public/ duplicates (already imported via src/assets)
rm -f public/brand-logos/hey-thisisandrew.png
rm -f public/brand-logos/be-unconventional.png
rm -f public/brand-logos/capture-create-caffeinate.png
rm -f public/hero-media/be-hq-still.jpg
rm -f public/hero-media/portrait.jpg
rm -f public/hero-media/ccc-pour.jpg

# Optimize JPEGs: max 1600px width, quality 80
for f in src/assets/portfolio/*.jpg src/assets/hero-media/*.jpg; do
  [ -f "$f" ] || continue
  echo "Optimizing: $f"
  sips -Z 1600 -s formatOptions 80 "$f" --out "$f" > /dev/null 2>&1
done

# Convert PNG logos to WebP (requires cwebp: brew install webp)
if command -v cwebp &> /dev/null; then
  for f in src/assets/brand-logos/*.png; do
    [ -f "$f" ] || continue
    webp="${f%.png}.webp"
    echo "Converting: $f -> $webp"
    cwebp -q 80 -resize 800 0 "$f" -o "$webp" > /dev/null 2>&1
    rm "$f"
  done
  # Update imports
  grep -rl "brand-logos/.*\.png" src/ | xargs sed -i '' 's|brand-logos/\(.*\)\.png|brand-logos/\1.webp|g'
  echo "Updated imports to .webp"
else
  echo "cwebp not found. Install with: brew install webp"
  echo "Skipping PNG->WebP conversion. PNGs will remain."
fi

echo ""
echo "Done. Sizes:"
du -sh src/assets public 2>/dev/null
