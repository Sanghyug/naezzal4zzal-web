import { useState } from "react";
import { launchApi } from "../lib/launch";
export default function LaunchOperator() {
  const [data, setData] = useState<Record<string, unknown> | null>(null),
    [error, setError] = useState(""),
    [reason, setReason] = useState(""),
    [target, setTarget] = useState(""),
    [amount, setAmount] = useState(1),
    [busy, setBusy] = useState(false);
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
      if (body.operation === "inspect") setData(result);
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
