import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";
import type { ReactNode, Ref } from "react";

type StartScreenProps = {
  onCameraClick: () => void;
  onUploadClick: () => void;
  onGalleryClick: () => void;
  onShareAppClick: () => void;
  inviteMessage?: string;
  inviteGuest?: boolean;
  accountRef?: Ref<HTMLDivElement>;
  footer?: ReactNode;
  fullscreenAvailable?: boolean;
  fullscreen?: boolean;
  onFullscreenClick?: () => void;
};

function StartScreen({
  onCameraClick,
  onUploadClick,
  onGalleryClick,
  onShareAppClick,
  inviteMessage,
  inviteGuest,
  accountRef,
  footer,
  fullscreenAvailable,
  fullscreen,
  onFullscreenClick,
}: StartScreenProps) {
  const [installPrompt, setInstallPrompt] = useState<(Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> });
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) {
      alert(
        "iPhone의 Safari에서는 공유 버튼 → 홈 화면에 추가를 선택하세요. Android의 Chrome·삼성 인터넷에서는 브라우저 메뉴 → 홈 화면에 추가 또는 앱 설치를 선택하세요.",
      );
      return;
    }

    installPrompt.prompt();

    const result = await installPrompt.userChoice;

    if (result.outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(to bottom, #fff1f5, #ffe4ec)",
        padding: "32px 18px 56px",
        boxSizing: "border-box",
        fontFamily: "sans-serif",
      }}
    >
      <div
        className="nz-home-card"
        style={{
          backgroundColor: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(8px)",
          borderRadius: "32px",
          padding: "28px 24px 26px",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 14px 42px rgba(0,0,0,0.10)",
          textAlign: "center",
        }}
      >
        <img
          src="/main-logo.png"
          alt="내짤4짤"
          style={{
            width: "150px",
            maxWidth: "62%",
            marginBottom: "0px",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />

        <img
          src="/title-logo.png"
          alt="내짤4짤"
          style={{
            width: "230px",
            maxWidth: "86%",
            marginTop: "-4px",
            marginBottom: "4px",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />

        <p
          style={{
            marginTop: "14px",
            marginBottom: 0,
            fontSize: "17px",
            lineHeight: 1.65,
            color: "#666",
            fontWeight: 500,
          }}
        >
          네 컷의 추억을
          <br />
          움직이는 짤로 간직해보세요 ✨
        </p>

        {accountRef && <div className="nz-home-account" ref={accountRef} />}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginTop: accountRef ? "14px" : "28px",
          }}
        >
          <button
            onClick={() => {
              const isMobile = /Android|iPhone|iPad|iPod/i.test(
                navigator.userAgent,
              );

              if (!isMobile) {
                alert(
                  "사진 찍기 기능은 스마트폰에서 사용할 수 있어요.\nPC에서는 '불러오기'를 이용해주세요.",
                );
                return;
              }

              onCameraClick();
            }}
            style={{
              width: "100%",
              padding: "17px",
              borderRadius: "18px",
              border: "none",
              background: "linear-gradient(to right, #ff5a93, #ff4f87)",
              color: "white",
              fontSize: "18px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 10px 24px rgba(255,79,135,0.35)",
            }}
          >
            📸 사진 찍기
          </button>

          <button
            onClick={onUploadClick}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "18px",
              border: "2px solid #ff4f87",
              backgroundColor: "white",
              color: "#ff4f87",
              fontSize: "18px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(255,79,135,0.10)",
            }}
          >
            🖼️ 불러오기
          </button>

          <button
            onClick={onGalleryClick}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "18px",
              border: "2px solid #d9b8ff",
              backgroundColor: "#fbf7ff",
              color: "#a26be8",
              fontSize: "18px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(162,107,232,0.12)",
            }}
          >
            💗 내 보관함
          </button>

          <div
            style={{
              marginTop: "18px",
              paddingTop: "20px",
              borderTop: "1px dashed #ffd1e0",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <button
              onClick={onShareAppClick}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "18px",
                border: "2px solid #ffc1b8",
                backgroundColor: "#fff7f5",
                color: "#ff6f61",
                fontSize: "18px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 6px 18px rgba(255,111,97,0.12)",
              }}
            >
              친구 초대하기
            </button>
              {inviteGuest && <p style={{fontSize:13,color:"#795664",lineHeight:1.6}}>로그인 후 친구를 초대하면 새 친구의 첫 GIF 또는 AI 영상 완성 시 2크레딧을 받을 수 있어요.</p>}
              {inviteMessage && <p role="status">{inviteMessage}</p>}

            <button
              hidden={Capacitor.isNativePlatform()}
              onClick={handleInstallApp}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "18px",
                border: "2px solid #ffd1e0",
                backgroundColor: "#fff8fb",
                color: "#ff4f87",
                fontSize: "18px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 6px 18px rgba(255,79,135,0.10)",
              }}
            >
              📱 홈화면에 설치하기
            </button>
            {fullscreenAvailable && <button type="button" onClick={onFullscreenClick} style={{width:"100%",padding:14,borderRadius:16,border:"1px solid #e5d2f1",background:"#f7f0fc",color:"#7549ae",fontWeight:800,cursor:"pointer"}}>{fullscreen ? "전체화면 닫기" : "전체화면으로 보기"}</button>}
          </div>
        </div>

        <p
          style={{
            marginTop: "20px",
            marginBottom: 0,
            fontSize: "13px",
            lineHeight: 1.6,
            color: "#999",
          }}
        >
          사진을 깨끗한 배경에서 찍으면
          <br />더 멋진 내짤을 만들 수 있습니다.
        </p>

        {/* 밤나무랩 앱 소개 */}
        <div
          style={{
            marginTop: "24px",
            padding: "14px",
            borderRadius: "16px",
            background: "#fff8fb",
            border: "1px solid #f5d9e3",
            textAlign: "center",
          }}
        >
          <img
            src="/bamnamulab-logo.png"
            alt="밤나무랩"
            style={{
              width: "56px",
              height: "56px",
              objectFit: "contain",
              marginBottom: "8px",
            }}
          />

          <div
            style={{
              fontWeight: 700,
              fontSize: "13px",
              color: "#555",
              marginBottom: "10px",
            }}
          >
            밤나무랩이 만든 앱
          </div>

          <a
            href="https://mom-is-flower.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              textDecoration: "none",
              padding: "10px",
              borderRadius: "12px",
              background: "#fff",
              border: "1px solid #f3d7e2",
              color: "inherit",
            }}
          >
            <div
              style={{
                color: "#ff4f87",
                fontWeight: 700,
                fontSize: "20px",
                marginBottom: "6px",
              }}
            >
              🌸 엄마는꽃
            </div>

            <div
              style={{
                fontSize: "12px",
                color: "#777",
                lineHeight: 1.6,
              }}
            >
              꽃을 좋아하는 엄마에게
              <br />
              꽃 이름을 선물하세요.
              <br />
              AI가 꽃 이름과 꽃의 이야기를 찾아주는 앱
            </div>
          </a>
        </div>

        {footer}

        <div
          className="nz-home-copyright"
          style={{
            marginTop: "24px",
            textAlign: "center",
            color: "#b8a5ac",
            fontSize: "11px",
            lineHeight: 1.8,
            fontWeight: 600,
            letterSpacing: "0.2px",
          }}
        >
          <div>친구들과의 추억을 움직이는 짤로 ✿</div>
          <div>© 2026 내짤4짤 · ver 1.2.1</div>
        </div>
      </div>
    </div>
  );
}

export default StartScreen;
