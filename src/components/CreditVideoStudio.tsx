import VideoGallerySave from "./VideoGallerySave";
import { useEffect, useRef, useState } from "react";
import { isVideoInProgress, launchApi, refreshAccount, useLaunch, videoFile } from "../lib/launch";
import type { LaunchJob } from "../lib/launch";
import { LoginPrompt } from "./LaunchAccount";
import { loadImage } from "../lib/loadImage";
import ShareControls from "./ShareControls";
import { scenesForCount, relationshipScene } from "../lib/relationshipScenes";
export default function CreditVideoStudio({
  ready,
  personCount: detectedCount = 0,
  workId,
  memo,
  getImages,
  open,
  onToggle,
}: {
  ready: boolean;
  personCount?: number;
  workId: string;
  getImages: () => Promise<string[]>;
  memo: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { account, config, authenticated, ready: authReady } = useLaunch();
  const scope = `${account?.user.id || "guest"}:${workId}`;
  const jobKey = `nz-credit-job:${scope}`;
  const requestKey = `nz-credit-request:${scope}`;
  const styleKey = `nz-video-style:${workId}`;
  const [style, setStyle] = useState<"memory" | "drawing">(() =>
      sessionStorage.getItem(styleKey) === "drawing"
        ? "drawing"
        : "memory",
    ),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [localJob, setJob] = useState<LaunchJob | null>(null),
    [selectedId, setSelectedId] = useState(
      () => sessionStorage.getItem(jobKey) || "",
    ),
    [url, setUrl] = useState("");
  const sceneKey = `nz-video-scene:${workId}`;
  const personCount = detectedCount;
  const [sceneId, setSceneId] = useState(() => sessionStorage.getItem(sceneKey) || "");
  const chosenScene = relationshipScene(sceneId);
  const activeScene = style === "memory" && chosenScene && scenesForCount(personCount).some(item=>item.id===chosenScene.id) ? chosenScene : undefined;
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [retryFile, setRetryFile] = useState(0);
  const lock = useRef(false),
    fileUrl = useRef("");
  const section = useRef<HTMLElement>(null);
  const cost = style === "drawing" ? 3 : 1;
  const trackedId = selectedId;
  const job = localJob?.id === trackedId ? localJob : account?.jobs.find((j) => j.id === trackedId);
  const inProgress = Boolean(job && isVideoInProgress(job));
  const shouldWork = Boolean(inProgress || (job?.status === "completed" && job.downloadable && !url));
  const keepAwake = busy || inProgress || Boolean(job?.status === "completed" && job.downloadable && !mediaReady);
  useEffect(() => {
    if (!keepAwake) return;
    let stopped = false;
    let sentinel: { release: () => Promise<void>; released: boolean } | undefined;
    let requesting = false;
    const acquire = async () => {
      if(stopped || requesting || document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
      const wake = (navigator as Navigator & {wakeLock?: {request:(kind:"screen")=>Promise<{release:()=>Promise<void>;released:boolean}>}}).wakeLock;
      if(!wake) return;
      requesting = true;
      try {const next=await wake.request("screen"); if(stopped) await next.release(); else sentinel=next;} catch { /* unsupported, denied or low battery */ } finally {requesting=false;}
    };
    void acquire(); document.addEventListener("visibilitychange",acquire);
    return ()=>{stopped=true;document.removeEventListener("visibilitychange",acquire);void sentinel?.release().catch(()=>{});};
  },[keepAwake]);
  const jobId = job?.id,
    userId = account?.user.id;
  useEffect(
    () => () => {
      if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
    },
    [],
  );
  useEffect(() => {
    if (!shouldWork || !jobId || !userId) return;
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
        setMessage("");
        setSelectedId(next.id);
        setJob(next);
        if (next.status === "completed") {
          if (!next.downloadable) return;
          if (!fileUrl.current) {
            const blob = await videoFile(id);
            if (stopped) return;
            fileUrl.current = URL.createObjectURL(blob);
            setUrl(fileUrl.current);
            setMessage("");
          }
          await refreshAccount();
          return;
        }
        if (["failed", "review", "unavailable"].includes(next.status)) {
          await refreshAccount();
          return;
        }
      } catch {
        if (!stopped) setMessage("연결 상태를 다시 확인하고 있어요. 새 제작 없이 같은 영상을 확인합니다.");
      } finally {
        running = false;
      }
      if (!stopped) timer = setTimeout(() => void check(), 6000);
    };
    const resume = () => {if(document.visibilityState === "visible"){clearTimeout(timer);void check();}};
    void check(); document.addEventListener("visibilitychange",resume); window.addEventListener("online",resume); window.addEventListener("pageshow",resume);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange",resume);window.removeEventListener("online",resume);window.removeEventListener("pageshow",resume);
      clearTimeout(timer);
    };
  }, [jobId, userId, shouldWork, retryFile]);
  useEffect(() => {
    if (!jobId || !userId || !inProgress) return;
    let active = true;
    const timer = window.setInterval(() => {
      void launchApi<LaunchJob>("jobStatus", { jobId }).then(next => {
        if (active) setJob(current => current?.id === next.id && ["completed", "failed", "review", "unavailable"].includes(current.status) ? current : next);
      }).catch(() => {});
    }, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [jobId, userId, inProgress]);
  async function start() {
    if (lock.current || !account || !consent) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    section.current?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
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
        new TextEncoder().encode(style + "|" + (activeScene ? activeScene.id + "|" + personCount + "|" : "") + images.join("|")),
      );
      const fp = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      let key: string;
      const old = JSON.parse(
        sessionStorage.getItem(requestKey) || "null",
      ) as { fp: string; key: string } | null;
      if (old?.fp === fp) key = old.key;
      else {
        key = crypto.randomUUID();
        sessionStorage.setItem(
          requestKey,
          JSON.stringify({ fp, key }),
        );
      }
      const j = await launchApi<LaunchJob>("generate", {
        requestKey: key,
        style,
        ...(activeScene ? { scene: activeScene.id, personCount } : {}),
        images,
        consent: true,
      });
      sessionStorage.setItem(jobKey, j.id);
      setSelectedId(j.id);
      setJob(j);
      void refreshAccount().catch(() => {});
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
    <section ref={section} className="nz-video nz-video-editor" aria-label="AI 영상 제작">
      <header className="nz-production-heading"><span aria-hidden="true">▶</span><div><h3>살아 움직이는 AI 영상</h3><p>사진 속 인물들이 실제로 움직여요.</p></div></header>
      <button className="nz-make-button nz-video-toggle" disabled={!ready} aria-expanded={open} onClick={onToggle}>
        AI 영상 만들기 <span className="nz-video-chevron" aria-hidden="true" />
      </button>
      {open && (
        <>
          {(busy || inProgress || (job?.status === "completed" && job.downloadable && !mediaReady)) && <VideoProgress status={job?.status} mediaReady={mediaReady} />}
          {!job && !busy && (
            <>
              <fieldset className="nz-video-styles" disabled={busy}>
                <legend>어떤 영상으로 남길까요?</legend>
                {([["memory", "실사 영상", "사진 그대로 생생하게", 1], ["drawing", "애니메이션", "그림처럼 특별하게", 3]] as const).map(([value, label, description, credits]) => (
                  <button key={value} className={`nz-style-card nz-style-${value}`} type="button" aria-pressed={style === value} onClick={() => {
                    setStyle(value);
                    sessionStorage.setItem(styleKey, value);
                    setConsent(false);
                  }}><span className="nz-style-art" aria-hidden="true" /><strong>{label}</strong><small>{description}</small><span className="nz-style-cost">{credits} 크레딧</span></button>
                ))}
              </fieldset>
              {style === "memory" && <fieldset style={{border:"1px solid #f3d4e3",borderRadius:16,padding:12,minWidth:0,margin:"12px 0"}} disabled={busy}>
                <legend style={{fontWeight:800,color:"#b52d67"}}>우리들의 순간</legend>
                <p style={{fontSize:13,margin:"4px 0 12px"}}>사진은 네 컷, 우리의 이야기는 무한대. 찍지 못했던 순간을 상상해 보세요.</p>
                {personCount === 0 && <p style={{fontSize:12}}>인원수를 확실히 파악하지 못했어요. 기본 실사 영상은 이용할 수 있어요. 새로운 사진에서 AI 자동 분석을 이용하면 상황 옵션을 추천해 드려요.</p>}
                <div style={{display:"grid",gap:8}}>
                  {[{id:"",title:"기본 실사 영상",description:"네컷 사진의 포즈를 자연스럽게 연결"},...scenesForCount(personCount)].map(item=><button type="button" key={item.id} aria-pressed={(activeScene?.id || "") === item.id} onClick={()=>{setSceneId(item.id);sessionStorage.setItem(sceneKey,item.id);setConsent(false);}} style={{textAlign:"left",padding:"12px",borderRadius:12,border:(activeScene?.id || "")===item.id?"2px solid #ed4b89":"1px solid #eadbe3",background:(activeScene?.id || "")===item.id?"#fff0f6":"#fff",color:"#513443",width:"100%"}}><strong style={{display:"block"}}>{item.title}</strong><small style={{display:"block",marginTop:4}}>{item.description}</small></button>)}
                </div>
                {activeScene && <p style={{fontSize:12,color:"#8a5269"}}>AI가 상상한 가상의 장면이에요. 실제 있었던 일이 아니며 사진의 구도에 따라 동작이 달라질 수 있어요. · 1크레딧</p>}
              </fieldset>}
              <div className="nz-video-guidance">
                <p>사진 속 인물의 동의를 받고 제작해 주세요.</p>
                <p>완성 영상은 {config?.retentionDays || 7}일간 보관돼요.</p>
                <details><summary>이용 안내</summary><p>5초 무음 MP4(480p)로 만들어요. 얼굴과 동작이 원본과 다를 수 있어요. 제작 실패가 확인되면 예약 크레딧을 돌려드려요.</p></details>
              </div>
              {config?.aiRestricted && !account?.aiAllowed && <p role="status">AI 기능은 현재 출시 준비 중이에요.</p>}
              {!authReady ? <p role="status">로그인을 확인하고 있어요.</p> : !account && authenticated ? (
                <button onClick={() => void refreshAccount().catch(() => setMessage("계정 정보를 다시 불러오지 못했어요."))}>계정 정보 다시 불러오기</button>
              ) : !account ? (
                <LoginPrompt />
              ) : config?.aiRestricted && !account.aiAllowed ? null : (
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
                        ? "네 사진을 OpenAI에 보내 동작을 분석하고, 네 사진 중 선택한 기준 사진과 설명을 HeyGen에 보내"
                        : "네 사진을 HeyGen에 보내"}{" "}
                      영상을 만드는 데 동의해요. 서비스 서버의 입력은 최대
                      24시간, 결과는 {config?.retentionDays || 7}일 보관해요.
                      제공업체에도 자료가 남을 수 있어요.
                    </span>
                  </label>
                  <button className="nz-video-create"
                    disabled={
                      busy ||
                      !ready ||
                      !consent ||
                      account.balance.available < cost ||
                      !config?.generation
                    }
                    onClick={() => void start()}
                  >
                    <strong>영상 만들기</strong><small>−{cost} 크레딧</small>
                  </button>

                </>
              )}
            </>
          )}
          {job && (
            <>
              {job.status === "completed" && mediaReady && <h3 role="status">영상이 완성됐어요!</h3>}
              {job.status === "completed" && !job.downloadable && <p>영상 보관 기간이 지났어요.</p>}
              {job.status === "failed" && <p role="status">제작 실패가 확인되어 예약 크레딧을 복구했어요.</p>}
              {job.status === "review" && <p role="status">운영자가 접수 상태를 확인하고 있어요. 새 제작을 누르지 마세요.</p>}
              {job.status === "unavailable" && <p role="status">저장할 수 있는 영상이 없어요.</p>}
              {job.error && <p>{job.error}</p>}
              {url && <>
                <video src={url} controls playsInline preload="auto" onLoadedData={() => { setMediaReady(true); setMediaError(false); }} onCanPlay={() => { setMediaReady(true); setMediaError(false); }} onError={() => { setMediaReady(false); setMediaError(true); }} aria-label="완성된 AI 영상" />
                {mediaReady && <><VideoGallerySave key={job.id} url={url} memo={memo} styleName={job.style === "drawing" ? "애니메이션 영상" : relationshipScene(job.scene)?.title || "실사 영상"} /><ShareControls url={url} video /></>}
              </>}
              {job.status === "completed" && job.downloadable && !mediaReady && (mediaError || message) && <button type="button" onClick={() => { if (fileUrl.current) URL.revokeObjectURL(fileUrl.current); fileUrl.current = ""; setUrl(""); setMediaError(false); setMessage(""); setRetryFile(n => n + 1); }}>영상 다시 불러오기 · 무료</button>}
              {((job.status === "completed" && (mediaReady || !job.downloadable)) || ["failed", "unavailable"].includes(job.status)) && (
                <button className="nz-video-restart"
                  onClick={() => {
                    section.current?.scrollIntoView({ block: "start" });
                    setMessage("");
                    sessionStorage.removeItem(jobKey);
                    sessionStorage.removeItem(requestKey);
                    if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
                    fileUrl.current = "";
                    setUrl("");
                    setMediaReady(false);
                    setMediaError(false);
                    setSelectedId("");
                    setJob(null);
                    setConsent(false);
                  }}
                >
                  다른 스타일로 영상 만들기
                </button>
              )}
              {job.status === "completed" && <p>완성 영상은 {config?.retentionDays || 7}일간 보관돼요.</p>}
            </>
          )}
          {message && <p role="status">{message}</p>}
        </>
      )}
    </section>
  );
}

const phases = ["사진 준비", "영상 생성", "마무리", "완성"];
function VideoProgress({ status, mediaReady }: { status?: string; mediaReady: boolean }) {
  const active = mediaReady ? 3 : status === "completed" || status === "storing" ? 2 : status === "submitting" || status === "processing" ? 1 : 0;
  const complete = mediaReady;
  return <div className="nz-video-progress" role="status">
    {!complete && <>
      <div className="nz-video-orbit" aria-hidden="true"><span /><span /><span /></div><div className="nz-scene-motion" aria-hidden="true"><span>♡</span><span>✦</span><span>♡</span><span>✦</span></div>
      <h3>사진 속 인물들이 움직이고 있어요!</h3>
      <p>{active === 2 ? "완성된 영상을 불러오고 있어요." : active === 0 ? "사진을 살펴보고 가장 잘 나온 장면을 고르고 있어요." : "사진 속 인물들이 움직이고 있어요. 보통 약 2분 정도 걸려요."}</p>
    </>}
    <ol aria-label="영상 제작 단계">
      {phases.map((label, index) => <li key={label} data-phase={complete || index < active ? "done" : index === active ? "active" : "waiting"} aria-current={index === active ? "step" : undefined}>
        <span aria-hidden="true" />{label}
      </li>)}
    </ol>
    {!complete && <p>화면이 꺼지거나 앱을 나가더라도 돌아오면 같은 제작의 상태를 확인해요. 다시 제작하지 않아도 돼요.</p>}
  </div>;
}
