import { useState } from "react";
import { launchApi } from "../lib/launch";
export default function LaunchOperator() {
  const [data, setData] = useState<Record<string, unknown> | null>(null),
    [error, setError] = useState(""),
    [reason, setReason] = useState(""),
    [target, setTarget] = useState(""),
    [amount, setAmount] = useState(1),
    [busy, setBusy] = useState(false),
    [giftLimit,setGiftLimit] = useState(1000),
    [dailyJobs,setDailyJobs] = useState(100),
    [dailyUsd,setDailyUsd] = useState(15),
    [memoryUsd,setMemoryUsd] = useState(.16),
    [drawingUsd,setDrawingUsd] = useState(.22),
    [extractionUsd,setExtractionUsd] = useState(.05),
    [usageId,setUsageId] = useState(""),
    [actualUsd,setActualUsd] = useState(0),
    [invoiceReference,setInvoiceReference] = useState("");
  if (new URLSearchParams(location.search).get("operator") !== "1") return null;
  const run = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const result = await launchApi<Record<string, unknown>>("admin", {
        ...body,
        reason,
        requestKey: crypto.randomUUID(),
      });
      if (body.operation === "inspect") { setData(result); const c=result.config as {giftLimit:number;dailyJobs:number;dailyUsd:number;memoryReserveUsd:number;drawingReserveUsd:number;extractionReserveUsd:number};setGiftLimit(c.giftLimit);setDailyJobs(c.dailyJobs);setDailyUsd(c.dailyUsd);setMemoryUsd(c.memoryReserveUsd);setDrawingUsd(c.drawingReserveUsd);setExtractionUsd(c.extractionReserveUsd); }
      else setData(await launchApi("admin", { operation: "inspect" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "운영자 확인이 필요해요.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="nz-account" aria-label="운영 관리">
      <h2>운영 관리</h2>
      <p>
        허용된 운영자 계정만 조회·변경할 수 있어요. 미리보기에서는 operator 모의
        계정만 허용돼요.
      </p>
      <button
        disabled={busy}
        onClick={() => void run({ operation: "inspect" })}
      >
        설정·주문·제작 조회
      </button>
      {data && (
        <>
          <label>
            변경·보상 사유
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
            />
          </label>
          {[
            ["gifts", "가입 선물"],
            ["invites", "초대 보상"],
            ["payments", "새 결제"],
            ["generation", "새 영상 제작"],
          ].map(([key, label]) => (
            <div key={key}>
              {label}
              <button
                disabled={busy || reason.trim().length < 4}
                onClick={() =>
                  void run({ operation: "settings", config: { [key]: false } })
                }
              >
                중지
              </button>
              <button
                disabled={busy || reason.trim().length < 4}
                onClick={() =>
                  void run({ operation: "settings", config: { [key]: true } })
                }
              >
                재개
              </button>
            </div>
          ))}
          <h3>웰컴 선물·AI 비용 한도</h3>
          <label>웰컴 지급 대상 인원<input type="number" min={0} max={1000000} value={giftLimit} onChange={e=>setGiftLimit(Number(e.target.value))}/></label>
          <label>하루 영상 접수 한도<input type="number" min={0} max={1000} value={dailyJobs} onChange={e=>setDailyJobs(Number(e.target.value))}/></label>
          <label>하루 AI 예약 예산 (USD)<input type="number" min={0} max={1000} step="0.01" value={dailyUsd} onChange={e=>setDailyUsd(Number(e.target.value))}/></label>
          <p>HeyGen 12월 1일 공식 요율: 5초 480p 실사 $0.10 · 애니메이션 $0.20. 예약 예산에는 GPT 분석비도 별도로 합산돼요. 실제 청구서는 따로 대조해주세요.</p>
          <label>실사 1편 예약 추정액 (USD)<input type="number" min={0} step="0.01" value={memoryUsd} onChange={e=>setMemoryUsd(Number(e.target.value))}/></label>
          <label>애니메이션 1편 예약 추정액 (USD)<input type="number" min={0} step="0.01" value={drawingUsd} onChange={e=>setDrawingUsd(Number(e.target.value))}/></label>
          <label>사진 추출 1회 예약 추정액 (USD)<input type="number" min={0} step="0.01" value={extractionUsd} onChange={e=>setExtractionUsd(Number(e.target.value))}/></label>
          <button disabled={busy || reason.trim().length<4} onClick={()=>void run({operation:"settings",config:{giftLimit,dailyJobs,dailyUsd,memoryReserveUsd:memoryUsd,drawingReserveUsd:drawingUsd,extractionReserveUsd:extractionUsd}})}>지급·비용 한도 저장</button>
          <button disabled={busy} onClick={async()=>{setBusy(true);setError("");try{const report=await launchApi("admin",{operation:"usageExport"});const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));const link=document.createElement("a");link.href=url;link.download="4zzal-costs-"+new Date().toISOString().slice(0,10)+".json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setError("원가 기록을 내려받지 못했어요.");}finally{setBusy(false);}}}>전체 원가 기록 내려받기</button>
          <h3>실제 청구 원가 대조</h3><p>아래 원가 기록 ID와 공급자 청구서를 대조해 입력해요. 추정치는 실제 청구액이 아니에요.</p>
          <label>원가 기록 ID<input value={usageId} onChange={e=>setUsageId(e.target.value)}/></label>
          <label>실제 청구액 (USD)<input type="number" min={0} step="0.000001" value={actualUsd} onChange={e=>setActualUsd(Number(e.target.value))}/></label>
          <label>청구서 참조 번호 (개인정보 제외)<input value={invoiceReference} onChange={e=>setInvoiceReference(e.target.value)}/></label>
          <button disabled={busy || !usageId || reason.trim().length<4} onClick={()=>void run({operation:"reconcileUsage",usageId,actualUsd,invoiceReference})}>청구액 기록</button>
          <h3>사유를 남기는 무료 크레딧 보상</h3>
          <label>
            대상 계정 ID
            <input value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
          <label>
            보상 수량 (1~30)
            <input
              type="number"
              min={1}
              max={30}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
          <button
            disabled={busy || !target || reason.trim().length < 4}
            onClick={() => void run({ operation: "adjust", target, amount })}
          >
            보상 지급
          </button>
          <h3>설정과 최근 처리 기록</h3>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              fontSize: 11,
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
