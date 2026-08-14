/**
 * Bộ suy luận chạy thẳng trên điện thoại.
 *
 * Chạy được cả mạng dày lẫn mạng tích chập, viết bằng JavaScript thuần: không
 * TensorFlow, không thư viện native, không cần build APK riêng — chạy ngay
 * trong Expo Go và không cần mạng.
 *
 * Trọng số đã lượng hoá về int8 đối xứng theo từng lớp (giảm bốn lần dung
 * lượng). Mỗi lớp giữ một hệ số `scale` để nhân ngược lại khi tính.
 */

export interface DenseLayer {
  kind: 'dense';
  inSize: number;
  outSize: number;
  activation: string;
  scale: number;
  bias: number[];
  weightsBase64: string;
}

export interface Conv2DLayer {
  kind: 'conv2d';
  kernelSize: number;
  inChannels: number;
  outChannels: number;
  /** 'same' giữ nguyên kích thước, 'valid' cắt bớt viền */
  padding: string;
  activation: string;
  scale: number;
  bias: number[];
  weightsBase64: string;
}

export interface MaxPoolLayer {
  kind: 'maxpool';
  poolSize: number;
}

export interface FlattenLayer {
  kind: 'flatten';
}

export type EmbeddedLayer = DenseLayer | Conv2DLayer | MaxPoolLayer | FlattenLayer;

export interface EmbeddedModel {
  /** [cao, rộng, kênh] với ảnh, hoặc [số đặc trưng] với vector */
  inputShape: number[];
  testAccuracy: number;
  trainedAt?: string;
  architecture?: string;
  extra?: {
    letters?: string;
    /** 'vsl' = ngôn ngữ ký hiệu Việt Nam, 'asl' hoặc bỏ trống = Mỹ */
    language?: string;
    /** Nguồn dữ liệu — phải hiển thị được nếu giấy phép yêu cầu ghi công */
    source?: string;
    license?: string;
  };
  layers: EmbeddedLayer[];
}

/** Khối dữ liệu đang chảy qua mạng. */
interface Volume {
  data: Float32Array;
  height: number;
  width: number;
  channels: number;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Giải mã base64 thành Int8Array.
 *
 * Tự viết thay vì dùng `atob`: hàm đó không có mặt chắc chắn trên mọi bản
 * Android chạy Hermes, và ở đây cần byte thô chứ không phải chuỗi.
 */
function decodeBase64(input: string): Int8Array {
  const lookup = new Uint8Array(128);
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i;

  let length = input.length;
  while (length > 0 && input.charCodeAt(length - 1) === 61) length--;
  const bytes = new Int8Array(Math.floor((length * 3) / 4));

  let byteIndex = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < length; i++) {
    buffer = (buffer << 6) | lookup[input.charCodeAt(i)];
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      const value = (buffer >> bits) & 0xff;
      bytes[byteIndex++] = value > 127 ? value - 256 : value;
    }
  }
  return bytes;
}

interface PreparedDense {
  kind: 'dense';
  inSize: number;
  outSize: number;
  activation: string;
  scale: number;
  bias: Float32Array;
  weights: Int8Array;
}

interface PreparedConv {
  kind: 'conv2d';
  kernelSize: number;
  inChannels: number;
  outChannels: number;
  padding: string;
  activation: string;
  scale: number;
  bias: Float32Array;
  weights: Int8Array;
}

type Prepared = PreparedDense | PreparedConv | MaxPoolLayer | FlattenLayer;

export class EmbeddedNetwork {
  private prepared: Prepared[] | null = null;

  constructor(private readonly model: EmbeddedModel) {}

  get inputShape(): number[] {
    return this.model.inputShape;
  }

  get testAccuracy(): number {
    return this.model.testAccuracy;
  }

  get letters(): string | undefined {
    return this.model.extra?.letters;
  }

  /** Giải mã trước, để lần suy luận đầu tiên không khựng giữa lúc demo. */
  warmUp(): void {
    this.ensurePrepared();
  }

  private ensurePrepared(): Prepared[] {
    if (this.prepared) return this.prepared;
    this.prepared = this.model.layers.map((layer): Prepared => {
      if (layer.kind === 'dense' || layer.kind === 'conv2d') {
        return {
          ...layer,
          bias: Float32Array.from(layer.bias),
          weights: decodeBase64(layer.weightsBase64),
        } as Prepared;
      }
      return layer;
    });
    return this.prepared;
  }

  /**
   * Chạy một mẫu. `input` phải khớp `inputShape` (theo thứ tự cao → rộng → kênh).
   * Trả về mảng kết quả của lớp cuối.
   */
  predict(input: Float32Array): Float32Array {
    const layers = this.ensurePrepared();
    const shape = this.model.inputShape;

    let volume: Volume =
      shape.length === 3
        ? { data: input, height: shape[0], width: shape[1], channels: shape[2] }
        : { data: input, height: 1, width: 1, channels: shape[0] };

    for (const layer of layers) {
      if (layer.kind === 'conv2d') volume = conv2d(volume, layer);
      else if (layer.kind === 'maxpool') volume = maxPool(volume, layer.poolSize);
      else if (layer.kind === 'flatten') volume = flatten(volume);
      else volume = dense(volume, layer);
    }
    return volume.data;
  }
}

/* ------------------------------------------------------------------ */
/* Các phép tính                                                       */
/* ------------------------------------------------------------------ */

function conv2d(input: Volume, layer: PreparedConv): Volume {
  const { kernelSize, outChannels, padding, weights, scale, bias, activation } = layer;
  const inChannels = input.channels;
  const pad = padding === 'same' ? Math.floor(kernelSize / 2) : 0;
  const outHeight = input.height + 2 * pad - kernelSize + 1;
  const outWidth = input.width + 2 * pad - kernelSize + 1;
  const out = new Float32Array(outHeight * outWidth * outChannels);

  // Trọng số xếp theo thứ tự của TensorFlow: [ky][kx][kênh vào][kênh ra].
  for (let oy = 0; oy < outHeight; oy++) {
    for (let ox = 0; ox < outWidth; ox++) {
      const outBase = (oy * outWidth + ox) * outChannels;

      for (let oc = 0; oc < outChannels; oc++) out[outBase + oc] = 0;

      for (let ky = 0; ky < kernelSize; ky++) {
        const sy = oy + ky - pad;
        if (sy < 0 || sy >= input.height) continue;
        for (let kx = 0; kx < kernelSize; kx++) {
          const sx = ox + kx - pad;
          if (sx < 0 || sx >= input.width) continue;

          const inBase = (sy * input.width + sx) * inChannels;
          const wBase = ((ky * kernelSize + kx) * inChannels) * outChannels;

          for (let ic = 0; ic < inChannels; ic++) {
            const value = input.data[inBase + ic];
            if (value === 0) continue;             // ảnh sau ReLU rất thưa, bỏ qua cho nhanh
            const wRow = wBase + ic * outChannels;
            for (let oc = 0; oc < outChannels; oc++) {
              out[outBase + oc] += value * weights[wRow + oc];
            }
          }
        }
      }

      for (let oc = 0; oc < outChannels; oc++) {
        out[outBase + oc] = out[outBase + oc] * scale + bias[oc];
      }
    }
  }

  applyActivation(out, activation);
  return { data: out, height: outHeight, width: outWidth, channels: outChannels };
}

function maxPool(input: Volume, poolSize: number): Volume {
  const outHeight = Math.floor(input.height / poolSize);
  const outWidth = Math.floor(input.width / poolSize);
  const channels = input.channels;
  const out = new Float32Array(outHeight * outWidth * channels);

  for (let oy = 0; oy < outHeight; oy++) {
    for (let ox = 0; ox < outWidth; ox++) {
      const outBase = (oy * outWidth + ox) * channels;
      for (let c = 0; c < channels; c++) out[outBase + c] = -Infinity;

      for (let py = 0; py < poolSize; py++) {
        const sy = oy * poolSize + py;
        for (let px = 0; px < poolSize; px++) {
          const sx = ox * poolSize + px;
          const inBase = (sy * input.width + sx) * channels;
          for (let c = 0; c < channels; c++) {
            const v = input.data[inBase + c];
            if (v > out[outBase + c]) out[outBase + c] = v;
          }
        }
      }
    }
  }
  return { data: out, height: outHeight, width: outWidth, channels };
}

/**
 * Trải khối thành vector.
 *
 * Dữ liệu đã nằm sẵn theo thứ tự cao → rộng → kênh, đúng thứ tự mà TensorFlow
 * dùng khi trải, nên chỉ cần đổi cách nhìn chứ không phải sắp xếp lại.
 */
function flatten(input: Volume): Volume {
  return {
    data: input.data,
    height: 1,
    width: 1,
    channels: input.height * input.width * input.channels,
  };
}

function dense(input: Volume, layer: PreparedDense): Volume {
  const { inSize, outSize, weights, scale, bias, activation } = layer;
  const out = new Float32Array(outSize);

  for (let o = 0; o < outSize; o++) {
    let sum = 0;
    // Trọng số xếp theo hàng đầu vào: phần tử (i, o) nằm ở i * outSize + o.
    for (let i = 0; i < inSize; i++) sum += input.data[i] * weights[i * outSize + o];
    out[o] = sum * scale + bias[o];
  }

  applyActivation(out, activation);
  return { data: out, height: 1, width: 1, channels: outSize };
}

function applyActivation(values: Float32Array, activation: string): void {
  const n = values.length;
  if (activation === 'relu') {
    for (let i = 0; i < n; i++) if (values[i] < 0) values[i] = 0;
    return;
  }
  if (activation === 'sigmoid') {
    for (let i = 0; i < n; i++) values[i] = 1 / (1 + Math.exp(-values[i]));
    return;
  }
  if (activation === 'softmax') {
    let max = -Infinity;
    for (let i = 0; i < n; i++) if (values[i] > max) max = values[i];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      values[i] = Math.exp(values[i] - max);
      sum += values[i];
    }
    for (let i = 0; i < n; i++) values[i] /= sum;
  }
  // 'linear' hoặc không rõ: giữ nguyên
}
