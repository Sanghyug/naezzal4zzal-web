export async function warpPhotoStrip(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = imageUrl;

    image.onload = () => {
      if (!window.cv) {
        resolve(imageUrl);
        return;
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (!ctx) {
        resolve(imageUrl);
        return;
      }

      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);

      const cv = window.cv;
      const src = cv.imread(canvas);

      const bestRect =
        findStripByEdges(cv, src, image.width, image.height) ??
        findStripByColorDifference(cv, canvas, image.width, image.height);

      if (!bestRect) {
        src.delete();
        resolve(imageUrl);
        return;
      }

      const output = warpByRotatedRect(cv, src, bestRect);
      src.delete();

      resolve(output);
    };
  });
}

function findStripByEdges(
  cv: any,
  src: any,
  imageWidth: number,
  imageHeight: number,
) {
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const closed = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
  cv.Canny(blurred, edges, 35, 120);

  const kernel = cv.Mat.ones(7, 7, cv.CV_8U);
  cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);

  cv.findContours(
    closed,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE,
  );

  let bestRect: any = null;
  let bestScore = 0;
  const imageArea = imageWidth * imageHeight;

  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);
    const rect = cv.minAreaRect(contour);

    const longSide = Math.max(rect.size.width, rect.size.height);
    const shortSide = Math.min(rect.size.width, rect.size.height);
    const ratio = longSide / shortSide;
    const rectArea = longSide * shortSide;

    const isLargeEnough = rectArea > imageArea * 0.08;
    const isNotWholeImage = rectArea < imageArea * 0.78;
    const isVerticalStrip = ratio > 2.0 && ratio < 5.8;
    const hasEnoughContour = area > rectArea * 0.18;

    const centerX = rect.center.x / imageWidth;
    const centerY = rect.center.y / imageHeight;
    console.log("edge candidate", {
      area,
      rectArea,
      ratio,
      longSide,
      shortSide,
      centerX,
      centerY,
    });
    const isReasonablyCentered =
      centerX > 0.12 && centerX < 0.88 && centerY > 0.12 && centerY < 0.88;

    if (
      isLargeEnough &&
      isNotWholeImage &&
      isVerticalStrip &&
      hasEnoughContour &&
      isReasonablyCentered
    ) {
      const score = rectArea * 0.7 + area * 0.3;

      if (score > bestScore) {
        bestScore = score;
        bestRect = rect;
      }
    }

    contour.delete();
  }

  gray.delete();
  blurred.delete();
  edges.delete();
  closed.delete();
  contours.delete();
  hierarchy.delete();
  kernel.delete();

  return bestRect;
}

function findStripByColorDifference(
  cv: any,
  canvas: HTMLCanvasElement,
  imageWidth: number,
  imageHeight: number,
) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const imageData = ctx.getImageData(0, 0, imageWidth, imageHeight);
  const data = imageData.data;

  const bgColor = getAverageCornerColor(data, imageWidth, imageHeight);
  const mask = new cv.Mat(imageHeight, imageWidth, cv.CV_8UC1);

  const threshold = 42;

  for (let y = 0; y < imageHeight; y++) {
    for (let x = 0; x < imageWidth; x++) {
      const index = (y * imageWidth + x) * 4;

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

  const kernel = cv.Mat.ones(11, 11, cv.CV_8U);
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

  let bestRect: any = null;
  let bestScore = 0;
  const imageArea = imageWidth * imageHeight;

  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);
    const rect = cv.minAreaRect(contour);

    const longSide = Math.max(rect.size.width, rect.size.height);
    const shortSide = Math.min(rect.size.width, rect.size.height);
    const ratio = longSide / shortSide;
    const rectArea = longSide * shortSide;
    console.log("color candidate", {
      area,
      rectArea,
      ratio,
      longSide,
      shortSide,
    });

    const isLargeEnough = rectArea > imageArea * 0.06;
    const isNotWholeImage = rectArea < imageArea * 0.72;
    const isVerticalStrip = ratio > 2.0 && ratio < 5.8;

    if (isLargeEnough && isNotWholeImage && isVerticalStrip) {
      const score = area;

      if (score > bestScore) {
        bestScore = score;
        bestRect = rect;
      }
    }

    contour.delete();
  }

  mask.delete();
  kernel.delete();
  contours.delete();
  hierarchy.delete();

  return bestRect;
}

function warpByRotatedRect(cv: any, src: any, rect: any): string {
  const points = getRotatedRectPoints(rect);
  const ordered = orderPoints(points);

  const widthTop = distance(ordered[0], ordered[1]);
  const widthBottom = distance(ordered[3], ordered[2]);
  let maxWidth = Math.round(Math.max(widthTop, widthBottom));

  const heightLeft = distance(ordered[0], ordered[3]);
  const heightRight = distance(ordered[1], ordered[2]);
  let maxHeight = Math.round(Math.max(heightLeft, heightRight));

  if (maxWidth > maxHeight) {
    const temp = maxWidth;
    maxWidth = maxHeight;
    maxHeight = temp;
  }

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
    cv.INTER_LINEAR,
    cv.BORDER_REPLICATE,
  );

  const outputCanvas = document.createElement("canvas");
  cv.imshow(outputCanvas, dst);

  const result = outputCanvas.toDataURL("image/png");

  srcTri.delete();
  dstTri.delete();
  transform.delete();
  dst.delete();

  return result;
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