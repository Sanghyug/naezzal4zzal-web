import fs from 'node:fs';
import {chromium} from '@playwright/test';
const response=JSON.parse(fs.readFileSync('artifacts/real-photo/response.json','utf8'));
if(response.cells?.length!==4) throw new Error('Four detected panels are required');
const browser=await chromium.launch({channel:'chrome'});
try{
const page=await browser.newPage();
await page.goto("http://127.0.0.1:5173/");
const source=fs.readFileSync('artifacts/real-photo/source.jpg').toString('base64');
const result=await page.evaluate(async({source,cells})=>{
 const image=new Image();image.src='data:image/jpeg;base64,'+source;await image.decode();
 const boxCanvas=document.createElement('canvas');boxCanvas.width=image.width;boxCanvas.height=image.height;const bc=boxCanvas.getContext('2d');bc.drawImage(image,0,0);
 const scale=1000/Math.max(image.width,image.height), offsetX=(1000-image.width*scale)/2, offsetY=(1000-image.height*scale)/2;
 const {refineVerticalCells}=await import('/src/lib/refinePhotoCells.ts');
 const pixels=bc.getImageData(0,0,image.width,image.height);
 const mapped=cells.map(c=>({x:(c.x-offsetX)/scale,y:(c.y-offsetY)/scale,width:c.width/scale,height:c.height/scale}));
 const refined=refineVerticalCells(pixels.data,image.width,image.height,mapped);
 cells=refined.map(c=>({x:c.x*scale+offsetX,y:c.y*scale+offsetY,width:c.width*scale,height:c.height*scale}));
 const crops=[]; const colors=['#ec2968','#357de0','#188f5d','#974dc4'];
 const sheet=document.createElement('canvas');sheet.width=1008;sheet.height=824;const sc=sheet.getContext('2d');sc.fillStyle='#fff0f5';sc.fillRect(0,0,sheet.width,sheet.height);
 for(let i=0;i<cells.length;i++){
  const cell=cells[i];const x=(cell.x-offsetX)/scale,y=(cell.y-offsetY)/scale,w=cell.width/scale,h=cell.height/scale;
  bc.strokeStyle=colors[i];bc.lineWidth=4;bc.strokeRect(x,y,w,h);bc.fillStyle=colors[i];bc.fillRect(x,y,30,30);bc.fillStyle='white';bc.font='bold 24px sans-serif';bc.fillText(String(i+1),x+7,y+24);
  const canvas=document.createElement('canvas');canvas.width=480;canvas.height=380;canvas.getContext('2d').drawImage(image,x,y,w,h,0,0,480,380);crops.push(canvas.toDataURL('image/png').split(',')[1]);
  const sx=16+(i%2)*496,sy=28+Math.floor(i/2)*404;sc.drawImage(canvas,sx,sy);sc.fillStyle='#674452';sc.font='bold 18px sans-serif';sc.fillText(String(i+1),sx+6,sy-6);
 }
 return {cells,overlay:boxCanvas.toDataURL('image/png').split(',')[1],sheet:sheet.toDataURL('image/png').split(',')[1],crops};
},{source,cells:response.cells});
for(const [name,data] of [['detected-panels.png',result.overlay],['four-cuts.png',result.sheet],...result.crops.map((v,i)=>['cut-'+(i+1)+'.png',v])])fs.writeFileSync('artifacts/real-photo/'+name,Buffer.from(data,'base64'));
fs.writeFileSync('artifacts/real-photo/refined-response.json',JSON.stringify({...response,cells:result.cells},null,2));
console.log(JSON.stringify({rendered:4,model:response.model,cells:result.cells}));
}finally{await browser.close();}
