/**
 * Rasterizes the school logo for PDF embedding.
 *
 * Settings store the logo in `schoolLogo`, and every built-in preset logo
 * (including the default) is an SVG data URI. jsPDF can only embed raster
 * images (PNG/JPEG/WebP), so an SVG logo silently degrades to a monogram
 * disc in printed ID cards even though the on-screen previews show it
 * correctly. This helper converts an SVG logo to a PNG data URI in the
 * browser at download time; raster logos pass through unchanged.
 *
 * Conversion strategy for SVG values:
 *   1. Direct load — hand the browser the exact string the on-screen
 *      previews use as an <img> src. The browser's own data-URI handling
 *      copes with both %XX escapes and literal '%' characters.
 *   2. Blob fallback — decode the payload ourselves and load it via a
 *      Blob URL. The decode is deliberately TOLERANT: the preset SVGs
 *      contain literal percent signs that are not percent-escapes
 *      (gradient stops like offset="0%" / offset="100%"), and a bare
 *      decodeURIComponent throws URIError on them. So each valid %XX
 *      escape is decoded individually and stray '%' characters are left
 *      untouched. Base64 payloads still go through atob.
 * A raw SVG markup string (starting with '<svg') skips step 1 and goes
 * straight to the Blob route.
 *
 * Returns '' whenever conversion is impossible (non-browser environment,
 * decode failure, unsupported value) — callers treat '' as "no override"
 * and the PDF generators keep their previous fallback behavior.
 */
export async function rasterizeLogoForPdf(logo: string): Promise<string> {
  if (!logo) return '';
  if (/^data:image\/(png|jpe?g|webp)/i.test(logo)) return logo;
  if (typeof window === 'undefined' || typeof Image === 'undefined' || typeof document === 'undefined') {
    return '';
  }

  try {
    const value = logo.trim();
    const isSvgDataUri = /^data:image\/svg\+xml/i.test(value);
    const isRawSvg = value.startsWith('<svg');
    if (!isSvgDataUri && !isRawSvg) return '';

    // Attempt 1: direct data-URI load (exactly what the previews do).
    if (isSvgDataUri) {
      const img = await loadImage(value);
      const png = img ? drawToPng(img) : '';
      if (png) return png;
    }

    // Attempt 2: Blob URL from the decoded SVG payload.
    const svgText = isRawSvg ? value : decodeSvgPayload(value);
    if (!svgText) return '';
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      return img ? drawToPng(img) : '';
    } finally {
      try { URL.revokeObjectURL(url); } catch { /* already revoked */ }
    }
  } catch {
    return '';
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    } catch {
      resolve(null);
    }
  });
}

function drawToPng(img: HTMLImageElement): string {
  try {
    if (!img.naturalWidth || !img.naturalHeight) return '';
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(img, 0, 0, 256, 256);
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

/**
 * Extracts the SVG text from an SVG data URI. Returns '' on failure.
 * Non-base64 payloads use a tolerant percent-decode (see header note):
 * valid %XX escapes are decoded one by one; a '%' that does not start a
 * valid escape is kept as-is. Never a bare decodeURIComponent.
 */
function decodeSvgPayload(dataUri: string): string {
  const comma = dataUri.indexOf(',');
  if (comma < 0) return '';
  const meta = dataUri.slice(0, comma);
  const payload = dataUri.slice(comma + 1);
  try {
    if (/;base64/i.test(meta)) return atob(payload);
    return payload.replace(/%([0-9A-Fa-f]{2})/g, (_match, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
  } catch {
    return '';
  }
}
