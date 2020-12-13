import { unmix16, unmix24 } from './matrix_dec';
import { ag_params, dyn_decomp } from './ag_dec';
import { unpc_block } from './dp_dec';

const { AV } = globalThis as any;
const ID_SCE = 0; // Single Channel Element
const ID_CPE = 1; // Channel Pair Element
const ID_CCE = 2; // Coupling Channel Element
const ID_LFE = 3; // LFE Channel Element
const ID_DSE = 4; // not yet supported
const ID_PCE = 5;
const ID_FIL = 6;
const ID_END = 7;

class ALACDecoder extends (globalThis as any).AV.Decoder {
  private bitstream: any;
  private config!: {
    frameLength: number;
    compatibleVersion: number;
    bitDepth: number;
    pb: number;
    mb: number;
    kb: number;
    numChannels: number;
    maxRun: number;
    maxFrameBytes: number;
    avgBitRate: number;
    sampleRate: number;
  };
  private mixBuffers!: Int32Array[];
  private predictor!: Int32Array;
  private shiftBuffer!: Uint16Array;

  setCookie(cookie: ArrayBuffer) {
    const data = AV.Stream.fromBuffer(cookie);

    // For historical reasons the decoder needs to be resilient to magic cookies vended by older encoders.
    // There may be additional data encapsulating the ALACSpecificConfig.
    // This would consist of format ('frma') and 'alac' atoms which precede the ALACSpecificConfig.
    // See ALACMagicCookieDescription.txt in the original Apple decoder for additional documentation
    // concerning the 'magic cookie'

    // skip format ('frma') atom if present
    if (data.peekString(4, 4) === 'frma') {
      data.advance(12);
    }

    // skip 'alac' atom header if present
    if (data.peekString(4, 4) === 'alac') {
      data.advance(12);
    }

    // read the ALACSpecificConfig
    this.config = {
      frameLength: data.readUInt32(),
      compatibleVersion: data.readUInt8(),
      bitDepth: data.readUInt8(),
      pb: data.readUInt8(),
      mb: data.readUInt8(),
      kb: data.readUInt8(),
      numChannels: data.readUInt8(),
      maxRun: data.readUInt16(),
      maxFrameBytes: data.readUInt32(),
      avgBitRate: data.readUInt32(),
      sampleRate: data.readUInt32(),
    };

    // CAF files don't encode the bitsPerChannel
    if (!(this as any).format.bitsPerChannel) {
      (this as any).format.bitsPerChannel = this.config.bitDepth;
    }

    // allocate mix buffers
    this.mixBuffers = [
      new Int32Array(this.config.frameLength), // left channel
      new Int32Array(this.config.frameLength), // right channel
    ];

    // allocate dynamic predictor buffer
    const predictorBuffer = new ArrayBuffer(this.config.frameLength * 4);
    this.predictor = new Int32Array(predictorBuffer);

    // "shift off" buffer shares memory with predictor buffer
    this.shiftBuffer = new Uint16Array(predictorBuffer);

    return this.shiftBuffer;
  }

  readChunk() {
    if (!this.stream.available(4)) {
      return;
    }

    const data = this.bitstream;
    let samples = this.config.frameLength;
    const { numChannels } = this.config;
    let channelIndex = 0;

    const output = new ArrayBuffer(
      (samples * numChannels * this.config.bitDepth) / 8
    );
    let end = false;

    while (!end) {
      // read element tag
      let ch;
      let chanBits;
      let mixBits;
      let mixRes;
      let shift;
      let shiftbits;
      const tag = data.read(3);

      switch (tag) {
        case ID_SCE:
        case ID_LFE:
        case ID_CPE: {
          const channels = tag === ID_CPE ? 2 : 1;

          // if decoding this would take us over the max channel limit, bail
          if (channelIndex + channels > numChannels) {
            throw new Error('Too many channels!');
          }

          // no idea what this is for... doesn't seem used anywhere
          data.read(4);

          // read the 12 unused header bits
          const unused = data.read(12);

          if (unused !== 0) {
            throw new Error(
              'Unused part of header does not contain 0, it should'
            );
          }

          // read the 1-bit "partial frame" flag, 2-bit "shift-off" flag & 1-bit "escape" flag
          const partialFrame = data.read(1);
          let bytesShifted = data.read(2);
          const escapeFlag = data.read(1);

          if (bytesShifted === 3) {
            throw new Error("Bytes are shifted by 3, they shouldn't be");
          }

          // check for partial frame to override requested samples
          if (partialFrame) {
            samples = data.read(32);
          }

          if (escapeFlag === 0) {
            let end1;
            let end3;
            shift = bytesShifted * 8;
            chanBits = this.config.bitDepth - shift + channels - 1;

            // compressed frame, read rest of parameters
            mixBits = data.read(8);
            mixRes = data.read(8);

            const mode = [];
            const denShift = [];
            const pbFactor = [];
            const num = [];
            const coefs = [];

            for (ch = 0, end1 = channels; ch < end1; ch++) {
              mode[ch] = data.read(4);
              denShift[ch] = data.read(4);
              pbFactor[ch] = data.read(3);
              num[ch] = data.read(5);
              coefs[ch] = new Int16Array(32);
              const table = coefs[ch];

              for (let i = 0, end2 = num[ch]; i < end2; i++) {
                table[i] = data.read(16);
              }
            }

            // if shift active, skip the the shift buffer but remember where it starts
            if (bytesShifted) {
              shiftbits = data.copy();
              data.advance(shift * channels * samples);
            }

            // decompress and run predictors
            const { mb, pb, kb, maxRun } = this.config;

            for (ch = 0, end3 = channels; ch < end3; ch++) {
              const params = ag_params(
                mb,
                (pb * pbFactor[ch]) / 4,
                kb,
                samples,
                samples,
                maxRun
              );
              const status = dyn_decomp(
                params,
                data,
                this.predictor,
                samples,
                chanBits
              );
              if (!status) {
                throw new Error('Error in Aglib.dyn_decomp');
              }

              if (mode[ch] === 0) {
                unpc_block(
                  this.predictor,
                  this.mixBuffers[ch],
                  samples,
                  coefs[ch],
                  num[ch],
                  chanBits,
                  denShift[ch]
                );
              } else {
                // the special "numActive == 31" mode can be done in-place
                unpc_block(
                  this.predictor,
                  this.predictor,
                  samples,
                  null,
                  31,
                  chanBits,
                  0
                );
                unpc_block(
                  this.predictor,
                  this.mixBuffers[ch],
                  samples,
                  coefs[ch],
                  num[ch],
                  chanBits,
                  denShift[ch]
                );
              }
            }
          } else {
            // uncompressed frame, copy data into the mix buffer to use common output code
            chanBits = this.config.bitDepth;
            shift = 32 - chanBits;

            for (let i = 0, end4 = samples; i < end4; i++) {
              let end5;
              for (ch = 0, end5 = channels; ch < end5; ch++) {
                this.mixBuffers[ch][i] =
                  (data.read(chanBits) << shift) >> shift;
              }
            }

            mixBits = 0;
            mixRes = 0;
            bytesShifted = 0;
          }

          // now read the shifted values into the shift buffer
          if (bytesShifted) {
            shift = bytesShifted * 8;
            for (let i = 0, end6 = samples * channels; i < end6; i++) {
              this.shiftBuffer[i] = shiftbits.read(shift);
            }
          }

          // un-mix the data and convert to output format
          // - note that mixRes = 0 means just interleave so we use that path for uncompressed frames
          switch (this.config.bitDepth) {
            case 16: {
              const out16 = new Int16Array(output, channelIndex);

              if (channels === 2) {
                unmix16(
                  this.mixBuffers[0],
                  this.mixBuffers[1],
                  out16,
                  numChannels,
                  samples,
                  mixBits,
                  mixRes
                );
              } else {
                const buf = this.mixBuffers[0];

                for (let i = 0, j = 0, end7 = samples; i < end7; i++) {
                  out16[j] = buf[i];
                  j += numChannels;
                }
              }
              break;
            }

            case 24: {
              const out8 = new Uint8Array(output, channelIndex * 3);

              if (channels === 2) {
                unmix24(
                  this.mixBuffers[0],
                  this.mixBuffers[1],
                  out8,
                  numChannels,
                  samples,
                  mixBits,
                  mixRes,
                  this.shiftBuffer,
                  bytesShifted
                );
              } else {
                throw new Error('Only supports stereo in 24-bit right now.');
              }
              break;
            }

            default:
              throw new Error(
                'Only supports 16-bit and 24-bit samples right now'
              );
          }

          channelIndex += channels;
          break;
        }

        case ID_CCE:
        case ID_PCE:
          throw new Error(`Unsupported element: ${tag}`);

        case ID_DSE: {
          // the tag associates this data stream element with a given audio element
          data.read(4);

          const dataByteAlignFlag = data.read(1);

          // 8-bit count or (8-bit + 8-bit count) if 8-bit count == 255
          let count = data.read(8);
          if (count === 255) {
            count += data.read(8);
          }

          // the align flag means the bitstream should be byte-aligned before reading the following data bytes
          if (dataByteAlignFlag) {
            data.align();
          }

          // skip the data bytes
          data.advance(count * 8);
          if (!(data.pos < data.length)) {
            throw new Error('buffer overrun');
          }
          break;
        }

        case ID_FIL: {
          // 4-bit count or (4-bit + 8-bit count) if 4-bit count == 15
          // - plus this weird -1 thing I still don't fully understand
          let count = data.read(4);
          if (count === 15) {
            count += data.read(8) - 1;
          }

          data.advance(count * 8);
          if (!(data.pos < data.length)) {
            throw new Error('buffer overrun');
          }
          break;
        }

        case ID_END:
          data.align();
          end = true;
          break;

        default:
          throw new Error(`Unknown element: ${tag}`);
      }

      if (channelIndex > numChannels) {
        throw new Error('Channel index too large.');
      }
    }

    switch (this.config.bitDepth) {
      case 16:
        return new Int16Array(output);

      case 24: {
        const int32Array = new Int32Array(samples * numChannels);
        const v = new DataView(output);

        for (let i = 0, j = 1; i < samples * numChannels; ++i, j += 3) {
          const byteHigh = v.getInt16(j, true);
          const byteLow = v.getUint8(j - 1);
          int32Array[i] = (byteHigh << 8) | byteLow;
        }
        return int32Array;
      }

      default:
        throw new Error('Only supports 16-bit and 24-bit right now.');
    }
  }
}

AV.Decoder.register('alac', ALACDecoder);
