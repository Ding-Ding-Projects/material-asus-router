const fs=require('fs');
let s=fs.readFileSync('css.mjs','utf8'); if(!s.includes('.u-hero>.u-conf')) s=s.replace('.u-hero .disp{font-size:64px}','.u-hero>.u-conf{position:absolute;z-index:0}\n.u-hero .disp{font-size:64px}'); fs.writeFileSync('css.mjs',s);
const t=fs.readFileSync('heights.tmp','utf8'); const h={}; t.replace(/"([^"]+)": (\d+),/g,(_,k,v)=>{h[k]=Number(v);});
for(const k of Object.keys(h)){ if(k.startsWith('Phone')) h[k]=844; else h[k]=Math.ceil((h[k]+20)/10)*10; }
h['Rail.dc.html']=900; h['TopBar.dc.html']=170; h['Takeover.dc.html']=1200; h['Setup.dc.html']=Math.max(h['Setup.dc.html'],900);
fs.writeFileSync('heights.json',JSON.stringify(h,null,1));
