/// <reference types="node" />

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { image } = req.body;
    const promptText =
      "이 이미지는 인생네컷, 포토이즘, 포토부스처럼 네 장의 연속 사진이 들어 있는 이미지다. " +
      "너의 임무는 사진 컷 4개의 배열 형태만 판단하는 것이다. " +
      "좌표를 찾지 마라. 사람 얼굴을 찾지 마라. 사진을 자르지 마라. " +
      '네 컷이 세로로 위에서 아래로 배열되어 있으면 layout은 "1x4"다. ' +
      '네 컷이 왼쪽 위, 오른쪽 위, 왼쪽 아래, 오른쪽 아래 형태로 배열되어 있으면 layout은 "2x2"다. ' +
      '판단이 어렵거나 확실하지 않으면 "unknown"을 반환하라. ' +
      "반환은 JSON만 해라. 설명 문장, 마크다운, 코드블록은 절대 쓰지 마라. " +
      '형식은 {"layout":"1x4","strip":{"x":100,"y":100,"width":400,"height":1400}} 이다. ' +
      'layout이 unknown이면 {"layout":"unknown"} 만 반환하라.';
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "image is required" });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY is missing" });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: promptText,
              },

              {
                type: "input_image",
                image_url: image,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);
      return res
        .status(500)
        .json({ error: "OpenAI request failed", detail: data });
    }

    const outputText =
      data.output_text ||
      data.output?.[0]?.content?.find(
        (item: any) => item.type === "output_text",
      )?.text;

    if (!outputText || typeof outputText !== "string") {
      return res
        .status(500)
        .json({ error: "No output_text from OpenAI", detail: data });
    }

    const parsed = JSON.parse(cleanJsonText(outputText));

    const layout = parsed?.layout;
    const strip = parsed?.strip;

    if (layout !== "1x4" && layout !== "2x2" && layout !== "unknown") {
      return res.status(500).json({
        error: "Invalid layout",
        detail: parsed,
      });
    }

    if (layout === "unknown") {
      return res.status(200).json({
        layout,
      });
    }

    if (
      !strip ||
      typeof strip.x !== "number" ||
      typeof strip.y !== "number" ||
      typeof strip.width !== "number" ||
      typeof strip.height !== "number"
    ) {
      return res.status(500).json({
        error: "Invalid strip",
        detail: parsed,
      });
    }

    return res.status(200).json({
      layout,
      strip,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      error: "extract-cells failed",
      message: error?.message || String(error),
    });
  }
}

function cleanJsonText(text: string) {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}
