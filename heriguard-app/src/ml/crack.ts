import { CRACK_MODEL } from "./crack-model";
import { EmbeddedNetwork } from "./runtime";

const SIZE = 64;
const HALF = 32;
const FEATURES = HALF * HALF * 2;
const GRID = 5;
const SOURCE = GRID * SIZE;
const THRESHOLD = 0.5;

export interface CrackBox {
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
  cells: number;
}

export interface CrackResult {
  isCrack: boolean;
  confidence: number;
  wholeImageScore: number;
  boxes: CrackBox[];
  heatmap: { grid: number; scores: number[] };
  tookMs: number;
}

const network = new EmbeddedNetwork(CRACK_MODEL);
const patch = new Uint8Array(SIZE * SIZE);
const features = new Float32Array(FEATURES);

export const CRACK_TEST_ACCURACY = CRACK_MODEL.testAccuracy;

function extract(pixels: Uint8Array, out: Float32Array): void {
  for (let by = 0; by < HALF; by++) {
    for (let bx = 0; bx < HALF; bx++) {
      let sum = 0;
      let grad = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const y = by * 2 + dy;
          const x = bx * 2 + dx;
          const value = pixels[y * SIZE + x];
          sum += value;
          const right = x + 1 < SIZE ? pixels[y * SIZE + x + 1] : value;
          const down = y + 1 < SIZE ? pixels[(y + 1) * SIZE + x] : value;
          grad += Math.abs(right - value) + Math.abs(down - value);
        }
      }
      const cell = by * HALF + bx;
      out[cell] = sum / 4 / 255;
      out[HALF * HALF + cell] = Math.min(1, grad / 8 / 64);
    }
  }
}

function score(gray: Uint8Array, left: number, top: number, side: number): number {
  const step = side / SIZE;
  const box = Math.max(1, Math.floor(step));
  for (let y = 0; y < SIZE; y++) {
    const srcY0 = top + Math.floor(y * step);
    for (let x = 0; x < SIZE; x++) {
      const srcX0 = left + Math.floor(x * step);
      let sum = 0;
      let count = 0;
      for (let dy = 0; dy < box && srcY0 + dy < SOURCE; dy++) {
        const row = (srcY0 + dy) * SOURCE;
        for (let dx = 0; dx < box && srcX0 + dx < SOURCE; dx++) {
          sum += gray[row + srcX0 + dx];
          count++;
        }
      }
      patch[y * SIZE + x] = count ? sum / count : 0;
    }
  }
  extract(patch, features);
  return network.predict(features)[0];
}

function boxesFromHeatmap(scores: Float32Array): CrackBox[] {
  const seen = new Set<number>();
  const boxes: CrackBox[] = [];
  for (let i = 0; i < GRID * GRID; i++) {
    if (scores[i] < THRESHOLD || seen.has(i)) continue;
    const queue = [i];
    seen.add(i);
    let minX = GRID, minY = GRID, maxX = -1, maxY = -1, best = 0, cells = 0;
    while (queue.length) {
      const current = queue.pop() as number;
      const x = current % GRID;
      const y = Math.floor(current / GRID);
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      best = Math.max(best, scores[current]); cells++;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
        const next = ny * GRID + nx;
        if (seen.has(next) || scores[next] < THRESHOLD) continue;
        seen.add(next); queue.push(next);
      }
    }
    boxes.push({
      x: minX / GRID,
      y: minY / GRID,
      w: (maxX - minX + 1) / GRID,
      h: (maxY - minY + 1) / GRID,
      confidence: best,
      cells,
    });
  }
  return boxes.sort((a, b) => b.confidence - a.confidence);
}

async function loadGrayImage(uri: string): Promise<Uint8Array> {
  if (typeof document === "undefined") throw new Error("Bản thử nghiệm model cần chạy trên web.");
  const image = new window.Image();
  image.crossOrigin = "anonymous";
  image.src = uri;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Không tải được dữ liệu ảnh."));
  });
  const canvas = document.createElement("canvas");
  canvas.width = SOURCE; canvas.height = SOURCE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
  context.drawImage(image, 0, 0, SOURCE, SOURCE);
  const rgba = context.getImageData(0, 0, SOURCE, SOURCE).data;
  const gray = new Uint8Array(SOURCE * SOURCE);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    gray[i] = (rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000;
  }
  return gray;
}

export async function analyzeCrackOnDevice(uri: string): Promise<CrackResult> {
  const started = performance.now();
  const gray = await loadGrayImage(uri);
  const wholeImageScore = score(gray, 0, 0, SOURCE);
  const scores = new Float32Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) scores[y * GRID + x] = score(gray, x * SIZE, y * SIZE, SIZE);
  }
  const isCrack = wholeImageScore >= THRESHOLD;
  return {
    isCrack,
    confidence: wholeImageScore,
    wholeImageScore,
    boxes: isCrack ? boxesFromHeatmap(scores).slice(0, 3) : [],
    heatmap: { grid: GRID, scores: Array.from(scores) },
    tookMs: Math.round(performance.now() - started),
  };
}
