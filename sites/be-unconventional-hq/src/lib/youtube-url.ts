export function getYouTubeEmbedUrl(videoId: string, playsinline: boolean = false): string {
  // Always use youtube-nocookie.com to avoid cookie-based auth loops and improve privacy
  // rel=0: Show related videos from the same channel
  // modestbranding=1: Hide YouTube logo
  // enablejsapi=1: Allow postMessage control
  let url = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`;
  if (playsinline) {
    url += '&playsinline=1';
  }
  return url;
}
