import { loadImage } from "./loadImage";
export async function alignImagesForGif(images: string[]): Promise<string[]> {
  if (!images.length) throw new Error("움짤로 만들 사진이 없어요.");
  const firstImage = await loadImage(images[0]);
  const targetWidth = 480;
  const targetHeight = Math.round(
    (firstImage.height / firstImage.width) * targetWidth,
  );

  const alignedImages: string[] = [];

  for (const imageUrl of images) {
    const image = await loadImage(imageUrl);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      alignedImages.push(imageUrl);
      continue;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const scale = Math.min(targetWidth / image.width, targetHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(image, (targetWidth - width) / 2, (targetHeight - height) / 2, width, height);

    alignedImages.push(canvas.toDataURL("image/png"));
  }

  return alignedImages;
}
