import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { schemaTypes } from './schema'

export default defineConfig({
  name: 'default',
  title: 'BE Unconventional HQ',

  projectId: '38nhxsib',
  dataset: 'production',

  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Content')
          .items([
            S.listItem()
              .title('Videos (Cinematic)')
              .child(S.documentTypeList('video').title('Videos (Cinematic)')),
            S.listItem()
              .title('Shorts')
              .child(S.documentTypeList('short').title('Shorts')),
            S.listItem()
              .title('Live Streams')
              .child(S.documentTypeList('live').title('Live Streams')),
            S.listItem()
              .title('Media Kit Stats')
              .child(S.document().schemaType('mediaKitStats').documentId('mediaKitStats')),
            S.divider(),
            ...S.documentTypeListItems().filter(
              (listItem) => !['video', 'short', 'live', 'mediaKitStats'].includes(listItem.getId() as string),
            ),
          ]),
    }),
  ],

  schema: {
    types: schemaTypes,
  },
})
