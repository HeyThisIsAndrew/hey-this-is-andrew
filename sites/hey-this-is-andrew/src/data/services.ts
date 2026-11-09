import data from './services.json';

export interface Service {
  title: string;
  desc: string;
}

export interface ClientResult {
  client: string;
  outcome: string;
}

/* Turnaround and client details come from ./ccc.ts and services.json. */
export interface ClientBlockData {
  deliverablesAndUsage?: string;
  clientResults?: string;
  results?: ClientResult[];
}

const rawData = data as typeof data & { clientBlock?: ClientBlockData };

export const SERVICES_LEDE: string = rawData.lede;
export const SERVICES: Service[] = rawData.items;
export const SERVICES_CLIENT_BLOCK: ClientBlockData = rawData.clientBlock ?? {};

/** The UGC inquiry mailto for brands and sponsorships. */
export const UGC_INQUIRY_HREF =
  'mailto:heythisisandrewb@gmail.com?subject=' +
  encodeURIComponent('Product review / brand partnership') +
  '&body=' +
  encodeURIComponent('Brand:\nProduct:\nWhat you want shown:\nTimeline:\n');

