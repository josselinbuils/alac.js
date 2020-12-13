# alac.js: An Apple Lossless decoder in the browser

The Apple Lossless Audio Codec (ALAC) is an audio codec developed by Apple and
included in the original iPod.

ALAC is a data compression method which reduces the size of audio files with no
loss of information.

A decoded ALAC stream is bit-for-bit identical to the original uncompressed
audio file.

The original encoder and decoder were
[open sourced](http://alac.macosforge.org/) by Apple, and this is a port of the
decoder to CoffeeScript so that ALAC files can be played in the browser.

## Installation

```bash
npm install @josselinbuils/alac
yarn add @josselinbuils/alac
```

## Authors

Alac.js was originally written by [@jensnockert](http://github.com/jensnockert)
and [@devongovett](http://github.com/devongovett) of
[Audiocogs](http://audiocogs.org/).

It has been ported to TypeScript by
[@josselinbuils](http://github.com/josselinbuils).

## License

alac.js is released under the same terms as the original ALAC decoder from
Apple, which is the [Apache 2](http://www.apache.org/licenses/LICENSE-2.0)
license.
