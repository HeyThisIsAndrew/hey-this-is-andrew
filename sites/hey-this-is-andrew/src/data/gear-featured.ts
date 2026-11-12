/**
 * The homepage Gear carousel (GearCarousel.astro): one piece from each of
 * the seven categories in gear.json, in the /gear/ page's order. Each is the
 * item that category lists first, which is where the kit puts its primary
 * piece (the "Workhorse Body", the "Workhorse Zoom", the "200W Key Light").
 *
 * Names must match gear.json exactly. The build fails if one stops matching,
 * has no photo, or has no store link (an item without one is not shown on
 * /gear/, so the carousel would have nowhere to send the reader).
 */
export const FEATURED_GEAR: string[] = [
  'Sony a7IV',
  'Sony FE 24-70mm f/2.8 GM',
  'Aputure Amaran 200d',
  'Peak Design Carbon Fiber Tripod',
  'Shure MV6 Gen 1',
  'Ascaso Steel Duo PID',
  'PlayStation Portal',
];
