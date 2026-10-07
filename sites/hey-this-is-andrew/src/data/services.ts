import data from './services.json';

export interface Service {
  title: string;
  desc: string;
}

export const SERVICES_LEDE: string = data.lede;
export const SERVICES: Service[] = data.items;
