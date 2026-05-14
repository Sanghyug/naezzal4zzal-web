function SplashScreen() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(to bottom, #fff1f5, #ffe4ec)",
        overflow: "hidden",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          animation: "fadeUp 1.2s ease",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <img
          src="/main-logo.png"
          alt="내짤4짤"
          style={{
            width: "150px",
            marginBottom: "8px",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />

        <img
          src="/title-logo.png"
          alt="내짤4짤"
          style={{
            width: "230px",
            maxWidth: "82vw",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            marginTop: "20px",
            color: "#8d6f79",
            fontSize: "15px",
            fontWeight: 700,
            letterSpacing: "-0.2px",
          }}
        >
          친구들과의 추억을 움직이는 짤로 ✨
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "42px",
          textAlign: "center",
          color: "#c2aab3",
          fontSize: "11px",
          lineHeight: 1.7,
          fontWeight: 600,
        }}
      >
        <div>© 2026 내짤4짤</div>
        <div>ver 1.0 beta</div>
      </div>

      <style>
        {`
          @keyframes fadeUp {
            0% {
              opacity: 0;
              transform: translateY(16px) scale(0.96);
            }

            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}
      </style>
    </div>
  );
}

export default SplashScreen;