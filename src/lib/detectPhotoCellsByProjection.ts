export type PhotoCellRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function detectPhotoCellsByProjection(
  imageUrl: string,
  stripRect: PhotoCellRect,
): Promise<PhotoCellRect[]> {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = imageUrl;

    image.onload = () => {
      const cellHeight = stripRect.height / 4;

      const insetX = stripRect.width * 0.055;

      // 컷별 상단 자르기 비율
      // 순서: 1번, 2번, 3번, 4번
      const topInsetRatios = [0.12, 0.12, 0.04, 0.04];

      // 컷별 하단 자르기 비율
      const bottomInsetRatios = [0.04, 0.04, 0.10, 0.10];

      const cells: PhotoCellRect[] = [];

      for (let i = 0; i < 4; i++) {
        const topInsetY = cellHeight * topInsetRatios[i];
        const bottomInsetY = cellHeight * bottomInsetRatios[i];

        cells.push({
          x: stripRect.x + insetX,
          y: stripRect.y + cellHeight * i + topInsetY,
          width: stripRect.width - insetX * 2,
          height: cellHeight - topInsetY - bottomInsetY,
        });
      }

      console.log("trimmed cells with per-cell adjustment:", cells);

      resolve(cells);
    };
  });
}