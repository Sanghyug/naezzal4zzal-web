import * as faceapi from "face-api.js";

let isLoaded = false;

export async function loadFaceModel() {
  if (isLoaded) return;

  const baseUrl = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  await faceapi.nets.tinyFaceDetector.loadFromUri(`${baseUrl}models`);

  isLoaded = true;
}

export async function detectFaces(imageUrl: string) {
  await loadFaceModel();

  const image = new Image();
  image.src = imageUrl;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("이미지 로드 실패"));
  });

  const faces = await faceapi.detectAllFaces(
    image,
    new faceapi.TinyFaceDetectorOptions({
      inputSize: 608,
      scoreThreshold: 0.18,
    }),
  );

  console.log("detected faces:", faces.length, faces);

  return faces;
}