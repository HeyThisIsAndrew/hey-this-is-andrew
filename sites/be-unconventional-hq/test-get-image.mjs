import { getImage } from 'astro:assets';

const url = "https://scontent-lax3-1.cdninstagram.com/v/t15.5256-10/767585787_1049764714129879_3776294612638384787_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=109&ccb=7-5&_nc_sid=18de74&efg=eyJlZmdfdGFnIjoiQ0xJUFMuYmVzdF9pbWFnZV91cmxnZW4uQzMifQ%3D%3D&_nc_ohc=GJxMTBVo4YAQ7kNvwFqRAuF&_nc_oc=AdrsLbvstBaVG5C92PiGDgEinoPiX-ukUolFcXoK-HY5E2NcBH2XRoBdeoz8gKRVgTw&_nc_zt=23&_nc_ht=scontent-lax3-1.cdninstagram.com&edm=AM6HXa8EAAAA&_nc_gid=DBm9U1SD40av2VqKZc_k_Q&_nc_tpa=Q5bMBQLyOf_u6qCBFJ_0yrWfSC7nH--HjOwpS1eoImCGp9FeduaZr73P_tlDGXU5s67VcS3YWWt2kr3UbA&oh=00_AQGVTNExc7mfbOvM4hFsZ_kxGQp9Q-y84So-eiOmiCoODQ&oe=6A7E8242";

async function run() {
  try {
    console.log("Fetching image...");
    const img = await getImage({ src: url, width: 440, inferSize: true });
    console.log("Success:", img);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
