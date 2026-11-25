import ShareControls from "./ShareControls";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [filter, setFilter] = useState<"all" | "gif" | "video">("all");
  const filteredItems = items.filter(item => filter === "all" || (item.mediaType || "gif") === filter);

  const urlsRef = useRef<string[]>([]);
  const activeRef = useRef(true);
  const loadItems = useCallback(async () => {
    try {
      const savedItems = await getGalleryItems();
      if (!activeRef.current) { savedItems.forEach(item => { URL.revokeObjectURL(item.gifUrl); if(item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl); }); return; }
      urlsRef.current.forEach(url => URL.revokeObjectURL(url));
      urlsRef.current = savedItems.flatMap(item => item.thumbnailUrl ? [item.gifUrl,item.thumbnailUrl] : [item.gifUrl]);
      setItems(savedItems);
    } catch (error) {
      console.error(error);
      alert("보관함을 불러오지 못했어요.");
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    activeRef.current = true;
    // IndexedDB results arrive asynchronously; there is no synchronous state update here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadItems();
    return () => { activeRef.current = false; urlsRef.current.forEach(url => URL.revokeObjectURL(url)); };
  }, [loadItems]);

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
          💡 완성한 움짤과 영상은 이 기기에 보관됩니다.
          <br />
          기기에 보관한 영상은 서버 보관 기간 7일이 지나도 이용할 수 있어요.
          <br />
          앱을 삭제하거나 브라우저 데이터를 지우거나 기기를 변경하면 사라질 수 있으니, 소중한
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

        <div role="tablist" aria-label="보관함 필터" style={{display:'flex',gap:8,marginBottom:18}}>
          {([['all','전체'],['gif','움짤'],['video','AI 영상']] as const).map(([value,label],index)=><button key={value} role="tab" id={'gallery-tab-'+value} aria-selected={filter===value} aria-controls="gallery-items" tabIndex={filter===value?0:-1} onClick={()=>setFilter(value)} onKeyDown={e=>{const values=['all','gif','video'] as const; const next=e.key==='ArrowRight'?(index+1)%3:e.key==='ArrowLeft'?(index+2)%3:e.key==='Home'?0:e.key==='End'?2:-1;if(next>=0){e.preventDefault();setFilter(values[next]);document.getElementById('gallery-tab-'+values[next])?.focus();}}} style={{flex:1,padding:'12px 4px',borderRadius:14,border:'1px solid #edcfe1',background:filter===value?'#7549ae':'#fff7fb',color:filter===value?'white':'#795664',fontWeight:800,cursor:'pointer'}}>{label}</button>)}
        </div>
        <div id="gallery-items" role="tabpanel" aria-labelledby={'gallery-tab-'+filter}>
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

        {!isLoading && filteredItems.length === 0 && (
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
            {filter === "all" ? "아직 저장된 내짤이 없어요." : filter === "video" ? "아직 저장된 AI 영상이 없어요." : "아직 저장된 움짤이 없어요."}
            <br />첫 번째 움직이는 추억을 만들어보세요 ✨
          </div>
        )}

        {!isLoading && filteredItems.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            {filteredItems.map((item) => (
              <button
                key={item.id}
                aria-label={item.mediaType === "video" ? `${videoLabel(item)} · ${item.memo}` : undefined}
                onClick={() => setSelectedItem(item)}
                style={{
                  minWidth: 0,
                  padding: 0,
                  border: "none",
                  backgroundColor: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    borderRadius: "20px",
                    overflow: "hidden",
                    backgroundColor: "#fff7fa",
                    border: "1px solid #ffd8e5",
                    boxShadow: "0 6px 16px rgba(255,79,135,0.10)",
                  }}
                >
                  {item.mediaType === "video" ? <div style={{position:'relative',background:'#f5f5f5'}}>
                    {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.memo} style={{width:'100%',display:'block',aspectRatio:'1 / 1.25',objectFit:'contain'}}/> : <video src={item.gifUrl+'#t=0.05'} muted playsInline preload="metadata" aria-label={item.memo} style={{width:'100%',display:'block',aspectRatio:'1 / 1.25',objectFit:'contain'}}/>}
                    <span aria-hidden="true" style={{position:'absolute',inset:0,display:'grid',placeItems:'center',pointerEvents:'none'}}><span style={{background:'#0009',borderRadius:'50%',color:'white',padding:'12px 15px',fontSize:20}}>▶</span></span>
                  </div> : <img
                    src={item.gifUrl}
                    alt={item.memo}
                    style={{
                      width: "100%",
                      display: "block",
                      aspectRatio: "1 / 1.25",
                      objectFit: "cover",
                      backgroundColor: "#f5f5f5",
                    }}
                  />}

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
                      {item.mediaType === "video" ? videoLabel(item) : item.styleName || "기본 GIF"}
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

        </div>
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
            role="dialog" aria-modal="true" aria-label="보관한 내짤"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "420px",
              maxHeight: "calc(100dvh - 36px)",
              overflowY: "auto",
              backgroundColor: "white",
              borderRadius: "28px",
              padding: "18px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.30)",
              textAlign: "center",
            }}
          >
            {selectedItem.mediaType === "video" ? <video src={selectedItem.gifUrl} controls playsInline aria-label={selectedItem.memo} style={{width:"100%",display:"block",borderRadius:22}} /> : <img
              src={selectedItem.gifUrl}
              alt={selectedItem.memo}
              style={{
                width: "100%",
                display: "block",
                borderRadius: "22px",
                backgroundColor: "#f5f5f5",
              }}
            />}

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
              {selectedItem.mediaType === "video" ? videoLabel(selectedItem) : selectedItem.styleName || "기본 GIF"}
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

            <ShareControls key={selectedItem.id} url={selectedItem.gifUrl} video={selectedItem.mediaType === "video"} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "9px",
                marginTop: "16px",
              }}
            >
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

function videoLabel(item: SavedNaezzalItem) { return /애니메이션|펜화|drawing/i.test(item.styleName) ? '애니메이션 영상' : '실사 영상'; }
export default GalleryScreen;
