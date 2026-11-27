import { Capacitor } from "@capacitor/core";
import { useState } from "react";
import InstallGuide from "./InstallGuide";
import { useInstallApp } from "../lib/useInstallApp";
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
  fullscreenNotice?: string;
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
  fullscreenNotice,
}: StartScreenProps) {
  const { installed, install } = useInstallApp();
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const handleInstallApp = async () => {
    if (installed || !(await install())) setShowInstallGuide(true);
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
            {showInstallGuide && <InstallGuide onClose={() => setShowInstallGuide(false)} />}
            {!Capacitor.isNativePlatform() && <button type="button" onClick={onFullscreenClick} style={{width:"100%",padding:14,borderRadius:16,border:"1px solid #e5d2f1",background:"#f7f0fc",color:"#7549ae",fontWeight:800,cursor:"pointer"}}>{fullscreen && fullscreenAvailable ? "전체화면 닫기" : "전체화면으로 보기"}</button>}
            {fullscreenNotice && <p role="status" style={{fontSize:13,color:"#795664",lineHeight:1.6}}>{fullscreenNotice}</p>}
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
            href="https://mea-luna.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{display:"block",textDecoration:"none",padding:"12px",borderRadius:"12px",background:"#fff",border:"1px solid #e4d9ef",color:"inherit",marginBottom:"12px"}}
          >
            <img src="https://mymoon-two.vercel.app/assets/images/moon_prophet.png" alt="나의 달 대표 일러스트" loading="lazy" style={{display:"block",width:"100%",maxHeight:220,objectFit:"contain",borderRadius:10,marginBottom:10}} />
            <div style={{color:"#7653a1",fontWeight:700,fontSize:20}}>나의 달</div>
            <div style={{fontSize:12,color:"#7653a1",marginBottom:8}}>Mea-Luna</div>
            <div style={{fontSize:12,color:"#777",lineHeight:1.7}}>내가 태어난 순간의 달은 어떤 모습이었을까요?<br />수호 달, 성격 이야기, MBTI 비교, 오늘의 운세를<br />무료로 재미있게 볼 수 있어요.</div>
            <div style={{marginTop:10,padding:"9px 12px",borderRadius:10,background:"#7653a1",color:"#fff",fontWeight:700,fontSize:13}}>나의 달 보러가기</div>
          </a>
          <a
            href="https://momisflower.com"
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
            <div style={{fontSize:12,color:"#a05a78",marginBottom:8}}>Mom-is-Flower</div>

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
            <div style={{marginTop:10,padding:"9px 12px",borderRadius:10,background:"#ff4f87",color:"#fff",fontWeight:700,fontSize:13}}>엄마는꽃 보러가기</div>
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
