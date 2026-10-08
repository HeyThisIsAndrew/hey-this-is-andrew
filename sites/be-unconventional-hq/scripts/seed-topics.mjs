import fs from 'node:fs';

const videosPath = new URL('../src/data/videos.json', import.meta.url).pathname;
let videos = [];
try {
  videos = JSON.parse(fs.readFileSync(videosPath, 'utf8'));
} catch (e) {
  console.error('Failed to parse videos.json:', e.message);
  process.exit(1);
}

const TIER1_TOPIC_SEEDS = [
  { _id: 'topic-film', _type: 'topic', title: 'Film', slug: { _type: 'slug', current: 'film' }, isTier1Category: true, youtubeSyncKeywords: ['film', 'movie', 'movies'] },
  { _id: 'topic-tv', _type: 'topic', title: 'TV', slug: { _type: 'slug', current: 'tv' }, isTier1Category: true, youtubeSyncKeywords: ['tv', 'television', 'tv show', 'series'] },
  { _id: 'topic-gaming', _type: 'topic', title: 'Games', slug: { _type: 'slug', current: 'gaming' }, isTier1Category: true, youtubeSyncKeywords: ['gaming', 'game', 'games', 'video game', 'video games'] },
  { _id: 'topic-events', _type: 'topic', title: 'Events', slug: { _type: 'slug', current: 'events' }, isTier1Category: true, youtubeSyncKeywords: ['event', 'events', 'convention'] },
  { _id: 'topic-uncategorized', _type: 'topic', title: 'Uncategorized', slug: { _type: 'slug', current: 'uncategorized' }, isTier1Category: false, youtubeSyncKeywords: [] },
];

const newVideos = [...videos.filter(v => v._type !== 'topic'), ...TIER1_TOPIC_SEEDS];

fs.writeFileSync(videosPath, JSON.stringify(newVideos, null, 2));
console.log('Seeded ' + TIER1_TOPIC_SEEDS.length + ' topics to videos.json');
