import data from './services.json';

export interface Service {
  title: string;
  desc: string;
}

export interface ClientResult {
  client: string;
  outcome: string;
}

export interface ClientBlockData {
  startingRate?: string;
  turnaround?: string;
  deliverablesAndUsage?: string;
  results?: ClientResult[];
}

const rawData = data as typeof data & { clientBlock?: ClientBlockData };

export const SERVICES_LEDE: string = rawData.lede;
export const SERVICES: Service[] = rawData.items;
export const SERVICES_CLIENT_BLOCK: ClientBlockData = rawData.clientBlock ?? {};
export const PROJECT_INQUIRY_HREF =
  'mailto:capturecreatecaffeinate@gmail.com?subject=' +
  encodeURIComponent('Photography project inquiry');

