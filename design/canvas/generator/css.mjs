export const MARK = '/* ==== v2: expressive lift, motion system and control library ==== */';
export const CSS = `${MARK}
/* global lift: every board, old and new */
.shell{background:radial-gradient(1100px 560px at 92% -8%,color-mix(in srgb,var(--tertiary-c) 62%,transparent),transparent 62%),radial-gradient(900px 520px at 30% 108%,color-mix(in srgb,var(--primary-c) 72%,transparent),transparent 60%),var(--bg)}
.card{transition:transform .28s cubic-bezier(.2,.9,.25,1.2),box-shadow .28s,border-radius .28s}
.card:not(.tone):not(.ter):not(.sec):not(.hero):hover{box-shadow:var(--e2);transform:translateY(-2px)}
.card.hero{background:linear-gradient(135deg,var(--primary),oklch(from var(--accent) .42 c calc(h + 32)))}
.btn{transition:transform .18s cubic-bezier(.3,1.5,.5,1),border-radius .22s,box-shadow .2s,filter .2s,background .2s}
.btn:hover{filter:brightness(1.06)}
.btn.f:hover{box-shadow:var(--e2)}
.btn.o:hover{background:var(--surf-high)}
.btn:active{transform:scale(.95);border-radius:14px}
.chip,.icb,.navi,.seg button,.tab,.menu .mi,.info,.rxbtn,.pill,.tag{transition:background .18s,color .18s,transform .18s cubic-bezier(.3,1.5,.5,1),border-radius .22s,box-shadow .2s}
.chip:hover{background:var(--surf-high)}
.chip:active,.icb:active,.info:active{transform:scale(.9)}
.navi:not(.on):hover{transform:translateX(3px)}
.seg button:hover{color:var(--text)}
.sw:hover i{box-shadow:0 0 0 8px color-mix(in srgb,var(--primary) 14%,transparent)}
.fab{transition:transform .2s cubic-bezier(.3,1.5,.5,1),border-radius .25s,box-shadow .2s}
.fab:hover{border-radius:28px;transform:translateY(-2px)}
.meter i{transform-origin:left;animation:u-w .9s cubic-bezier(.2,.9,.3,1) both}
.rise:nth-child(5){animation-delay:.2s}.rise:nth-child(6){animation-delay:.25s}.rise:nth-child(7){animation-delay:.3s}.rise:nth-child(8){animation-delay:.35s}.rise:nth-child(9){animation-delay:.4s}.rise:nth-child(10){animation-delay:.45s}.rise:nth-child(n+11){animation-delay:.5s}
.disp{font-stretch:76%}

/* layout */
.u-i{flex:none}
.u-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px;align-items:start}
.u-c3{grid-column:span 3}.u-c4{grid-column:span 4}.u-c5{grid-column:span 5}.u-c6{grid-column:span 6}.u-c7{grid-column:span 7}.u-c8{grid-column:span 8}.u-c9{grid-column:span 9}.u-c12{grid-column:span 12}
@media (max-width:1000px){.u-grid>*{grid-column:1/-1}}
.u-ch{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.u-ch .h2{flex:1;min-width:0}
.u-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.u-li{display:flex;align-items:center;gap:14px;padding:12px 0;min-width:0}
.u-li+.u-li{border-top:1px solid var(--line)}
.u-av{width:44px;height:44px;border-radius:16px;background:var(--tertiary-c);color:var(--on-tertiary-c);display:grid;place-items:center;flex:none;font-weight:800;transition:border-radius .3s}
.u-li:hover .u-av{border-radius:22px}
.u-av.p{background:var(--primary-c);color:var(--on-primary-c)}
.u-av.g{background:var(--good-c);color:var(--text)}
.u-av.b{background:var(--bad-c);color:var(--text)}
.u-num{font-size:84px;font-weight:880;font-stretch:72%;letter-spacing:-2px;line-height:.9;font-variant-numeric:tabular-nums}
.u-num small{font-size:24px;font-weight:700;letter-spacing:0;margin-left:6px}

/* hero */
.u-hero{position:relative;overflow:hidden;border-radius:44px;padding:36px 40px 32px;color:var(--on-primary);background:linear-gradient(135deg,var(--primary),oklch(from var(--accent) .42 c calc(h + 32)));box-shadow:var(--e2);display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:28px;align-items:center;min-height:300px;isolation:isolate}
.u-hero.t3{background:linear-gradient(135deg,var(--tertiary-c),var(--primary-c));color:var(--on-tertiary-c);box-shadow:none}
.u-hero.ok{background:linear-gradient(135deg,oklch(.5 .14 155),oklch(.4 .11 195));color:#fff}
.u-hero.no{background:linear-gradient(135deg,oklch(.5 .19 25),oklch(.36 .15 5));color:#fff}
.u-hero>*{position:relative;z-index:1;min-width:0}
.u-hero>.u-shape{position:absolute;z-index:0}
.u-hero>.u-conf{position:absolute;z-index:0}
.u-hero .disp{font-size:64px}
.u-hero .lede{color:inherit;opacity:.9}
.u-eye{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.u-hero .tag{background:color-mix(in srgb,currentColor 16%,transparent);color:inherit}
.u-stats{display:flex;flex-wrap:wrap;gap:18px 36px;margin-top:22px}
.u-stats .k{opacity:.82}
.u-acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
.u-hero .btn.t{background:color-mix(in srgb,currentColor 18%,transparent);color:inherit}
.u-hero .btn.f{background:var(--surf);color:var(--text)}
.u-art{display:grid;place-items:center;min-height:220px;position:relative}
.u-shape{position:absolute;pointer-events:none;fill:currentColor;opacity:.13}
.u-spin{animation:u-spin 48s linear infinite;transform-origin:center;transform-box:fill-box}
.u-spin.r{animation-direction:reverse;animation-duration:64s}
.u-float{animation:u-float 7s ease-in-out infinite}
@keyframes u-spin{to{transform:rotate(360deg)}}
@keyframes u-float{50%{transform:translateY(-10px) rotate(3deg)}}
@media (max-width:1000px){.u-hero{grid-template-columns:1fr}}

/* setting rows and real controls */
.u-set{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 20px;align-items:center;padding:14px 0}
.u-set+.u-set{border-top:1px solid var(--line)}
.u-set.wd{grid-template-columns:minmax(0,1fr)}
.u-ctl{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;min-width:0}
.u-set.wd .u-ctl{justify-content:flex-start}
.u-sel{appearance:none;-webkit-appearance:none;height:48px;min-width:190px;max-width:100%;border-radius:14px;border:1.5px solid var(--line);background:var(--surf) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' fill='none' stroke='%23808090' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center;padding:0 44px 0 16px;font:650 15px var(--font);color:var(--text);transition:border-color .2s,box-shadow .2s}
.u-sel:hover{border-color:var(--primary)}
.u-sel:focus{box-shadow:0 0 0 4px color-mix(in srgb,var(--primary) 22%,transparent)}
.u-selw{display:flex;flex-direction:column;gap:4px;align-items:flex-end;min-width:0}
.u-set.wd .u-selw{align-items:flex-start}
.u-seld{font-size:12.5px;color:var(--sub);max-width:300px;text-align:right;line-height:1.35}
.u-set.wd .u-seld{text-align:left}
.u-step{display:inline-flex;align-items:center;gap:2px;height:48px;padding:4px;border-radius:24px;background:var(--surf-high)}
.u-step button{width:40px;height:40px;border-radius:20px;border:0;background:var(--surf);color:var(--text);display:grid;place-items:center;box-shadow:var(--e1);transition:transform .15s,border-radius .2s}
.u-step button:hover{background:var(--primary-c);color:var(--on-primary-c)}
.u-step button:active{transform:scale(.86);border-radius:12px}
.u-step output{min-width:52px;text-align:center;font:800 18px var(--font);font-variant-numeric:tabular-nums}
.u-step small{font-size:12px;color:var(--sub);font-weight:700;margin:0 8px 0 -2px}
.u-range{display:flex;align-items:center;gap:14px;min-width:240px;flex:1}
.u-range input{-webkit-appearance:none;appearance:none;flex:1;height:44px;background:none;margin:0;min-width:110px;cursor:pointer}
.u-range input::-webkit-slider-runnable-track{height:16px;border-radius:8px;background:linear-gradient(90deg,var(--primary) var(--v,50%),var(--surf-high) var(--v,50%))}
.u-range input::-webkit-slider-thumb{-webkit-appearance:none;width:6px;height:44px;margin-top:-14px;border-radius:3px;background:var(--primary);box-shadow:0 0 0 5px var(--surf);transition:width .15s}
.u-range input:active::-webkit-slider-thumb{width:3px}
.u-range input::-moz-range-track{height:16px;border-radius:8px;background:linear-gradient(90deg,var(--primary) var(--v,50%),var(--surf-high) var(--v,50%))}
.u-range input::-moz-range-thumb{width:6px;height:44px;border:0;border-radius:3px;background:var(--primary);box-shadow:0 0 0 5px var(--surf)}
.u-bub{min-width:78px;height:40px;padding:0 12px;border-radius:14px;background:var(--primary-c);color:var(--on-primary-c);display:inline-flex;align-items:baseline;justify-content:center;gap:3px;font:800 17px/40px var(--font);font-variant-numeric:tabular-nums;flex:none}
.u-bub small{font-size:11.5px;font-weight:700}
.u-ip{display:inline-flex;align-items:center;gap:3px;padding:4px;border-radius:16px;background:var(--surf-high)}
.u-oct{width:52px;height:40px;border-radius:12px;border:0;background:var(--surf);color:var(--text);text-align:center;font:700 15.5px ui-monospace,'Cascadia Code',Consolas,monospace;box-shadow:var(--e1);padding:0;transition:box-shadow .2s}
.u-oct:focus{box-shadow:0 0 0 3px var(--primary)}
.u-oct.p{width:92px}
span.u-oct{display:grid;place-items:center;background:transparent;box-shadow:none;color:var(--sub)}
.u-ip b{color:var(--sub);font-weight:800}
.u-netbar{display:flex;height:30px;border-radius:10px;overflow:hidden;font-size:11.5px;font-weight:750;min-width:240px;flex:1}
.u-netbar i{display:grid;place-items:center;font-style:normal;white-space:nowrap;overflow:hidden;transition:width .4s cubic-bezier(.2,.9,.3,1.1)}
.u-netbar i:first-child{background:var(--primary);color:var(--on-primary)}
.u-netbar i:last-child{flex:1;background:var(--tertiary-c);color:var(--on-tertiary-c)}
.u-port{display:flex;flex-direction:column;gap:8px;align-items:flex-end;min-width:0}
.u-set.wd .u-port{align-items:flex-start}
.u-chips{display:flex;flex-wrap:wrap;gap:6px}
.u-chip{min-height:36px;cursor:pointer}
.u-dev{display:flex;align-items:center;gap:10px;min-width:0}
.u-pw{display:flex;align-items:center;height:48px;border-radius:14px;border:1.5px solid var(--line);background:var(--surf);padding:0 2px 0 14px;min-width:250px;transition:border-color .2s}
.u-pw:focus-within{border-color:var(--primary)}
.u-pw input{flex:1;border:0;background:none;outline:none;font:650 15px ui-monospace,Consolas,monospace;color:var(--text);min-width:0}
.u-str{display:flex;align-items:center;gap:4px;margin-top:6px;min-width:250px}
.u-str i{flex:1;height:6px;border-radius:3px;background:var(--surf-high);transition:background .3s}
.u-str.s1 i:nth-child(-n+1){background:var(--bad)}.u-str.s2 i:nth-child(-n+2){background:var(--warn)}.u-str.s3 i:nth-child(-n+3){background:var(--good)}.u-str.s4 i:nth-child(-n+4){background:var(--good)}
.u-str b{font-size:12px;margin-left:8px;white-space:nowrap}
.u-sch{display:grid;grid-template-columns:48px repeat(24,minmax(0,1fr));gap:3px;align-items:center}
.u-sch.h12{grid-template-columns:40px repeat(12,minmax(0,1fr))}
.u-sch .hh{font-size:10.5px;color:var(--sub);text-align:center;font-variant-numeric:tabular-nums}
.u-sch .dd{font-size:12.5px;font-weight:750}
.u-hc{height:30px;min-width:0;border-radius:6px;border:0;padding:0;background:var(--surf-high);cursor:pointer;transition:background .15s,transform .15s,border-radius .2s}
.u-hc.on{background:var(--primary);border-radius:10px}
.u-hc:hover{transform:scale(1.18)}
.u-rb{position:relative;height:56px;flex:1;min-width:280px}
.u-rbt{position:absolute;left:0;right:0;top:20px;height:16px;border-radius:8px;background:var(--surf-high);overflow:hidden}
.u-rbf{position:absolute;top:0;bottom:0;background:linear-gradient(90deg,var(--primary),var(--tertiary))}
.u-rb input{position:absolute;left:0;top:6px;width:100%;height:44px;-webkit-appearance:none;appearance:none;background:none;pointer-events:none;margin:0}
.u-rb input::-webkit-slider-runnable-track{background:none;height:44px}
.u-rb input::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:8px;height:44px;border-radius:4px;background:var(--text);box-shadow:0 0 0 4px var(--surf);cursor:ew-resize}
.u-rb input::-moz-range-thumb{pointer-events:auto;width:8px;height:44px;border:0;border-radius:4px;background:var(--text)}
.u-rbd{position:absolute;top:22px;width:12px;height:12px;border-radius:6px;background:var(--warn);border:2px solid var(--surf);transform:translateX(-50%)}
.u-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:150px;padding:20px;border-radius:28px;border:2.5px dashed color-mix(in srgb,var(--primary) 55%,transparent);background:color-mix(in srgb,var(--primary-c) 45%,transparent);color:var(--on-primary-c);text-align:center;cursor:pointer;position:relative;transition:border-radius .3s,background .25s,transform .25s cubic-bezier(.3,1.5,.5,1)}
.u-drop:hover,.u-drop:focus-within{border-radius:44px;background:var(--primary-c);transform:scale(1.012)}
.u-drop span{font-size:13px;opacity:.85}
.u-vh{position:absolute;opacity:0;width:1px;height:1px}

/* data and graphics */
.u-chart{position:relative}
.u-chart svg{display:block;width:100%}
.u-draw{stroke-dasharray:1;stroke-dashoffset:0;animation:u-draw 1.7s cubic-bezier(.3,.7,.2,1) both}
@keyframes u-draw{from{stroke-dashoffset:1}}
.u-fadein{animation:u-fade 1.2s .45s both}
@keyframes u-fade{from{opacity:0}}
.u-bars{display:flex;align-items:flex-end;gap:5px;height:150px}
.u-bars i{flex:1;min-width:0;border-radius:8px 8px 3px 3px;background:linear-gradient(180deg,var(--primary),color-mix(in srgb,var(--primary) 40%,transparent));transform-origin:bottom;animation:u-grow .75s cubic-bezier(.2,.9,.3,1.2) both;transition:filter .2s}
.u-bars i:hover{filter:brightness(1.2)}
.u-bars i.hi{background:linear-gradient(180deg,var(--tertiary),color-mix(in srgb,var(--tertiary) 40%,transparent))}
.u-bars i.lo{background:linear-gradient(180deg,var(--bad),color-mix(in srgb,var(--bad) 40%,transparent))}
.u-bars i.gd{background:linear-gradient(180deg,var(--good),color-mix(in srgb,var(--good) 40%,transparent))}
@keyframes u-grow{from{transform:scaleY(0)}}
@keyframes u-w{from{transform:scaleX(0)}}
.u-barl{display:flex;gap:5px;font-size:11px;color:var(--sub);margin-top:6px}
.u-barl span{flex:1;text-align:center;min-width:0;overflow:hidden}
.u-hb{display:grid;grid-template-columns:minmax(90px,180px) minmax(0,1fr) 84px;gap:12px;align-items:center;font-size:13.5px;padding:6px 0}
.u-hb b{font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u-hb span{text-align:right;color:var(--sub);font-variant-numeric:tabular-nums}
.u-ringv{animation:u-ring 1.5s cubic-bezier(.3,.8,.2,1) both}
@keyframes u-ring{from{stroke-dasharray:0 100}}
.u-needle{transform-origin:100px 100px;animation:u-needle 1.9s cubic-bezier(.3,1.35,.4,1) both}
@keyframes u-needle{from{transform:rotate(-118deg)}}
.u-count{animation:u-count 65s linear forwards}
@keyframes u-count{to{stroke-dashoffset:100}}
.u-pipe{display:flex;align-items:flex-start}
.u-pn{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;position:relative;font-size:13px;font-weight:650;min-width:0;padding:0 4px}
.u-pn small{font-weight:500;color:var(--sub);font-size:12px}
.u-pd{width:48px;height:48px;border-radius:24px;display:grid;place-items:center;background:var(--surf-high);color:var(--sub);position:relative;z-index:1;transition:all .3s}
.u-pn.done .u-pd{background:var(--primary);color:var(--on-primary)}
.u-pn.act .u-pd{background:var(--tertiary);color:#fff;border-radius:16px;animation:u-pulse 1.6s ease-in-out infinite}
.u-pn.fail .u-pd{background:var(--bad);color:#fff;border-radius:16px}
.u-pn+.u-pn::before{content:"";position:absolute;top:21px;right:50%;width:100%;height:6px;border-radius:3px;background:var(--surf-high)}
.u-pn.done+.u-pn::before{background:var(--primary)}
.u-pn.done+.u-pn.act::before{background:linear-gradient(90deg,var(--primary),var(--tertiary),var(--primary));background-size:200% 100%;animation:u-flow 1.2s linear infinite}
.u-pn.done+.u-pn.fail::before{background:linear-gradient(90deg,var(--primary),var(--bad))}
@keyframes u-pulse{50%{box-shadow:0 0 0 12px color-mix(in srgb,var(--tertiary) 24%,transparent);transform:scale(1.07)}}
@keyframes u-flow{to{background-position:-200% 0}}
.u-rip{position:relative;display:grid;place-items:center}
.u-rip::before,.u-rip::after{content:"";position:absolute;inset:0;border-radius:50%;border:3px solid currentColor;opacity:0;animation:u-rip 2.4s ease-out infinite}
.u-rip::after{animation-delay:1.2s}
@keyframes u-rip{0%{transform:scale(.6);opacity:.7}100%{transform:scale(1.9);opacity:0}}
.u-pop{animation:u-pop .85s cubic-bezier(.2,1.6,.3,1) both}
@keyframes u-pop{from{transform:scale(.2) rotate(-40deg);opacity:0}}
.u-conf{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.u-conf i{position:absolute;left:50%;top:46%;width:10px;height:18px;border-radius:4px;transform:translate(var(--dx),var(--dy)) rotate(var(--r));animation:u-conf 2.8s cubic-bezier(.15,.8,.3,1) infinite}
@keyframes u-conf{0%{transform:translate(0,0) rotate(0);opacity:0}12%{opacity:1}75%{opacity:1}100%{transform:translate(var(--dx),calc(var(--dy) + 60px)) rotate(var(--r));opacity:0}}
.u-shake{animation:u-shake .7s cubic-bezier(.36,.07,.19,.97) both}
@keyframes u-shake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-9px)}40%,60%{transform:translateX(9px)}}
.u-sk{display:block;border-radius:12px;background:linear-gradient(90deg,var(--surf-high) 25%,var(--surf-low) 50%,var(--surf-high) 75%);background-size:200% 100%;animation:u-flow 1.4s linear infinite;min-height:18px}
.u-empty{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;padding:36px 20px}
.u-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
.u-kpi{border-radius:24px;padding:16px 18px;background:var(--surf-low);transition:border-radius .3s,background .2s}
.u-kpi:hover{border-radius:32px;background:var(--surf-high)}
.u-kpi .big{font-size:36px;margin-top:6px}
.u-kpi .t2{margin-top:6px}
.u-up{color:var(--good);font-weight:750}.u-dn{color:var(--bad);font-weight:750}
.u-tbl{width:100%;border-collapse:collapse;font-size:14px}
.u-tbl th{text-align:left;font-size:12.5px;font-weight:750;color:var(--sub);padding:8px 12px;letter-spacing:.3px}
.u-tbl td{padding:10px 12px;border-top:1px solid var(--line);vertical-align:middle}
.u-tbl tbody tr{transition:background .15s}
.u-tbl tbody tr:hover{background:var(--surf-low)}
.u-scroll{overflow-x:auto}
.u-code{font:13px/1.65 ui-monospace,'Cascadia Code',Consolas,monospace;background:var(--surf-low);border-radius:18px;padding:14px 16px;overflow:auto;white-space:pre-wrap;word-break:break-word;margin:0}
.u-add{display:block;background:var(--good-c);border-radius:6px;padding:0 6px}
.u-del{display:block;background:var(--bad-c);border-radius:6px;padding:0 6px;text-decoration:line-through}
mark.u-hit{background:color-mix(in srgb,var(--tertiary) 42%,transparent);color:inherit;border-radius:5px;padding:0 3px}
mark.u-hit.g2{background:color-mix(in srgb,var(--primary) 34%,transparent)}
.u-tok{display:inline-flex;align-items:center;height:36px;padding:0 12px;border-radius:12px;font:700 14px ui-monospace,Consolas,monospace;background:var(--primary-c);color:var(--on-primary-c);border:0;cursor:pointer;transition:transform .15s,border-radius .2s}
.u-tok:hover{transform:translateY(-2px);border-radius:18px}
.u-tok.t3{background:var(--tertiary-c);color:var(--on-tertiary-c)}.u-tok.s2{background:var(--secondary-c);color:var(--on-secondary-c)}.u-tok.q{background:var(--warn-c);color:var(--text)}
.u-fab{position:sticky;bottom:24px;align-self:flex-end;height:64px;padding:0 26px;border-radius:22px;border:0;background:var(--tertiary-c);color:var(--on-tertiary-c);box-shadow:var(--e3);display:flex;align-items:center;gap:12px;font:800 16px var(--font);z-index:8;text-decoration:none;transition:transform .22s cubic-bezier(.3,1.5,.5,1),border-radius .25s}
.u-fab:hover{border-radius:32px;transform:translateY(-3px) rotate(-1.5deg)}
.u-over{position:absolute;inset:0;z-index:30;display:grid;place-items:center;padding:40px 24px;background:color-mix(in srgb,var(--bg) 52%,transparent);backdrop-filter:blur(16px) saturate(1.3);-webkit-backdrop-filter:blur(16px) saturate(1.3)}
.u-take{width:min(980px,100%);border-radius:56px;padding:48px;box-shadow:var(--e3);position:relative;overflow:hidden;display:flex;flex-direction:column;gap:18px;isolation:isolate}
.u-ro{display:flex;align-items:center;gap:10px;padding:12px 18px;border-radius:18px;background:var(--warn-c);color:var(--text);font-weight:650;font-size:14.5px}
.role-viewer .w{opacity:.5;pointer-events:none}
.fw-stock .u-merb{opacity:.42;pointer-events:none;filter:saturate(.3)}
.u-why{display:flex;gap:10px;align-items:center;padding:12px 16px;border-radius:16px;background:var(--surf-high);font-size:13.5px;font-weight:650;margin-top:10px}
.role-operator .u-ownb,.role-viewer .u-ownb{opacity:.42;pointer-events:none}
.u-key{border-radius:28px;padding:20px;background:var(--surf-low);display:flex;flex-direction:column;gap:10px;border:2px solid transparent;transition:border-color .3s,background .3s,border-radius .3s}
.u-key.on{border-color:var(--good);background:var(--good-c);border-radius:36px}
.u-qr{border-radius:20px;background:#fff;padding:12px;box-shadow:var(--e1)}
.u-stage{display:flex;align-items:center;gap:10px;flex-wrap:wrap}

/* phone boards: fixed 390 by 844 root */
.u-ph{width:390px;height:844px;position:relative;overflow:hidden;display:flex;flex-direction:column;background:radial-gradient(500px 300px at 100% 0,color-mix(in srgb,var(--tertiary-c) 60%,transparent),transparent 70%),var(--bg)}
.u-sb{height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;font-weight:750;font-size:14px;flex:none}
.u-ab{display:flex;align-items:center;gap:4px;padding:2px 8px 8px 18px;flex:none}
.u-ab h1{flex:1;margin:0;font-size:28px;font-weight:840;font-stretch:80%;letter-spacing:-.5px;min-width:0}
.u-pc{flex:1;overflow-y:auto;padding:4px 16px 112px;display:flex;flex-direction:column;gap:14px;scrollbar-width:none}
.u-bn{position:absolute;left:0;right:0;bottom:0;height:84px;padding:10px 6px 18px;display:flex;background:var(--surf-low);z-index:5}
.u-bn a{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11.5px;font-weight:700;color:var(--sub);text-decoration:none;min-height:44px}
.u-bn a .p{width:60px;height:32px;border-radius:16px;display:grid;place-items:center;position:relative;transition:background .2s,width .25s cubic-bezier(.3,1.5,.5,1)}
.u-bn a.on{color:var(--text)}
.u-bn a.on .p{background:var(--secondary-c);color:var(--on-secondary-c);width:68px}
.u-bn .badge{position:absolute;top:-4px;right:4px}
.u-pfab{position:absolute;right:16px;bottom:100px;z-index:6;height:60px;padding:0 20px;border-radius:20px;border:0;background:var(--primary);color:var(--on-primary);box-shadow:var(--e3);display:flex;align-items:center;gap:10px;font:800 15px var(--font);text-decoration:none;transition:transform .2s,border-radius .25s}
.u-pfab:active{transform:scale(.94);border-radius:30px}
.u-psc{position:absolute;inset:0;z-index:19;background:rgba(8,10,24,.42);backdrop-filter:blur(2px)}
.u-bs{position:absolute;left:0;right:0;bottom:0;z-index:20;border-radius:32px 32px 0 0;background:var(--surf);box-shadow:var(--e3);padding:10px 20px 26px;display:flex;flex-direction:column;gap:12px;animation:u-sheet .5s cubic-bezier(.2,.9,.25,1.1) both;max-height:720px;overflow-y:auto}
.u-bs::before{content:"";width:40px;height:5px;border-radius:3px;background:var(--line);align-self:center;flex:none}
@keyframes u-sheet{from{transform:translateY(100%)}}
.u-ph .card{border-radius:28px;padding:18px}
.u-ph .u-hero{grid-template-columns:minmax(0,1fr);padding:22px;border-radius:32px;min-height:0;gap:14px}
.u-ph .u-hero .disp{font-size:38px}
.u-ph .u-art{min-height:0}
.u-ph .u-num{font-size:60px}
.u-ph .u-set{grid-template-columns:minmax(0,1fr) auto}
.u-ph .u-range{min-width:0}
.u-ph .u-pw,.u-ph .u-str{min-width:0}
.u-pc>*{flex:none}
.u-hero .axis{color:inherit;opacity:.8}
.u-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.u-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:92px;border-radius:24px;background:var(--surf);box-shadow:var(--e1);font-size:12px;font-weight:700;text-align:center;text-decoration:none;color:var(--text);padding:8px 4px;line-height:1.2;transition:transform .18s cubic-bezier(.3,1.5,.5,1),border-radius .22s}
.u-tile:active{transform:scale(.93);border-radius:16px}
.u-tile small{font-weight:600;color:var(--sub);font-size:10.5px}

/* motion gates: the motion Tweak and the system setting still everything; the resting frame is the designed frame */
.std .dr,.std .dr *,.std .u-spin,.std .u-float,.std .u-conf i,.std .u-rip::before,.std .u-rip::after{animation:none!important}
.calm *,.calm *::before,.calm *::after{animation:none!important;transition:none!important}
@media (prefers-reduced-motion:reduce){.mx *,.mx *::before,.mx *::after{animation:none!important;transition:none!important}}
`;
