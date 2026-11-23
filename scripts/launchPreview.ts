import type { Plugin } from "vite";
export function launchPreview(enabled: boolean): Plugin {
  return {
    name: "local-launch-preview",
    apply: "serve",
    configureServer(server) {
      if (!enabled) return;
      process.env.LAUNCH_DEMO = "1";
      server.middlewares.use("/api/extract-cells", (_req, res) => {
        res.statusCode = 503;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error:
              "미리보기에서는 실제 AI 사진 분석을 호출하지 않아요. 직접 맞추기로 계속해주세요.",
          }),
        );
      });
      server.middlewares.use("/api/launch", async (req, res) => {
        const parts: Buffer[] = [];
        let size = 0;
        try {
          for await (const chunk of req) {
            const b = Buffer.from(chunk);
            size += b.length;
            if (size > 3900000) {
              res.statusCode = 413;
              res.end(JSON.stringify({ error: "자료가 너무 커요." }));
              return;
            }
            parts.push(b);
          }
          const { default: handler } = await import("../api/launch.ts");
          const url = new URL(req.url || "/", "http://127.0.0.1");
          const body = parts.length
            ? JSON.parse(Buffer.concat(parts).toString())
            : undefined;
          res.setHeader("Content-Type", "application/json");
          const response = {
            setHeader: (k: string, v: string | string[]) => res.setHeader(k, v),
            status: (code: number) => {
              res.statusCode = code;
              return response;
            },
            json: (value: unknown) => res.end(JSON.stringify(value)),
            end: (value?: Buffer) => res.end(value),
          };
          await handler(
            {
              method: req.method,
              headers: req.headers,
              query: Object.fromEntries(url.searchParams),
              body,
            },
            response,
          );
        } catch {
          res.statusCode = 503;
          res.end(
            JSON.stringify({ error: "미리보기 연결을 다시 확인해주세요." }),
          );
        }
      });
    },
  };
}
