import { useEffect, useState } from "react";
import {
  deleteGalleryItem,
  getGalleryItems,
  type SavedNaezzalItem,
} from "../lib/galleryStore";

type GalleryScreenProps = {
  onBack: () => void;
};

function GalleryScreen({ onBack }: GalleryScreenProps) {
  const [items, setItems] = useState<SavedNaezzalItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SavedNaezzalItem | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setIsLoading(true);
      const savedItems = await getGalleryItems();
      setItems(savedItems);
    } catch (error) {
      console.error(error);
      alert("보관함을 불러오지 못했어요.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm("이 내짤을 보관함에서 삭제할까요?");
    if (!ok) return;

    try {
      await deleteGalleryItem(id);
      setSelectedItem(null);
      await loadItems();
    } catch (error) {
      console.error(error);
      alert("삭제하는 중 문제가 생겼어요.");
    }
  };

  const handleShare = async (item: SavedNaezzalItem) => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (!isMobile) {
      alert(
        "PC 브라우저에서는 GIF 파일 공유가 불안정해요.\n스마트폰에서 공유하거나, 다운로드 기능을 이용해주세요.",
      );
      return;
    }

    try {
      const response = await fetch(item.gifUrl);
      const blob = await response.blob();

      const file = new File([blob], "naezzal4zzal.gif", {
        type: "image/gif",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "내짤4짤",
          text: item.memo,
          files: [file],
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: "내짤4짤",
          text: `${item.memo}\n내짤4짤에서 만든 움직이는 네컷 추억.`,
          url: window.location.origin,
        });
        return;
      }

      alert("이 브라우저에서는 공유 기능을 사용할 수 없어요.");
    } catch (error) {
      console.error(error);
      alert("공유하는 중 문제가 생겼어요.");
    }
  };

  const handleDownload = (item: SavedNaezzalItem) => {
    const link = document.createElement("a");
    link.href = item.gifUrl;
    link.download = "naezzal4zzal.gif";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const formatDate = (createdAt: string) => {
    const date = new Date(createdAt);

    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(to bottom, #fff1f5, #ffe4ec)",
        padding: "18px",
        boxSizing: "border-box",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "460px",
          margin: "0 auto",
          backgroundColor: "white",
          borderRadius: "30px",
          padding: "20px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#ff4f87",
            textAlign: "center",
            fontSize: "25px",
            fontWeight: 900,
          }}
        >
          💗 내 보관함
        </h2>

        <div
          style={{
            marginTop: 12,
            marginBottom: 20,
            padding: 12,
            borderRadius: 12,
            background: "#f5f5f5",
            fontSize: 13,
            lineHeight: 1.6,
            color: "#555",
          }}
        >
          💡 내짤4짤은 서버 없이 동작하는 웹앱입니다.
          <br />
          저장된 내짤은 이 기기의 브라우저 안에만 보관됩니다.
          <br />
          브라우저 데이터를 삭제하거나 기기를 변경하면 사라질 수 있으니, 소중한
          추억은 반드시 <strong>기기에 저장하기</strong>를 이용해 사진첩 또는
          다운로드 폴더에 보관해주세요.
        </div>

        <p
          style={{
            marginTop: "10px",
            marginBottom: "18px",
            color: "#9b8790",
            textAlign: "center",
            fontSize: "13px",
            lineHeight: 1.6,
            fontWeight: 700,
          }}
        >
          저장한 움직이는 네컷 추억을
          <br />
          다시 보고 공유할 수 있어요.
        </p>

        {isLoading && (
          <div
            style={{
              padding: "40px 0",
              textAlign: "center",
              color: "#aaa",
              fontWeight: 800,
            }}
          >
            보관함을 불러오는 중...
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div
            style={{
              padding: "42px 18px",
              borderRadius: "24px",
              backgroundColor: "#fff7fa",
              textAlign: "center",
              color: "#b79aa5",
              fontWeight: 800,
              lineHeight: 1.7,
            }}
          >
            아직 저장된 내짤이 없어요.
            <br />첫 번째 움직이는 추억을 만들어보세요 ✨
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                style={{
                  padding: 0,
                  border: "none",
                  backgroundColor: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    borderRadius: "20px",
                    overflow: "hidden",
                    backgroundColor: "#fff7fa",
                    border: "1px solid #ffd8e5",
                    boxShadow: "0 6px 16px rgba(255,79,135,0.10)",
                  }}
                >
                  <img
                    src={item.gifUrl}
                    alt={item.memo}
                    style={{
                      width: "100%",
                      display: "block",
                      aspectRatio: "1 / 1.25",
                      objectFit: "cover",
                      backgroundColor: "#f5f5f5",
                    }}
                  />

                  <div
                    style={{
                      padding: "9px 10px 10px",
                    }}
                  >
                    <div
                      style={{
                        color: "#6f5961",
                        fontSize: "12px",
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.memo}
                    </div>

                    <div
                      style={{
                        marginTop: "4px",
                        color: "#ff6f9d",
                        fontSize: "10px",
                        fontWeight: 900,
                      }}
                    >
                      {item.styleName || "기본 GIF"}
                    </div>

                    <div
                      style={{
                        marginTop: "4px",
                        color: "#c7aab5",
                        fontSize: "10px",
                        fontWeight: 800,
                      }}
                    >
                      {formatDate(item.createdAt)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onBack}
          style={{
            marginTop: "18px",
            width: "100%",
            padding: "15px",
            borderRadius: "17px",
            border: "none",
            backgroundColor: "#9b9b9b",
            color: "white",
            fontSize: "16px",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          홈으로 돌아가기
        </button>
      </div>

      {selectedItem && (
        <div
          onClick={() => setSelectedItem(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 30,
            backgroundColor: "rgba(0,0,0,0.52)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "18px",
            boxSizing: "border-box",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "420px",
              backgroundColor: "white",
              borderRadius: "28px",
              padding: "18px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.30)",
              textAlign: "center",
            }}
          >
            <img
              src={selectedItem.gifUrl}
              alt={selectedItem.memo}
              style={{
                width: "100%",
                display: "block",
                borderRadius: "22px",
                backgroundColor: "#f5f5f5",
              }}
            />

            <div
              style={{
                marginTop: "12px",
                color: "#6f5961",
                fontSize: "15px",
                fontWeight: 900,
                lineHeight: 1.5,
              }}
            >
              {selectedItem.memo}
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "#ff6f9d",
                fontSize: "12px",
                fontWeight: 900,
              }}
            >
              {selectedItem.styleName || "기본 GIF"}
            </div>

            <div
              style={{
                marginTop: "4px",
                color: "#c7aab5",
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              {formatDate(selectedItem.createdAt)}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "9px",
                marginTop: "16px",
              }}
            >
              <button
                onClick={() => handleShare(selectedItem)}
                style={modalPinkButtonStyle}
              >
                공유하기
              </button>

              <button
                onClick={() => handleDownload(selectedItem)}
                style={modalLavenderButtonStyle}
              >
                다운로드
              </button>

              <button
                onClick={() => handleDelete(selectedItem.id)}
                style={modalGrayButtonStyle}
              >
                삭제
              </button>

              <button
                onClick={() => setSelectedItem(null)}
                style={modalSoftButtonStyle}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalPinkButtonStyle: React.CSSProperties = {
  padding: "13px 8px",
  borderRadius: "15px",
  border: "none",
  backgroundColor: "#ff4f87",
  color: "white",
  fontSize: "14px",
  fontWeight: 900,
  cursor: "pointer",
};

const modalLavenderButtonStyle: React.CSSProperties = {
  padding: "13px 8px",
  borderRadius: "15px",
  border: "none",
  backgroundColor: "#b88cff",
  color: "white",
  fontSize: "14px",
  fontWeight: 900,
  cursor: "pointer",
};

const modalGrayButtonStyle: React.CSSProperties = {
  padding: "13px 8px",
  borderRadius: "15px",
  border: "none",
  backgroundColor: "#aaa",
  color: "white",
  fontSize: "14px",
  fontWeight: 900,
  cursor: "pointer",
};

const modalSoftButtonStyle: React.CSSProperties = {
  padding: "13px 8px",
  borderRadius: "15px",
  border: "1px solid #ffd1e0",
  backgroundColor: "#fff6fa",
  color: "#ff4f87",
  fontSize: "14px",
  fontWeight: 900,
  cursor: "pointer",
};

export default GalleryScreen;
