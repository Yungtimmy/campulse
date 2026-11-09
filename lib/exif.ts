import sharp from "sharp";

const MAX_BYTES = 5 * 1024 * 1024;

export class PhotoError extends Error {}

/** Re-encode to JPEG so GPS and device metadata are not stored. */
export async function stripExif(input: Buffer): Promise<Buffer> {
  if (input.byteLength === 0) throw new PhotoError("Choose a photo or skip this step");
  if (input.byteLength > MAX_BYTES) throw new PhotoError("Photo must be 5 MB or smaller");
  try {
    return await sharp(input).rotate().jpeg({ quality: 85 }).toBuffer();
  } catch {
    throw new PhotoError("Use a JPG or PNG photo");
  }
}
