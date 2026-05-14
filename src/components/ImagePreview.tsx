type ImagePreviewProps = {
  imageUrl: string;
  onReset: () => void;
};

function ImagePreview({ imageUrl, onReset }: ImagePreviewProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #fff1f5, #ffe4ec)",
        padding: "24px",
        boxSizing: "border-box",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "420px",
          margin: "0 auto",
          backgroundColor: "white",
          borderRadius: "28px",
          padding: "20px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
          textAlign: "center",
        }}
      >
        <h2 style={{ color: "#ff4f87", marginTop: 0 }}>사진을 불러왔어요</h2>

        <img
          src={imageUrl}
          alt="업로드한 네컷 사진"
          style={{
            width: "100%",
            maxHeight: "560px",
            objectFit: "contain",
            borderRadius: "20px",
            backgroundColor: "#f5f5f5",
          }}
        />

        <button
          onClick={onReset}
          style={{
            marginTop: "20px",
            width: "100%",
            padding: "16px",
            borderRadius: "16px",
            border: "none",
            backgroundColor: "#ff4f87",
            color: "white",
            fontSize: "17px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          다른 사진 고르기
        </button>
      </div>
    </div>
  );
}

export default ImagePreview;