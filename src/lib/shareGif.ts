import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export async function shareGif(gifUrl: string, text: string): Promise<boolean> {
  const blob = await (await fetch(gifUrl)).blob();
  if (Capacitor.isNativePlatform()) {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(new Error("파일을 읽지 못했어요.")); reader.readAsDataURL(blob);
    });
    const path = "naezzal4zzal-" + crypto.randomUUID() + ".gif";
    const file = await Filesystem.writeFile({ path, data, directory: Directory.Cache });
    try { await Share.share({ title: "내짤4짤", text, files: [file.uri] }); }
    finally { await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {}); }
    return true;
  }
  const file = new File([blob], "naezzal4zzal.gif", { type: "image/gif" });
  if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "내짤4짤", text }); return true; }
  const link = document.createElement("a");
  link.href = gifUrl; link.download = "naezzal4zzal.gif"; document.body.appendChild(link); link.click(); link.remove();
  return false;
}
