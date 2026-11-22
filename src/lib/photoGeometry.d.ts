export type CellRect = { x: number; y: number; width: number; height: number };
export type PhotoLayout = "1x4" | "2x2";
export function validateCells(value: unknown, width: number, height: number): CellRect[];
export function createLayoutCells(layout: PhotoLayout, width: number, height: number): CellRect[];
