import { useEffect, useRef, useState } from "react";
import { downloadMediaFile, mediaShareText, officialAppUrl, saveMediaFile, shareMediaFile } from "../lib/shareGif";
import { recordCompletedShare, rewardNames, useShareCount } from "../lib/shareRewards";

export default function ShareControls({ url, video = false }: { url: string; video?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [showCopy, setShowCopy] = useState(false);
  const lock = useRef(false);
  const pendingRef = useRef(false);
  const count = useShareCount();
  useEffect(() => {
    let active = true; const controller = new AbortController();
    // Reset a previous file while this asynchronous URL load starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFile(null); setMessage(""); setPending(false); pendingRef.current = false;
    fetch(url, {signal: controller.signal}).then(async response => {
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      if (!blob.size) throw new Error();
      if (active) setFile(new File([blob], video ? "naezzal4zzal.mp4" : "naezzal4zzal.gif", {type: video ? "video/mp4" : "image/gif"}));
    }).catch(() => { if (active) setMessage("공유할 파일을 불러오지 못했어요. 다시 준비해주세요."); });
    return () => { active = false; controller.abort(); };
  }, [url, video, retry]);
  const reward = () => {
    try {
      const next = recordCompletedShare();
      setMessage(next <= rewardNames.length ? "공유 " + next + "회 · " + rewardNames[next - 1] + "가 열렸어요 ✨" : "공유 기록을 저장했어요 💌");
    } catch { setMessage("공유했지만 이 브라우저에 보상 기록을 저장하지 못했어요. 저장 공간 설정을 확인해주세요."); }
  };
  const share = async () => {
    if (!file || lock.current) return;
    lock.current = true; setBusy(true); setPending(false); pendingRef.current = false; setMessage("");
    try {
      // file is prepared before this click so navigator.share retains user activation.
      const result = await shareMediaFile(file, mediaShareText);
      if (result === "shared") reward();
      else { pendingRef.current = true; setPending(true); setMessage(result === "downloaded" ? "내려받은 파일을 카카오톡 등으로 친구에게 보낸 뒤 아래에서 확인해주세요. 다운로드만으로는 보상이 열리지 않아요." : "공유 완료 여부를 기기에서 알려주지 않았어요. 친구에게 보냈다면 아래에서 확인해주세요."); }
    } catch (error) {
      const cancelled = error instanceof Error && (error.name === "AbortError" || /cancel/i.test(error.message));
      setMessage(cancelled ? "공유를 취소했어요. 공유 횟수는 그대로예요." : "공유하지 못했어요. 기기에 저장한 후 친구에게 보내주세요.");
    } finally { lock.current = false; setBusy(false); }
  };
  const shareIntro = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "내짤4짤", text: mediaShareText });
      else { await navigator.clipboard.writeText(mediaShareText); setMessage("소개 메시지를 복사했어요."); }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) setShowCopy(true);
    }
  };
  const copyAddress = async () => {
    try { await navigator.clipboard.writeText(officialAppUrl); setMessage("앱 주소를 복사했어요."); }
    catch { setShowCopy(true); }
  };
  return <div style={{marginTop:12}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
      <button onClick={share} disabled={!file || busy} style={{...button,background:"#ff4f87",opacity:!file || busy ? 0.6 : 1}}>{busy ? "공유 중..." : "공유하기"}</button>
      <button onClick={async()=>{if(!file||lock.current)return;lock.current=true;setBusy(true);try{await saveMediaFile(file);}catch{setMessage("파일을 저장하지 못했어요.");}finally{lock.current=false;setBusy(false);}}} disabled={!file || busy} style={{...button,background:"#b88cff"}}>기기에 저장하기</button>
    </div>
    <div className="nz-share-app nz-share-visible">
      <p className="nz-share-brand"><strong>네 컷 사진을 짤과 영상으로!</strong><br/>친구와의 추억을 공유하는 새로운 방법, 내짤4짤</p>
      <p className="nz-share-address">{officialAppUrl}</p>
      <div>
        <button type="button" onClick={() => void shareIntro()}>소개 메시지 공유하기</button>
        <button type="button" onClick={() => void copyAddress()}>앱 주소 복사하기</button>
      </div>
      <p>카카오톡이 파일과 문구를 함께 받지 않는 경우 소개 메시지를 붙여넣어 주세요. 주소는 Safari, Chrome 또는 삼성 인터넷에서 열 수 있어요.</p>
      {showCopy && <textarea aria-label="복사할 앱 소개 메시지" readOnly value={mediaShareText} onFocus={(event) => event.currentTarget.select()} />}
    </div>
    {pending && <div style={{padding:12,background:"#fff4f8",borderRadius:14,marginTop:10}}>
      <p style={{fontSize:13,lineHeight:1.6}}>{message}</p>
      <button style={{...button,background:"#ff4f87",width:"100%"}} onClick={()=>{if(!pendingRef.current)return;pendingRef.current=false;setPending(false);reward();}}>친구에게 보냈어요 · 보상 받기</button>
      <button style={{...button,background:"#9b8790",width:"100%",marginTop:8}} onClick={()=>{pendingRef.current=false;setPending(false);setMessage("아직 보내지 않았어요. 공유 횟수는 그대로예요.");}}>아직 보내지 않았어요</button>
      <button style={{...button,background:"#b88cff",width:"100%",marginTop:8}} onClick={()=>file&&downloadMediaFile(file)}>파일 다시 내려받기</button>
    </div>}
    {!pending && message && <p role="status" style={{fontSize:13,lineHeight:1.6,color:"#795664"}}>{message}</p>}
    {!file && <button onClick={()=>setRetry(v=>v+1)} style={{...button,background:"#b88cff",width:"100%",marginTop:8}}>파일 다시 준비하기</button>}
    {!video && <p style={{fontSize:12,color:"#9b8790",lineHeight:1.6}}>이 기기의 공유 기록 {count}회 · {count<6 ? "다음 보상: "+rewardNames[count]+" (공유 "+(count+1)+"회)" : "모든 꾸미기 옵션이 열렸어요."}<br/>공유 메뉴 완료 또는 직접 확인 기준이에요. 상대방 수신 여부는 확인할 수 없어요.</p>}
  </div>;
}
const button: React.CSSProperties = {padding:"14px 8px",border:0,borderRadius:15,color:"white",fontSize:14,fontWeight:900,cursor:"pointer"};
