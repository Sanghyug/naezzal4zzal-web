import { validateCells, type CellRect } from "./photoGeometry.js";

// Refine a vertical print using image edges, without identifying the people.
// Uncertain images keep their AI boxes and can still be adjusted manually.
export function refineVerticalCells(data: Uint8ClampedArray, width: number, height: number, cells: CellRect[]): CellRect[] {
  if (cells.length !== 4) return cells;
  const sorted = [...cells].sort((a,b)=>a.y-b.y);
  const median = (values: number[]) => { const a=[...values].sort((a,b)=>a-b); return a[Math.floor(a.length/2)]; };
  const typicalWidth = median(sorted.map(c=>c.width));
  const center = median(sorted.map(c=>c.x+c.width/2));
  if (sorted.some(c=>Math.abs(c.x+c.width/2-center)>typicalWidth*.3)) return cells;
  const pixel=(x:number,y:number,k:number)=>data[(Math.max(0,Math.min(height-1,Math.round(y)))*width+Math.max(0,Math.min(width-1,Math.round(x))))*4+k];
  const columnDeviation=(x:number,c:CellRect)=>{
    let sum=0,sum2=0,n=0;
    for(let y=Math.ceil(c.y+c.height*.15);y<c.y+c.height*.95;y+=3){const v=(pixel(x,y,0)+pixel(x,y,1)+pixel(x,y,2))/3;sum+=v;sum2+=v*v;n++;}
    return Math.sqrt(Math.max(0,sum2/n-(sum/n)**2));
  };
  const start=Math.max(0,Math.floor(center-typicalWidth)), end=Math.min(width-1,Math.ceil(center+typicalWidth));
  const deviations=[];
  for(let x=start;x<=end;x++) deviations.push(median(sorted.map(c=>columnDeviation(x,c))));
  const levels=[...deviations].sort((a,b)=>a-b);
  const low=levels[Math.floor(levels.length*.2)], high=levels[Math.floor(levels.length*.7)];
  if (high<12 || high<low*1.8) return cells;
  const threshold=low+(high-low)*.28;
  let left=Math.round(center),right=left;
  while(left>start && deviations[left-start]>threshold) left--;
  while(right<end && deviations[right-start]>threshold) right++;
  if(right-left<typicalWidth*.7 || right-left>typicalWidth*1.7) return cells;
  const rowScore=(y:number)=>{
    const change=[0,0,0];let n=0;
    for(let x=Math.ceil(left+(right-left)*.07);x<right-(right-left)*.07;x+=2){for(let k=0;k<3;k++)change[k]+=pixel(x,y+2,k)-pixel(x,y-2,k);n++;}
    return change.reduce((s,v)=>s+Math.abs(v/n),0)/3;
  };
  const bestEdge=(a:number,b:number)=>{
    let best={y:Math.round(a),score:0};
    for(let y=Math.max(2,Math.ceil(a));y<=Math.min(height-3,Math.floor(b));y++){const score=rowScore(y);if(score>best.score)best={y,score};}
    return best;
  };
  const bottoms=sorted.map(c=>bestEdge(c.y+c.height*.8,c.y+c.height*1.17));
  if(bottoms.some(b=>b.score<4))return cells;
  const tops=sorted.map((_,i)=>i===0 ? 0 : bestEdge(bottoms[i-1].y+5,bottoms[i-1].y+(bottoms[i].y-bottoms[i-1].y)*.13).y);
  // The paper header can be a stronger edge than panel 1. Use the following
  // panels' measured size and perspective trend to restrict that first search.
  const perspective=Math.max(.8,Math.min(1.2,(bottoms[1].y-bottoms[0].y)/(bottoms[2].y-bottoms[1].y)));
  const firstHeight=(bottoms[1].y-tops[1])*perspective;
  const firstTop=bottoms[0].y-firstHeight;
  tops[0]=bestEdge(firstTop-firstHeight*.1,firstTop+firstHeight*.1).y;
  const refined=sorted.map((_,i)=>({x:left+1,y:tops[i]+2,width:right-left-2,height:bottoms[i].y-tops[i]-4}));
  const valid=validateCells(refined,width,height);
  return valid.length===4 ? valid : cells;
}
