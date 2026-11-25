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
  const { account, config, authenticated, ready: authReady } = useLaunch();
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
        if (["failed", "review", "unavailable"].includes(next.status)) {
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
    if (!["failed", "review", "unavailable"].includes(jobStatus || "") && !url) void check();
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
    <section className="nz-video nz-video-editor" aria-label="AI 영상 제작">
      <button className="nz-make-button nz-video-toggle" disabled={!ready} aria-expanded={open} onClick={onToggle}>
        AI 영상 만들기 <span className="nz-video-chevron" aria-hidden="true" />
      </button>
      {open && (
        <>
          {!job && (
            <>
              <fieldset className="nz-video-styles" disabled={busy}>
                <legend>어떤 영상으로 남길까요?</legend>
                {([["memory", "실사 영상", "사진 그대로 생생하게", 1], ["drawing", "애니메이션", "그림처럼 특별하게", 3]] as const).map(([value, label, description, credits]) => (
                  <button key={value} className={`nz-style-card nz-style-${value}`} type="button" aria-pressed={style === value} onClick={() => {
                    setStyle(value);
                    sessionStorage.setItem("nz-video-style", value);
                    setConsent(false);
                  }}><span className="nz-style-art" aria-hidden="true" /><strong>{label}</strong><small>{description}</small><span className="nz-style-cost">{credits} 크레딧</span></button>
                ))}
              </fieldset>
              <div className="nz-video-guidance">
                <p>사진 속 인물의 동의를 받고 제작해 주세요.</p>
                <p>완성 영상은 {config?.retentionDays || 7}일간 보관돼요.</p>
                <details><summary>이용 안내</summary><p>5초 무음 MP4(480p)로 만들어요. 얼굴과 동작이 원본과 다를 수 있어요. 제작 실패가 확인되면 예약 크레딧을 돌려드려요.</p></details>
              </div>
              {!authReady ? <p role="status">로그인을 확인하고 있어요.</p> : !account && authenticated ? (
                <button onClick={() => void refreshAccount().catch(() => setMessage("계정 정보를 다시 불러오지 못했어요."))}>계정 정보 다시 불러오기</button>
              ) : !account ? (
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
                  {!config?.generation && <p role="status">AI 영상 제작을 준비하고 있어요.</p>}
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
                      : `${cost}크레딧으로 ${style === "memory" ? "실사" : "애니메이션"} 영상 제작`}
                  </button>

                </>
              )}
            </>
          )}
          {job && (
            <>
              <p role="status">
                {job.status === "unavailable"
                  ? "저장할 수 있는 영상이 없어요."
                  : job.status === "completed"
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
                          style === "drawing" ? "애니메이션 영상" : "실사 영상",
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
              {["completed", "failed", "unavailable"].includes(job.status) && (
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
