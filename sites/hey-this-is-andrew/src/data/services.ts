import data from './services.json';

export interface Service {
  title: string;
  desc: string;
}

export interface ClientResult {
  client: string;
  outcome: string;
}

/* Starting rate and turnaround are not here: they come from the pitch deck's
   numbers in ./ccc.ts (shared with /ccc/). */
export interface ClientBlockData {
  deliverablesAndUsage?: string;
  clientResults?: string;
  results?: ClientResult[];
}

const rawData = data as typeof data & { clientBlock?: ClientBlockData };

export const SERVICES_LEDE: string = rawData.lede;
export const SERVICES: Service[] = rawData.items;
export const SERVICES_CLIENT_BLOCK: ClientBlockData = rawData.clientBlock ?? {};
/** The CCC project mailto (subject and a short prefilled body), shared
 *  with /ccc/ and the brand card. */
export { CCC_INQUIRY_HREF as PROJECT_INQUIRY_HREF } from './ccc';

