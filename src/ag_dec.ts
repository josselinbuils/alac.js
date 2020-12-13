/**
 * Adaptive Golomb decode routines.
 */

const MAX_PREFIX_16 = 9;
const MAX_PREFIX_32 = 9;
const QBSHIFT = 9;
const QB = 1 << QBSHIFT;
const MMULSHIFT = 2;
const MDENSHIFT = QBSHIFT - MMULSHIFT - 1;
const MOFF = 1 << (MDENSHIFT - 2);
const N_MAX_MEAN_CLAMP = 0xffff;
const N_MEAN_CLAMP_VAL = 0xffff;
const BITOFF = 24;
const MAX_DATATYPE_BITS_16 = 16;

interface AgParams {
  mb: number;
  mb0: number;
  pb: number;
  kb: number;
  wb: number;
  qb: number;
  fw: number;
  sw: number;
  maxrun: number;
}

export function ag_params(
  m: number,
  p: number,
  k: number,
  f: number,
  s: number,
  maxrun: number
): AgParams {
  return {
    mb: m,
    mb0: m,
    pb: p,
    kb: k,
    wb: (1 << k) - 1,
    qb: QB - p,
    fw: f,
    sw: s,
    maxrun,
  };
}

export function dyn_decomp(
  params: AgParams,
  data: any,
  pc: Int32Array,
  samples: number,
  maxSize: number
) {
  const { pb, kb, wb } = params;
  let { mb0: mb } = params;

  let zmode = 0;
  let c = 0;

  while (c < samples) {
    let m = mb >>> QBSHIFT;
    let k = Math.min(31 - lead(m + 3), kb);
    m = (1 << k) - 1;

    let n = dyn_get_32(data, m, k, maxSize);

    // least significant bit is sign bit
    const ndecode = n + zmode;
    const multiplier = -(ndecode & 1) | 1;
    pc[c++] = ((ndecode + 1) >>> 1) * multiplier;

    mb = pb * (n + zmode) + mb - ((pb * mb) >> QBSHIFT);

    // update mean tracking
    if (n > N_MAX_MEAN_CLAMP) {
      mb = N_MEAN_CLAMP_VAL;
    }

    zmode = 0;

    if (mb << MMULSHIFT < QB && c < samples) {
      zmode = 1;

      k = lead(mb) - BITOFF + ((mb + MOFF) >> MDENSHIFT);
      const mz = ((1 << k) - 1) & wb;
      n = dyn_get_16(data, mz, k);

      if (!(c + n <= samples)) {
        return false;
      }

      for (let j = 0, end = n; j < end; j++) {
        pc[c++] = 0;
      }

      if (n >= 65535) {
        zmode = 0;
      }
      mb = 0;
    }
  }

  return true;
}

function lead(input: number) {
  let output = 0;
  let curbyte = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // emulate goto :)
    curbyte = input >>> 24;
    if (curbyte) {
      break;
    }
    output += 8;

    curbyte = input >>> 16;
    if (curbyte & 0xff) {
      break;
    }
    output += 8;

    curbyte = input >>> 8;
    if (curbyte & 0xff) {
      break;
    }
    output += 8;

    curbyte = input;
    if (curbyte & 0xff) {
      break;
    }
    output += 8;

    return output;
  }

  if (curbyte & 0xf0) {
    curbyte >>>= 4;
  } else {
    output += 4;
  }

  if (curbyte & 0x8) {
    return output;
  }

  if (curbyte & 0x4) {
    return output + 1;
  }

  if (curbyte & 0x2) {
    return output + 2;
  }

  if (curbyte & 0x1) {
    return output + 3;
  }

  // shouldn't get here
  return output + 4;
}

function dyn_get_16(data: any, m: number, k: number) {
  let result;
  const offs = data.bitPosition;
  let stream = data.peek(32 - offs) << offs;
  const bitsInPrefix = lead(~stream);

  if (bitsInPrefix >= MAX_PREFIX_16) {
    data.advance(MAX_PREFIX_16 + MAX_DATATYPE_BITS_16);
    stream <<= MAX_PREFIX_16;
    result = stream >>> (32 - MAX_DATATYPE_BITS_16);
  } else {
    data.advance(bitsInPrefix + k);

    stream <<= bitsInPrefix + 1;
    const v = stream >>> (32 - k);
    result = bitsInPrefix * m + v - 1;

    if (v < 2) {
      result -= v - 1;
    } else {
      data.advance(1);
    }
  }

  return result;
}

function dyn_get_32(data: any, m: number, k: number, maxbits: number) {
  const offs = data.bitPosition;
  let stream = data.peek(32 - offs) << offs;
  let result = lead(~stream);

  if (result >= MAX_PREFIX_32) {
    data.advance(MAX_PREFIX_32);
    return data.read(maxbits);
  }

  data.advance(result + 1);

  if (k !== 1) {
    stream <<= result + 1;
    result *= m;
    const v = stream >>> (32 - k);

    data.advance(k - 1);

    if (v > 1) {
      result += v - 1;
      data.advance(1);
    }
  }

  return result;
}
