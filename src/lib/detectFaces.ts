import * as faceapi from "face-api.js";

let isLoaded = false;

export async function loadFaceModel() {
  if (isLoaded) return;

  await faceapi.nets.tinyFaceDetector.loadFromUri("/models");

  isLoaded = true;
}

export async function detectFaces(
  imageUrl: string,
): Promise<faceapi.FaceDetection[]> {
  await loadFaceModel();

  const image = new Image();
  image.src = imageUrl;

  await new Promise((resolve) => {
    image.onload = resolve;
  });

  return await faceapi.detectAllFaces(
    image,
    new faceapi.TinyFaceDetectorOptions({
      inputSize: 416,
      scoreThreshold: 0.45,
    }),
  );
}