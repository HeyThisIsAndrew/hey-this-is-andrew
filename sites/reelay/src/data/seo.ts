import { SITE } from './site';
import { RELEASE } from './release';
import { OPERATOR } from './operator';

const filled = (v: string) => !/\{\{/.test(v);

/* schema.org SoftwareApplication for the home and download pages. The
 * publisher is only included once the operator's legal name is filled in. */
export function softwareApplication() {
  return {
    '@type': 'SoftwareApplication',
    name: SITE.name,
    alternateName: SITE.fullName,
    description: SITE.description,
    url: SITE.url,
    image: `${SITE.url}/og/home.png`,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'macOS 12 or later (Apple silicon)',
    softwareVersion: RELEASE.version,
    datePublished: RELEASE.date,
    downloadUrl: RELEASE.href,
    fileSize: RELEASE.size,
    releaseNotes: `${SITE.url}/changelog`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    ...(filled(OPERATOR.legalEntity) ? { publisher: { '@type': 'Organization', name: OPERATOR.legalEntity } } : {}),
  };
}
