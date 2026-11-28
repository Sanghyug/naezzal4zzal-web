import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { demoLogin, kakaoLogin, launchApi, logout, refreshAccount, useLaunch, videoFile, flushDraft } from "../lib/launch";
import type { LaunchOrder } from "../lib/launch";
import LaunchPolicies from "./LaunchPolicies";
import { LaunchIcon, FilmDecoration } from "./LaunchArtwork";
import { shareAppInvite } from "../lib/appInvite";
import { BUSINESS, supportMailto } from "../lib/business";
import { PAID_CREDIT_POLICY_VERSION, PAID_CREDIT_TERM } from "../lib/creditPolicy";
import "./launch.css";
import "./launch-redesign.css";
export function LoginPrompt({ onDismiss }: { onDismiss?: () => void }) {
  const { config } = useLaunch();
  const [alias, setAlias] = useState("tester"), [error, setError] = useState(""), [busy, setBusy] = useState(false), [policy, setPolicy] = useState(false);
  const pending = useRef(false);
  if (policy) return <LaunchPolicies onBack={() => setPolicy(false)} />;
  const full = Boolean(onDismiss);
  return <div className={full ? "nz-login nz-login-full" : "nz-login nz-login-compact"}>
    {full ? <><h1 className="nz-login-title">네 컷 사진에<br/><em>생기를!<span aria-hidden="true">ˊˊ</span></em></h1>
    <p className="nz-login-subtitle">사진 속 그 순간을,<br/>실사와 애니메이션 영상으로 만나봐요.</p>
    <img className="nz-login-art" src="/launch/login-illustration.jpg" width="745" height="700" alt="같은 네 컷 사진을 실사와 애니메이션로 나란히 표현한 예시"/>
    <div className="nz-gift-ticket nz-ticket">
      <LaunchIcon name="gift"/><div>{!config ? <p role="status">가입 선물을 확인하고 있어요.</p> : config.giftAvailable ? <><span className="nz-pill">처음 만나는 내짤4짤!</span><strong>웰컴 <b>4</b>크레딧</strong><small>신규 가입 선착순 {(config.giftLimit ?? 1000).toLocaleString("ko-KR")}명 · 한 번만 지급</small></> : <strong className="nz-gift-closed">가입 선물 이벤트가 마감됐어요</strong>}
      <p>실사와 애니메이션을 모두 경험해 보세요.</p><div className="nz-cost-chips nz-welcome-examples" aria-label="웰컴 크레딧으로 실사 한 편과 애니메이션 한 편"><span>실사 1편 · 1크레딧</span><b>＋</b><span>애니메이션 1편 · 3크레딧</span></div></div>
    </div></> : <><h3>{config?.giftAvailable ? "처음 만나는 내짤4짤! 웰컴 4크레딧" : "로그인하고 영상 만들기"}</h3></>}
    {config?.demo && <label className="nz-demo-field">체험 계정 이름<input value={alias} onChange={e=>setAlias(e.target.value)} autoComplete="off"/></label>}
    <button className="nz-kakao-login" disabled={busy || (!config?.demo && !config?.auth.url)} aria-busy={busy} onClick={async()=>{
      if(pending.current) return; pending.current=true; setBusy(true); setError("");
      try { if(config?.demo) await demoLogin(alias); else await kakaoLogin(); }
      catch(e){setError(e instanceof Error ? e.message : "로그인을 다시 확인해주세요.");}
      finally{pending.current=false;setBusy(false);}
    }}><LaunchIcon name="chat"/>{busy ? "로그인 준비 중…" : config?.demo ? "모의 계정으로 로그인" : "카카오로 시작하기"}</button>
    {error && <p role="alert">{error} <button className="nz-text-button" onClick={()=>setError("")}>다시 시도</button></p>}
    {full && <><button className="nz-browse" onClick={onDismiss}>지금은 둘러볼게요</button><p className="nz-free-note">사진 편집과 기본 움짤은 로그인 없이 무료</p><nav className="nz-policy-links" aria-label="서비스 정책"><button onClick={()=>setPolicy(true)}>이용약관</button><span>·</span><button onClick={()=>setPolicy(true)}>개인정보처리방침</button></nav></>}
  </div>;
}
const names: Record<string, string> = {
  signup_gift: "가입 선물",
  purchase: "10크레딧 충전",
  invite_reward: "친구 초대 보상",
  generation_reserve: "영상 제작 예약",
  generation_use: "영상 제작 사용 확정",
  generation_release: "제작 예약 복구",
  purchase_cancel: "구매 취소",
  payment_review: "결제 내역 확인 요청",
  admin_adjustment: "운영자 보상",
};
const statusNames: Record<string, string> = {
  pending: "결제 대기",
  confirming: "승인 확인 중",
  paid: "충전 완료",
  cancelling: "취소 확인 중",
  cancelled: "취소 완료",
  failed: "실패",
  reserved: "제작 준비",
  analyzing: "동작 분석 중",
  submitting: "접수 확인 중",
  processing: "제작 중",
  storing: "무음 영상 보관 중",
  completed: "완성",
  unavailable: "영상 없음",
  review: "운영자 확인 중",
};
export default function LaunchAccount({ entryTarget }: { entryTarget?: HTMLElement | null }) {
  const { account, config, error, ready, authenticated } = useLaunch();
  const [open, setOpen] = useState(
      new URLSearchParams(location.search).has("payment"),
    ),
    [message, setMessage] = useState(""),
    [purchase, setPurchase] = useState<LaunchOrder | null>(null),
    [busy, setBusy] = useState(false),
    [refund, setRefund] = useState(""),
    [reason, setReason] = useState(""),
    [closeText, setCloseText] = useState("");
  const [tab, setTab] = useState<"videos" | "orders" | "credits">(new URLSearchParams(location.search).has("payment") ? "orders" : "credits");
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if(!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow="hidden";
    const scope = purchase ? panel.current?.querySelector<HTMLElement>(".nz-checkout") : panel.current;
    scope?.querySelector<HTMLButtonElement>("button")?.focus();
    const keys=(e: KeyboardEvent)=>{
      if(e.key==="Escape"){ e.preventDefault(); if(purchase) setPurchase(null); else setOpen(false); }
      if(e.key==="Tab"){
        const items=Array.from(scope?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),summary,[tabindex="0"]') || []).filter(x=>x.getClientRects().length);
        const first=items[0],last=items[items.length-1];
        if(e.shiftKey && (document.activeElement===first || !scope?.contains(document.activeElement))){e.preventDefault();last?.focus();}
        else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };document.addEventListener("keydown",keys);
    return ()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",keys);if(previous?.isConnected)previous.focus();};
  },[open,purchase]);
  const accountId = account?.user.id;
  useEffect(() => {
    if (!open) return;
    panel.current?.parentElement?.scrollTo(0, 0);
    panel.current?.querySelector<HTMLButtonElement>(".nz-close")?.focus();
  }, [accountId, open]);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await refreshAccount();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "연결을 다시 확인해주세요.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!open || !accountId) return;
    const t = setInterval(() => void refreshAccount().catch(() => {}), 15000);
    return () => clearInterval(t);
  }, [open, accountId]);
  const entry = <>
    <div className="nz-bar"><button onClick={()=>setOpen(v=>!v)}>{account ? `내 크레딧 ${account.balance.available} · 내역` : "내 크레딧"}</button>{config?.demo && <span>출시 준비 미리보기 · 실제 결제·AI 비용 없음</span>}</div>
    {error && <p className="nz-bar" role="status">{error}</p>}
  </>;
  return <>
    {entryTarget ? createPortal(entry, entryTarget) : entry}
    {open && <div className="nz-account-overlay"><section ref={panel} className="nz-account nz-redesign" role="dialog" aria-modal="true" aria-label="내 크레딧">
      <header className="nz-brand-header"><img src="/launch/logo.png" alt="내짤4짤" width="595" height="190"/><button className="nz-close" aria-label="크레딧 닫기" onClick={()=>setOpen(false)}>×</button></header>
      {!ready ? <p role="status">로그인을 확인하고 있어요.</p> : !account && authenticated ? <button onClick={() => void act(refreshAccount)}>계정 정보 다시 불러오기</button> : !account ? <><LoginPrompt onDismiss={()=>setOpen(false)}/><button onClick={async()=>setMessage(await shareAppInvite(null))}>친구 초대하기</button><p>로그인 후 친구 초대 보상을 받을 수 있어요.</p></> : <>
        <div className="nz-page-title"><h1>내 크레딧</h1><p>추억을 더 만들 준비, 됐나요?</p></div>
        <div className="nz-credit-ticket nz-ticket"><div className="nz-ticket-top"><div><span className="nz-pill">사용 가능한 크레딧</span><strong><b>{account.balance.available}</b><span>크레딧</span></strong><p>제작 예약 {account.balance.reserved}크레딧 · 총 보유 {account.balance.total}</p></div><FilmDecoration/></div><div className="nz-cost-chips"><span><LaunchIcon name="video"/>실사 영상 <b>1크레딧</b></span><span><LaunchIcon name="pen"/>애니메이션 영상 <b>3크레딧</b></span></div></div>
        {!!account.balance.expired && <p role="status">사용기간이 끝난 {account.balance.expired}크레딧은 총 보유량에 포함되지만 새 제작에는 사용할 수 없어요. 구매 내역에서 환불을 요청할 수 있어요.</p>}
        <section className="nz-topup-card"><h2>추억을 더 만들고 싶다면</h2><div className="nz-price"><b>10크레딧</b><strong>3,900원</strong></div><p>필요할 때 한 번씩 충전해요 · 사용기간 {PAID_CREDIT_TERM}</p>
                <button
                  disabled={busy || !config?.payments}
                  onClick={() =>
                    void act(async () => {
                      const cache = "nz-purchase-request:" + account.user.id;
                      const key =
                        sessionStorage.getItem(cache) || crypto.randomUUID();
                      sessionStorage.setItem(cache, key);
                      const o = await launchApi<LaunchOrder>("order", {
                        requestKey: key,
                      });
                      if (o.status !== "pending") {
                        if (["paid", "cancelled", "failed"].includes(o.status)) sessionStorage.removeItem(cache);
                        setMessage(
                          ["confirming", "cancelling", "review"].includes(o.status)
                            ? "확인 중인 구매가 있어요. 구매 내역에서 상태를 확인해주세요."
                            : "기존 구매 상태를 확인했어요. 새 충전은 다시 선택해주세요.",
                        );
                        setTab("orders");
                        await refreshAccount();
                        return;
                      }
                      setPurchase(o);
                    })
                  }
                >
                  10크레딧 충전하기
                </button>

        {!config?.payments && <p>결제 연결을 준비하고 있어요.</p>}{(config?.paymentMode==="mock" || config?.paymentMode==="toss-test") && <span className="nz-test-badge">테스트 결제 · 실제 청구 없음</span>}
        {purchase && accountId && purchase.user===accountId && <Checkout order={purchase} onClose={()=>setPurchase(null)} onDone={()=>{sessionStorage.removeItem("nz-purchase-request:"+accountId);setPurchase(null);setTab("orders");void refreshAccount();}}/>}
        </section>
        <section className="nz-referral-card"><LaunchIcon name="plane" className="nz-plane"/><h2>친구와 함께, <em>+2크레딧</em></h2><p>초대받은 새 친구가 가입하고<br/>GIF 또는 AI 영상을 처음 완성하면 선물로 드려요</p>
        <button disabled={busy} onClick={async () => { setBusy(true); try { setMessage(await shareAppInvite(account, config?.appUrl)); } finally { setBusy(false); } }}>친구 초대하기</button>
        <div className="nz-referral-counts"><span>이번 달 <b>{account.invite.monthlyUsed}/{account.invite.monthlyLimit}</b>명</span><span>보상 대기 <b>{account.invite.waiting}</b>명</span></div>
        <details className="nz-invite-details"><summary>초대 안내</summary><p>보상은 초대한 사람에게 지급해요. 새 친구의 가입 확인과 첫 GIF·실사·애니메이션 영상 중 하나의 정상 완성이 필요해요. 친구 한 명당 한 번, 결제 여부와 관계없이 지급해요. 자기 초대와 중복 가입은 제외돼요. 한국 시간 월 {account.invite.monthlyLimit}명까지, 링크는 발급 후 30일간 유효해요.</p><p>링크 유효기간: {new Date(account.invite.expires).toLocaleDateString("ko-KR")}</p></details></section>
        <section className="nz-records-card"><h2>나의 기록</h2><div role="tablist" aria-label="나의 기록" className="nz-record-tabs">{([['videos','내 영상'],['orders','구매 내역'],['credits','크레딧 내역']] as const).map(([key,label],i)=><button key={key} id={"nz-tab-"+key} role="tab" aria-selected={tab===key} aria-controls={"nz-panel-"+key} tabIndex={tab===key?0:-1} onClick={()=>setTab(key)} onKeyDown={e=>{const keys=['videos','orders','credits'] as const;const next=e.key==='ArrowRight'?(i+1)%3:e.key==='ArrowLeft'?(i+2)%3:e.key==='Home'?0:e.key==='End'?2:-1;if(next>=0){e.preventDefault();setTab(keys[next]);document.getElementById('nz-tab-'+keys[next])?.focus();}}}>{label}</button>)}</div>
        <div role="tabpanel" id={"nz-panel-"+tab} aria-labelledby={"nz-tab-"+tab} tabIndex={0}>
        {tab==='videos' && <><h3 className="nz-sr-only">영상 제작 내역</h3>              {account.jobs.length === 0 && <p>아직 만든 영상이 없어요.</p>}
              {account.jobs.map((j) => (
                <article className="nz-history" key={j.id}>
                  <b>
                    {j.style === "memory" ? "실사 영상" : "애니메이션 영상"} ·{" "}
                    {j.cost}크레딧
                  </b>
                  <span>{statusNames[j.status] || j.status}</span><small>{new Date(j.created).toLocaleString("ko-KR")}</small>
                  {j.error && <p>{j.error}</p>}
                  {!["completed", "failed", "review"].includes(j.status) && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(() => launchApi("work", { jobId: j.id }))
                      }
                    >
                      같은 제작 상태 확인
                    </button>
                  )}
                  {j.downloadable && (
                    <>
                      <p>
                        {j.expires &&
                          new Date(j.expires).toLocaleDateString("ko-KR")}
                        까지 보관
                      </p>
                      <button
                        onClick={() =>
                          void act(async () => {
                            const blob = await videoFile(j.id),
                              url = URL.createObjectURL(blob),
                              a = document.createElement("a");
                            a.href = url;
                            a.download = "naezzal4zzal.mp4";
                            a.click();
                            setTimeout(() => URL.revokeObjectURL(url), 30000);
                          })
                        }
                      >
                        완성본 다시 저장 · 무료
                      </button>
                      <button
                        onClick={() =>
                          void act(() =>
                            launchApi("deleteResult", { jobId: j.id }),
                          )
                        }
                      >
                        서버 완성본 삭제
                      </button>
                    </>
                  )}
                  {j.status === "completed" && !j.downloadable && (
                    <p>보관이 종료된 영상이에요.</p>
                  )}
                </article>
              ))}
</>}
        {tab==='orders' && <><h3 className="nz-sr-only">구매 내역 · 취소</h3>{account.orders.length===0 && <p className="nz-empty">아직 구매 내역이 없어요.</p>}              {account.orders.map((o) => (
                <article className="nz-history" key={o.id}>
                  <b>{o.credits}크레딧 · {o.amount.toLocaleString("ko-KR")}원</b>
                  <time dateTime={new Date(o.created).toISOString()}>{new Date(o.created).toLocaleString("ko-KR")}</time>
                  <span>{statusNames[o.status]}</span>
                  {o.creditExpiresAt && <p>사용기한: {new Date(o.creditExpiresAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false })}에 종료 (한국시간)</p>}
                  {!o.creditPolicyVersion && o.status === "paid" && <p>기존 구매 · 사용기한 없음</p>}
                  {!!o.expiredCredits && <p>사용기간 종료 {o.expiredCredits}크레딧 · 남은 구매 잔액은 환불 요청 가능</p>}
                  <small>주문 {o.id}</small>
                  {["pending", "confirming", "cancelling"].includes(
                    o.status,
                  ) && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(() =>
                          launchApi("recoverOrder", { orderId: o.id }),
                        )
                      }
                    >
                      구매 상태 다시 확인
                    </button>
                  )}
                  {o.status === "paid" && (
                    <button
                      onClick={() => {
                        setRefund(o.id);
                        setReason("");
                      }}
                    >
                      미사용 구매 취소 / 환불 요청
                    </button>
                  )}
                </article>
              ))}
              {refund && (
                <div className="nz-product">
                  <h4>구매 취소·환불</h4>
                  <p>
                    전액 미사용이며 제작 예약 중이 아닌 구매는 취소할 수 있어요.
                    일부 사용한 구매는 문의로 확인해드려요.
                    사용기간이 지나도 남은 구매 잔액의 환불을 요청할 수 있어요.
                  </p>
                  <p><a href={supportMailto("내짤4짤 환불 요청 · 주문 " + refund)}>부분 사용·기간 종료·결제 취소 오류 문의</a></p>
                  <label>
                    취소 사유
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={300}
                    />
                  </label>
                  <button
                    disabled={busy || reason.trim().length < 2}
                    onClick={() =>
                      void act(async () => {
                        await launchApi("cancel", { orderId: refund, reason });
                        setRefund("");
                        setMessage("구매 취소 상태를 확인했어요.");
                      })
                    }
                  >
                    미사용 구매 취소 요청
                  </button>
                  <button onClick={() => setRefund("")}>돌아가기</button>
                </div>
              )}
</>}
        {tab==='credits' && <><h3 className="nz-sr-only">크레딧 내역</h3>              {account.entries.filter(e=>names[e.kind]).length === 0 && <p className="nz-empty">아직 크레딧 내역이 없어요.</p>}
              {account.entries
                .filter((e) => names[e.kind])
                .map((e) => (
                  <div className="nz-ledger" key={e.id}>
                    <span><LaunchIcon name={e.kind === "signup_gift" || e.kind === "invite_reward" ? "gift" : "video"}/>
                      {names[e.kind]}
                      <small>{new Date(e.at).toLocaleString("ko-KR")}</small>
                    </span>
                    <b>
                      {e.amount > 0 ? "+" : ""}
                      {e.amount}
                    </b>
                  </div>
                ))}
              <details className="nz-ledger-help"><summary>크레딧 이용 안내</summary><p className="nz-muted">
                제작 예약과 사용 확정은 같은 제작의 진행 단계예요. 두 번
                차감되지 않아요. 무료 크레딧부터 사용하며 구매분은 구매 건별로
                기록해요.
              </p></details>
</>}
        </div></section>
        <footer className="nz-account-footer"><details className="nz-management"><summary>계정 관리</summary>              <details>
                <summary>계정 탈퇴와 서버 자료 삭제</summary>
                <p>
                  진행 중인 제작·결제가 없고 구매 잔액의 환불이 정리된 뒤 탈퇴할
                  수 있어요. 무료 잔액과 서버 사진·영상은 삭제해요. 거래 장부는
                  법정 보관 의무를 확인해 별도 관리하고 중복 선물 방지 식별
                  해시는 90일 후 삭제해요.
                </p>
                <label>
                  확인을 위해 ‘탈퇴’ 입력
                  <input
                    value={closeText}
                    onChange={(e) => setCloseText(e.target.value)}
                  />
                </label>
                <button
                  disabled={busy || closeText !== "탈퇴"}
                  onClick={() =>
                    void act(async () => {
                      await launchApi("closeAccount", { confirm: closeText });
                      await logout();
                      setMessage("계정과 서버 파일 삭제를 완료했어요.");
                    })
                  }
                >
                  계정 탈퇴 요청
                </button>
              </details>
</details><span aria-hidden="true">|</span><button onClick={()=>void logout()}>로그아웃</button><p>보관 중인 완성 영상은 다시 저장해도 무료예요.</p><details className="nz-support"><summary>문의와 도움말</summary>          <p>
            <a href={supportMailto("내짤4짤 문의·환불")}>문의·환불 요청 · {BUSINESS.supportEmail}</a>
          </p>
          <p className="nz-muted">밤나무랩에서 문의를 확인해드려요. 비밀번호나 인증 코드는 보내지 마세요.</p>
</details></footer>
      </>}
      {message && <p className="nz-feedback" role="status">{message}</p>}
    </section></div>}
  </>;
}
function Checkout({
  order,
  onClose,
  onDone,
}: {
  order: LaunchOrder;
  onClose: () => void;
  onDone: () => void;
}) {
  const { config, account } = useLaunch(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<(() => Promise<void>) | null>(null);
  const checkoutUserId = account?.user.id;
  useEffect(() => {
    if (config?.paymentMode === "mock" || !checkoutUserId) return;
    let stopped = false;
    const cleanup: (() => void)[] = [];
    void (async () => {
      try {
        const { clientKey } = await launchApi<{ clientKey: string }>(
          "checkoutConfig",
        );
        const toss = await loadTossPayments(clientKey),
          widgets = toss.widgets({ customerKey: checkoutUserId });
        await widgets.setAmount({ currency: "KRW", value: 3900 });
        if (stopped) return;
        const methods = await widgets.renderPaymentMethods({
            selector: "#nz-payment-methods",
            variantKey: "DEFAULT",
          }),
          agreement = await widgets.renderAgreement({
            selector: "#nz-payment-agreement",
            variantKey: "AGREEMENT",
          });
        cleanup.push(
          () => methods.destroy(),
          () => agreement.destroy(),
        );
        if (stopped) {
          cleanup.forEach((f) => f());
          return;
        }
        setRequest(() => async () => {
          await widgets.requestPayment({
            orderId: order.id,
            orderName: "내짤4짤 AI 영상 제작 10크레딧",
            successUrl: location.origin + "/?payment=success",
            failUrl: location.origin + "/?payment=fail",
          });
        });
      } catch (e) {
        if (!stopped)
          setError(
            e instanceof Error ? e.message : "결제 연결을 준비하고 있어요.",
          );
      }
    })();
    return () => {
      stopped = true;
      cleanup.forEach((f) => f());
    };
  }, [order.id, checkoutUserId, config?.paymentMode]);
  return (
    <div
      className="nz-checkout"
      role="dialog"
      aria-modal="true"
      aria-label="10크레딧 결제"
    >
      <h3>10크레딧 · 최종 3,900원</h3>
      <p>
        이 서비스에서만 사용하는 영상 제작 크레딧이에요. 양도·현금 교환·자동
        충전은 지원하지 않아요.
      </p>
      <p>{order.creditPolicyVersion === PAID_CREDIT_POLICY_VERSION
        ? `사용기간은 ${PAID_CREDIT_TERM}이며, 구매 내역에서 종료 시각을 확인할 수 있어요.`
        : "이 주문은 기존 구매 조건을 적용하여 사용기한이 없어요."}</p>
      <p>사용기간이 끝나면 새 영상 제작에 사용할 수 없지만, 남은 구매 잔액의 환불을 요청할 수 있어요.</p>
      <div id="nz-payment-methods" />
      <div id="nz-payment-agreement" />
      {config?.paymentMode === "mock" && (
        <p>모의 결제 화면입니다. 실제 카드나 계좌를 사용하지 않아요.</p>
      )}
      <button
        disabled={busy || (config?.paymentMode !== "mock" && !request)}
        onClick={async () => {
          setBusy(true);
          try {
            await flushDraft();
            if (config?.paymentMode === "mock") {
              await launchApi("confirm", {
                orderId: order.id,
                paymentKey: "mock-" + order.id,
                amount: 3900,
              });
              onDone();
            } else await request?.();
          } catch (e) {
            setError(e instanceof Error ? e.message : "결제를 확인해주세요.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {config?.paymentMode === "mock"
          ? "모의 3,900원 승인"
          : "3,900원 결제하기"}
      </button>
      <button onClick={onClose}>결제 취소하고 돌아가기</button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
