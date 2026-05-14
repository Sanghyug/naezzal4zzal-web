export async function warpPhotoStrip(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = imageUrl;

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", {
  willReadFrequently: true,
});

      if (!ctx || !window.cv) {
        resolve(imageUrl);
        return;
      }

      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);

      const cv = window.cv;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const width = canvas.width;
      const height = canvas.height;

      const bgColor = getAverageCornerColor(data, width, height);
      const mask = new cv.Mat(height, width, cv.CV_8UC1);

      const threshold = 55;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;

          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];

          const distance = Math.sqrt(
            Math.pow(r - bgColor.r, 2) +
              Math.pow(g - bgColor.g, 2) +
              Math.pow(b - bgColor.b, 2),
          );

          mask.ucharPtr(y, x)[0] = distance > threshold ? 255 : 0;
        }
      }

      const kernel = cv.Mat.ones(9, 9, cv.CV_8U);
      cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
      cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);

      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();

      cv.findContours(
        mask,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE,
      );

      let bestContour: any = null;
      let bestScore = 0;

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        const rect = cv.minAreaRect(contour);

        const rectWidth = Math.max(rect.size.width, rect.size.height);
        const rectHeight = Math.min(rect.size.width, rect.size.height);
        const ratio = rectWidth / rectHeight;

        const imageArea = width * height;
        const isLargeEnough = area > imageArea * 0.05;
        const isStripLike = ratio > 1.8 && ratio < 8;

        if (isLargeEnough && isStripLike && area > bestScore) {
          if (bestContour) bestContour.delete();
          bestContour = contour;
          bestScore = area;
        } else {
          contour.delete();
        }
      }

      if (!bestContour) {
        mask.delete();
        kernel.delete();
        contours.delete();
        hierarchy.delete();
        resolve(imageUrl);
        return;
      }

      const rect = cv.minAreaRect(bestContour);
      const points = getRotatedRectPoints(rect);
      const ordered = orderPoints(points);

      const widthTop = distance(ordered[0], ordered[1]);
      const widthBottom = distance(ordered[3], ordered[2]);
      const maxWidth = Math.round(Math.max(widthTop, widthBottom));

      const heightLeft = distance(ordered[0], ordered[3]);
      const heightRight = distance(ordered[1], ordered[2]);
      const maxHeight = Math.round(Math.max(heightLeft, heightRight));

      const src = cv.imread(canvas);

      const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        ordered[0].x,
        ordered[0].y,
        ordered[1].x,
        ordered[1].y,
        ordered[2].x,
        ordered[2].y,
        ordered[3].x,
        ordered[3].y,
      ]);

      const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0,
        0,
        maxWidth,
        0,
        maxWidth,
        maxHeight,
        0,
        maxHeight,
      ]);

      const transform = cv.getPerspectiveTransform(srcTri, dstTri);
      const dst = new cv.Mat();

      cv.warpPerspective(
        src,
        dst,
        transform,
        new cv.Size(maxWidth, maxHeight),
      );

      const outputCanvas = document.createElement("canvas");
      cv.imshow(outputCanvas, dst);

      const warpedUrl = outputCanvas.toDataURL("image/png");

      bestContour.delete();
      mask.delete();
      kernel.delete();
      contours.delete();
      hierarchy.delete();
      src.delete();
      srcTri.delete();
      dstTri.delete();
      transform.delete();
      dst.delete();

      resolve(warpedUrl);
    };
  });
}

function getAverageCornerColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const sampleSize = Math.floor(Math.min(width, height) * 0.08);

  const points = [
    { startX: 0, startY: 0 },
    { startX: width - sampleSize, startY: 0 },
    { startX: 0, startY: height - sampleSize },
    { startX: width - sampleSize, startY: height - sampleSize },
  ];

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (const point of points) {
    for (let y = point.startY; y < point.startY + sampleSize; y++) {
      for (let x = point.startX; x < point.startX + sampleSize; x++) {
        const index = (y * width + x) * 4;

        r += data[index];
        g += data[index + 1];
        b += data[index + 2];
        count++;
      }
    }
  }

  return {
    r: r / count,
    g: g / count,
    b: b / count,
  };
}

function getRotatedRectPoints(rect: any) {
  const cx = rect.center.x;
  const cy = rect.center.y;
  const w = rect.size.width;
  const h = rect.size.height;
  const angle = (rect.angle * Math.PI) / 180;

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const corners = [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ];

  return corners.map((point) => ({
    x: cx + point.x * cos - point.y * sin,
    y: cy + point.x * sin + point.y * cos,
  }));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function orderPoints(points: { x: number; y: number }[]) {
  const topLeft = points.reduce((prev, curr) =>
    curr.x + curr.y < prev.x + prev.y ? curr : prev,
  );

  const bottomRight = points.reduce((prev, curr) =>
    curr.x + curr.y > prev.x + prev.y ? curr : prev,
  );

  const topRight = points.reduce((prev, curr) =>
    curr.x - curr.y > prev.x - prev.y ? curr : prev,
  );

  const bottomLeft = points.reduce((prev, curr) =>
    curr.x - curr.y < prev.x - prev.y ? curr : prev,
  );

  return [topLeft, topRight, bottomRight, bottomLeft];
}