import { Paths, File, Directory } from "expo-file-system";
import type { PatrolSession, NodeImage, ShotKind } from "@/types/robot";

function ensureDir(dir: Directory): void {
  try {
    // createDirectory("") chỉ tạo 1 cấp — dùng legacy API để tạo cả parent
    dir.createDirectory("");
  } catch {
    // already exists
  }
}

/**
 * Async version — đảm bảo thư mục tồn tại, tạo cả parent nếu cần.
 * Dùng cho writePatrolManifest khi thư mục có thể chưa tồn tại.
 */
async function ensureDirAsync(dir: Directory): Promise<void> {
  const legacy = await import("expo-file-system/legacy");
  try {
    await legacy.makeDirectoryAsync(dir.uri, { intermediates: true });
  } catch {
    // already exists
  }
}

function heriguardDir(): Directory {
  const root = new Directory(Paths.document, "heriguard");
  ensureDir(root);
  return root;
}

function patrolDir(patrolId: string): Directory {
  const root = heriguardDir();
  // Tạo heriguard/patrols/ trước nếu chưa có
  const patrolsParent = new Directory(root, "patrols");
  ensureDir(patrolsParent);
  const dir = new Directory(patrolsParent, patrolId);
  ensureDir(dir);
  return dir;
}

function nodeDir(patrolId: string, nodeX2: number): Directory {
  const dir = new Directory(patrolDir(patrolId), `node_${nodeX2}`);
  ensureDir(dir);
  return dir;
}

/**
 * Get path to patrol.json manifest
 */
function getPatrolManifestPath(patrolId: string): string {
  const dir = patrolDir(patrolId);
  const file = new File(dir, "patrol.json");
  return file.uri;
}

export async function saveImage(
  sourceUri: string,
  patrolId: string,
  frameIndex: number
): Promise<string> {
  const dir = patrolDir(patrolId);
  const name = `frame_${String(frameIndex).padStart(4, "0")}.jpg`;
  const file = dir.createFile(name, "image/jpeg");
  await File.downloadFileAsync(sourceUri, file, { idempotent: true });
  return file.uri;
}

export async function saveBase64Image(
  base64: string,
  patrolId: string,
  frameIndex: number
): Promise<string> {
  const dir = patrolDir(patrolId);
  const name = `frame_${String(frameIndex).padStart(4, "0")}.jpg`;
  const file = dir.createFile(name, "image/jpeg");
  const uri = file.uri;
  const fs = await import("expo-file-system");
  const legacy = await import("expo-file-system/legacy");
  await legacy.writeAsStringAsync(uri, base64, {
    encoding: fs.EncodingType.Base64,
  });
  return uri;
}

export async function getPatrolImages(patrolId: string): Promise<string[]> {
  const root = new Directory(Paths.document, "heriguard", "patrols");
  const dir = new Directory(root, patrolId);
  const info = await Paths.info(dir.uri);
  if (!info.exists) return [];
  const items = dir.list();
  return items
    .filter((item): item is File => item instanceof File)
    .filter((f) => f.uri.endsWith(".jpg"))
    .sort((a, b) => a.uri.localeCompare(b.uri))
    .map((f) => f.uri);
}

export async function deletePatrol(patrolId: string): Promise<void> {
  const dir = new Directory(heriguardDir(), "patrols", patrolId);
  const info = await Paths.info(dir.uri);
  if (info.exists) {
    dir.delete();
  }
}

/**
 * ─────────────────────────────────────────────────────────────
 * NEW: Patrol Manifest Functions (Phase A)
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Save image to node folder + update patrol.json
 * Path: patrols/{patrolId}/node_{nodeX2}/shot_{shotKind}_{frameId}.jpg
 */
export async function savePatrolImage(
  patrolId: string,
  nodeX2: number,
  shotKind: ShotKind,
  frameId: number,
  base64: string,
  nodeImage: Omit<NodeImage, "uri">
): Promise<NodeImage> {
  // 1. Create node folder
  const nodeFolder = nodeDir(patrolId, nodeX2);

  // 2. Save JPEG file
  const fileName = `shot_${shotKind}_${String(frameId).padStart(4, "0")}.jpg`;
  const file = nodeFolder.createFile(fileName, "image/jpeg");
  const uri = file.uri;

  const fs = await import("expo-file-system");
  const legacy = await import("expo-file-system/legacy");
  await legacy.writeAsStringAsync(uri, base64, {
    encoding: fs.EncodingType.Base64,
  });

  // 3. Create NodeImage object with URI
  const nodeImageFull: NodeImage = {
    ...nodeImage,
    uri,
  };

  // 4. Update patrol.json manifest
  await updatePatrolJsonWithImage(patrolId, nodeImageFull);

  return nodeImageFull;
}

/**
 * Save image from a local file (asset) to node folder + update patrol.json
 * Path: patrols/{patrolId}/node_{nodeX2}/shot_{shotKind}_{frameId}.jpg
 * Unlike savePatrolImage (base64), this copies a real JPEG file
 */
export async function savePatrolImageFromFile(
  patrolId: string,
  nodeX2: number,
  shotKind: ShotKind,
  frameId: number,
  sourceUri: string,
  nodeImage: Omit<NodeImage, "uri">
): Promise<NodeImage> {
  const nodeFolder = nodeDir(patrolId, nodeX2);

  const fileName = `shot_${shotKind}_${String(frameId).padStart(4, "0")}.jpg`;
  const file = nodeFolder.createFile(fileName, "image/jpeg");
  const uri = file.uri;

  const legacy = await import("expo-file-system/legacy");
  await legacy.copyAsync({ from: sourceUri, to: uri });

  const nodeImageFull: NodeImage = { ...nodeImage, uri };
  await updatePatrolJsonWithImage(patrolId, nodeImageFull);

  return nodeImageFull;
}

/**
 * Storage path của node trong phân vùng tài liệu (để hiển thị trong UI)
 * Vd: heriguard/patrols/{patrolId}/node_{nodeX2}
 */
export function getNodeStorageDir(patrolId: string, nodeX2: number): string {
  return nodeDir(patrolId, nodeX2).uri;
}

/**
 * Read patrol.json manifest
 * Returns null if file doesn't exist
 */
export async function readPatrolJson(patrolId: string): Promise<PatrolSession | null> {
  const manifestPath = getPatrolManifestPath(patrolId);
  const fs = await import("expo-file-system");
  const legacy = await import("expo-file-system/legacy");

  try {
    const info = await Paths.info(manifestPath);
    if (!info.exists) {
      return null;
    }

    const json = await legacy.readAsStringAsync(manifestPath, {
      encoding: fs.EncodingType.UTF8,
    });
    return JSON.parse(json) as PatrolSession;
  } catch (error) {
    console.warn(`readPatrolJson(${patrolId}) failed:`, error);
    return null;
  }
}

/**
 * Update patrol.json with new image entry
 * Merges with existing manifest or creates new one
 */
async function updatePatrolJsonWithImage(
  patrolId: string,
  nodeImage: NodeImage
): Promise<void> {
  const manifestPath = getPatrolManifestPath(patrolId);
  const fs = await import("expo-file-system");
  const legacy = await import("expo-file-system/legacy");

  // Read existing manifest or create empty
  let manifest: PatrolSession;
  try {
    const info = await Paths.info(manifestPath);
    if (info.exists) {
      const json = await legacy.readAsStringAsync(manifestPath, {
        encoding: fs.EncodingType.UTF8,
      });
      manifest = JSON.parse(json) as PatrolSession;
    } else {
      throw new Error("File not found, creating new");
    }
  } catch {
    // File doesn't exist or parse failed, create empty manifest
    // Note: patrolId should be set by patrolStore when creating new patrol
    manifest = {
      id: patrolId,
      startTime: new Date().toISOString(),
      images: [],
      mapMarkers: [],
      detections: [],
      sensorLogs: [],
    };
  }

  // Update or append image
  const existingIdx = manifest.images.findIndex(
    (img) => img.frameId === nodeImage.frameId
  );
  if (existingIdx >= 0) {
    manifest.images[existingIdx] = nodeImage;
  } else {
    manifest.images.push(nodeImage);
  }

  // Write back to disk
  const json = JSON.stringify(manifest, null, 2);
  await legacy.writeAsStringAsync(manifestPath, json, {
    encoding: fs.EncodingType.UTF8,
  });
}

/**
 * Update entire patrol.json (end patrol, add metadata, etc)
 */
export async function updatePatrolJson(
  patrolId: string,
  updates: Partial<PatrolSession>
): Promise<void> {
  const manifestPath = getPatrolManifestPath(patrolId);
  const fs = await import("expo-file-system");
  const legacy = await import("expo-file-system/legacy");

  let manifest = await readPatrolJson(patrolId);
  if (!manifest) {
    console.warn(`updatePatrolJson: ${patrolId} not found`);
    return;
  }

  manifest = { ...manifest, ...updates };
  const json = JSON.stringify(manifest, null, 2);

  await legacy.writeAsStringAsync(manifestPath, json, {
    encoding: fs.EncodingType.UTF8,
  });
}

/**
 * Write complete patrol.json directly — no read needed.
 * Dùng cho seed data: tạo manifest mới từ đầu (tránh race condition
 * giữa savePatrolImageFromFile và updatePatrolJson).
 * Tự tạo thư mục cha nếu chưa tồn tại.
 */
export async function writePatrolManifest(
  patrolId: string,
  session: PatrolSession
): Promise<void> {
  const fs = await import("expo-file-system");
  const legacy = await import("expo-file-system/legacy");

  // Đảm bảo thư mục patrol tồn tại (heriguard/patrols/{patrolId}/)
  await ensureDirAsync(patrolDir(patrolId));

  const manifestPath = getPatrolManifestPath(patrolId);
  const json = JSON.stringify(session, null, 2);
  try {
    await legacy.writeAsStringAsync(manifestPath, json, {
      encoding: fs.EncodingType.UTF8,
    });
    console.log(
      `[FileStorage] writePatrolManifest OK: ${patrolId} (${session.images.length} images, path=${manifestPath})`
    );
  } catch (err) {
    console.warn(`[FileStorage] writePatrolManifest FAIL: ${patrolId}`, err);
  }
}

/**
 * List all patrol directories under heriguard/patrols/
 */
export async function listPatrolDirs(): Promise<string[]> {
  const patrolsRoot = new Directory(heriguardDir(), "patrols");
  try {
    const info = await Paths.info(patrolsRoot.uri);
    if (!info.exists) {
      console.log("[FileStorage] listPatrolDirs: heriguard/patrols/ not found");
      return [];
    }

    const items = patrolsRoot.list();
    const dirs = items
      .filter((item): item is Directory => item instanceof Directory)
      .map((dir) => dir.name)
      .sort()
      .reverse(); // Most recent first
    console.log(`[FileStorage] listPatrolDirs: found ${dirs.length} dirs:`, dirs);
    return dirs;
  } catch (error) {
    console.warn("listPatrolDirs failed:", error);
    return [];
  }
}

/**
 * Load all persisted patrols from disk
 * Called on app startup to rehydrate patrolStore
 */
export async function loadPersistedPatrols(): Promise<PatrolSession[]> {
  const patrolIds = await listPatrolDirs();
  const patrols: PatrolSession[] = [];

  for (const patrolId of patrolIds) {
    try {
      const manifest = await readPatrolJson(patrolId);
      if (manifest) {
        patrols.push(manifest);
      } else {
        console.warn(`[FileStorage] readPatrolJson returned null for ${patrolId}`);
      }
    } catch (error) {
      console.warn(`Failed to load patrol ${patrolId}:`, error);
    }
  }

  console.log(`[FileStorage] loadPersistedPatrols: loaded ${patrols.length} patrols`);
  return patrols;
}
