/**
 * Rules for filtering non-content media (images, videos) during extraction.
 * Consumed by media-extractor.ts and text-extractor.ts.
 */

/**
 * Minimum dimensions to consider an image "content" rather than a tracking
 * pixel, icon, or spacer. If an <img> has explicit width/height attributes
 * below this threshold we skip it.
 */
export const MIN_IMAGE_DIMENSION = 100;

/**
 * Patterns in image URLs that indicate non-content images (tracking pixels,
 * social icons, UI sprites, etc.)
 */
export const JUNK_IMAGE_PATTERNS = [
  /\/tracking[/.-]/i,
  /\/pixel[/.-]/i,
  /\/beacon[/.-]/i,
  /\/analytics[/.-]/i,
  /\/ads[/.-]/i,
  /\/avatar[/.-]/i,
  /\/icon[/.-]/i,
  /\/logo[/.-]/i,
  /\/favicon/i,
  /\/badge[/.-]/i,
  /\/button[/.-]/i,
  /\/spinner[/.-]/i,
  /\/loading[/.-]/i,
  /\/sprite[/.-]/i,
  /1x1\./i,
  /spacer\./i,
  /blank\./i,
  /transparent\./i,
  /gravatar\.com/i,
];

export function isContentImage(img: Element, imgUrl: string): boolean {
  // Skip tiny images (tracking pixels, spacers)
  const width = parseInt(img.getAttribute("width") || "0", 10);
  const height = parseInt(img.getAttribute("height") || "0", 10);
  if (width > 0 && width < MIN_IMAGE_DIMENSION) return false;
  if (height > 0 && height < MIN_IMAGE_DIMENSION) return false;

  // Skip images whose URLs match junk patterns
  for (const pattern of JUNK_IMAGE_PATTERNS) {
    if (pattern.test(imgUrl)) return false;
  }

  return true;
}
