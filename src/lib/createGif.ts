import { loadImage } from "./loadImage";
import gifshot from "gifshot";

export type GifSpeed = "fast" | "normal" | "slow";

export async function createGif(
  images: string[],
  speed: GifSpeed = "normal",
): Promise<string> {
  if (!images.length) throw new Error("움짤로 만들 사진이 없어요.");
  const firstImage = await loadImage(images[0]);

  const gifWidth = 480;
  const gifHeight = Math.round((firstImage.height / firstImage.width) * gifWidth);

  const intervalMap: Record<GifSpeed, number> = {
    fast: 0.32,
    normal: 0.5,
    slow: 0.75,
  };

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("움짤 생성 시간이 너무 길어요. 다시 시도해주세요.")), 30000);
    gifshot.createGIF(
      {
        images,
        gifWidth,
        gifHeight,
        interval: intervalMap[speed],
        numFrames: images.length,
        frameDuration: 1,
        sampleInterval: 8,
      },
      (obj: { error: boolean; image: string; errorMsg?: string }) => {
        window.clearTimeout(timer);
        if (obj.error) {
          reject(new Error(obj.errorMsg || "GIF 생성 실패"));
          return;
        }

        resolve(obj.image);
      },
    );
  });
}
