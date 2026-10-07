/// <reference types="astro/client" />

declare module '@andrew/local-cms' {
  export function localCms(options: any): any;
}
declare module '@andrew/local-cms/config' {
  export interface LocalCmsConfig {
    imageHost?: { type: 'sanity'; projectId: string; dataset: string } | { type: string };
    [key: string]: any;
  }
}
declare module '@andrew/local-cms/images' {
  export function resolveImage(value: any, opts?: any): any;
}
