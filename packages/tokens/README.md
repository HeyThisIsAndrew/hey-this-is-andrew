# @andrew/tokens

The base design tokens: CSS custom properties for colour, type, spacing,
geometry and the brand accordion. Every shared component in `@andrew/ui`
reads these and nothing else.

```astro
---
import '@andrew/tokens/tokens.css';      // base (monochrome, dark, square)
import '../styles/theme.css';            // this site's overrides, loaded after
---
```

Ready-made themes live in `themes/`:

| file | what it does |
| --- | --- |
| `themes/hq-red.css` | BE Unconventional HQ's red accent everywhere |

The full theming contract (every token, what reads it, and worked examples)
is in `packages/ui/README.md`.
