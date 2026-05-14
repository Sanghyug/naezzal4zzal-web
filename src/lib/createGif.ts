import gifshot from "gifshot";

export async function createGif(images: string[]): Promise<string> {
  const firstImage = await loadImage(images[0]);

  const gifWidth = 480;
  const gifHeight = Math.round(
    (firstImage.height / firstImage.width) * gifWidth,
  );

  return new Promise((resolve, reject) => {
    gifshot.createGIF(
      {
        images,
        gifWidth,
        gifHeight,
        interval: 0.5,
        numFrames: images.length,
        frameDuration: 1,
        sampleInterval: 8,
      },
      (obj: { error: boolean; image: string; errorMsg?: string }) => {
        if (obj.error) {
          reject(new Error(obj.errorMsg || "GIF 생성 실패"));
          return;
        }

        resolve(obj.image);
      },
    );
  });
}

function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = imageUrl;
    image.onload = () => resolve(image);
  });
}
