import test from 'node:test';
import assert from 'node:assert/strict';
import { pageDirection } from '../src/scripts/route-transitions.mjs';
const origin = 'https://example.com';
const personal = ['/hey-this-is-andrew/', '/hey-this-is-andrew/brands/', '/hey-this-is-andrew/build/', '/hey-this-is-andrew/gear/', '/hey-this-is-andrew/about/'];
const hq = ['/', '/feed', '/intel', '/events', '/featured', '/about'];
const direction = (from, to, options) => pageDirection(new URL(from, origin), new URL(to, origin), options);
for (const [from, to, expected, options] of [
  ['/hey-this-is-andrew/', '/hey-this-is-andrew/gear/', 'slide-forward', { routes: personal }],
  ['/hey-this-is-andrew/gear/', '/hey-this-is-andrew/brands/', 'slide-backward', { routes: personal }],
  ['/hey-this-is-andrew/brands/', '/hey-this-is-andrew/brands/be-unconventional-hq/', 'slide-forward', { routes: personal }],
  ['/hey-this-is-andrew/brands/be-unconventional-hq/', '/hey-this-is-andrew/brands/', 'slide-backward', { routes: personal }],
  ['/', '/feed#film', 'dive-down', { routes: hq }],
  ['/feed#film', '/about', 'dive-up', { routes: hq }],
  ['/feed#film', '/feed#tv', 'none', { routes: hq }],
  ['/events', '/events/2', 'page-rows', { routes: hq }],
  ['/intel', '/intel/topic/film', 'none', { routes: hq, filterRoots: ['/intel'] }],
  ['/intel/topic/film', '/intel/some-article', 'slide-forward', { routes: hq, filterRoots: ['/intel'] }],
  ['/', '/about', 'slide-backward', { routes: hq, navigationType: 'traverse', direction: 'back' }],
  ['/feed#film', '/', 'dive-up', { routes: hq, navigationType: 'traverse', direction: 'back' }],
]) test(`${from} to ${to} uses ${expected}`, () => assert.equal(direction(from, to, options), expected));
