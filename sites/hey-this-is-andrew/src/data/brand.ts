// Every personal-brand logo surface imports the approved artwork from here.
import logo from '../assets/brand-logos/hey-thisisandrew.png';
import site from './site.json';
export const PERSONAL_BRAND = {
  name: 'HEY_THISISANDREW',
  logo,
  url: site.url,
  linksUrl: `${site.url}/links/`,
} as const;
