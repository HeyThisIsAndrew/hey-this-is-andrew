import { createClient } from '@sanity/client';
import { createImageUrlBuilder } from '@sanity/image-url';

const client = createClient({
  projectId: '38nhxsib',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2023-05-03',
});

const builder = createImageUrlBuilder(client);

async function run() {
  const query = `*[_type == "event" && slug.current == "sdcc-2026"][0]{ logo }`;
  const event = await client.fetch(query);
  const url = builder.image(event.logo).height(240).url();
  console.log(url);
}

run();
