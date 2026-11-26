// Third part of the canvas theme: kick and ban, the public Unkick page, Lock
// IP with the changes panel, saved routers and connection keys, the start-up
// cards, the router's own add-on page and app updates. gen.mjs appends this string to the
// ones from theme.mjs and theme2.mjs.
export const CSS3 = `
/* ---------- narrow pages: these boards also read at 360 px ---------- */
.ph:has(.b9){max-width:100vw}
.ph:has(.b9) .pc{overflow:hidden auto;scrollbar-width:thin}
.b9{display:flex;flex-direction:column;gap:12px;min-width:0}
.pc>.b9{flex:1 0 auto}
.b9 .btn,.ksheet .btn{white-space:normal;text-align:center;line-height:1.2;padding-block:8px!important;max-width:100%}
.b9 .tag,.ksheet .tag{white-space:normal}
.b9 .row,.ksheet .row{flex-wrap:wrap}
.b9 .t1,.b9 .t2,.ksheet .t1,.ksheet .t2{overflow-wrap:anywhere}
.b9 .seg,.ksheet .seg{display:grid;width:100%}
.b9 .seg button{padding:0 6px;white-space:normal;line-height:1.15}
.b9 .stp output{min-width:52px}
.b9 .nm,.ksheet .nm{flex:0 0 auto}
.b9 .pair9{display:flex;gap:8px}
.b9 .pair9>*{flex:1 1 0;min-width:0;padding-inline:10px!important}
.b9 .ipp .oc{min-width:44px;padding:0 6px}
.b9 .devp.one,.ksheet .devp.one{grid-template-columns:minmax(0,1fr)}
.b9 .devp.one button,.ksheet .devp.one button{width:100%;padding:10px 14px}
.b9 .devp .t2,.ksheet .devp .t2{color:inherit;opacity:.82}
.lab9.grow{flex:1 1 140px}
.lab9{font-size:12.5px;font-weight:760;letter-spacing:.8px;text-transform:uppercase;color:var(--sub)}
.url9{display:flex;align-items:center;gap:8px;min-height:40px;padding:6px 14px;border-radius:20px;background:rgb(255 255 255 / calc(.55 - var(--dark) * .45));font-family:ui-monospace,Consolas,monospace;font-size:12.5px;overflow-wrap:anywhere;min-width:0}
.url9 span{min-width:0;overflow-wrap:anywhere}
.note9{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:20px;background:var(--good-c);color:var(--on-good-c);font-weight:680;font-size:13.5px;animation:pop .5s var(--spring) both}
.note9.bad{background:var(--bad-c);color:var(--on-bad-c);animation:shake .6s both}
.note9 span{min-width:0;overflow-wrap:anywhere}

/* ---------- kick and ban ---------- */
.ksheet{max-height:94%;overflow:hidden auto;scrollbar-width:thin;gap:10px}
.imp9{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:20px;background:var(--good-c);color:var(--on-good-c);font-weight:680;font-size:13.5px}
.imp9.bro{background:var(--warn-c);color:var(--on-warn-c);box-shadow:inset 0 0 0 2px var(--warn);animation:shake .7s both}
.imp9 span{min-width:0}
.dash9{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:14px;border-radius:22px;border:2px dashed var(--sub)}
.ksheet .chip{min-height:44px;padding:0 12px}
.log9 .tm{font-family:ui-monospace,Consolas,monospace;font-size:12px;font-weight:700;opacity:.8;white-space:nowrap}

/* ---------- the public Unkick page ---------- */
.uk{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:26px 20px;border-radius:36px;background:var(--surf);box-shadow:var(--e2);animation:rise .6s var(--spring) both}
.uk h1{font-size:30px;font-weight:800;font-stretch:78%;line-height:1.05;text-wrap:balance}
.uk p{color:var(--sub);font-size:14.5px;max-width:36ch}
.ukic{position:relative;width:104px;height:104px;margin:14px;border-radius:50%;display:grid;place-items:center;color:#fff;background:linear-gradient(140deg,var(--b1),var(--f1));animation:breath9 2.8s ease-in-out infinite}
.ukic::before,.ukic::after{content:'';position:absolute;inset:0;border-radius:50%;border:3px solid var(--primary);animation:ring9 2.8s ease-out infinite}
.ukic::after{animation-delay:1.4s}
.ukic.ok{background:var(--good);animation:pop .6s var(--spring) both}
.ukic.off{background:var(--surf-high);color:var(--sub);animation:none}
.ukic.ok::before,.ukic.ok::after,.ukic.off::before,.ukic.off::after{display:none}
.std .ukic,.std .ukic::before,.std .ukic::after{animation:none!important}
.std .ukic::before,.std .ukic::after{opacity:.35}
.ukl{width:100%;text-align:left;padding:12px 14px;border-radius:20px;background:var(--surf-low);font-size:14px;overflow-wrap:anywhere}
.ukl b{font-weight:780}
.ukbig{width:100%;min-height:64px!important;font-size:19px!important;border-radius:32px}
.uknote{font-size:12.5px!important;color:var(--sub)}
@keyframes ring9{from{transform:scale(1);opacity:.7}to{transform:scale(1.5);opacity:0}}
@keyframes breath9{50%{transform:scale(1.06)}}

/* ---------- Lock IP and the changes panel ---------- */
.b9 .row .acts9{flex-basis:100%;display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;align-items:center}
.lrow .ed9{flex-basis:100%;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px;border-radius:18px;background:var(--surf);animation:pop .45s var(--spring) both}
.selb{width:44px;height:44px;flex:none;border-radius:14px;display:grid;place-items:center;box-shadow:inset 0 0 0 2px var(--sub);color:transparent!important;transition:background .25s,border-radius .35s var(--spring),transform .3s var(--spring)}
.selb:active{transform:scale(.88)}
.selb[aria-checked=true]{background:var(--primary)!important;color:var(--on-primary)!important;box-shadow:none;border-radius:22px}
.icb[aria-pressed=true]{background:var(--primary-c);color:var(--on-primary-c)!important;border-radius:16px}
.selbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px;border-radius:22px;background:var(--secondary-c);color:var(--on-secondary-c);animation:pop .45s var(--spring) both}
.selbar .t1{flex:1 1 100%}
.dockbar9{position:sticky;bottom:0;z-index:3;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px 10px 16px;border-radius:24px;background:var(--surf);box-shadow:var(--e3),inset 0 0 0 2px var(--primary);animation:rise .6s var(--spring) both}
.dockbar9 .grow{flex:1 1 150px}
.chg9{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:26px;background:var(--surf);box-shadow:var(--e2);animation:rise .6s var(--spring) both}
.key9{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:20px;background:var(--surf-low);transition:background .35s,color .35s}
.key9.on{background:var(--good-c);color:var(--on-good-c)}
.key9.on .t2{color:inherit}
.key9 .kh{display:flex;align-items:center;gap:8px;font-weight:760;font-size:14px}
.km9{width:22px;height:22px;flex:none;border-radius:50%;box-shadow:inset 0 0 0 2px currentColor;display:grid;place-items:center;transition:background .3s,transform .5s var(--spring)}
.key9.on .km9{background:var(--good);box-shadow:none;transform:rotate(360deg)}
.key9.on .km9::after{content:'';width:9px;height:5px;border-left:2.4px solid #fff;border-bottom:2.4px solid #fff;transform:rotate(-45deg) translate(1px,-1px)}
.tap9{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.tap9 .btn{min-width:52px}
.b9 .btn.okk{background:var(--good)!important;color:#fff!important;box-shadow:none}
.kbd9{font-family:ui-monospace,Consolas,monospace;font-size:12px;padding:2px 8px;border-radius:8px;background:var(--surf-high);color:var(--text);box-shadow:inset 0 -2px 0 var(--line);white-space:nowrap}
.btn[aria-disabled=true]{opacity:.5}

/* ---------- saved routers ---------- */
.tbar9{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:8px 10px;border-radius:22px;background:var(--glass);border:1px solid var(--line)}
.tbar9 .t2{flex:1 1 130px}
.tbadge{display:inline-flex;align-items:center;gap:8px;min-height:36px;padding:4px 14px;border-radius:18px;background:var(--warn-c);color:var(--on-warn-c);box-shadow:inset 0 0 0 2px var(--warn);font-weight:760;font-size:13px;animation:pop .5s var(--spring) both;min-width:0;overflow-wrap:anywhere}
.tbadge i{width:10px;height:10px;flex:none;border-radius:50%;background:var(--warn);color:var(--warn);animation:pulse 1.4s infinite}
.ask9{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:22px;background:var(--bad-c);color:var(--on-bad-c);animation:pop .45s var(--spring) both}
.pub9{font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.5;padding:10px 12px;border-radius:16px;background:var(--surf-high);overflow-wrap:anywhere}

/* ---------- start-up cards ---------- */
.boot9{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:28px 20px;border-radius:36px;background:var(--surf);box-shadow:var(--e2);animation:rise .6s var(--spring) both}
.boot9 h1{font-size:30px;font-weight:800;font-stretch:78%;line-height:1.05;text-wrap:balance}
.boot9 .prog{width:100%}
.boot9 .prog i{transition:width .5s var(--spring)}
.spin9{width:64px;height:64px;border-radius:50%;border:6px solid var(--surf-high);border-top-color:var(--primary);animation:spin .9s linear infinite}
.err9{width:100%;text-align:left;font-family:ui-monospace,Consolas,monospace;font-size:12.5px;line-height:1.6;padding:12px 14px;border-radius:16px;background:#11131c;color:#ff9a8f;overflow-wrap:anywhere;white-space:pre-wrap}
.boot9.bad{animation:shake .6s both}
.boot9 .acts9{display:flex;flex-direction:column;gap:8px;width:100%}

/* ---------- the router's own page for the add-on ---------- */
.mer{flex:1;display:flex;flex-direction:column;gap:0;padding:10px;border-radius:12px;background:#21333e;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4;animation:fade .4s ease both}
.mer .mtab{align-self:flex-start;padding:8px 14px;border-radius:6px 6px 0 0;background:#4D595D;font-weight:700}
.mer .mpn{display:flex;flex-direction:column;gap:12px;padding:14px 12px;border-radius:0 6px 6px 6px;background:#4D595D}
.mer h1{font-size:18px;font-weight:700;padding-bottom:8px;border-bottom:1px solid #93a0a5}
.mer .mhd{padding:8px 10px;background:linear-gradient(#92a0a5,#66747b);font-weight:700}
.mer .mrow{display:flex;flex-wrap:wrap;border:1px solid #2f3a3e;border-top:0}
.mer .ml{flex:1 1 110px;padding:10px;background:#2f3a3e;font-weight:700;color:#ffcc00}
.mer .mv{flex:2 1 170px;display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;padding:6px 10px;background:#475a5f;min-width:0}
.mer .mrad{display:inline-flex;align-items:center;gap:8px;min-height:44px;color:#fff!important;font:inherit}
.mer .mrad i{width:16px;height:16px;border-radius:50%;border:2px solid #fff;display:grid;place-items:center}
.mer .mrad[aria-checked=true] i::after{content:'';width:8px;height:8px;border-radius:50%;background:#fff}
.mer .mport{display:inline-flex;align-items:center;gap:6px}
.mer .mport button{width:44px;height:44px;border-radius:4px;background:linear-gradient(#93a0a5,#66747b)!important;color:#fff!important;font-size:20px;font-weight:700}
.mer .mport output{min-width:64px;padding:6px 8px;border:1px solid #929ea1;background:#596e74;text-align:center;font-family:ui-monospace,Consolas,monospace}
.mer .mpick{display:flex;flex-wrap:wrap;gap:10px}
.mer .mpick button{flex:1 1 130px;display:flex;flex-direction:column;gap:4px;min-height:64px;padding:12px;border:1px solid #93a0a5;border-radius:8px;text-align:left;color:#fff!important;font:inherit;transition:background .25s,border-color .25s,transform .3s var(--spring)}
.mer .mpick button b{display:flex;align-items:center;gap:8px}
.mer .mpick button[aria-checked=true]{background:#2f3a3e!important;border-color:#ffcc00;transform:translateY(-2px)}
.mer .mpick i{width:16px;height:16px;flex:none;border-radius:50%;border:2px solid #fff;display:grid;place-items:center}
.mer .mpick button[aria-checked=true] i::after{content:'';width:8px;height:8px;border-radius:50%;background:#fff}
.mer .mopen{align-self:flex-start;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:8px 18px;border-radius:22px;background:var(--primary);color:#fff!important;text-decoration:none;font-weight:700;overflow-wrap:anywhere;animation:pop .45s var(--spring) both}
.mer .mnote{color:#ffcc00;font-size:12px}
.mer .msub{font-size:12px;opacity:.9}
.mer .mapply{align-self:center;min-height:44px;padding:0 28px;border-radius:6px;background:linear-gradient(#93a0a5,#66747b)!important;color:#fff!important;font-weight:700}
.mer .mdone{padding:8px 10px;border:1px solid #ffcc00;border-radius:4px;animation:pop .45s var(--spring) both}

/* ---------- app updates ---------- */
.cv10{display:flex;flex-direction:column;gap:4px;padding:10px 14px;border-radius:22px;border:2px dashed var(--sub)}
.cv10 .rowx{flex-wrap:nowrap}
.cv10 .btn{align-self:flex-start}
.ver10{display:flex;flex-direction:column;gap:2px;min-width:0}
.ver10 .lab9{color:inherit;opacity:.8}
.ver10 .mono{font-size:13px;font-weight:680;overflow-wrap:anywhere}
.steps10{display:flex;flex-direction:column;gap:8px}
.st10{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:18px;background:var(--surf-low);transition:background .35s,color .35s;animation:rise .5s var(--spring) both;animation-delay:calc(var(--j) * 70ms)}
.st10 .grow{min-width:0}
.st10 .sm10{width:28px;height:28px;flex:none;border-radius:50%;display:grid;place-items:center;box-shadow:inset 0 0 0 2px var(--sub);color:var(--sub)}
.st10.done{background:var(--good-c);color:var(--on-good-c)}
.st10.done .sm10{background:var(--good);color:#fff;box-shadow:none;animation:pop .5s var(--spring) both}
.st10.now{box-shadow:inset 0 0 0 2px var(--primary)}
.st10.now .sm10{box-shadow:none;border:3px solid var(--surf-high);border-top-color:var(--primary);animation:spin .9s linear infinite}
.st10.fail{background:var(--bad-c);color:var(--on-bad-c);animation:shake .6s both}
.st10.fail .sm10{background:var(--bad);color:#fff;box-shadow:none}
.st10.done .t2,.st10.fail .t2{color:inherit}
.empty .cmd10{display:block;margin-top:12px;text-align:left}
.empty p:has(.cmd10){max-width:100%}
.ph:has(.cmd10){max-width:100vw}
`;
