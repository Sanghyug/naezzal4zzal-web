type StartScreenProps = {
  onCameraClick: () => void;
  onUploadClick: () => void;
};

function StartScreen({ onCameraClick, onUploadClick }: StartScreenProps) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(to bottom, #fff1f5, #ffe4ec)",
        padding: "18px",
        boxSizing: "border-box",
        fontFamily: "sans-serif",
      }}
    >
      <div
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

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginTop: "28px",
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
        <div
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
          <div>© 2026 내짤4짤 · ver 1.0 beta</div>
        </div>
      </div>
    </div>
  );
}

export default StartScreen;
