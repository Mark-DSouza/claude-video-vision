import { describe, it, expect, afterEach } from "vitest";
import {
  extractFrames,
  getVideoMetadata,
  calculateAutoFps,
  frameFormatExtension,
  frameFormatMimeType,
} from "../../src/extractors/frames.js";
import { join } from "path";
import { rmSync, existsSync, readdirSync } from "fs";
import { tmpdir } from "os";

const FIXTURE = join(import.meta.dirname, "../fixtures/test-3s.mp4");
const LONG_FIXTURE = join(import.meta.dirname, "../fixtures/test-12s.mp4");
const OUT_DIR = join(tmpdir(), "cvv-frames-test-" + Date.now());

describe("frame extraction", () => {
  afterEach(() => {
    if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  });

  describe("getVideoMetadata", () => {
    it("returns correct metadata for test video", async () => {
      const meta = await getVideoMetadata(FIXTURE);
      expect(meta.has_audio).toBe(true);
      expect(meta.duration_seconds).toBeCloseTo(3, 0);
      expect(meta.width).toBe(320);
      expect(meta.height).toBe(240);
      expect(meta.codec).toContain("h264");
    });
  });

  describe("calculateAutoFps", () => {
    it("returns 2 for videos under 1 minute", () => {
      expect(calculateAutoFps(30)).toBe(2);
    });

    it("returns 1 for videos 1-5 minutes", () => {
      expect(calculateAutoFps(120)).toBe(1);
    });

    it("returns 0.5 for videos 5-15 minutes", () => {
      expect(calculateAutoFps(600)).toBe(0.5);
    });

    it("returns 0.2 for videos 15-60 minutes", () => {
      expect(calculateAutoFps(1800)).toBe(0.2);
    });

    it("returns 0.1 for videos over 60 minutes", () => {
      expect(calculateAutoFps(7200)).toBe(0.1);
    });
  });

  describe("frame format helpers", () => {
    it("maps frame formats to file extensions", () => {
      expect(frameFormatExtension("jpeg")).toBe("jpg");
      expect(frameFormatExtension("png")).toBe("png");
      expect(frameFormatExtension("webp")).toBe("webp");
    });

    it("maps frame formats to mime types", () => {
      expect(frameFormatMimeType("jpeg")).toBe("image/jpeg");
      expect(frameFormatMimeType("png")).toBe("image/png");
      expect(frameFormatMimeType("webp")).toBe("image/webp");
    });
  });

  describe("extractFrames", () => {
    it("extracts frames as base64 images with timestamps", async () => {
      const result = await extractFrames(FIXTURE, {
        fps: 1,
        resolution: 256,
        outputDir: OUT_DIR,
      });
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0].timestamp).toBeDefined();
      expect(result[0].image).toBeDefined();
      expect(result[0].image!.length).toBeGreaterThan(100); // base64 data
      expect(result[0].format).toBe("jpeg");
    });

    it("supports extracting frames as PNG", async () => {
      const result = await extractFrames(FIXTURE, {
        fps: 1,
        resolution: 256,
        outputDir: OUT_DIR,
        format: "png",
      });
      const files = readdirSync(OUT_DIR);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0].format).toBe("png");
      expect(files.some((file) => file.endsWith(".png"))).toBe(true);
    });

    // Regression test for a bug where -to (an output option) was applied
    // against the rebased post-seek clock rather than the original timeline
    // whenever -ss (an input option) was also set. A nonzero startTime with
    // an endTime well before the file's actual end reproduced it: the
    // extraction ran for (endTime's raw seconds value) seconds *from the
    // seek point* instead of stopping at endTime, silently pulling in far
    // more of the video than requested (all the way to the max_frames
    // ceiling for long videos). Every pre-existing test in this file used
    // startTime 0 (or omitted it), where the bug is invisible, which is how
    // it shipped undetected.
    it("bounds extraction to (endTime - startTime), not endTime's raw value", async () => {
      // 12s fixture, window [4s, 7s) at 2fps => exactly 6 frames expected.
      // The bug would instead run ~7s from the seek point (to ~11s),
      // yielding roughly double the frames.
      const result = await extractFrames(LONG_FIXTURE, {
        fps: 2,
        resolution: 256,
        outputDir: OUT_DIR,
        startTime: "00:00:04",
        endTime: "00:00:07",
      });
      expect(result.length).toBe(6);
    });
  });
});
