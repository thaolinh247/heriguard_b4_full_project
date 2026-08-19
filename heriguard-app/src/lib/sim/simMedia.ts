import { Asset } from "expo-asset";

/**
 * ─────────────────────────────────────────────────────────────
 * SIMULATION MEDIA — ánh xạ ảnh asset cho seed data
 *
 * Ảnh rộng (wide): từ thư mục "di tích nứt" (heritage site cracks)
 * Ảnh zoom (detail): từ thư mục "vết nứt" (wall cracks)
 *
 * Quy tắc seed:
 *  - MỖI điểm chụp có 1 ảnh wide CỐ ĐỊNH dùng cho TẤT CẢ các ngày
 *    (resolveWideUriForNode)
 *  - Ảnh zoom KHÁC NHAU mỗi ngày theo dayIndex (resolveZoomUri)
 * ─────────────────────────────────────────────────────────────
 */

// Ảnh wide — từ "heritage-site" (ảnh di tích có vết nứt)
const WIDE_MODULES = [
  require("@/assets/images/heritage-site/Di-Tich-Quoc-Gia-4.jpg"),
  require("@/assets/images/heritage-site/Di-Tich-Quoc-Gia-7.jpg"),
  require("@/assets/images/heritage-site/Di-Tich-Quoc-Gia-10.jpg"),
  require("@/assets/images/heritage-site/Nha-Co.jpg"),
  require("@/assets/images/heritage-site/xuong-cap-di-tich-23052023-01.jpg"),
];

// Ảnh zoom — 3 ảnh vết nứt, mỗi ngày chọn 1 ảnh khác nhau (dayIndex 0,1,2)
const ZOOM_SEQUENCE = [
  require("@/assets/images/crack-detail/crack-low.jpg"),
  require("@/assets/images/crack-detail/crack-medium.jpg"),
  require("@/assets/images/crack-detail/crack-high.jpg"),
];

const resolvedCache = new Map<string, Promise<string>>();

async function resolveModule(module: number): Promise<string> {
  const key = String(module);
  let cached = resolvedCache.get(key);
  if (!cached) {
    cached = (async () => {
      const asset = Asset.fromModule(module);
      if (!asset.localUri) await asset.downloadAsync();
      return asset.localUri ?? asset.uri;
    })();
    resolvedCache.set(key, cached);
  }
  return cached;
}

/** Ảnh wide CỐ ĐỊNH theo điểm chụp — node 1 → ảnh A, node 2 → ảnh B (dùng mọi ngày) */
export function resolveWideUriForNode(nodeX2: number): Promise<string> {
  const idx = (nodeX2 - 1) % WIDE_MODULES.length;
  return resolveModule(WIDE_MODULES[idx]);
}

/** Ảnh zoom — dayIndex 0,1,2 → crack-low/medium/high (mỗi ngày 1 ảnh khác nhau) */
export function resolveZoomUri(dayIndex: number): Promise<string> {
  const idx = dayIndex % ZOOM_SEQUENCE.length;
  return resolveModule(ZOOM_SEQUENCE[idx]);
}

// ── Backward-compatible exports (used by mockBle.ts) ──────────
export function resolveWideUri(): Promise<string> {
  return resolveModule(WIDE_MODULES[0]);
}

export function resolveSimUri(nodeX2: number): Promise<string> {
  return resolveModule(WIDE_MODULES[nodeX2 % WIDE_MODULES.length]);
}

export function getSimModuleForNode(nodeX2: number): number {
  return WIDE_MODULES[nodeX2 % WIDE_MODULES.length];
}
