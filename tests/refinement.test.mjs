import {test} from 'node:test';import assert from 'node:assert/strict';
import {refineVerticalCells} from '../src/lib/refinePhotoCells.ts';
test('repeated paper borders recover complete panels from narrow AI boxes',()=>{
 const w=240,h=1000,data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let value=190;for(let i=0;i<4;i++)if(x>=50&&x<190&&y>=80+i*196&&y<260+i*196)value=70+Math.floor((y-80-i*196)/12)%2*35;const at=(y*w+x)*4;data[at]=data[at+1]=data[at+2]=value;data[at+3]=255;}
 const seeds=Array.from({length:4},(_,i)=>({x:55,y:90+i*196,width:110,height:170}));const out=refineVerticalCells(data,w,h,seeds);assert.equal(out.length,4);for(let i=0;i<4;i++){assert.ok(Math.abs(out[i].x-50)<5);assert.ok(Math.abs(out[i].width-140)<8);assert.ok(Math.abs(out[i].y-(80+i*196))<6);assert.ok(Math.abs(out[i].height-180)<10);}
});
test('uniform images do not manufacture confident boundaries',()=>{const data=new Uint8ClampedArray(240*1000*4).fill(120);const seeds=Array.from({length:4},(_,i)=>({x:55,y:90+i*196,width:110,height:170}));assert.deepEqual(refineVerticalCells(data,240,1000,seeds),seeds);});
