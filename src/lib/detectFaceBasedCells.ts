import { detectFaces } from "./detectFaces";

export type FaceCellRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function detectFaceBasedCells(
  imageUrl: string,
): Promise<FaceCellRect[]> {
  const image = await loadImage(imageUrl);
  const detections = await detectFaces(imageUrl);

  const faces: FaceBox[] = detections.map((detection: any) => {
    const box = detection.box;
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    };
  });

  if (faces.length < 4) {
    return [];
  }

  const rows = groupFacesByRow(faces, image.height);

  if (rows.length !== 4) {
    return [];
  }

  const rowCenters = rows.map((row) => {
    const union = getUnionBox(row);
    return union.y + union.height / 2;
  });

  const gaps = [];
  for (let i = 1; i < rowCenters.length; i++) {
    gaps.push(rowCenters[i] - rowCenters[i - 1]);
  }

  const averageGap =
    gaps.reduce((sum, gap) => sum + gap, 0) / Math.max(1, gaps.length);

  const cellHeight = clamp(averageGap * 0.82, image.height * 0.14, image.height * 0.28);
  const cellWidth = cellHeight * 1.45;

  return rows.map((row) => {
    const union = getUnionBox(row);

    const centerX = union.x + union.width / 2;
    const centerY = union.y + union.height / 2;

    const width = Math.max(cellWidth, union.width * 2.6);
    const height = Math.max(cellHeight, union.height * 3.2);

    return {
      x: clamp(centerX - width / 2, 0, image.width - width),
      y: clamp(centerY - height * 0.45, 0, image.height - height),
      width: Math.min(width, image.width),
      height: Math.min(height, image.height),
    };
  });
}

function groupFacesByRow(faces: FaceBox[], imageHeight: number): FaceBox[][] {
  const sorted = [...faces].sort(
    (a, b) => a.y + a.height / 2 - (b.y + b.height / 2),
  );

  const threshold = imageHeight * 0.085;
  const rows: FaceBox[][] = [];

  for (const face of sorted) {
    const centerY = face.y + face.height / 2;

    const targetRow = rows.find((row) => {
      const rowBox = getUnionBox(row);
      const rowCenterY = rowBox.y + rowBox.height / 2;
      return Math.abs(centerY - rowCenterY) < threshold;
    });

    if (targetRow) {
      targetRow.push(face);
    } else {
      rows.push([face]);
    }
  }

  return rows
    .sort((a, b) => {
      const boxA = getUnionBox(a);
      const boxB = getUnionBox(b);
      return boxA.y - boxB.y;
    })
    .slice(0, 4);
}

function getUnionBox(boxes: FaceBox[]): FaceBox {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = imageUrl;
    image.onload = () => resolve(image);
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}