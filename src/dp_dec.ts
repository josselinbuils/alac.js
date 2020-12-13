/**
 * Dynamic Predictor decode routines
 */

export function unpc_block(
  pc1: Int32Array,
  out: Int32Array,
  num: number,
  coefs: Int16Array | null,
  active: number,
  chanbits: number,
  denshift: number
) {
  let a0;
  let a1;
  let a2;
  let a3;
  let b0;
  let b1;
  let b2;
  let b3;
  let del;
  let del0;
  let i;
  let j;
  let offset;
  let sg;
  let sgn;
  let sum1;
  let top;
  let end1;
  const chanshift = 32 - chanbits;
  const denhalf = 1 << (denshift - 1);

  out[0] = pc1[0];

  // just copy if active is 0
  if (active === 0) {
    copy(out, 0, pc1, 0, num * 4);
    return;
  }

  // short-circuit if active is 31
  if (active === 31) {
    let end;
    let prev = out[0];

    for (i = 1, end = num; i < end; i++) {
      del = pc1[i] + prev;
      prev = (del << chanshift) >> chanshift;
      out[i] = prev;
    }

    return;
  }

  for (i = 1, end1 = active; i <= end1; i++) {
    del = pc1[i] + out[i - 1];
    out[i] = (del << chanshift) >> chanshift;
  }

  const lim = active + 1;

  if (active === 4) {
    // Optimization for active == 4
    let end2;

    if (coefs === null) {
      throw new Error('coefs should not be null');
    }

    [a0, a1, a2, a3] = Array.from(coefs);

    for (j = lim, end2 = num; j < end2; j++) {
      top = out[j - lim];
      offset = j - 1;

      b0 = top - out[offset];
      b1 = top - out[offset - 1];
      b2 = top - out[offset - 2];
      b3 = top - out[offset - 3];

      sum1 = (denhalf - a0 * b0 - a1 * b1 - a2 * b2 - a3 * b3) >> denshift;
      del = pc1[j];
      del0 = pc1[j];
      sg = (-del >>> 31) | (del >> 31);
      del += top + sum1;

      out[j] = (del << chanshift) >> chanshift;

      if (sg > 0) {
        sgn = (-b3 >>> 31) | (b3 >> 31);
        a3 -= sgn;
        del0 -= (sgn * b3) >> denshift;
        if (del0 <= 0) {
          continue;
        }

        sgn = (-b2 >>> 31) | (b2 >> 31);
        a2 -= sgn;
        del0 -= 2 * ((sgn * b2) >> denshift);
        if (del0 <= 0) {
          continue;
        }

        sgn = (-b1 >>> 31) | (b1 >> 31);
        a1 -= sgn;
        del0 -= 3 * ((sgn * b1) >> denshift);
        if (del0 <= 0) {
          continue;
        }

        a0 -= (-b0 >>> 31) | (b0 >> 31);
      } else if (sg < 0) {
        // note: to avoid unnecessary negations, we flip the value of "sgn"
        sgn = -((-b3 >>> 31) | (b3 >> 31));
        a3 -= sgn;
        del0 -= (sgn * b3) >> denshift;
        if (del0 >= 0) {
          continue;
        }

        sgn = -((-b2 >>> 31) | (b2 >> 31));
        a2 -= sgn;
        del0 -= 2 * ((sgn * b2) >> denshift);
        if (del0 >= 0) {
          continue;
        }

        sgn = -((-b1 >>> 31) | (b1 >> 31));
        a1 -= sgn;
        del0 -= 3 * ((sgn * b1) >> denshift);
        if (del0 >= 0) {
          continue;
        }

        a0 += (-b0 >>> 31) | (b0 >> 31);
      }
    }

    coefs[0] = a0;
    coefs[1] = a1;
    coefs[2] = a2;
    coefs[3] = a3;
  } else if (active === 8) {
    // Optimization for active == 8
    let a4;
    let a5;
    let a6;
    let a7;
    let end3;

    if (coefs === null) {
      throw new Error('coefs should not be null');
    }

    [a0, a1, a2, a3, a4, a5, a6, a7] = Array.from(coefs);

    for (j = lim, end3 = num; j < end3; j++) {
      top = out[j - lim];
      offset = j - 1;

      b0 = top - out[offset];
      b1 = top - out[offset - 1];
      b2 = top - out[offset - 2];
      b3 = top - out[offset - 3];
      const b4 = top - out[offset - 4];
      const b5 = top - out[offset - 5];
      const b6 = top - out[offset - 6];
      const b7 = top - out[offset - 7];

      sum1 =
        (denhalf -
          a0 * b0 -
          a1 * b1 -
          a2 * b2 -
          a3 * b3 -
          a4 * b4 -
          a5 * b5 -
          a6 * b6 -
          a7 * b7) >>
        denshift;

      del = pc1[j];
      del0 = pc1[j];
      sg = (-del >>> 31) | (del >> 31);
      del += top + sum1;

      out[j] = (del << chanshift) >> chanshift;

      if (sg > 0) {
        sgn = (-b7 >>> 31) | (b7 >> 31);
        a7 -= sgn;
        del0 -= (sgn * b7) >> denshift;
        if (del0 <= 0) {
          continue;
        }

        sgn = (-b6 >>> 31) | (b6 >> 31);
        a6 -= sgn;
        del0 -= 2 * ((sgn * b6) >> denshift);
        if (del0 <= 0) {
          continue;
        }

        sgn = (-b5 >>> 31) | (b5 >> 31);
        a5 -= sgn;
        del0 -= 3 * ((sgn * b5) >> denshift);
        if (del0 <= 0) {
          continue;
        }

        sgn = (-b4 >>> 31) | (b4 >> 31);
        a4 -= sgn;
        del0 -= 4 * ((sgn * b4) >> denshift);
        if (del0 <= 0) {
          continue;
        }

        sgn = (-b3 >>> 31) | (b3 >> 31);
        a3 -= sgn;
        del0 -= 5 * ((sgn * b3) >> denshift);
        if (del0 <= 0) {
          continue;
        }

        sgn = (-b2 >>> 31) | (b2 >> 31);
        a2 -= sgn;
        del0 -= 6 * ((sgn * b2) >> denshift);
        if (del0 <= 0) {
          continue;
        }

        sgn = (-b1 >>> 31) | (b1 >> 31);
        a1 -= sgn;
        del0 -= 7 * ((sgn * b1) >> denshift);
        if (del0 <= 0) {
          continue;
        }

        a0 -= (-b0 >>> 31) | (b0 >> 31);
      } else if (sg < 0) {
        // note: to avoid unnecessary negations, we flip the value of "sgn"
        sgn = -((-b7 >>> 31) | (b7 >> 31));
        a7 -= sgn;
        del0 -= (sgn * b7) >> denshift;
        if (del0 >= 0) {
          continue;
        }

        sgn = -((-b6 >>> 31) | (b6 >> 31));
        a6 -= sgn;
        del0 -= 2 * ((sgn * b6) >> denshift);
        if (del0 >= 0) {
          continue;
        }

        sgn = -((-b5 >>> 31) | (b5 >> 31));
        a5 -= sgn;
        del0 -= 3 * ((sgn * b5) >> denshift);
        if (del0 >= 0) {
          continue;
        }

        sgn = -((-b4 >>> 31) | (b4 >> 31));
        a4 -= sgn;
        del0 -= 4 * ((sgn * b4) >> denshift);
        if (del0 >= 0) {
          continue;
        }

        sgn = -((-b3 >>> 31) | (b3 >> 31));
        a3 -= sgn;
        del0 -= 5 * ((sgn * b3) >> denshift);
        if (del0 >= 0) {
          continue;
        }

        sgn = -((-b2 >>> 31) | (b2 >> 31));
        a2 -= sgn;
        del0 -= 6 * ((sgn * b2) >> denshift);
        if (del0 >= 0) {
          continue;
        }

        sgn = -((-b1 >>> 31) | (b1 >> 31));
        a1 -= sgn;
        del0 -= 7 * ((sgn * b1) >> denshift);
        if (del0 >= 0) {
          continue;
        }

        a0 += (-b0 >>> 31) | (b0 >> 31);
      }
    }

    coefs[0] = a0;
    coefs[1] = a1;
    coefs[2] = a2;
    coefs[3] = a3;
    coefs[4] = a4;
    coefs[5] = a5;
    coefs[6] = a6;
    coefs[7] = a7;
  } else {
    // General case
    let end4;

    if (coefs === null) {
      throw new Error('coefs should not be null');
    }

    for (i = lim, end4 = num; i < end4; i++) {
      let end5;
      let dd;
      sum1 = 0;
      top = out[i - lim];
      offset = i - 1;

      for (j = 0, end5 = active; j < end5; j++) {
        sum1 += coefs[j] * (out[offset - j] - top);
      }

      del = pc1[i];
      del0 = pc1[i];
      sg = (-del >>> 31) | (del >> 31);

      del += top + ((sum1 + denhalf) >> denshift);
      out[i] = (del << chanshift) >> chanshift;

      if (sg > 0) {
        for (j = active - 1; j >= 0; j--) {
          dd = top - out[offset - j];
          sgn = (-dd >>> 31) | (dd >> 31);

          coefs[j] -= sgn;
          del0 -= (active - j) * ((sgn * dd) >> denshift);

          if (del0 <= 0) {
            break;
          }
        }
      } else if (sg < 0) {
        for (j = active - 1; j >= 0; j--) {
          dd = top - out[offset - j];
          sgn = (-dd >>> 31) | (dd >> 31);

          coefs[j] += sgn;
          del0 -= (active - j) * ((-sgn * dd) >> denshift);

          if (del0 >= 0) {
            break;
          }
        }
      }
    }
  }
}

function copy(
  dst: Int32Array,
  dstOffset: number,
  src: Int32Array,
  srcOffset: number,
  n: number
): void {
  const destination = new Uint8Array(dst, dstOffset, n);
  const source = new Uint8Array(src, srcOffset, n);
  destination.set(source);
}
