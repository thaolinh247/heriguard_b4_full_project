import { Paths, File, Directory } from "expo-file-system";

function ensureDir(dir: Directory): void {
  try {
    dir.createDirectory("");
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
  const dir = new Directory(heriguardDir(), "patrols", patrolId);
  ensureDir(dir);
  return dir;
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
