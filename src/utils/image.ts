export function resizeImageToDataURL(
  file: File,
  max = 256,
  quality = 0.7,
  type: 'image/jpeg' | 'image/png' = 'image/jpeg'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width || max, img.height || max));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round((img.width || max) * r));
      c.height = Math.max(1, Math.round((img.height || max) * r));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL(type, quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Not a valid image'));
    };
    img.src = url;
  });
}

export function shrinkDataURL(
  dataUrl: string,
  max = 256,
  quality = 0.7,
  type: 'image/jpeg' | 'image/png' = 'image/jpeg'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width || max, img.height || max));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round((img.width || max) * r));
      c.height = Math.max(1, Math.round((img.height || max) * r));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL(type, quality));
    };
    img.onerror = () => reject(new Error('Not a valid image'));
    img.src = dataUrl;
  });
}
