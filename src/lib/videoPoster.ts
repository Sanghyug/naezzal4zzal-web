export async function videoPoster(blob: Blob): Promise<Blob | undefined> {
  if (typeof document === 'undefined') return undefined;
  const url = URL.createObjectURL(blob), video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto';
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('poster timeout')), 6000);
      const done = () => { window.clearTimeout(timeout); resolve(); };
      video.onerror = () => { window.clearTimeout(timeout); reject(new Error('poster unavailable')); };
      video.onloadeddata = () => { if (Number.isFinite(video.duration) && video.duration > 0.1) { video.onseeked = done; video.currentTime = 0.05; } else done(); };
      video.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(480, video.videoWidth); canvas.height = Math.round(canvas.width * video.videoHeight / video.videoWidth);
    if (!canvas.width || !canvas.height) return undefined;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise(resolve => canvas.toBlob(blob => resolve(blob || undefined), 'image/jpeg', 0.82));
  } catch { return undefined; }
  finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
}
