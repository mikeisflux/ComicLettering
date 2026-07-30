declare module "utif2" {
  export interface UtifIFD {
    width: number;
    height: number;
    [key: string]: unknown;
  }
  export function decode(buf: ArrayBuffer | Uint8Array): UtifIFD[];
  export function decodeImage(buf: ArrayBuffer | Uint8Array, ifd: UtifIFD): void;
  export function toRGBA8(ifd: UtifIFD): Uint8Array;
}
