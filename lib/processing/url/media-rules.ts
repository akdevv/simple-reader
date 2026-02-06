/**
 * Rules for filtering non-content media (images, videos) during extraction.
 * Consumed by media-extractor.ts and text-extractor.ts.
 */

/**
 * Minimum dimensions to consider an image "content" rather than a tracking
 * pixel, icon, or spacer. If an <img> has explicit width/height attributes
 * below this threshold we skip it.
 */
export const MIN_IMAGE_DIMENSION = 150;

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

/** True if the URL points to an SVG image (we drop these as content). */
export function isSvgImageUrl(url: string): boolean {
  return /\.svg($|\?)/i.test(url);
}

export function isContentImage(img: Element, imgUrl: string): boolean {
  // Skip SVG images
  if (isSvgImageUrl(imgUrl)) return false;

  // Skip small images (under MIN_IMAGE_DIMENSION)
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

/**
 * True if the element is inside the document's <head>.
 * Media in head (e.g. meta og:image, or stray img/video in head) should be dropped.
 */
export function isInHead(doc: Document, el: Element): boolean {
  return doc.head?.contains(el) ?? false;
}
