import { useState } from 'react';
import { externalBrowserUrl } from '../lib/browserEntry';
export default function AppLinkCopyGuide() {
  const url=new URL(externalBrowserUrl(location.href));url.searchParams.delete('copy');
  const target=url.href;
  const [message,setMessage]=useState('');
  return <main style={{maxWidth:420,margin:'32px auto',padding:24,background:'#fff7fb',borderRadius:24,color:'#63495d',lineHeight:1.7}}>
    <h1 style={{fontSize:24}}>앱 주소 복사 안내</h1>
    <p>쾌적한 사용 환경을 위해 복사한 주소를 Safari 또는 Chrome에 붙여넣어 주세요.</p>
    <p>초대 코드가 있는 주소는 초대 정보도 함께 유지돼요.</p>
    <button onClick={async()=>{try{await navigator.clipboard.writeText(target);setMessage('앱 주소를 복사했어요.');}catch{setMessage('아래 주소를 길게 눌러 복사해주세요.');}}} style={{width:'100%',padding:15,border:0,borderRadius:14,background:'#7549ae',color:'white',fontWeight:800}}>앱 주소 복사하기</button>
    <textarea aria-label="복사할 앱 주소" readOnly value={target} onFocus={e=>e.currentTarget.select()} style={{boxSizing:'border-box',marginTop:16,width:'100%',minHeight:70}}/>
    {message&&<p role="status">{message}</p>}
    <a href={target}>내짤4짤 시작하기</a>
  </main>;
}
