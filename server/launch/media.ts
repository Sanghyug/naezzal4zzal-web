import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";
import { parseGIF, decompressFrames } from "gifuct-js";
import { requireRule } from "./domain.ts";
import { createHash } from "node:crypto";
export function validateGif(bytes: Buffer) {
  requireRule(
    bytes.length >= 100 && bytes.length <= 1500000,
    "GIF는 1.5MB 이하로 확인할 수 있어요.",
  );
  requireRule(
    /^GIF8[79]a/.test(bytes.toString("ascii", 0, 6)),
    "GIF 파일이 아니에요.",
  );
  const parsed = parseGIF(Uint8Array.from(bytes).buffer);
  requireRule(
    parsed.lsd.width >= 64 &&
      parsed.lsd.height >= 64 &&
      parsed.lsd.width <= 800 &&
      parsed.lsd.height <= 1000,
    "GIF 크기를 확인해주세요.",
  );
  const count = parsed.frames.filter((f) => "image" in f).length;
  requireRule(
    count >= 4 && count <= 80,
    "네 컷이 담긴 움직이는 GIF가 필요해요.",
  );
  for (const f of parsed.frames)
    if ("image" in f) {
      const d = f.image.descriptor;
      requireRule(
        d.width > 0 &&
          d.height > 0 &&
          d.width <= parsed.lsd.width &&
          d.height <= parsed.lsd.height &&
          d.left + d.width <= parsed.lsd.width &&
          d.top + d.height <= parsed.lsd.height,
        "GIF 프레임 크기를 확인해주세요.",
      );
    }
  requireRule(
    count * parsed.lsd.width * parsed.lsd.height <= 40000000,
    "GIF의 전체 크기가 너무 커요.",
  );
  const frames = decompressFrames(parsed, false);
  requireRule(
    frames.length === count &&
      frames.every((f) => f.pixels.length === f.dims.width * f.dims.height),
    "GIF를 읽지 못했어요.",
  );
  const hashes = new Set(
    frames.map((f) =>
      createHash("sha256").update(Uint8Array.from(f.pixels)).digest("hex"),
    ),
  );
  requireRule(hashes.size >= 2, "움직임이 있는 GIF가 필요해요.");
  return { frames: count, width: parsed.lsd.width, height: parsed.lsd.height };
}
export async function removeAudio(bytes: Buffer) {
  requireRule(
    bytes.length > 100 && bytes.length <= 12000000,
    "영상 파일 크기를 확인해주세요.",
  );
  requireRule(ffmpeg, "영상 후처리를 준비하고 있어요.", 503);
  const dir = await mkdtemp(join(tmpdir(), "naezzal-"));
  try {
    const input = join(dir, "input.mp4"),
      output = join(dir, "silent.mp4");
    await writeFile(input, bytes);
    await promisify(execFile)(
      ffmpeg,
      [
        "-nostdin",
        "-v",
        "error",
        "-i",
        input,
        "-map",
        "0:v:0",
        "-c:v",
        "copy",
        "-an",
        "-movflags",
        "+faststart",
        output,
      ],
      { timeout: 30000, maxBuffer: 500000 },
    );
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
export async function limitedDownload(url: string, limit = 12000000) {
  const u = new URL(url);
  requireRule(
    u.protocol === "https:" && !u.username && !u.password,
    "영상 주소를 확인해주세요.",
  );
  // Only links returned by our authenticated provider status call reach here.
  const r = await fetch(u, {
    redirect: "error",
    signal: AbortSignal.timeout(25000),
  });
  requireRule(
    r.ok && r.headers.get("content-type")?.startsWith("video/"),
    "영상 다운로드를 다시 확인할게요.",
    502,
  );
  requireRule(
    Number(r.headers.get("content-length") || 0) <= limit,
    "영상이 너무 커요.",
    502,
  );
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = r.body!.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      requireRule(size <= limit, "영상이 너무 커요.", 502);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks);
}
// Authenticated Preview-only deployment check: synthetic media, no user photos or AI.
export async function mediaSmoke() {
  requireRule(ffmpeg, "영상 후처리 프로그램이 없어요.", 503);
  const dir = await mkdtemp(join(tmpdir(), "nz-smoke-"));
  try {
    const input = join(dir, "with-audio.mp4"),
      output = join(dir, "without-audio.mp4");
    await promisify(execFile)(
      ffmpeg,
      [
        "-nostdin",
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=pink:s=160x120:r=24",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:sample_rate=32000",
        "-t",
        "1",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        input,
      ],
      { timeout: 20000 },
    );
    await writeFile(output, await removeAudio(await readFile(input)));
    let info = "";
    try {
      const r = await promisify(execFile)(
        ffmpeg,
        ["-hide_banner", "-i", output, "-f", "null", "-"],
        { timeout: 20000 },
      );
      info = r.stderr;
    } catch {
      throw new Error("Media probe failed");
    }
    return {
      platform: process.platform,
      videoPresent: /Video:/.test(info),
      audioRemoved: !/Audio:/.test(info),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
