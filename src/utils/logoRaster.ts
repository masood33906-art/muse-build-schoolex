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
 * Returns '' whenever conversion is impossible (non-browser environment,
 * decode failure, unsupported value) — callers treat '' as "no override"
 * and the PDF generators keep their previous fallback behavior.
 */
export async function rasterizeLogoForPdf(logo: string): Promise<string> {
  if (!logo) return '';
  if (/^data:image\/(png|jpe?g|webp)/i.test(logo)) return logo;
  if (!/^data:image\/svg\+xml/i.test(logo)) return '';
  if (typeof window === 'undefined' || typeof Image === 'undefined' || typeof document === 'undefined') {
    return '';
  }

  let svgText: string;
  try {
    const comma = logo.indexOf(',');
    if (comma < 0) return '';
    const meta = logo.slice(0, comma);
    const payload = logo.slice(comma + 1);
    svgText = /;base64/i.test(meta) ? atob(payload) : decodeURIComponent(payload);
  } catch {
    return '';
  }

  return new Promise<string>((resolve) => {
    let url = '';
    const revoke = () => {
      if (url) {
        try { URL.revokeObjectURL(url); } catch { /* already revoked */ }
      }
    };
    try {
      const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            revoke();
            resolve('');
            return;
          }
          ctx.drawImage(img, 0, 0, 256, 256);
          revoke();
          resolve(canvas.toDataURL('image/png'));
        } catch {
          revoke();
          resolve('');
        }
      };
      img.onerror = () => {
        revoke();
        resolve('');
      };
      img.src = url;
    } catch {
      revoke();
      resolve('');
    }
  });
}
