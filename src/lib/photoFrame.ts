type Size = { width: number; height: number };
export function commonPhotoRatio(photos: Size[]) {
  const ratios = photos.filter(p => p.width > 0 && p.height > 0 && Number.isFinite(p.width / p.height)).map(p => p.width / p.height).sort((a,b)=>a-b);
  if (!ratios.length) return 4 / 3;
  const middle = Math.floor(ratios.length / 2);
  return ratios.length % 2 ? ratios[middle] : (ratios[middle - 1] + ratios[middle]) / 2;
}
export function containPhoto(photo: Size, frame: Size) {
  const scale = Math.min(frame.width / photo.width, frame.height / photo.height);
  const width = photo.width * scale, height = photo.height * scale;
  return { x: (frame.width - width) / 2, y: (frame.height - height) / 2, width, height };
}
