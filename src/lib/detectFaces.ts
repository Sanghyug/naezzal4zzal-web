import * as faceapi from "face-api.js";

let isLoaded = false;

function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  message: string,
): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

export async function loadFaceModel() {
  if (isLoaded) return;

  const baseUrl = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  await withTimeout(
    faceapi.nets.tinyFaceDetector.loadFromUri(`${baseUrl}models`),
    3000,
    "얼굴 인식 모델 로드 시간 초과",
  );

  isLoaded = true;
}

export async function detectFaces(imageUrl: string) {
  await withTimeout(loadFaceModel(), 3000, "얼굴 인식 모델 준비 시간 초과");

  const image = new Image();

  await withTimeout(
    new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("이미지 로드 실패"));
      image.src = imageUrl;
    }),
    3000,
    "이미지 로드 시간 초과",
  );

  const faces = await withTimeout<faceapi.FaceDetection[]>(
    Promise.resolve(
      faceapi.detectAllFaces(
        image,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.18,
        }),
      ),
    ),
    3000,
    "얼굴 인식 처리 시간 초과",
  );

  console.log("detected faces:", faces.length, faces);

  return faces;
}
