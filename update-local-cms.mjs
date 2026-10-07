import fs from 'fs';
let p = 'sites/hey-this-is-andrew/local-cms.config.mjs';
let c = fs.readFileSync(p, 'utf8');

const newCollections = `
    {
      name: 'services',
      label: 'Services',
      file: 'src/data/services.json',
      itemLabel: 'title',
      help: 'What I do / services.',
      fields: [
        { key: 'lede', label: 'Lede', type: 'text' },
        {
          key: 'items',
          label: 'Service Items',
          type: 'array',
          fields: [
            { key: 'title', label: 'Title', type: 'text' },
            { key: 'desc', label: 'Description', type: 'textarea' }
          ]
        }
      ]
    },
    {
      name: 'events',
      label: 'Events',
      file: 'src/data/events.json',
      itemLabel: 'name',
      help: 'Upcoming and past events coverage.',
      fields: [
        {
          key: 'upcoming',
          label: 'Upcoming Events',
          type: 'array',
          fields: [
            { key: 'name', label: 'Event Name', type: 'text' },
            { key: 'location', label: 'Location', type: 'text' },
            { key: 'dates', label: 'Dates', type: 'text' },
            { key: 'blurb', label: 'Blurb', type: 'textarea' },
            { key: 'url', label: 'URL', type: 'url' }
          ]
        },
        {
          key: 'past',
          label: 'Past Coverage',
          type: 'array',
          fields: [
            { key: 'name', label: 'Event Name', type: 'text' },
            { key: 'location', label: 'Location', type: 'text' },
            { key: 'dates', label: 'Dates', type: 'text' },
            { key: 'blurb', label: 'Blurb', type: 'textarea' },
            { key: 'url', label: 'URL', type: 'url' }
          ]
        }
      ]
    },
    {
      name: 'press',
      label: 'Press Kit',
      file: 'src/data/press.json',
      itemLabel: 'label',
      help: 'Press kit information.',
      fields: [
        { key: 'email', label: 'Contact Email', type: 'email' },
        { key: 'bio', label: 'Bio Paragraphs', type: 'list' },
        {
          key: 'stats',
          label: 'Audience Stats',
          type: 'array',
          fields: [
            { key: 'label', label: 'Label', type: 'text' },
            { key: 'note', label: 'Note', type: 'text' }
          ]
        },
        {
          key: 'assets',
          label: 'Brand Assets',
          type: 'array',
          fields: [
            { key: 'name', label: 'Asset Name', type: 'text' },
            { key: 'desc', label: 'Description', type: 'textarea' },
            { key: 'href', label: 'File URL', type: 'text' },
            { key: 'filename', label: 'Download Filename', type: 'text' }
          ]
        }
      ]
    },
    {
      name: 'site',
      label: 'Site Config',
      file: 'src/data/site.json',
      itemLabel: 'title',
      help: 'Global site configuration.',
      fields: [
        { key: 'title', label: 'Site Title', type: 'text' },
        { key: 'description', label: 'Site Description', type: 'textarea' },
        { key: 'url', label: 'Site URL', type: 'url' }
      ]
    }
`;

c = c.replace(/\]\s*,\s*\}\s*;\s*$/, newCollections + '\n  ],\n};\n');
fs.writeFileSync(p, c);
