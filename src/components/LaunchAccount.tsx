import { useEffect, useState } from "react";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import {
  demoLogin,
  googleLogin,
  launchApi,
  logout,
  refreshAccount,
  useLaunch,
  videoFile,
  flushDraft,
} from "../lib/launch";
import type { LaunchOrder } from "../lib/launch";
import "./launch.css";
export function LoginPrompt() {
  const { config } = useLaunch();
  const [alias, setAlias] = useState("tester"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="nz-login">
      <h3>
        {config?.giftAvailable
          ? "로그인하고 무료 5크레딧 받기"
          : "로그인하고 영상 만들기"}
      </h3>
      <p>사진 편집과 기본 GIF는 로그인 없이 계속 쓸 수 있어요.</p>
      {config?.demo && (
        <label>
          체험 계정 이름
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            autoComplete="off"
          />
        </label>
      )}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            if (config?.demo) await demoLogin(alias);
            else await googleLogin();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "로그인을 다시 확인해주세요.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {config?.demo ? "모의 계정으로 로그인" : "Google로 계속하기"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
const names: Record<string, string> = {
  signup_gift: "가입 선물",
  purchase: "10크레딧 충전",
  invite_reward: "친구 초대 보상",
  generation_reserve: "영상 제작 예약",
  generation_use: "영상 제작 사용 확정",
  generation_release: "제작 예약 복구",
  purchase_cancel: "구매 취소",
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
  review: "운영자 확인 중",
};
export default function LaunchAccount() {
  const { account, config, error } = useLaunch();
  const [open, setOpen] = useState(
      new URLSearchParams(location.search).has("payment"),
    ),
    [message, setMessage] = useState(""),
    [purchase, setPurchase] = useState<LaunchOrder | null>(null),
    [busy, setBusy] = useState(false),
    [refund, setRefund] = useState(""),
    [reason, setReason] = useState(""),
    [closeText, setCloseText] = useState("");
  const accountId = account?.user.id;
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
  return (
    <>
      <div className="nz-bar">
        <button onClick={() => setOpen((v) => !v)}>
          {account
            ? `내 크레딧 ${account.balance.available} · 내역`
            : "내 크레딧 · 로그인"}
        </button>
        {config?.demo && (
          <span>출시 준비 미리보기 · 실제 결제·AI 비용 없음</span>
        )}
      </div>
      {open && (
        <section className="nz-account" aria-label="내 크레딧">
          <div className="nz-heading">
            <h2>움직이는 추억을 더 만들어요</h2>
            <button onClick={() => setOpen(false)} aria-label="크레딧 닫기">
              닫기
            </button>
          </div>
          {!account ? (
            <LoginPrompt />
          ) : (
            <>
              <div className="nz-balance">
                <strong>{account.balance.available}크레딧</strong>
                <span>
                  사용 가능 · 제작 예약 {account.balance.reserved} · 총 보유{" "}
                  {account.balance.total}
                </span>
              </div>
              <p>
                실사 영상 1크레딧 · 펜화 영상 3크레딧
                <br />
                보관 중인 같은 완성본은 다시 저장해도 무료예요.
              </p>
              <div className="nz-product">
                <h3>
                  10크레딧 <strong>3,900원</strong>
                </h3>
                <p>
                  최종 결제금액 · 일회성 충전
                  <br />
                  실사 최대 10편 또는 펜화 3편＋실사 1편
                </p>
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
                      if (["paid", "cancelled", "failed"].includes(o.status)) {
                        sessionStorage.removeItem(cache);
                        setMessage(
                          "기존 구매 상태를 확인했어요. 새 충전은 다시 선택해주세요.",
                        );
                        return;
                      }
                      setPurchase(o);
                    })
                  }
                >
                  10크레딧 충전
                </button>
                {!config?.payments && <p>결제 연결을 준비하고 있어요.</p>}
                {config?.paymentMode !== "live" && (
                  <small>
                    {config?.paymentMode === "mock"
                      ? "모의 결제: 실제 돈이 결제되지 않아요."
                      : "토스 테스트 결제: 실제 돈이 출금되지 않아요."}
                  </small>
                )}
              </div>
              <h3>친구에게 움직이는 추억을 소개해요</h3>
              <p>
                새 친구가 초대 링크로 들어와 기본 GIF를 완성하고 가입 확인까지
                마치면 나에게 2크레딧이 와요. 친구는 가입 선물 대상이면
                5크레딧을 받아요.
              </p>
              <p>
                이번 달 {account.invite.monthlyUsed}/
                {account.invite.monthlyLimit}명 · 보상 대기{" "}
                {account.invite.waiting}명<br />
                링크 유효기간:{" "}
                {new Date(account.invite.expires).toLocaleDateString("ko-KR")}
              </p>
              <button
                disabled={!account.invite.enabled}
                onClick={() =>
                  void act(async () => {
                    const url =
                      location.origin + "/?ref=" + account.invite.code;
                    try {
                      if (navigator.share)
                        await navigator.share({
                          title: "내짤4짤",
                          text: "네 컷 사진으로 움짤을 만들어봐!",
                          url,
                        });
                      else {
                        await navigator.clipboard.writeText(url);
                        setMessage("초대 링크를 복사했어요.");
                      }
                    } catch (e) {
                      if (!(e instanceof Error && e.name === "AbortError"))
                        throw e;
                    }
                  })
                }
              >
                {account.invite.enabled
                  ? "친구 초대 링크 공유"
                  : "이번 달 초대 보상 한도 도달"}
              </button>
              <h3>영상 제작 내역</h3>
              {account.jobs.length === 0 && <p>아직 만든 영상이 없어요.</p>}
              {account.jobs.map((j) => (
                <article className="nz-history" key={j.id}>
                  <b>
                    {j.style === "memory" ? "실사 영상" : "펜화 영상"} ·{" "}
                    {j.cost}크레딧
                  </b>
                  <span>{statusNames[j.status] || j.status}</span>
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
              <h3>구매 내역 · 취소</h3>
              {account.orders.map((o) => (
                <article className="nz-history" key={o.id}>
                  <b>10크레딧 · 3,900원</b>
                  <span>{statusNames[o.status]}</span>
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
                  </p>
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
              <h3>크레딧 내역</h3>
              {account.entries
                .filter((e) => names[e.kind])
                .map((e) => (
                  <div className="nz-ledger" key={e.id}>
                    <span>
                      {names[e.kind]}
                      <small>{new Date(e.at).toLocaleString("ko-KR")}</small>
                    </span>
                    <b>
                      {e.amount > 0 ? "+" : ""}
                      {e.amount}
                    </b>
                  </div>
                ))}
              <p className="nz-muted">
                제작 예약과 사용 확정은 같은 제작의 진행 단계예요. 두 번
                차감되지 않아요. 무료 크레딧부터 사용하며 구매분은 구매 건별로
                기록해요.
              </p>
              <details>
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
              <button onClick={() => void logout()}>로그아웃</button>
            </>
          )}
          <p>
            {config?.contact ? (
              <a
                href={
                  "mailto:" +
                  config.contact +
                  "?subject=" +
                  encodeURIComponent("내짤4짤 문의·환불")
                }
              >
                문의·환불 요청
              </a>
            ) : (
              <a
                href="https://github.com/Sanghyug/naezzal4zzal-web/issues"
                target="_blank"
                rel="noreferrer"
              >
                공개 오류 문의 · 사진·결제정보를 올리지 마세요
              </a>
            )}
          </p>
          {!config?.contact && (
            <p className="nz-muted">
              비공개 문의 연락처는 공개 출시 전에 연결할 예정이에요.
            </p>
          )}
          {(message || error) && <p role="status">{message || error}</p>}
          {purchase && accountId && purchase.user === accountId && (
            <Checkout
              order={purchase}
              onClose={() => setPurchase(null)}
              onDone={() => {
                sessionStorage.removeItem(
                  "nz-purchase-request:" + accountId,
                );
                setPurchase(null);
                void refreshAccount();
              }}
            />
          )}
        </section>
      )}
    </>
  );
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
