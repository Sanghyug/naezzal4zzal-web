export default function PrivacyScreen({onBack}: {onBack: () => void}) {
  return <main style={{maxWidth: 480, margin: "0 auto", padding: 24, fontFamily: "sans-serif", lineHeight: 1.8, color: "#55424b"}}>
    <h1 style={{fontSize: 24}}>사진과 개인정보 안내</h1>
    <p>내짤4짤은 로그인 없이 종이 네컷사진을 편집하고 움직이는 GIF로 만드는 앱입니다.</p>
    <h2 style={{fontSize: 18}}>사진을 보내는 경우</h2>
    <p>사진마다 ‘사진 전송에 동의하고 AI로 찾기’를 선택할 때에만 분석용으로 크기를 줄인 사진 한 장을 앱의 분석 서버와 OpenAI로 보냅니다. 사진 속 얼굴 등 포함된 내용도 함께 전송됩니다. 목적은 네 사진의 위치를 찾는 것입니다. 메모와 보관함은 분석 서버에 보내지 않습니다.</p>
    <p>앱 서버는 분석 사진을 별도 보관함에 저장하지 않도록 구현되어 있습니다. OpenAI에는 응답 저장을 끄고 요청합니다. 다만 이는 제공업체의 모든 로그나 보관이 없다는 뜻은 아닙니다. 제공업체의 데이터 처리 안내를 확인해주세요.</p>
    <a href="https://platform.openai.com/docs/guides/your-data" target="_blank" rel="noreferrer">OpenAI API 데이터 처리 안내</a>
    <h2 style={{fontSize: 18}}>사진을 보내지 않는 방법</h2>
    <p>‘사진 전송 없이 직접 맞추기’를 선택하면 사진을 외부로 보내지 않고 기기 안에서 편집하고 GIF를 만들 수 있습니다.</p>
    <h2 style={{fontSize: 18}}>보관과 삭제</h2>
    <p>완성한 GIF와 메모는 이 기기의 앱 또는 브라우저 안에 저장됩니다. 보관함에서 항목을 삭제할 수 있습니다. 앱 삭제, 브라우저 데이터 삭제, 기기 변경 시 사라질 수 있으니 소중한 파일은 ‘기기에 저장하기’로 따로 보관해주세요. 공유를 선택하면 선택한 다른 앱으로 GIF가 전달됩니다.</p>
    <h2 style={{fontSize: 18}}>문의</h2>
    <p><a href="https://github.com/Sanghyug/naezzal4zzal-web/issues" target="_blank" rel="noreferrer">내짤4짤 문의 페이지</a>에 오류를 알려주세요. 공개 문의에 개인 사진이나 개인정보를 올리지 마세요.</p>
    <p>개발 중 안내 · 2026년 11월 22일</p>
    <button onClick={onBack} style={{padding: 14, width: "100%"}}>돌아가기</button>
  </main>;
}
