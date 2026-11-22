export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => reject(new Error("사진을 불러오는 시간이 너무 길어요. 다시 골라주세요.")), 15000);
    image.onload = () => { window.clearTimeout(timer); resolve(image); };
    image.onerror = () => { window.clearTimeout(timer); reject(new Error("사진을 읽을 수 없어요. JPG 또는 PNG 사진으로 다시 골라주세요.")); };
    image.src = url;
  });
}
