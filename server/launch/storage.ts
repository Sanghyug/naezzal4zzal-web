import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
export interface Storage {
  put(bucket: string, key: string, bytes: Buffer, type: string): Promise<void>;
  get(bucket: string, key: string): Promise<Buffer>;
  remove(bucket: string, key: string): Promise<void>;
}
export function localStorage(root: string): Storage {
  const file = (bucket: string, key: string) => {
    const p = resolve(root, bucket, key);
    if (!p.startsWith(resolve(root) + requireSeparator()))
      throw new Error("Invalid storage path");
    return p;
  };
  return {
    async put(b, k, bytes) {
      const p = file(b, k);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, bytes);
    },
    async get(b, k) {
      return readFile(file(b, k));
    },
    async remove(b, k) {
      await rm(file(b, k), { force: true });
    },
  };
}
function requireSeparator() {
  return process.platform === "win32" ? "\\" : "/";
}
export function supabaseStorage(url: string, key: string): Storage {
  const c = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async put(b, k, bytes, type) {
      const { error } = await c.storage
        .from(b)
        .upload(k, bytes, { contentType: type, upsert: true });
      if (error) throw new Error("Private storage write failed");
    },
    async get(b, k) {
      const { data, error } = await c.storage.from(b).download(k);
      if (error || !data) throw new Error("Private storage read failed");
      return Buffer.from(await data.arrayBuffer());
    },
    async remove(b, k) {
      const { error } = await c.storage.from(b).remove([k]);
      if (error) throw new Error("Private storage delete failed");
    },
  };
}
