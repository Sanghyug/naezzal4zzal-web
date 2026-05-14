export type PhotoStripRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function detectPhotoStrip(
  imageUrl: string
): Promise<PhotoStripRect> {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = imageUrl;

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", {
  willReadFrequently: true,
});

      if (!ctx) {
        resolve({
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
        return;
      }

      canvas.width = image.width;
      canvas.height = image.height;

      ctx.drawImage(image, 0, 0);

      const cv = window.cv;

      const src = cv.imread(canvas);
      const gray = new cv.Mat();
      const blurred = new cv.Mat();
      const edges = new cv.Mat();
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();

      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
      cv.Canny(blurred, edges, 50, 150);

      cv.findContours(
        edges,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE
      );

      console.log("contours size:", contours.size());

      let bestRect: PhotoStripRect | null = null;
      let bestArea = 0;

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const rect = cv.boundingRect(contour);

        const area = rect.width * rect.height;
        const ratio = rect.height / rect.width;

        console.log("rect:", rect, "area:", area, "ratio:", ratio);

        const isLargeEnough = area > image.width * image.height * 0.05;
        const isVerticalStrip = ratio > 1.5 && ratio < 6;

        if (isLargeEnough && isVerticalStrip && area > bestArea) {
          bestArea = area;
          bestRect = {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        }

        contour.delete();
      }

      src.delete();
      gray.delete();
      blurred.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();

      if (!bestRect) {
        resolve({
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
        return;
      }

      console.log("bestRect:", bestRect);

      resolve(bestRect);
    };
  });
}