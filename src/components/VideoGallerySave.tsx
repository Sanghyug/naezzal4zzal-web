import { useRef, useState } from 'react';
import { saveGalleryItem } from '../lib/galleryStore';
export default function VideoGallerySave({url,memo,styleName}:{url:string;memo:string;styleName:string}) {
  const [state,setState]=useState<'ready'|'saving'|'saved'>('ready');
  const [error,setError]=useState(''); const locked=useRef(false);
  return <>
    <button className="nz-gallery-save" disabled={state!=='ready'} onClick={async()=>{
      if(locked.current)return;locked.current=true;setState('saving');setError('');
      try { const saved=await saveGalleryItem(url,memo,styleName,'video');URL.revokeObjectURL(saved.gifUrl);setState('saved'); }
      catch {setError('보관함에 저장하지 못했어요. 기기에 저장하거나 다시 시도해주세요.');setState('ready');}
      finally {locked.current=false;}
    }}>{state==='saved'?'보관함 저장 완료':state==='saving'?'저장 중...':'보관함에 저장하기'}</button>
    {error&&<p role="status">{error}</p>}
  </>;
}
