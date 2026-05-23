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
  let image: HTMLImageElement;

  try {
    image = await loadImage(imageUrl);
  } catch (error) {
    console.warn("이미지 로드 실패 → 기계적 4분할로 전환", error);
    return [];
  }

  let detections: Awaited<ReturnType<typeof detectFaces>>;

  try {
    detections = await detectFaces(imageUrl);
  } catch (error) {
    console.warn("얼굴 인식 실패 → 기계적 4분할로 전환", error);
    return [];
  }

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

  const unions = rows.map((row) => getUnionBox(row));

  const centers = unions.map((union) => ({
    x: union.x + union.width / 2,
    y: union.y + union.height / 2,
  }));

  const averageCenterX =
    centers.reduce((sum, center) => sum + center.x, 0) / centers.length;

  // 네컷 프레임 비율 고정
  // 숫자를 키우면 더 가로로 길어지고,
  // 숫자를 줄이면 더 세로로 길어짐.
  // 지금은 인생네컷 단일 컷 느낌에 맞춰 1.35로 고정.
  const fixedAspectRatio = 1.35;

  const equalCellHeight = clamp(
    averageGap * 0.9,
    image.height * 0.16,
    image.height * 0.3,
  );

  const equalCellWidth = clamp(
    equalCellHeight * fixedAspectRatio,
    image.width * 0.28,
    image.width * 0.86,
  );

  return centers.map((center) => ({
    x: clamp(
      averageCenterX - equalCellWidth / 2,
      0,
      image.width - equalCellWidth,
    ),
    y: clamp(
      center.y - equalCellHeight * 0.48,
      0,
      image.height - equalCellHeight,
    ),
    width: equalCellWidth,
    height: equalCellHeight,
  }));
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
  return new Promise((resolve, reject) => {
    const image = new Image();

    const timer = window.setTimeout(() => {
      reject(new Error("이미지 로드 시간 초과"));
    }, 3000);

    image.onload = () => {
      window.clearTimeout(timer);
      resolve(image);
    };

    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("이미지 로드 실패"));
    };

    image.src = imageUrl;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
