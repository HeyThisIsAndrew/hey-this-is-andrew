/**
 * One newsletter image: 1200x675 (16:9), the WHOLE picture, never cut off.
 *
 * The owner's rule for THE HQ DISPATCH is that an image is never cropped.
 * The email's boxes are 16:9, and story art is not always 16:9 (L.A. Comic
 * Con's is 1.9:1, some Substack art is square), so the art is FITTED inside
 * the frame, not cropped to fill it. What fills the rest is the treatment
 * the event stage already uses on the site (CLAUDE.md, "The placeholder is
 * the picture, all of it, unblurred"): two copies of one image, the front one
 * contained and sharp, the back one covering the frame, blurred and darkened,
 * so the gutters read as the picture's own light rather than as bars.
 *
 * Built ahead of time rather than in the email: blur, layering and
 * object-fit are unreliable or missing across mail clients (Outlook desktop
 * has none of them), and a flat JPEG renders identically everywhere.
 *
 * One exception to "never crop", and it removes nothing: YouTube's 4:3
 * renditions (hqdefault, sddefault, default) are a 16:9 frame with black bars
 * BAKED IN above and below. Those bars are cut away, exactly and only them.
 * maxresdefault (what every video in the store has today) is already 16:9.
 */
import sharp from 'sharp';

export const WIDTH = 1200;
export const HEIGHT = 675;
const SURFACE = '#111111';

/** YouTube renditions that are 4:3 with a letterboxed 16:9 frame inside. */
const YT_LETTERBOXED = /(^|\/\/)i\.ytimg\.com\/vi(_webp)?\/[^/]+\/(hq|sd|)default\.(jpg|webp)/i;

/**
 * @param {Buffer} input  the source image, any format sharp reads
 * @param {{ sourceUrl?: string }} [options]
 * @returns {Promise<Buffer>} a 1200x675 progressive JPEG
 */
export async function composeDispatchImage(input, { sourceUrl = '' } = {}) {
  /* Normalise once: honour EXIF rotation, and put transparency on the box
     colour so a transparent PNG does not go black. */
  let { data: source, info } = await sharp(input, { failOn: 'none' })
    .rotate()
    .flatten({ background: SURFACE })
    .png()
    .toBuffer({ resolveWithObject: true });

  if (YT_LETTERBOXED.test(sourceUrl) && Math.abs(info.width / info.height - 4 / 3) < 0.02) {
    const frameHeight = Math.round((info.width * 9) / 16);
    const top = Math.round((info.height - frameHeight) / 2);
    ({ data: source, info } = await sharp(source)
      .extract({ left: 0, top, width: info.width, height: frameHeight })
      .png()
      .toBuffer({ resolveWithObject: true }));
  }

  /* Front: the whole image, as large as fits. Upscaled if it is small, since
     the email shows it at 550px and 1200 is only the 2x rendition. */
  const front = await sharp(source)
    .resize(WIDTH, HEIGHT, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });

  /* Back: the same image covering the frame, blurred past any detail and
     darkened so it can never compete with the front copy. */
  const back = await sharp(source)
    .resize(WIDTH, HEIGHT, { fit: 'cover' })
    .blur(32)
    .modulate({ brightness: 0.42 })
    .toBuffer();

  return sharp(back)
    .composite([
      {
        input: front.data,
        left: Math.round((WIDTH - front.info.width) / 2),
        top: Math.round((HEIGHT - front.info.height) / 2),
      },
    ])
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toBuffer();
}
