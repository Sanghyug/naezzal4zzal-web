export async function cropImage(
  imageUrl: string,
  cropX: number,
  cropY: number,
  cropWidth: number,
  cropHeight: number
): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();

    image.src = imageUrl;

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", {
  willReadFrequently: true,
});

      if (!ctx) return;

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      ctx.drawImage(
        image,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      );

      const croppedImage = canvas.toDataURL("image/png");

      resolve(croppedImage);
    };
  });
}