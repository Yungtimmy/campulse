import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { stripExif } from "./exif.ts";

describe("stripExif", () => {
  it("drops embedded metadata when the photo is re-encoded", async () => {
    const input = await sharp({
      create: { width: 12, height: 8, channels: 3, background: { r: 20, g: 40, b: 60 } },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: "device-secret" } } })
      .toBuffer();

    const cleaned = await stripExif(input);
    const meta = await sharp(cleaned).metadata();
    assert.equal(meta.exif, undefined);
    assert.equal(cleaned.includes(Buffer.from("device-secret")), false);
    assert.equal(meta.format, "jpeg");
  });
});
