import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export type ShareResult = "shared" | "downloaded" | "unconfirmed";
export async function shareMediaFile(file: File, text: string): Promise<ShareResult> {
  if (Capacitor.isNativePlatform()) {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(new Error("파일을 읽지 못했어요.")); reader.readAsDataURL(file);
    });
    const path = "naezzal4zzal-" + crypto.randomUUID() + (file.type === "video/mp4" ? ".mp4" : ".gif");
    const saved = await Filesystem.writeFile({ path, data, directory: Directory.Cache });
    // Keep the cache file available while the receiving app imports it.
    const result = await Share.share({ title: "내짤4짤", text, files: [saved.uri] });
    return result.activityType ? "shared" : "unconfirmed";
  }
  const fileData = { files: [file] };
  const fullData = { ...fileData, title: "내짤4짤", ...(text ? { text } : {}) };
  if (navigator.share && navigator.canShare?.(fileData)) {
    await navigator.share(navigator.canShare(fullData) ? fullData : fileData);
    return "shared";
  }
  downloadMediaFile(file);
  return "downloaded";
}
export function downloadMediaFile(file: File) {
  const url = URL.createObjectURL(file), link = document.createElement("a");
  link.href = url; link.download = file.name; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function saveMediaFile(file: File) {
  if (Capacitor.isNativePlatform()) { await shareMediaFile(file, "‘파일에 저장’ 또는 저장할 앱을 선택해주세요."); return; }
  downloadMediaFile(file);
}
