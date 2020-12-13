/**
 * ALAC mixing/matrixing routines to/from 32-bit predictor buffers.
 */

export function unmix16(
  u: Int32Array,
  v: Int32Array,
  out: Int16Array,
  stride: number,
  samples: number,
  mixbits: number,
  mixres: number
): void {
  if (mixres === 0) {
    // Conventional separated stereo
    for (let i = 0, end = samples; i < end; i++) {
      out[i * stride] = u[i];
      out[i * stride + 1] = v[i];
    }
  } else {
    // Matrixed stereo
    for (let i = 0, end1 = samples; i < end1; i++) {
      const l = u[i] + v[i] - ((mixres * v[i]) >> mixbits);
      out[i * stride] = l;
      out[i * stride + 1] = l - v[i];
    }
  }
}

export function unmix24(
  u: Int32Array,
  v: Int32Array,
  out: Uint8Array,
  stride: number,
  samples: number,
  mixbits: number,
  mixres: number,
  shiftUV: Uint16Array,
  bytesShifted: number
) {
  const HBYTE = 2;
  const LBYTE = 0;
  const MBYTE = 1;
  const shift = bytesShifted * 8;
  let offset = 0;
  let l;
  let r;

  if (mixres !== 0) {
    /* matrixed stereo */
    if (bytesShifted !== 0) {
      for (let j = 0, k = 0; j < samples; j++, k += 2) {
        l = u[j] + v[j] - ((mixres * v[j]) >> mixbits);
        r = l - v[j];
        l = (l << shift) | shiftUV[k];
        r = (r << shift) | shiftUV[k + 1];

        out[offset + HBYTE] = (l >> 16) & 0x00ff;
        out[offset + MBYTE] = (l >> 8) & 0x00ff;
        out[offset + LBYTE] = (l >> 0) & 0x00ff;
        offset += 3;

        out[offset + HBYTE] = (r >> 16) & 0x00ff;
        out[offset + MBYTE] = (r >> 8) & 0x00ff;
        out[offset + LBYTE] = (r >> 0) & 0x00ff;
        offset += (stride - 1) * 3;
      }
    } else {
      for (let j = 0; j < samples; j++) {
        l = u[j] + v[j] - ((mixres * v[j]) >> mixbits);
        r = l - v[j];

        out[offset + HBYTE] = (l >> 16) & 0x00ff;
        out[offset + MBYTE] = (l >> 8) & 0x00ff;
        out[offset + LBYTE] = (l >> 0) & 0x00ff;
        offset += 3;

        out[offset + HBYTE] = (r >> 16) & 0x00ff;
        out[offset + MBYTE] = (r >> 8) & 0x00ff;
        out[offset + LBYTE] = (r >> 0) & 0x00ff;
        offset += (stride - 1) * 3;
      }
    }
  } else if (bytesShifted !== 0) {
    /* Conventional separated stereo. */
    for (let j = 0, k = 0; j < samples; j++, k += 2) {
      l = u[j];
      r = v[j];
      l = (l << shift) | shiftUV[k];
      r = (r << shift) | shiftUV[k + 1];

      out[offset + HBYTE] = (l >> 16) & 0x00ff;
      out[offset + MBYTE] = (l >> 8) & 0x00ff;
      out[offset + LBYTE] = (l >> 0) & 0x00ff;
      offset += 3;

      out[offset + HBYTE] = (r >> 16) & 0x00ff;
      out[offset + MBYTE] = (r >> 8) & 0x00ff;
      out[offset + LBYTE] = (r >> 0) & 0x00ff;
      offset += (stride - 1) * 3;
    }
  } else {
    for (let j = 0; j < samples; j++) {
      let val = u[j];

      out[offset + HBYTE] = (val >> 16) & 0x00ff;
      out[offset + MBYTE] = (val >> 8) & 0x00ff;
      out[offset + LBYTE] = (val >> 0) & 0x00ff;
      offset += 3;

      val = v[j];
      out[offset + HBYTE] = (val >> 16) & 0x00ff;
      out[offset + MBYTE] = (val >> 8) & 0x00ff;
      out[offset + LBYTE] = (val >> 0) & 0x00ff;
      offset += (stride - 1) * 3;
    }
  }
}
