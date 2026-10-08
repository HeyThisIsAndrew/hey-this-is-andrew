import { defineType, defineField } from 'sanity';

export default defineType({
  name: 'mediaKitStats',
  title: 'Media Kit Stats',
  type: 'document',
  fields: [
    defineField({
      name: 'youtube',
      title: 'YouTube Stats',
      type: 'object',
      fields: [
        defineField({ name: 'followerCount', type: 'number', title: 'Subscribers' }),
        defineField({ name: 'viewCount', type: 'number', title: 'Total Views' }),
        defineField({ name: 'videoCount', type: 'number', title: 'Video Count' }),
      ],
    }),
    defineField({
      name: 'tiktok',
      title: 'TikTok Stats',
      type: 'object',
      fields: [
        defineField({ name: 'followerCount', type: 'number', title: 'Followers' }),
        defineField({ name: 'heartCount', type: 'number', title: 'Total Hearts/Likes' }),
        defineField({ name: 'videoCount', type: 'number', title: 'Video Count' }),
      ],
    }),
    defineField({
      name: 'instagram',
      title: 'Instagram Stats',
      type: 'object',
      fields: [
        defineField({ name: 'followerCount', type: 'number', title: 'Followers' }),
        defineField({ name: 'mediaCount', type: 'number', title: 'Media Count' }),
      ],
    }),
    defineField({
      name: 'lastSyncedAt',
      title: 'Last Synced At',
      type: 'datetime',
      readOnly: true,
      description: 'Automatically updated by the cron worker.',
    }),
  ],
  preview: {
    select: {
      date: 'lastSyncedAt',
    },
    prepare(selection) {
      const { date } = selection;
      return {
        title: 'Media Kit Stats',
        subtitle: date ? `Last synced: ${new Date(date).toLocaleString()}` : 'Never synced',
      };
    },
  },
});
