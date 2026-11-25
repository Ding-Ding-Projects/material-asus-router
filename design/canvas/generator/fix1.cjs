const fs=require('fs');
let a=fs.readFileSync('boardsA.mjs','utf8'); if(!a.includes('x(l[0]), x(l[1]),')) throw new Error('a');
a=a.replace('x(l[0]), x(l[1]),','x(l[0]), x(l[2]),'); fs.writeFileSync('boardsA.mjs',a);
let c=fs.readFileSync('boardsC.mjs','utf8'); const k="page: 'changes', h: 1100, hasStage: true, stage: 'success',"; if(!c.includes(k)) throw new Error('c');
c=c.replace(k,"page: 'changes', h: 1200, hasStage: true, stage: 'success', css: '.shell{min-height:1200px}.u-over{place-items:start center;padding-top:250px}.u-take{align-items:stretch}',"); fs.writeFileSync('boardsC.mjs',c);
let s=fs.readFileSync('css.mjs','utf8'); if(!s.includes('.u-tiles{display:grid')) throw new Error('s');
s=s.replace('.u-tiles{display:grid','.u-pc>*{flex:none}\n.u-hero .axis{color:inherit;opacity:.8}\n.u-tiles{display:grid'); fs.writeFileSync('css.mjs',s);
