// Bounded header reader for the PNG/JPEG formats accepted by the video API.
// No decompression and no filesystem access; rejects unknown/malformed headers.
export function imageSize(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  if (
    b.length >= 24 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length > 4 && b[0] === 255 && b[1] === 216) {
    let p = 2;
    for (let n = 0; n < 1024 && p + 4 <= b.length; n++) {
      if (b[p] !== 255) throw new Error("Invalid JPEG marker");
      while (p < b.length && b[p] === 255) p++;
      const marker = b[p++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (p + 2 > b.length) break;
      const length = b.readUInt16BE(p);
      if (length < 2 || p + length > b.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker)
      ) {
        if (length < 7) break;
        return { height: b.readUInt16BE(p + 3), width: b.readUInt16BE(p + 5) };
      }
      p += length;
    }
  }
  throw new Error("Invalid or unsupported image dimensions");
}
