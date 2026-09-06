import React, { useEffect, useRef, useState } from "react";
import { User } from "./types";

// Биометрия: face-api.js (tiny-детектор + landmarks-tiny + recognition, ~7 МБ).
// Модели берутся с локального сервера (/models/) или из CDN при первом запуске.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any = null;
let loading: Promise<boolean> | null = null;

const BASES = ["./models/", "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights/"];

export function faceReady(): Promise<boolean> {
  if (api && (api as { __ok?: boolean }).__ok) return Promise.resolve(true);
  if (!loading) {
    loading = (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m = await import("face-api.js");
        for (const base of BASES) {
          try {
            await Promise.all([
              m.nets.tinyFaceDetector.loadFromUri(base),
              m.nets.faceLandmark68TinyNet.loadFromUri(base),
              m.nets.faceRecognitionNet.loadFromUri(base),
            ]);
            api = m;
            (api as { __ok?: boolean }).__ok = true;
            return true;
          } catch { /* следующая база */ }
        }
      } catch { /* библиотека недоступна */ }
      return false;
    })();
  }
  return loading;
}

export interface FaceBox { x: number; y: number; width: number; height: number; }

/** Вектор лица (128 чисел) из изображения/видео. */
export async function embeddingFrom(source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Promise<{ emb: number[]; box: FaceBox } | null> {
  if (!(await faceReady())) return null;
  try {
    const det = await api.tinyFaceDetector(source as HTMLVideoElement, new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }));
    if (!det) return null;
    const res = await api.computeFaceDescriptor(source as HTMLVideoElement, det);
    if (!res || !res.length) return null;
    return { emb: Array.from(res as Float32Array), box: { x: det.box.x, y: det.box.y, width: det.box.width, height: det.box.height } };
  } catch { return null; }
}

export function faceDistance(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

export function bestMatch(emb: number[], users: User[], threshold: number): { user: User; dist: number } | null {
  let best: { user: User; dist: number } | null = null;
  for (const u of users) {
    if (!u.faceEmbedding || u.archived) continue;
    const d = faceDistance(emb, u.faceEmbedding);
    if (d <= threshold && (!best || d < best.dist)) best = { user: u, dist: d };
  }
  return best;
}

/** Самообучение: плавное обновление эталонного вектора после успешного распознавания. */
export function blendEmbedding(oldEmb: number[], newEmb: number[]): number[] {
  return oldEmb.map((v, i) => v * 0.85 + newEmb[i] * 0.15);
}

export async function embeddingFromFile(src: string): Promise<number[] | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      const r = await embeddingFrom(img);
      resolve(r ? r.emb : null);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ---------- умная камера ----------
export interface SmartCam { stream: MediaStream; stop: () => void; quality: string; }

/** Автоподбор разрешения, непрерывный фокус/экспозиция/баланс белого. */
export async function openSmartCamera(video: HTMLVideoElement, mirror: boolean): Promise<SmartCam | null> {
  const ladder: [number, number][] = [[1920, 1080], [1280, 720], [960, 540], [640, 480]];
  for (const [w, h] of ladder) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: w }, height: { ideal: h }, facingMode: "user" },
        audio: false,
      });
      video.srcObject = stream;
      video.style.transform = mirror ? "scaleX(-1)" : "none";
      await video.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const adv: any = {};
          if (caps.focusMode?.includes?.("continuous")) adv.focusMode = "continuous";
          if (caps.exposureMode?.includes?.("continuous")) adv.exposureMode = "continuous";
          if (caps.whiteBalanceMode?.includes?.("continuous")) adv.whiteBalanceMode = "continuous";
          if (Object.keys(adv).length) await track.applyConstraints({ advanced: [adv] }).catch(() => {});
        } catch { /* не критично */ }
      }
      const s = track?.getSettings?.();
      return { stream, stop: () => stream.getTracks().forEach((t) => t.stop()), quality: `${s?.width || w}×${s?.height || h}` };
    } catch { /* пробуем ниже */ }
  }
  return null;
}

/** Средняя яркость кадра (0-255) — для адаптации к освещению. */
export function frameBrightness(video: HTMLVideoElement): number {
  try {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 48;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(video, 0, 0, 64, 48);
    const d = ctx.getImageData(0, 0, 64, 48).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 16) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
    return s / (d.length / 16);
  } catch { return 128; }
}

export function captureFrame(video: HTMLVideoElement, quality = 0.7, mirror = false): string {
  const c = document.createElement("canvas");
  const w = Math.min(640, video.videoWidth || 640);
  const h = Math.round(w * ((video.videoHeight || 480) / (video.videoWidth || 640)));
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, w, h);
  return c.toDataURL("image/jpeg", quality);
}

// ---------- компонент проверки лица ----------
export function FaceCheck({ target, threshold, users, mirror, onResult, onClose, title }: {
  target: User | null;             // ожидаемый сотрудник (null = свободная идентификация)
  threshold: number;
  users: User[];
  mirror: boolean;
  onResult: (r: { ok: boolean; user: User | null; dist: number | null; frame: string; fallback?: boolean; emb?: number[] }) => void;
  onClose: () => void;
  title: string;
}) {
  const vRef = useRef<HTMLVideoElement>(null);
  const camRef = useRef<SmartCam | null>(null);
  const [hint, setHint] = useState("Запуск камеры…");
  const [box, setBox] = useState<FaceBox | null>(null);
  const [dark, setDark] = useState(false);
  const [quality, setQuality] = useState("");
  const busy = useRef(false);
  const doneRef = useRef(false);
  const stable = useRef(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    (async () => {
      const ready = await faceReady();
      if (!alive || !vRef.current) return;
      const cam = await openSmartCamera(vRef.current, mirror);
      camRef.current = cam;
      if (!alive) { cam?.stop(); return; }
      if (!cam) { setHint("Камера недоступна. Подтвердите вручную."); return; }
      setQuality(cam.quality);
      setHint(ready ? "Смотрите в камеру — лицо определится автоматически" : "Нейросеть недоступна — подтвердите вручную");
      timer = setInterval(async () => {
        if (!alive || doneRef.current || busy.current || !vRef.current) return;
        const v = vRef.current;
        setDark(frameBrightness(v) < 55);
        if (!ready) return;
        const r = await embeddingFrom(v);
        if (!alive || doneRef.current) return;
        setBox(r?.box || null);
        if (!r) { stable.current = 0; return; }
        stable.current++;
        if (stable.current >= 2) {
          busy.current = true;
          const m = bestMatch(r.emb, users, threshold);
          const frame = captureFrame(v, 0.72, mirror);
          doneRef.current = true;
          onResult({ ok: !!m && (!target || m.user.id === target.id), user: m?.user || null, dist: m?.dist ?? null, frame, emb: r.emb });
        }
      }, 700);
    })();
    return () => { alive = false; if (timer) clearInterval(timer); camRef.current?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const manual = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const frame = vRef.current ? captureFrame(vRef.current, 0.72, mirror) : "";
    onResult({ ok: true, user: target, dist: null, frame, fallback: true });
  };

  const bw = box ? `${(box.width / 320) * 100}%` : undefined;
  return (
    <div className="fixed inset-0 z-[78] bg-steel-950/85 backdrop-blur-sm grid place-items-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-md anim-pop overflow-hidden">
        <div className="px-5 py-3.5 border-b border-line flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-night-soft text-night grid place-items-center"><I0 n="camera" /></span>
          <b className="font-display text-sm flex-1 truncate">{title}</b>
          <span className="badge bg-paper text-mute">{quality || "…"}</span>
          <button className="w-8 h-8 rounded-lg grid place-items-center text-mute hover:bg-paper" onClick={onClose}><I0 n="x" /></button>
        </div>
        <div className="relative bg-steel-950">
          <video ref={vRef} playsInline muted className="w-full aspect-[4/3] object-cover" style={{ filter: dark ? "brightness(1.5)" : undefined }} />
          {box && bw && (
            <div className="absolute border-2 border-ok rounded-xl pulse-ok" style={{
              left: `${(box.x / 320) * 100}%`, top: `${(box.y / 240) * 100}%`, width: bw, height: `${(box.height / 240) * 100}%`,
            }} />
          )}
          {dark && <div className="absolute top-2 left-1/2 -translate-x-1/2 badge bg-warn text-white">Недостаточно света — камера адаптируется</div>}
        </div>
        <div className="p-4">
          <p className="text-[12.5px] font-bold text-mute text-center leading-relaxed">{hint}</p>
          <div className="flex gap-2 mt-3">
            <button className="btn btn-ghost flex-1" onClick={onClose}>Отмена</button>
            <button className="btn btn-dark flex-1" onClick={manual}>Подтвердить вручную</button>
          </div>
          <p className="text-[10.5px] font-bold text-mute text-center mt-2.5">Камера сама настраивает разрешение, фокус и освещение. Вектор лица самообучается при каждом успешном проходе.</p>
        </div>
      </div>
    </div>
  );
}

function I0({ n }: { n: string }) {
  const p: Record<string, React.ReactNode> = {
    camera: <><path d="M4 8h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></>,
    x: <path d="M5 5l14 14M19 5L5 19" />,
  };
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p[n]}</svg>
  );
}
