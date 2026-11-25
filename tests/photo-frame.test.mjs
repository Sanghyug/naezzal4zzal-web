import test from 'node:test';
import assert from 'node:assert/strict';
import {commonPhotoRatio,containPhoto} from '../src/lib/photoFrame.ts';
test('one common frame contains diverse portrait, landscape and perspective panel sizes without distortion or cropping',()=>{
  for(const sizes of [[{width:320,height:240},{width:330,height:260},{width:290,height:240},{width:340,height:270}],[{width:120,height:400},{width:400,height:120},{width:200,height:200},{width:300,height:400}]]){
    const ratio=commonPhotoRatio(sizes), frame={width:480,height:480/ratio};
    for(const photo of sizes){const box=containPhoto(photo,frame);assert.ok(box.x>=-1e-9&&box.y>=-1e-9);assert.ok(box.x+box.width<=frame.width+1e-9&&box.y+box.height<=frame.height+1e-9);assert.ok(Math.abs(box.width/box.height-photo.width/photo.height)<1e-9);}
  }
  assert.equal(commonPhotoRatio([]),4/3);
});
