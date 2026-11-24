import BusinessInfo from "./BusinessInfo";
import { BUSINESS, supportMailto } from "../lib/business";

export default function PrivacyScreen({onBack}: {onBack: () => void}) {
  return <main style={{maxWidth: 480, margin: "0 auto", padding: 24, fontFamily: "sans-serif", lineHeight: 1.8, color: "#55424b"}}>
    <h1 style={{fontSize: 24}}>사진과 개인정보 안내</h1>
    <p>내짤4짤은 로그인 없이 종이 네컷사진을 편집하고 움직이는 GIF로 만드는 앱입니다.</p>
    <h2 style={{fontSize: 18}}>사진을 보내는 경우</h2>
    <p>사진마다 ‘사진 전송에 동의하고 AI로 찾기’를 선택할 때에만 분석용으로 크기를 줄인 사진 한 장을 앱의 분석 서버와 OpenAI로 보냅니다. 사진 속 얼굴 등 포함된 내용도 함께 전송됩니다. 목적은 네 사진의 위치를 찾는 것입니다. 메모와 보관함은 분석 서버에 보내지 않습니다.</p>
    <p>앱 서버는 분석 사진을 별도 보관함에 저장하지 않도록 구현되어 있습니다. OpenAI에는 응답 저장을 끄고 요청합니다. 다만 이는 제공업체의 모든 로그나 보관이 없다는 뜻은 아닙니다. 제공업체의 데이터 처리 안내를 확인해주세요.</p>
    <a href="https://platform.openai.com/docs/guides/your-data" target="_blank" rel="noreferrer">OpenAI API 데이터 처리 안내</a>
    <h2 style={{fontSize: 18}}>AI 영상 제작</h2>
    <p>영상 제작 안내에 동의하고 제작 버튼을 누를 때, 편집한 네 사진을 앱 서버를 거쳐 HeyGen으로 보내 새 5초 영상을 만듭니다. 원본과 다른 표정·동작이 생길 수 있습니다. 사진 속 사람의 허락을 받고 사용해주세요. 제작 비용은 운영자의 HeyGen API 계정에서 차감됩니다. 참고 사진과 완성 영상은 HeyGen 작업 공간에 남을 수 있으며, 운영자에게 삭제를 요청할 수 있습니다. GIF를 만드는 데 영상 제작은 필요하지 않습니다.</p>
    <a href="https://www.heygen.com/privacy" target="_blank" rel="noreferrer">HeyGen 개인정보 안내</a>
    <h2 style={{fontSize: 18}}>공유 보상</h2>
    <p>공유 횟수와 열린 GIF 스타일·프레임은 현재 기기의 브라우저에 저장됩니다. 편집 화면과 보관함에서 공유한 기록을 함께 사용합니다. 공유 메뉴 완료 또는 파일을 친구에게 보냈다는 직접 확인을 기준으로 기록하며, 상대방의 실제 수신 여부를 확인하지 않습니다. 공유 취소와 다운로드만으로는 보상이 열리지 않습니다.</p>
    <h2 style={{fontSize: 18}}>사진을 보내지 않는 방법</h2>
    <p>‘사진 전송 없이 직접 맞추기’를 선택하고 AI 영상 제작을 시작하지 않으면 사진을 외부로 보내지 않고 기기 안에서 편집하고 GIF를 만들 수 있습니다.</p>
    <h2 style={{fontSize: 18}}>보관과 삭제</h2>
    <p>완성한 GIF·영상과 메모는 이 기기의 앱 또는 브라우저 안에 저장됩니다. 보관함에서 항목을 삭제할 수 있습니다. 앱 삭제, 브라우저 데이터 삭제, 기기 변경 시 사라질 수 있으니 소중한 파일은 ‘기기에 저장하기’로 따로 보관해주세요. 공유를 선택하면 선택한 다른 앱으로 GIF가 전달됩니다.</p>
    <h2 style={{fontSize: 18}}>개인정보 보호책임자 및 문의</h2>
    <p>개인정보 보호책임자: {BUSINESS.name} 대표 {BUSINESS.representative}</p>
    <p>서비스 문의와 개인정보 열람·정정·삭제·처리정지, 동의 철회 및 계정 탈퇴 요청은 <a href={supportMailto("내짤4짤 개인정보·서비스 문의")}>{BUSINESS.supportEmail}</a>로 보내주세요. 요청 내용을 확인하고 필요한 경우 본인 확인을 거쳐 처리 결과를 안내합니다.</p>
    <h2 style={{fontSize: 18}}>서비스 운영자</h2>
    <BusinessInfo />
    <p>적용일 · 2026년 11월 24일</p>
    <button onClick={onBack} style={{padding: 14, width: "100%"}}>돌아가기</button>
  </main>;
}
