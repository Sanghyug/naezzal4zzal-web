import { useEffect, useRef, useState } from "react";
import { launchApi, refreshAccount, useLaunch, videoFile } from "../lib/launch";
import type { LaunchJob } from "../lib/launch";
import { LoginPrompt } from "./LaunchAccount";
import { loadImage } from "../lib/loadImage";
import { saveGalleryItem } from "../lib/galleryStore";
import ShareControls from "./ShareControls";
export default function CreditVideoStudio({
  ready,
  getImages,
  memo,
  open,
  onToggle,
}: {
  ready: boolean;
  getImages: () => Promise<string[]>;
  memo: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { account, config } = useLaunch();
  const [style, setStyle] = useState<"memory" | "drawing">(() =>
      sessionStorage.getItem("nz-video-style") === "drawing"
        ? "drawing"
        : "memory",
    ),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [localJob, setJob] = useState<LaunchJob | null>(null),
    [selectedId, setSelectedId] = useState(
      () => sessionStorage.getItem("nz-credit-job") || "",
    ),
    [url, setUrl] = useState(""),
    [saved, setSaved] = useState(false);
  const lock = useRef(false),
    fileUrl = useRef("");
  const cost = style === "drawing" ? 3 : 1;
  const job = account?.jobs.find((j) => j.id === selectedId) || localJob;
  const jobId = job?.id,
    jobStatus = job?.status,
    userId = account?.user.id;
  useEffect(
    () => () => {
      if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
    },
    [],
  );
  useEffect(() => {
    if (!open || !jobId || !userId) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    let running = false;
    const id = jobId;
    const check = async () => {
      if (running) return;
      running = true;
      try {
        const next = await launchApi<LaunchJob>("work", { jobId: id });
        if (stopped) return;
        setJob(next);
        if (next.status === "completed" && next.downloadable) {
          if (!fileUrl.current) {
            const blob = await videoFile(id);
            if (stopped) return;
            fileUrl.current = URL.createObjectURL(blob);
            setUrl(fileUrl.current);
          }
          await refreshAccount();
          return;
        }
        if (["failed", "review"].includes(next.status)) {
          await refreshAccount();
          return;
        }
      } catch (e) {
        if (!stopped)
          setMessage(
            e instanceof Error
              ? e.message
              : "같은 제작 상태를 확인하고 있어요.",
          );
      } finally {
        running = false;
      }
      if (!stopped) timer = setTimeout(() => void check(), 6000);
    };
    if (!["failed", "review"].includes(jobStatus || "") && !url) void check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [open, jobId, userId, jobStatus, url]);
  async function start() {
    if (lock.current || !account || !consent) return;
    lock.current = true;
    setBusy(true);
    setMessage("사진을 준비하고 있어요.");
    try {
      const cuts = await getImages();
      const images = await Promise.all(
        cuts.map(async (cut) => {
          const im = await loadImage(cut),
            c = document.createElement("canvas");
          c.width = 640;
          c.height = 480;
          const x = c.getContext("2d")!;
          x.fillStyle = "#e8e8e8";
          x.fillRect(0, 0, 640, 480);
          const scale = Math.min(640 / im.width, 480 / im.height);
          x.drawImage(
            im,
            (640 - im.width * scale) / 2,
            (480 - im.height * scale) / 2,
            im.width * scale,
            im.height * scale,
          );
          return c.toDataURL("image/jpeg", 0.88);
        }),
      );
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(style + "|" + images.join("|")),
      );
      const fp = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      let key: string;
      const old = JSON.parse(
        sessionStorage.getItem("nz-credit-request") || "null",
      ) as { fp: string; key: string } | null;
      if (old?.fp === fp) key = old.key;
      else {
        key = crypto.randomUUID();
        sessionStorage.setItem(
          "nz-credit-request",
          JSON.stringify({ fp, key }),
        );
      }
      const j = await launchApi<LaunchJob>("generate", {
        requestKey: key,
        style,
        images,
        consent: true,
      });
      sessionStorage.setItem("nz-credit-job", j.id);
      setSelectedId(j.id);
      setJob(j);
      setSaved(false);
      setMessage("제작을 접수했어요.");
      await refreshAccount();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "제작 요청을 다시 확인해주세요.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="nz-video" aria-label="AI 영상 제작">
      <button disabled={!ready} onClick={onToggle}>
        🎬 AI 영상 만들기
      </button>
      {open && (
        <>
          <h3>네 컷이 살아나는 5초 영상</h3>
          <p>스마트폰 감상용 480p · 무음 MP4</p>
          {config?.videoMode === "mock" && (
            <p>
              <strong>
                미리보기: 사진을 외부 AI로 보내지 않고 모의 영상으로 흐름을
                확인해요.
              </strong>
            </p>
          )}
          {!job && (
            <>
              <fieldset disabled={busy}>
                <legend>어떤 추억으로 남길까요?</legend>
                <label>
                  <input
                    type="radio"
                    name="credit-style"
                    checked={style === "memory"}
                    onChange={() => {
                      setStyle("memory");
                      sessionStorage.setItem("nz-video-style", "memory");
                      setConsent(false);
                    }}
                  />{" "}
                  실사 영상 · 1크레딧
                </label>
                <label>
                  <input
                    type="radio"
                    name="credit-style"
                    checked={style === "drawing"}
                    onChange={() => {
                      setStyle("drawing");
                      sessionStorage.setItem("nz-video-style", "drawing");
                      setConsent(false);
                    }}
                  />{" "}
                  펜화 영상 · 3크레딧
                </label>
              </fieldset>
              <p>
                {style === "memory"
                  ? "네 컷의 포즈를 분석하고 첫 사진을 움직여요."
                  : "네 사진을 참고해 가는 펜선과 옅은 수채색의 그림으로 움직여요."}{" "}
                얼굴·손·동작이 원본과 다를 수 있어요.
              </p>
              {!account ? (
                <LoginPrompt />
              ) : (
                <>
                  <p>
                    사용 가능 {account.balance.available}크레딧 · 제작 후{" "}
                    {Math.max(0, account.balance.available - cost)}크레딧
                    {account.balance.available < cost && (
                      <>
                        <br /> {cost - account.balance.available}크레딧이
                        부족해요. 위 ‘내 크레딧’에서 충전해주세요.
                      </>
                    )}
                  </p>
                  <label className="nz-consent">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    <span>
                      사진 속 인물의 허락을 받았어요.{" "}
                      {style === "memory"
                        ? "네 사진을 OpenAI에 보내 동작을 분석하고, 첫 사진과 설명을 HeyGen에 보내"
                        : "네 사진을 HeyGen에 보내"}{" "}
                      영상을 만드는 데 동의해요. 서비스 서버의 입력은 최대
                      24시간, 결과는 {config?.retentionDays || 7}일 보관해요.
                      제공업체에도 자료가 남을 수 있어요.
                    </span>
                  </label>
                  <button
                    disabled={
                      busy ||
                      !ready ||
                      !consent ||
                      account.balance.available < cost ||
                      !config?.generation
                    }
                    onClick={() => void start()}
                  >
                    {busy
                      ? "같은 제작 접수 확인 중…"
                      : `${cost}크레딧으로 ${style === "memory" ? "실사" : "펜화"} 영상 제작`}
                  </button>
                  <p>
                    기술 실패가 확정되면 예약분을 한 번 복구해요. 사진·손 모양의
                    품질 불만은 문의로 확인하며 무제한 재제작은 제공하지 않아요.
                  </p>
                </>
              )}
            </>
          )}
          {job && (
            <>
              <p role="status">
                {job.status === "completed"
                  ? "영상이 완성됐어요."
                  : job.status === "failed"
                    ? "제작 실패가 확인되어 예약 크레딧을 복구했어요."
                    : job.status === "review"
                      ? "운영자가 접수 상태를 확인하고 있어요. 새 제작을 누르지 마세요."
                      : "영상을 만들고 있어요. 화면을 닫아도 내 크레딧의 제작 내역에서 이어서 확인할 수 있어요."}
              </p>
              {job.error && <p>{job.error}</p>}
              {url && (
                <>
                  <video
                    src={url}
                    controls
                    playsInline
                    aria-label="완성된 AI 영상"
                  />
                  <ShareControls
                    url={url}
                    text={memo || "내짤4짤의 움직이는 추억"}
                    video
                  />
                  <button
                    disabled={saved}
                    onClick={async () => {
                      try {
                        const item = await saveGalleryItem(
                          url,
                          memo,
                          style === "drawing" ? "펜화 영상" : "실사 영상",
                          "video",
                        );
                        URL.revokeObjectURL(item.gifUrl);
                        setSaved(true);
                      } catch (e) {
                        setMessage(
                          e instanceof Error
                            ? e.message
                            : "보관함 저장을 확인해주세요.",
                        );
                      }
                    }}
                  >
                    {saved ? "보관함 저장 완료" : "이 기기 보관함에 저장"}
                  </button>
                  <p>
                    서비스 보관 기간 {config?.retentionDays || 7}일 · 같은
                    완성본 다시 저장은 무료예요.
                  </p>
                </>
              )}
              {["completed", "failed"].includes(job.status) && (
                <button
                  onClick={() => {
                    sessionStorage.removeItem("nz-credit-job");
                    sessionStorage.removeItem("nz-credit-request");
                    if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
                    fileUrl.current = "";
                    setUrl("");
                    setSelectedId("");
                    setJob(null);
                    setConsent(false);
                  }}
                >
                  새 영상 선택 · 별도 크레딧 사용
                </button>
              )}
            </>
          )}
          {message && <p role="status">{message}</p>}
        </>
      )}
    </section>
  );
}
