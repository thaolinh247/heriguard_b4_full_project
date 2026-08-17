import { Asset } from "expo-asset";

/**
 * ─────────────────────────────────────────────────────────────
 * SIMULATION MEDIA — ánh xạ ảnh asset cho từng node
 * Cùng node luôn trả về cùng ảnh (để demo so sánh lần-tuần-tra)
 * ─────────────────────────────────────────────────────────────
 */

const CRACK_MODULES = [
  require("@/assets/images/heritage-cracks/crack-1.jpg"),
  require("@/assets/images/heritage-cracks/crack-2.jpg"),
  require("@/assets/images/heritage-cracks/crack-3.jpg"),
  require("@/assets/images/heritage-cracks/crack-4.jpg"),
  require("@/assets/images/heritage-cracks/crack-5.jpg"),
  require("@/assets/images/heritage-cracks/crack-6.jpg"),
  require("@/assets/images/heritage-cracks/crack-7.jpg"),
  require("@/assets/images/wall-crack-1.jpg"),
  require("@/assets/images/wall-crack-2.jpg"),
  require("@/assets/images/wall-crack-3.jpg"),
];

const CLEAN_MODULES = [
  require("@/assets/images/wall-brick.jpg"),
  require("@/assets/images/wall-yellow.jpg"),
  require("@/assets/images/column-1.jpg"),
  require("@/assets/images/column-2.jpg"),
];

/** Node 0,1,2 = bề mặt sạch (không phát hiện); node 3+ = nghi vấn nứt */
export function isCrackNode(nodeX2: number): boolean {
  return nodeX2 >= 3;
}

/** Module ảnh ổn định cho node — deterministic, same node = same image */
export function getSimModuleForNode(nodeX2: number): number {
  if (isCrackNode(nodeX2)) {
    return CRACK_MODULES[nodeX2 % CRACK_MODULES.length];
  }
  return CLEAN_MODULES[nodeX2 % CLEAN_MODULES.length];
}

const resolvedCache = new Map<number, Promise<string>>();

/**
 * File URI cục bộ (file://) của ảnh asset — để copyAsync vào node folder
 * Asset.downloadAsync() trả localUri trên cả Expo Go và build thật
 */
export function resolveSimUri(nodeX2: number): Promise<string> {
  let cached = resolvedCache.get(nodeX2);
  if (!cached) {
    cached = (async () => {
      const asset = Asset.fromModule(getSimModuleForNode(nodeX2));
      if (!asset.localUri) await asset.downloadAsync();
      return asset.localUri ?? asset.uri;
    })();
    resolvedCache.set(nodeX2, cached);
  }
  return cached;
}