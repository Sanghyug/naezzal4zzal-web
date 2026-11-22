import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

// Development only: use the owner's existing Vercel login to reach a protected
// Preview API. The OpenAI key stays on Vercel and never enters browser code.
export function devVisionProxy(deployment: string | undefined): Plugin {
  return { name: "local-vision-preview", apply: "serve", configureServer(server) {
    if (!deployment || !/^https:\/\/naezzal4zzal-[a-z0-9]+-sanghyug-park-s-projects\.vercel\.app$/.test(deployment)) return;
    const cli = process.env.VERCEL_CLI_JS || join(process.env.APPDATA || "", "npm/node_modules/vercel/dist/vc.js");
    if (!existsSync(cli)) return;
    server.middlewares.use("/api/extract-cells", (req, res) => {
      if (req.method !== "POST") { res.statusCode=405;res.end();return; }
      const parts: Buffer[]=[];let size=0;
      req.on("data", (chunk:Buffer)=>{size+=chunk.length;if(size>4_000_000){res.statusCode=413;res.end();req.destroy();return;}parts.push(chunk);});
      req.on("end",()=>{
        const child=execFile(process.execPath,[cli,"curl","/api/extract-cells","--deployment",deployment,"--yes","--","--silent","--show-error","--max-time","35","--request","POST","--header","Content-Type: application/json","--data-binary","@-"], {cwd:process.cwd(),timeout:40000,maxBuffer:1024*1024}, (error, stdout)=>{
          res.setHeader("Content-Type","application/json");res.setHeader("Cache-Control","no-store");
          try { const result=JSON.parse(stdout.trim());res.statusCode=error||result.error?502:200;res.end(JSON.stringify(result)); }
          catch { res.statusCode=502;res.end(JSON.stringify({error:"Preview API unavailable"})); }
        });
        child.stdin?.end(Buffer.concat(parts));
      });
    });
  } };
}
