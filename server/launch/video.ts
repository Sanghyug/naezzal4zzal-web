import { fetchOpenAI } from "./costs.ts";
import type { Meter } from "./costs.ts";
import { createHash } from "node:crypto";
import { imageSize } from "./dimensions.ts";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpeg from "ffmpeg-static";
import { requireRule } from "./domain.ts";
import type { Job } from "./domain.ts";
import { drawingPrompt } from "./prompts.ts";
import { relationshipScene } from "../../src/lib/relationshipScenes.ts";
export const ANALYSIS_VERSION = "gpt-5.4-motion-v1";
export const motionInstruction = `Four ordered photos 01 to 04 from one session. Track people with fixed IDs by hair/clothes, even if positions change. Record observations for all four frames; separate observed poses from inferred transitions. Distinguish screen and anatomical left/right. Never guess hidden hands, fingers, contact points or uncertain identity matches. Distinguish individual finger/two-hand hearts from shared hearts, and describe V signs and their positions. Plan 2-3 major changes in FIVE seconds with final key pose held about one second. Keep the first image's lanes, explicitly omit position swaps. Do not invent waves or shared hearts. The video model receives ONLY the first image, never refer to unseen photos in motion_prompt_en. Write a self-contained English motion prompt with subjects described by first-image clothing and positions. Other fields may be Korean. Arrays contain descriptive strings, observed_frames has four entries 01 through 04. Record uncertainties and omitted poses. Do not infer sensitive attributes or identities, and do not give success probabilities.`;
export function relationshipInstruction(sceneId: string, count: number, role: number) {
  const scene = relationshipScene(sceneId);
  requireRule(scene && count >= scene.min && count <= scene.max, "상황을 확인해주세요.");
  return `Create a fictional, wholesome interpersonal scene, not a reconstruction of actual events. Four ordered photos 01 to 04 are provided only to observe appearance and composition. The FIRST image is the only frame the video model receives. Expected visible people: ${count === 4 ? 'four or more' : count}, based on user selection; verify visually, never add or remove people to match that count. Use screen-left to screen-right positional IDs and clothing, never infer gender, age, identity, romantic relationship or real emotions. Keep exact appearance, clothing, background, positions and count. The selected action is: ${scene.action} For three-person role assignment, choose the person at zero-based left-to-right index ${role % count} as the distinct third person when the scene requires one. For other scenes choose reachable actors based on visible space. Start from original pose (0–1s), enact one clear action and reciprocal reaction (1–4s), hold the resulting expression (4–5s). Mutual eye contact and interaction take priority over camera-facing poses. Never create sexual, coercive, violent, humiliating or dangerous interactions. Keep contact light, voluntary and age-appropriate; if framing or actual count makes the selected action impossible, adapt to a harmless shared glance and smile, without inventing people or limbs. No cuts, no camera movement, no audio, no text. Write one self-contained English motion_prompt_en without references to unseen frames, and describe any adaptations in summary_ko and uncertainties. observed_frames must contain four entries. Other fields follow the JSON schema; arrays contain strings.`;
}
export const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export function validateImages(value: unknown): asserts value is string[] {
  requireRule(
    Array.isArray(value) && value.length === 4,
    "편집한 네 사진이 필요해요.",
  );
  for (const image of value) {
    requireRule(
      typeof image === "string" &&
        image.length < 850000 &&
        /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(image),
      "사진 파일을 확인해주세요.",
    );
    const bytes = Buffer.from(image.split(",")[1], "base64");
    requireRule(
      image.startsWith("data:image/png")
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes[0] === 255 && bytes[1] === 216,
      "사진 형식을 확인해주세요.",
    );
    const size = imageSize(bytes);
    requireRule(
      size.width <= 640 &&
        size.height <= 480 &&
        size.width >= 64 &&
        size.height >= 64,
      "사진은 640×480 이하로 준비해주세요.",
    );
  }
}
export function videoPayload(
  style: Job["style"],
  images: string[],
  motion?: string,
) {
  const refs = images.map((i) => ({
    type: "base64",
    media_type: i.slice(5, i.indexOf(";")),
    data: i.split(",")[1],
  }));
  const common = {
    model: "heygen-video-1",
    duration: 5,
    resolution: "480p",
    prompt_enhancement: "disabled",
  };
  if (style === "drawing")
    return {
      ...common,
      mode: "reference_to_video",
      aspect_ratio: "4:3",
      reference_images: refs,
      prompt: drawingPrompt,
    };
  requireRule(
    motion &&
      motion.length < 12000 &&
      !/(?:picture|photo|image)\s*0?[234]/i.test(motion),
    "동작 설명을 다시 확인해야 해요.",
    502,
  );
  return {
    ...common,
    mode: "image_to_video",
    image: refs[0],
    prompt:
      "One continuous FIVE-second photorealistic shot, locked camera. Preserve the exact faces, hair, clothing, background, person count and first-image left-to-right identities. Natural skin texture, no beautification, cuts, new people, captions, logos, watermark, dialogue or music. Silent. Only the described motions.\n\n" +
      motion,
  };
}
export type Analysis = {
  motion_prompt_en: string;
  characters: string[];
  observed_frames: string[];
  uncertainties: string[];
  motion_plan: string[];
  omitted_poses: string[];
  summary_ko: string;
};
export interface VideoProvider {
  kind: "mock" | "heygen";
  analyze(
    images: string[], sceneId?: string, personCount?: number,
  ): Promise<{ analysis: Analysis; model: string; usage: unknown }>;
  submit(job: Job, images: string[], motion?: string): Promise<string>;
  status(id: string): Promise<{ status: string; url?: string }>;
  mockFile?(): Promise<Buffer>;
}
export function heygenProvider(openai: string, heygen: string, record?: Meter): VideoProvider {
  async function api(url: string, body?: unknown, id?: string) {
    const r = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: {
        "x-api-key": heygen,
        "Content-Type": "application/json",
        ...(id ? { "Idempotency-Key": id } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(25000),
    });
    requireRule(r.ok, "영상 공급자 응답을 다시 확인할게요.", 502);
    const data = JSON.parse(await r.text());
    return data.data || data;
  }
  return {
    kind: "heygen",
    async analyze(images, sceneId, personCount) {
      const fields = [
        "characters",
        "observed_frames",
        "uncertainties",
        "motion_plan",
        "omitted_poses",
        "motion_prompt_en",
        "summary_ko",
      ];
      const properties = Object.fromEntries(
        fields.map((k) => [
          k,
          ["motion_prompt_en", "summary_ko"].includes(k)
            ? { type: "string" }
            : { type: "array", items: { type: "string" } },
        ]),
      );
      const r = await fetchOpenAI(record,"motion","https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + openai,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.4",
          store: false,
          max_output_tokens: 3200,
          reasoning: { effort: "low" },
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: sceneId ? relationshipInstruction(sceneId, personCount || 0, parseInt(sha(images[0]).slice(0, 8), 16)) : motionInstruction },
                ...images.map((image_url) => ({
                  type: "input_image",
                  image_url,
                  detail: "high",
                })),
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "motion_analysis",
              strict: true,
              schema: {
                type: "object",
                properties,
                required: fields,
                additionalProperties: false,
              },
            },
          },
        }),
        signal: AbortSignal.timeout(45000),
      });
      requireRule(r.ok, "동작 분석 응답 확인이 필요해요.", 502);
      const d = JSON.parse(await r.text());
      requireRule(
        d.status === "completed",
        "동작 분석이 완료되지 않았어요.",
        502,
      );
      const text =
        d.output_text ||
        d.output
          ?.flatMap(
            (x: { content?: { type: string; text?: string }[] }) =>
              x.content || [],
          )
          .find((x: { type: string }) => x.type === "output_text")?.text;
      const analysis = JSON.parse(text) as Analysis;
      requireRule(
        analysis.observed_frames?.length === 4 &&
          typeof analysis.motion_prompt_en === "string",
        "동작 분석 형식을 확인해야 해요.",
        502,
      );
      videoPayload("memory", images, analysis.motion_prompt_en);
      return { analysis, model: d.model, usage: d.usage };
    },
    async submit(job, images, motion) {
      const d = await api(
        "https://api.heygen.com/v3/models/videos",
        videoPayload(job.style, images, motion),
        "launch-" + job.id,
      );
      requireRule(
        typeof d.video_id === "string",
        "제작 접수 확인이 필요해요.",
        502,
      );
      return d.video_id;
    },
    async status(id) {
      const d = await api(
        "https://api.heygen.com/v3/models/videos/" + encodeURIComponent(id),
      );
      return { status: d.status, url: d.video_url };
    },
  };
}
let mockBytes: Promise<Buffer> | undefined;
export function mockVideoProvider(): VideoProvider {
  return {
    kind: "mock",
    async analyze() {
      return {
        analysis: {
          characters: ["모의 인물"],
          observed_frames: ["01", "02", "03", "04"],
          uncertainties: ["모의 분석"],
          motion_plan: ["모의 연결"],
          omitted_poses: [],
          motion_prompt_en:
            "Keep the first-image people in place, gently move between the observed poses and end in individual hearts.",
          summary_ko: "모의 분석",
        },
        model: "mock",
        usage: null,
      };
    },
    async submit(j) {
      return "mock-" + j.id;
    },
    async status() {
      return { status: "completed" };
    },
    mockFile() {
      if (!mockBytes)
        mockBytes = (async () => {
          requireRule(ffmpeg, "모의 영상 준비 중이에요.");
          const dir = await mkdtemp(join(tmpdir(), "nz-mock-"));
          try {
            const out = join(dir, "mock.mp4");
            await promisify(execFile)(
              ffmpeg,
              [
                "-nostdin",
                "-v",
                "error",
                "-f",
                "lavfi",
                "-i",
                "testsrc2=size=640x480:rate=24",
                "-t",
                "5",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-an",
                out,
              ],
              { timeout: 20000 },
            );
            const bytes = await readFile(out);
            await writeFile(join(dir, "checked.bin"), bytes);
            return bytes;
          } finally {
            await rm(dir, { recursive: true, force: true });
          }
        })();
      return mockBytes;
    },
  };
}
