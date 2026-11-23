import { useEffect, useRef, useState } from "react";
import { loadImage } from "../lib/loadImage";
import { saveGalleryItem } from "../lib/galleryStore";
import ShareControls from "./ShareControls";
import CreditVideoStudio from "./CreditVideoStudio";
import { launchEnabled, useLaunch } from "../lib/launch";

const base = import.meta.env.VITE_API_BASE_URL || "";
const jobKey = "naezzal4zzal-video-job";
const requestKey = "naezzal4zzal-video-request";
function storedToken() { try { return sessionStorage.getItem(jobKey) || ""; } catch { return ""; } }
export default function VideoStudio(props: { ready: boolean; getImages: () => Promise<string[]>; memo: string }) {
  const { account } = useLaunch();
  const [creditOpen, setCreditOpen] = useState(false);
  return launchEnabled ? <CreditVideoStudio key={account?.user.id || 'guest'} {...props} open={creditOpen} onToggle={() => setCreditOpen(v => !v)} /> : <LegacyVideoStudio {...props} />;
}
function LegacyVideoStudio({ ready, getImages, memo }: { ready: boolean; getImages: () => Promise<string[]>; memo: string }) {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [variant, setVariant] = useState<"memory" | "drawing">("memory");
  const [token, setToken] = useState(storedToken);
  const [status, setStatus] = useState("");
  const [url, setUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const fileUrl = useRef("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const lock = useRef(false);
  const pendingRequest = useRef<{ fingerprint: string; id: string } | null>(null);
  const active = useRef(true);
  useEffect(()=>{active.current=true;return()=>{active.current=false;if(fileUrl.current)URL.revokeObjectURL(fileUrl.current);};},[]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(base + "/api/videos?action=config", {signal:controller.signal})
      .then(async r => {if(!r.ok)throw new Error();return r.json();})
      .then(data=>setAvailable(data.available===true))
      .catch(()=>{if(!controller.signal.aborted)setAvailable(false);});
    return ()=>controller.abort();
  },[open,refresh]);
  useEffect(()=>{
    if(!token || !open) return;
    let cancelled=false; let timer: ReturnType<typeof setTimeout>; const controller=new AbortController(); const started=Date.now();
    const poll=async()=>{
      try{
        const response=await fetch(base+"/api/videos",{headers:{Authorization:"Bearer "+token},signal:controller.signal});
        const result=await response.json().catch(()=>({error:"제작 서버 응답을 확인하지 못했어요. 같은 요청으로 다시 확인해주세요."}));
        if(cancelled)return;
        if(!response.ok) {
          if([401,404].includes(response.status)){setMessage(result.error);setStatus("unavailable");return;}
          throw new Error(result.error||"영상 상태를 확인하지 못했어요.");
        }
        setStatus(result.status);
        if(result.variant==="memory"||result.variant==="drawing")setVariant(result.variant);
        if(result.status==="completed"){
          setSourceUrl(result.videoUrl); setMessage("5초 영상이 완성됐어요. 저장할 파일을 준비하고 있어요.");
          const media=await fetch(base+"/api/videos?action=file",{headers:{Authorization:"Bearer "+token},signal:controller.signal});
          if(!media.ok){const error=await media.json().catch(()=>({error:"영상 파일을 다시 확인해주세요."}));throw new Error(error.error||"영상 파일을 다시 확인해주세요.");}
          const blob=await media.blob();if(cancelled)return;
          if(fileUrl.current)URL.revokeObjectURL(fileUrl.current);fileUrl.current=URL.createObjectURL(blob);setUrl(fileUrl.current);
          setMessage("5초 영상이 완성됐어요. 기기에 저장해 소중히 간직해주세요.");return;
        }
        if(["failed","cancelled"].includes(result.status)){setMessage(result.error);return;}
        setMessage("네 사진으로 영상을 만들고 있어요. 몇 분 걸릴 수 있어요. 이 화면을 닫아도 제작은 계속되며, 같은 탭에서 영상 제작을 열면 다시 확인할 수 있어요.");
      }catch(error){
        if(cancelled)return;
        setMessage(error instanceof Error ? error.message+" 잠시 후 다시 확인합니다." : "연결을 다시 확인하고 있어요.");
      }
      if(Date.now()-started>15*60000){setMessage("제작이 오래 걸리고 있어요. 새로 제작하지 않고 아래에서 상태를 다시 확인해주세요.");return;}
      timer=setTimeout(()=>void poll(),8000);
    };
    void poll();
    return()=>{cancelled=true;controller.abort();clearTimeout(timer);};
  },[token,open,refresh]);
  const start=async()=>{
    if(lock.current||!ready||!consent||!accessCode.trim())return;
    lock.current=true;setBusy(true);setMessage("네 사진을 영상 제작용으로 준비하고 있어요.");
    try{
      const cuts=await getImages();
      if(cuts.length!==4)throw new Error("네 사진의 테두리를 먼저 맞춰주세요.");
      const images=await Promise.all(cuts.map(async cut=>{
        const image=await loadImage(cut);const canvas=document.createElement("canvas");canvas.width=image.width;canvas.height=image.height;
        const ctx=canvas.getContext("2d");if(!ctx)throw new Error("사진을 준비하지 못했어요.");ctx.drawImage(image,0,0);return canvas.toDataURL("image/jpeg",.9);
      }));
      const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(variant+"|"+images.join("|")));
      const fingerprint=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,"0")).join("");
      if(!pendingRequest.current){try{pendingRequest.current=JSON.parse(sessionStorage.getItem(requestKey)||"null");}catch{/* use an in-memory request below */}}
      if(pendingRequest.current?.fingerprint!==fingerprint)pendingRequest.current={fingerprint,id:crypto.randomUUID()};
      try{sessionStorage.setItem(requestKey,JSON.stringify(pendingRequest.current));}catch{/* same-page retries retain the in-memory request */}
      const response=await fetch(base+"/api/videos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({images,requestId:pendingRequest.current.id,accessCode:accessCode.trim(),consent:true,variant}),signal:AbortSignal.timeout(58000)});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"제작 요청을 확인하지 못했어요. 같은 요청으로 다시 시도해주세요.");
      if(typeof result.token!=="string"||!result.token)throw new Error("접수 결과를 확인하지 못했어요. 같은 요청으로 다시 확인해주세요.");
      try{sessionStorage.setItem(jobKey,result.token);}catch{/* the open screen still keeps the token */}
      if(active.current){setToken(result.token);setStatus("pending");setSaved(false);setUrl("");}
    }catch(error){
      if(active.current)setMessage(error instanceof Error && error.name!=="TimeoutError" ? error.message : "접수 확인이 지연되고 있어요. 다시 누르면 같은 요청을 확인합니다.");
    }finally{lock.current=false;if(active.current)setBusy(false);}
  };
  const newVideo=()=>{
    if(fileUrl.current)URL.revokeObjectURL(fileUrl.current);fileUrl.current="";setToken("");setStatus("");setUrl("");setSourceUrl("");setMessage("");setSaved(false);setConsent(false);pendingRequest.current=null;
    try{sessionStorage.removeItem(jobKey);sessionStorage.removeItem(requestKey);}catch{/* memory state is already reset */}
  };
  return <section aria-label="AI 영상 제작" style={{marginTop:12}}>
    <button disabled={!ready||busy} onClick={()=>setOpen(v=>!v)} style={{...button,background:"#b88cff",boxShadow:"0 8px 20px rgba(184,140,255,.25)",opacity:ready?1:.6}}>🎬 AI 영상 만들기</button>
    {open && <div style={{marginTop:12,padding:16,borderRadius:20,background:"#faf3ff",border:"1px solid #ead8ff",color:"#6f5961",lineHeight:1.7}}>
      <h3 style={{marginTop:0,color:"#9862d4"}}>네 컷이 살아나는 5초 영상</h3>
      <p style={{fontSize:12,color:"#9862d4"}}>스마트폰 감상용 480p · 5초 영상</p>
      <p style={{fontSize:13}}>맞춘 네 사진을 참고해 작은 손인사와 하트 동작을 만들어요. AI가 새로 만든 영상이므로 원본과 표정·손 모양 등이 달라질 수 있어요.</p>
      {!token && <>
        <fieldset disabled={busy} style={{border:"1px solid #e1c7f4",borderRadius:14,padding:12,margin:"12px 0"}}>
          <legend style={{fontWeight:800,color:"#9862d4"}}>어떤 영상으로 만들까요?</legend>
          <label style={{display:"block",padding:"8px 0"}}><input type="radio" name="video-variant" value="memory" checked={variant==="memory"} onChange={()=>{setVariant("memory");setConsent(false);}} /> 기본 · 인물 그대로</label>
          <label style={{display:"block",padding:"8px 0"}}><input type="radio" name="video-variant" value="drawing" checked={variant==="drawing"} onChange={()=>{setVariant("drawing");setConsent(false);}} /> 2D 펜화 애니메이션</label>
          <p style={{fontSize:12,marginBottom:0}}>{variant==="drawing"?"원래 인물의 얼굴·머리 모양·옷을 살린 가는 펜선과 옅은 수채색의 2D 그림으로 만들어요. 작은 손인사와 하트 동작을 애니메이션으로 표현해요.":"네 사진 속 인물을 유지해 자연스러운 5초 영상을 만들어요."}</p>
          <p style={{fontSize:12,marginBottom:0}}>두 방식 모두 원래 포즈 → 작은 손인사 → 하트 순서로 움직여요. 별도로 만드는 영상이라 동작과 타이밍이 완전히 같지는 않을 수 있어요.</p>
        </fieldset>
        {available===null && <p role="status">영상 연결을 확인하고 있어요.</p>}
        {available===false && <p role="status">영상 제작 연결을 준비하고 있어요. GIF는 지금 만들 수 있어요. <button onClick={()=>setRefresh(v=>v+1)}>연결 다시 확인</button></p>}
        <label style={{display:"block",fontSize:13,fontWeight:800}}>사무실 테스트 코드
          <input type="password" autoComplete="off" value={accessCode} onChange={e=>setAccessCode(e.target.value)} style={{boxSizing:"border-box",width:"100%",padding:13,borderRadius:12,border:"1px solid #d8b8ee",marginTop:6}} />
        </label>
        <label style={{display:"flex",gap:8,marginTop:14,fontSize:13}}>
          <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />
          <span>사진 속 사람들의 허락을 받았으며, 네 사진을 앱 서버와 HeyGen에 보내 유료 영상 제작을 시작하는 데 동의해요. HeyGen의 작업 공간에는 참고 사진과 완성 영상이 남을 수 있어요.</span>
        </label>
        <p style={{fontSize:12}}>제작 비용은 운영자의 HeyGen API 잔액에서 차감됩니다. 공유 보상과는 별개예요. <a href="https://www.heygen.com/privacy" target="_blank" rel="noreferrer">HeyGen 개인정보 안내</a></p>
        <button disabled={!available||!consent||!accessCode.trim()||busy||!ready} onClick={()=>void start()} style={{...button,background:"#b88cff",opacity:!available || !consent || !accessCode.trim() || busy ? 0.5 : 1}}>{busy?"제작 요청 확인 중...":"동의하고 5초 영상 제작"}</button>
      </>}
      {token && !sourceUrl && !["failed","cancelled","unavailable"].includes(status) && <p style={{fontWeight:800,color:"#9862d4"}}>✨ 영상 제작 중</p>}
      {message && <p role="status" style={{fontSize:13}}>{message}</p>}
      {token && <button onClick={()=>setRefresh(v=>v+1)} style={{...button,background:"#cfb1e8",marginTop:8}}>제작 상태 다시 확인</button>}
      {sourceUrl && !url && <><video src={sourceUrl} controls playsInline aria-label="완성된 AI 영상" style={{width:"100%",borderRadius:16}} /><a href={sourceUrl} target="_blank" rel="noreferrer">영상 원본 열기 · 파일이 크면 여기서 저장해주세요</a></>}
      {url && <>
        <video src={url} controls playsInline aria-label="완성된 AI 영상" style={{width:"100%",borderRadius:16,marginTop:12}} />
        <button disabled={saving||saved} onClick={async()=>{
          if(saving||saved)return;setSaving(true);
          try{const item=await saveGalleryItem(url,memo,variant==="drawing"?"2D 펜화 5초 영상":"기본 5초 영상","video");URL.revokeObjectURL(item.gifUrl);setSaved(true);setMessage("영상도 내 보관함에 저장했어요 💗");}
          catch{setMessage("보관함에 저장하지 못했어요. 기기에 저장하거나 다시 시도해주세요.");}finally{setSaving(false);}
        }} style={{...button,background:"#ff4f87",marginTop:12}}>{saved?"보관함 저장 완료":saving?"저장 중...":"영상 보관함에 저장하기"}</button>
        <ShareControls url={url} text={memo||"내짤4짤에서 만든 움직이는 추억"} video />
      </>}
      {token && ["completed","failed","cancelled","unavailable"].includes(status) && <button onClick={newVideo} style={{...button,background:"#9b8790",marginTop:10}}>새 영상 제작 준비</button>}
      <button onClick={()=>setOpen(false)} style={{...button,background:"#c1aebc",marginTop:10}}>영상 화면 접기</button>
    </div>}
  </section>;
}
const button: React.CSSProperties={width:"100%",padding:16,borderRadius:16,border:0,color:"white",fontSize:16,fontWeight:800,cursor:"pointer"};
