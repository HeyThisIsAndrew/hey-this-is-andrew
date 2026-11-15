// The accordion's panels live in panels.json: edit them in the local CMS
// (`pnpm dev`, then /local-cms) or by hand. Panel 0 opens first.
import type { AccordionPanel } from '@andrew/ui/types';
import rows from './panels.json';
import { image } from './images';

interface PanelRow {
  id: string;
  name: string;
  kicker: string;
  headline: string;
  deck: string;
  cta?: string;
  url?: string;
  logo?: string;
  wordmark: string;
  media?: string;
  accent?: string;
  comingSoon?: boolean;
  teaserTag?: string;
}

export const PANELS: AccordionPanel[] = (rows as PanelRow[]).map((p) => ({
  id: p.id,
  name: p.name,
  kicker: p.kicker,
  headline: p.headline,
  deck: p.deck,
  cta: p.cta,
  url: p.url,
  logoSrc: image(p.logo, `panels.json ${p.id}.logo`),
  wordmark: p.wordmark,
  mediaSrc: image(p.media, `panels.json ${p.id}.media`) ?? null,
  accent: p.accent || undefined,
  comingSoon: p.comingSoon || undefined,
  teaserTag: p.teaserTag,
}));
