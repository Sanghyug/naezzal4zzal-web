export async function alignImagesForGif(images: string[]): Promise<string[]> {
  console.log("face alignment temporarily skipped");

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

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    alignedImages.push(canvas.toDataURL("image/png"));
  }

  return alignedImages;
}

function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = imageUrl;
    image.onload = () => resolve(image);
  });
}