export type PhotoCellRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function detectPhotoCells(
  imageUrl: string,
  stripRect: PhotoCellRect,
): Promise<PhotoCellRect[]> {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = imageUrl;

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", {
  willReadFrequently: true,
});

      if (!ctx) {
        resolve([]);
        return;
      }

      canvas.width = stripRect.width;
      canvas.height = stripRect.height;

      ctx.drawImage(
        image,
        stripRect.x,
        stripRect.y,
        stripRect.width,
        stripRect.height,
        0,
        0,
        stripRect.width,
        stripRect.height,
      );

      const cv = window.cv;
      const thresh = new cv.Mat();

      const src = cv.imread(canvas);
      const gray = new cv.Mat();
      const blurred = new cv.Mat();
      const edges = new cv.Mat();
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();

      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
      cv.threshold(blurred, thresh, 180, 255, cv.THRESH_BINARY_INV);

      cv.findContours(
        thresh,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE,
      );

      const candidates: PhotoCellRect[] = [];

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const rect = cv.boundingRect(contour);

        const area = rect.width * rect.height;
        const ratio = rect.width / rect.height;

        const minArea = stripRect.width * stripRect.height * 0.03;
        const maxArea = stripRect.width * stripRect.height * 0.4;

        const isLargeEnough = area > minArea && area < maxArea;
        const isPhotoLike = ratio > 0.6 && ratio < 1.8;

        if (isLargeEnough && isPhotoLike) {
          candidates.push({
            x: stripRect.x + rect.x,
            y: stripRect.y + rect.y,
            width: rect.width,
            height: rect.height,
          });
        }

        contour.delete();
      }

      src.delete();
      gray.delete();
      blurred.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();
      thresh.delete();

      const sorted = candidates
        .sort((a, b) => b.width * b.height - a.width * a.height)
        .slice(0, 4)
        .sort((a, b) => a.y - b.y);

      console.log("photo cell candidates:", candidates);
      console.log("selected photo cells:", sorted);

      resolve(sorted);
    };
  });
}
