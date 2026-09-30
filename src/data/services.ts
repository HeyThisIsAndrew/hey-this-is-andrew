// "What I do" (WorkWithAndrew.astro, #work).
//
// DRAFT FOR APPROVAL (defect 34, decision 10): an updated offering drafted
// from Andrew's five recommendations. Andrew works iteratively; edit the
// wording here, the section renders whatever this list holds.

export interface Service {
  title: string;
  desc: string;
}

export const SERVICES_LEDE =
  'Five services, one operator. For press, media, or project inquiries, head to the press kit.';

export const SERVICES: Service[] = [
  {
    title: 'Beverage & hospitality photography',
    desc: 'Cocktails, plates, and the rooms they are served in, photographed for bars and restaurants.',
  },
  {
    title: 'Short-form video & Reels',
    desc: 'Vertical video shot and cut for Reels, TikTok, and Shorts.',
  },
  {
    title: 'UGC & brand partnerships',
    desc: 'Content for brands, made the same way I make my own, with the process shown.',
  },
  {
    title: 'Video editing',
    desc: 'Editing, color, and sound for footage you already have.',
  },
  {
    title: 'Event photo & video coverage',
    desc: 'Photos and video from your event, ready to post the same week.',
  },
];
