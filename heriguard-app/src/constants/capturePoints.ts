/**
 * ─────────────────────────────────────────────────────────────
 * CAPTURE POINTS — 2 điểm chụp cố định được đánh dấu sẵn trên
 * bản đồ guard.png. Mỗi điểm tương ứng 1 node dừng của robot
 * (mỗi 0.5m một node): Điểm chụp 1 = 0.5m (node 1),
 * Điểm chụp 2 = 1.0m (node 2).
 *
 * M-Vision camera chỉ chụp ảnh tại 2 điểm dừng này —
 * các node khác (0, 3-6) robot đi qua nhưng KHÔNG chụp.
 * ─────────────────────────────────────────────────────────────
 */

export interface CapturePoint {
  id: number;
  nodeX2: number;
  label: string;
  distanceLabel: string;
  description: string;
}

export const CAPTURE_POINTS: CapturePoint[] = [
  {
    id: 1,
    nodeX2: 1,
    label: "Điểm chụp 1",
    distanceLabel: "0.5m",
    description: "Cột trụ phía trước — khu vực tường chính diện",
  },
  {
    id: 2,
    nodeX2: 2,
    label: "Điểm chụp 2",
    distanceLabel: "1.0m",
    description: "Tường bên — khu vực chân tường giao lộ",
  },
];

export function getCapturePoint(id: number): CapturePoint | undefined {
  return CAPTURE_POINTS.find((p) => p.id === id);
}

export function getCapturePointByNode(nodeX2: number): CapturePoint | undefined {
  return CAPTURE_POINTS.find((p) => p.nodeX2 === nodeX2);
}