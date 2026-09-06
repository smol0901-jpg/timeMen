// Биометрия на face-api.js (подключается с CDN в index.html как window.faceapi).
// Модели скачиваются один раз и кэшируются браузером — это и есть "маленькие нейросети".
declare global {
  interface Window { faceapi?: any }
}

const WEIGHTS = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights";
let loading: Promise<boolean> | null = null;

export function faceApi(): any {
  return window.faceapi;
}

export function loadFaceModels(): Promise<boolean> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const api = faceApi();
      if (!api) return false;
      await Promise.all([
        api.nets.tinyFaceDetector.loadFromUri(WEIGHTS),
        api.nets.faceLandmark68Net.loadFromUri(WEIGHTS),
        api.nets.faceRecognitionNet.loadFromUri(WEIGHTS),
      ]);
      return true;
    } catch {
      return false;
    }
  })();
  return loading;
}

export function faceReady(): boolean {
  const api = faceApi();
  return !!api && !!api.nets.tinyFaceDetector?.params;
}

function opts() {
  const api = faceApi();
  return new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });
}

// Возвращает 128-мерный дескриптор первого найденного лица (или null)
export async function faceDescriptor(input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<number[] | null> {
  const api = faceApi();
  if (!api) return null;
  const ok = await loadFaceModels();
  if (!ok) return null;
  try {
    const res = await api.detectSingleFace(input as any, opts()).withFaceLandmarks().withFaceDescriptor();
    if (!res) return null;
    return Array.from(res.descriptor as Float32Array);
  } catch {
    return null;
  }
}

export interface FaceBox { x: number; y: number; width: number; height: number; score: number }
export async function detectFaces(input: HTMLVideoElement | HTMLCanvasElement): Promise<FaceBox[]> {
  const api = faceApi();
  if (!api) return [];
  const ok = await loadFaceModels();
  if (!ok) return [];
  try {
    const res = await api.detectAllFaces(input as any, opts());
    return res.map((r: any) => ({ x: r.box.x, y: r.box.y, width: r.box.width, height: r.box.height, score: r.score }));
  } catch {
    return [];
  }
}

// Евклидова дистанция между дескрипторами; < 0.5 — одно лицо
export function faceDistance(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 1;
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

export function faceMatch(a: number[], b: number[], threshold = 0.5): { ok: boolean; distance: number } {
  const d = faceDistance(a, b);
  return { ok: d <= threshold, distance: d };
}

// Оценка освещённости кадра (0..255) — для автоподстройки
export function estimateBrightness(canvas: HTMLCanvasElement): number {
  try {
    const ctx = canvas.getContext("2d")!;
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    const step = 4 * 8;
    let n = 0;
    for (let i = 0; i < d.length; i += step) { sum += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; }
    return n ? sum / n : 128;
  } catch {
    return 128;
  }
}

// Авто-выбор разрешения камеры под условия (лицо/освещённость)
export async function autoCamera(video: HTMLVideoElement, optsIn?: MediaStreamConstraints): Promise<MediaStream | null> {
  const tryConstraints: MediaStreamConstraints[] = [
    { video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
    { video: true, audio: false },
  ];
  for (const c of tryConstraints) {
    try {
      const s = await navigator.mediaDevices.getUserMedia(optsIn || c);
      video.srcObject = s;
      await video.play().catch(() => {});
      return s;
    } catch { /* пробуем дальше */ }
  }
  return null;
}

// Фото из видеопотока в dataURL с авто-кадрированием по лицу
export async function captureWithFace(video: HTMLVideoElement, quality = 0.8): Promise<{ src: string; descriptor: number[] | null; box: FaceBox | null }> {
  const w = video.videoWidth || 640, h = video.videoHeight || 480;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(video, 0, 0, w, h);
  const boxes = await detectFaces(video);
  const box = boxes[0] || null;
  const descriptor = await faceDescriptor(video);
  return { src: c.toDataURL("image/jpeg", quality), descriptor, box };
}

export function stopStream(video: HTMLVideoElement) {
  const s = video.srcObject as MediaStream | null;
  s?.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
}
