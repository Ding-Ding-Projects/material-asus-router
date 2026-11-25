// Second part of the shared theme: the parts added for the owner tools, the
// dangerous-action sequence, the household boards and the diagnostics boards.
// gen.mjs appends this string to the one from theme.mjs.
export const CSS2 = `
/* ---------- full-board takeovers ---------- */
.take{position:absolute;inset:0;z-index:9;display:grid;place-items:center;padding:48px;overflow:hidden;isolation:isolate;color:#fff;text-align:center;animation:fade .45s ease both}
.take .tki{position:relative;display:flex;flex-direction:column;align-items:center;gap:22px;max-width:1040px}
.take h1,.take .tkh{display:block;margin:0;font-size:128px;font-weight:900;font-stretch:60%;line-height:.88;letter-spacing:-.02em;text-transform:uppercase;text-wrap:balance}
.take p{font-size:19px;font-weight:520;max-width:60ch;margin:0}
.take .tag{background:rgb(255 255 255 / .16);color:#fff;border:1px solid rgb(255 255 255 / .3)}
.take.mad{background:radial-gradient(circle at 50% 38%,#c4001f,#4a000c 72%)}
.take.mad::before{content:'';position:absolute;inset:0;z-index:-1;background:repeating-linear-gradient(-45deg,rgb(0 0 0 / .26) 0 44px,transparent 44px 88px);background-size:124.5px 124.5px;animation:hazard 1.1s linear infinite}
.take.mad::after{content:'';position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 0 16px #ffd400,inset 0 0 160px rgb(0 0 0 / .6);animation:breathe .8s ease-in-out infinite}
.take.mad .tkh{animation:slam .75s var(--spring) both,quake .45s .75s 3;text-shadow:0 8px 0 rgb(0 0 0 / .35)}
.take.mad .tki>*{animation:rise .7s var(--spring) both;animation-delay:calc(var(--j,0) * 140ms + 500ms)}
.take.mad .tki>.tkh{animation-delay:0s,.75s}
.take.ds{background:radial-gradient(circle at 50% 110%,#7a2c12,#2a0f08 70%);cursor:pointer;width:100%;height:100%;font:inherit}
.take.ds .tkh{font-size:150px;text-transform:none;font-stretch:66%;animation:rise 1.1s var(--spring) both;text-shadow:0 0 80px rgb(255 190 110 / .55)}
.take.ds .steam{position:absolute;inset:0;z-index:-1}
.take.launch{background:linear-gradient(#04061a,#161a55 62%,#3c2a70)}
.madface{width:230px;height:230px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff8a5c,#e3122d 70%);position:relative;box-shadow:0 0 0 10px rgb(255 255 255 / .16),0 30px 80px rgb(0 0 0 / .5);animation:quake .5s infinite}
.madface svg{position:absolute;inset:0;width:100%;height:100%}
.madface .puff{position:absolute;top:36%;width:38px;height:38px;border-radius:50%;background:rgb(255 255 255 / .85);filter:blur(4px);animation:puff 1.2s ease-out infinite}
.madface .puff.l{left:-30px;--dx:-70px}.madface .puff.r{right:-30px;--dx:70px;animation-delay:.4s}
.madm{display:flex;gap:6px;align-items:flex-end;height:54px}
.madm i{flex:1;min-width:26px;border-radius:8px;background:var(--surf-high);height:calc(30% + var(--k) * 23%);transform-origin:bottom;animation:growY .7s var(--spring) both;animation-delay:calc(var(--k) * 110ms + 300ms);transition:background .4s,transform .4s var(--spring)}
.madm i.on{background:linear-gradient(0deg,var(--warn),var(--bad))}
.madm i.on.top{animation:growY .7s var(--spring) both,flick .35s 1s infinite alternate}
.glass .madm i,.ink .madm i{background:rgb(255 255 255 / .2)}.glass .madm i.on,.ink .madm i.on{background:linear-gradient(0deg,#ffd400,#ff5a3c)}
.lvl{display:grid;place-items:center;width:64px;height:64px;font-weight:900;font-size:28px;font-stretch:70%;color:#fff;background:linear-gradient(140deg,var(--warn),var(--bad))}

/* ---------- the reboot launch ---------- */
.sky{position:relative;height:560px;border-radius:36px;overflow:hidden;isolation:isolate;color:#fff;background:linear-gradient(#04061a,#161a55 62%,#3c2a70);box-shadow:var(--e2)}
.sky .star{position:absolute;left:var(--x);top:var(--y);width:3px;height:3px;border-radius:50%;background:#fff;animation:twinkle 2.2s var(--d) ease-in-out infinite}
.sky .pad{position:absolute;left:0;right:0;bottom:0;height:74px;background:linear-gradient(#141833,#090b18);border-top:3px solid rgb(255 255 255 / .16)}
.sky .tower{position:absolute;left:calc(50% + 62px);bottom:74px;width:18px;height:230px;background:repeating-linear-gradient(0deg,rgb(255 255 255 / .32) 0 4px,transparent 4px 22px),rgb(255 255 255 / .1);border-radius:4px 4px 0 0;transition:transform 1.2s var(--ease);transform-origin:bottom}
.sky.go .tower{transform:rotate(14deg)}
.rocket{position:absolute;left:50%;bottom:74px;width:96px;margin-left:-48px;transition:transform 2.6s cubic-bezier(.55,0,.85,.45);z-index:2}
.rocket svg{display:block;width:100%}
.rocket .flame{position:absolute;left:50%;top:calc(100% - 10px);width:44px;margin-left:-22px;height:0;border-radius:40% 40% 50% 50% / 20% 20% 80% 80%;background:linear-gradient(#fff,#ffd400 30%,#ff5a3c 70%,transparent);transform-origin:top;transition:height .5s var(--spring);z-index:-1}
.sky.cd .rocket .flame{height:46px;animation:flick .13s infinite alternate}
.sky.go .rocket .flame{height:190px;animation:flick .1s infinite alternate}
.sky.cd .rocket{animation:quake .35s infinite}
.sky.go .rocket{transform:translateY(-300px)}
.sky.go{animation:quake .4s 5}
.sky .smoke i{position:absolute;bottom:52px;left:calc(50% + var(--x));width:90px;height:90px;margin-left:-45px;border-radius:50%;background:rgb(255 255 255 / .5);filter:blur(10px);opacity:0}
.sky.cd .smoke i{opacity:.45;animation:billow 1.6s var(--d) ease-out infinite}
.sky.go .smoke i{opacity:.8;animation:billow 1.2s var(--d) ease-out infinite}
.sky .hud{position:absolute;left:26px;top:22px;right:26px;display:flex;justify-content:space-between;gap:16px;align-items:flex-start;z-index:3}
.sky .hud .glass{padding:14px 18px;border-radius:22px;text-align:left}
.cdbig{font-size:190px;font-weight:900;font-stretch:58%;line-height:.82;font-variant-numeric:tabular-nums;text-shadow:0 0 60px rgb(255 212 0 / .6)}
.sky .mid{position:absolute;left:30px;top:186px;z-index:3;text-align:left;display:flex;flex-direction:column;gap:6px}
.chk{display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 12px;border-radius:16px;background:rgb(255 255 255 / .1);font-weight:700;font-size:13.5px;animation:slideIn .6s var(--spring) both;animation-delay:calc(var(--j) * 130ms + 250ms)}
.chk.go{background:rgb(120 240 160 / .22)}.chk.hold{background:rgb(255 212 0 / .2)}
.chk b{margin-left:auto;font-stretch:80%;letter-spacing:.8px}

.sky .ctl{position:absolute;right:26px;bottom:14px;z-index:4;display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.cd10{--v:0;--from:10;counter-reset:n var(--v);animation:cdown 10s linear both}
.cd10::after{content:counter(n)}
.cds{display:none}.calm .cds{display:inline}.calm .cd10{display:none}
@media (prefers-reduced-motion:reduce){.mx .cds{display:inline}.mx .cd10{display:none}}
.take.mad .tki>.madface{animation:pop .6s var(--spring) both,quake .5s .6s infinite}

.pipe .pc{padding:0;display:block;min-height:0}

/* ---------- four keys ---------- */
.keys{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.keyc{position:relative;border-radius:32px;padding:20px 16px;background:var(--surf);box-shadow:var(--e1);display:flex;flex-direction:column;gap:12px;align-items:center;text-align:center;transition:background .5s,transform .5s var(--spring),box-shadow .4s;animation:rise .7s var(--spring) both;animation-delay:calc(var(--j) * 110ms + 150ms)}
.keyc.on{background:var(--good-c);color:var(--on-good-c);transform:translateY(-6px)}
.keyc.next{box-shadow:inset 0 0 0 3px var(--primary),var(--e2)}
.keyhole{position:relative;width:112px;height:112px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#2a2d45 0 34%,#11131c 36% 58%,#3b3f5c 60%);color:#ffd479;box-shadow:inset 0 0 0 4px rgb(255 255 255 / .16),var(--e2);transition:box-shadow .5s}
.keyhole .i{transition:transform .9s var(--spring)}
.keyc.on .keyhole{box-shadow:0 0 0 6px var(--good),0 0 46px var(--good)}
.keyc.on .keyhole .i{transform:rotate(90deg) scale(1.15)}
.keyc.next .keyhole{animation:pulse 1.6s infinite;color:#ffd479}
.keyc .kn{font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--sub)}
.keyc.on .kn{color:inherit}
.armbar{position:relative;height:18px;border-radius:9px;background:var(--surf-high);overflow:hidden}
.armbar i{position:absolute;inset:0;width:var(--p);border-radius:9px;background:linear-gradient(90deg,var(--good),var(--warn),var(--bad));transition:width .8s var(--spring)}

/* ---------- timelines ---------- */
.tl{position:relative;display:flex;flex-direction:column;gap:8px;padding-left:36px}
.tl::before{content:'';position:absolute;left:14px;top:14px;bottom:14px;width:4px;border-radius:2px;background:var(--surf-high)}
.te{position:relative;display:flex;align-items:center;gap:12px;min-height:60px;width:100%;text-align:left;padding:8px 14px;border-radius:22px;background:var(--surf-low);animation:rise .6s var(--spring) both;animation-delay:calc(var(--j,0) * 60ms + 200ms);transition:background .25s,transform .35s var(--spring),box-shadow .25s}
.te:hover{transform:translateX(4px)}
.te::before{content:'';position:absolute;left:-30px;top:50%;width:20px;height:20px;margin-top:-10px;border-radius:50%;background:var(--surf-high);border:4px solid var(--surf);transition:background .3s,transform .4s var(--spring)}
.te.done::before{background:var(--good)}
.te.now::before{background:var(--primary);color:var(--primary);animation:pulse 1.4s infinite;transform:scale(1.25)}
.te.bad::before{background:var(--bad)}
.te.sel{background:var(--primary-c);color:var(--on-primary-c);box-shadow:inset 0 0 0 2.5px var(--primary)}
.te.sel::before{background:var(--primary);transform:scale(1.3)}
.te.cmp{background:var(--tertiary-c);color:var(--on-tertiary-c);box-shadow:inset 0 0 0 2.5px var(--tertiary)}
.te.pend{opacity:.6}
.te .tm{font-family:ui-monospace,Consolas,monospace;font-size:12px;font-weight:700;opacity:.8;white-space:nowrap}
.htl{position:relative;height:118px;margin:6px 22px 0}
.htl .trk{position:absolute;left:0;right:0;top:34px;height:10px;border-radius:5px;background:rgb(255 255 255 / .2)}
.htl .fil{position:absolute;left:0;top:34px;height:10px;border-radius:5px;width:var(--p);background:linear-gradient(90deg,#fff,#ffd479);transition:width .9s var(--spring)}
.htl .fil::after{content:'';position:absolute;right:-8px;top:-7px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 0 0 0 #fff;color:#fff;animation:pulse 1.2s infinite}
.htl .mk{position:absolute;top:19px;left:var(--x);width:40px;height:40px;margin-left:-20px;border-radius:50%;display:grid;place-items:center;background:rgb(40 44 90 / .9);border:2px solid rgb(255 255 255 / .35);color:#fff;animation:pop .5s var(--spring) both;animation-delay:calc(var(--k) * 90ms + 300ms);transition:background .4s,color .4s,transform .4s var(--spring)}
.htl .mk.done{background:#fff;color:var(--f1);border-color:#fff}
.htl .mk.now{background:#ffd479;color:#2a1c00;border-color:#fff;transform:scale(1.2)}
.htl .mk span{position:absolute;top:48px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:11.5px;font-weight:720;color:#fff}

/* ---------- the dim sum moment ---------- */
.steamer{position:relative;width:280px;height:250px;flex:none}
.steamer .bk{position:absolute;left:50%;width:230px;height:62px;margin-left:-115px;border-radius:16px;background:repeating-linear-gradient(90deg,#dba55c 0 13px,#c58b40 13px 15px);box-shadow:inset 0 -9px 0 rgb(0 0 0 / .16),inset 0 0 0 4px #a8702c,0 10px 24px rgb(0 0 0 / .3);animation:rise .7s var(--spring) both;animation-delay:calc(var(--k) * 160ms)}
.steamer .bk.b1{bottom:0}.steamer .bk.b2{bottom:56px}
.steamer .lid{position:absolute;left:50%;bottom:114px;width:238px;height:40px;margin-left:-119px;border-radius:50% 50% 14px 14px / 100% 100% 14px 14px;background:linear-gradient(#e2b06a,#c58b40);box-shadow:inset 0 0 0 4px #a8702c;transform-origin:10% 100%;animation:lid 2.6s ease-in-out infinite}
.steamer .lid::after{content:'';position:absolute;left:50%;top:-10px;width:30px;height:14px;margin-left:-15px;border-radius:8px;background:#a8702c}
.steam i{position:absolute;bottom:var(--b,150px);left:var(--x);width:16px;height:70px;border-radius:8px;background:rgb(255 255 255 / .7);filter:blur(7px);opacity:.5;animation:steam 2.8s var(--d) ease-out infinite}
.buns{display:flex;gap:10px;flex-wrap:wrap}
.bun{width:58px;height:48px;border-radius:50% 50% 46% 46% / 62% 62% 38% 38%;background:radial-gradient(circle at 40% 30%,#fff,#fff1d6 70%);box-shadow:inset 0 -6px 0 rgb(0 0 0 / .08),0 6px 14px rgb(0 0 0 / .25);position:relative;animation:pop .6s var(--spring) both,bob 2.4s ease-in-out infinite;animation-delay:calc(var(--k) * 180ms + 300ms),calc(var(--k) * 300ms)}
.bun::after{content:'';position:absolute;left:50%;top:6px;width:16px;height:8px;margin-left:-8px;border-radius:50%;box-shadow:inset 0 2px 0 rgb(0 0 0 / .14)}
.bun.todo{opacity:.25;filter:grayscale(1);animation:pop .6s var(--spring) both;animation-delay:calc(var(--k) * 180ms + 300ms)}
.dropz{border-radius:30px;border:3px dashed rgb(255 255 255 / .5);padding:22px;display:flex;flex-direction:column;gap:12px;align-items:center;text-align:center;width:100%;color:#fff;background:rgb(255 255 255 / .08);transition:transform .4s var(--spring),background .3s,border-color .3s}
.dropz:hover{transform:scale(1.02);background:rgb(255 255 255 / .16);border-color:#fff}
.dropz .i{animation:bob 1.8s ease-in-out infinite}

/* ---------- live mode undo toasts ---------- */
.utoasts{position:absolute;right:28px;bottom:28px;z-index:7;display:flex;flex-direction:column;gap:10px;width:min(460px,calc(100% - 56px))}
.utoast{position:relative;overflow:hidden;display:flex;align-items:center;gap:12px;padding:14px 16px 18px;border-radius:24px;background:oklch(from var(--accent) calc(.24 + var(--dark) * .68) .05 h);color:oklch(from var(--accent) calc(.96 - var(--dark) * .76) .02 h);box-shadow:var(--e3);font-weight:650;font-size:14px;animation:toastIn .7s var(--spring) both;animation-delay:calc(var(--j,0) * 120ms)}
.utoast .bar{position:absolute;left:0;right:0;bottom:0;height:5px;background:linear-gradient(90deg,var(--b1),var(--b3));transform-origin:left;animation:drain 8s linear both}
.utoast .btn{background:rgb(255 255 255 / .16)!important;color:inherit!important}
.livedot{display:inline-block;width:12px;height:12px;border-radius:6px;background:#ff5a3c;color:#ff5a3c;animation:pulse 1.2s infinite}
.liverow{box-shadow:inset 4px 0 0 var(--good)}

/* ---------- leaderboard ---------- */
.podium{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:end;min-height:330px}
.pod{position:relative;border-radius:30px 30px 14px 14px;padding:16px 10px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;color:#fff;background:rgb(255 255 255 / .14);border:1px solid rgb(255 255 255 / .28);backdrop-filter:blur(18px);height:var(--h);transform-origin:bottom;animation:growY .9s var(--spring) both;animation-delay:calc(var(--k) * 170ms + 200ms);transition:height .8s var(--spring)}
.pod.p1{background:#fff;color:var(--f1);border:0;box-shadow:0 0 70px rgb(255 255 255 / .4)}
.pod .rk{font-size:54px;font-weight:900;font-stretch:62%;line-height:.9}
.pod .crown{color:#ffb300;animation:bob 1.8s ease-in-out infinite}
.pod .av{background:rgb(255 255 255 / .22);color:inherit}
.lbr{position:relative;display:grid;grid-template-columns:44px 44px minmax(0,1fr) auto;gap:12px;align-items:center;min-height:66px;padding:8px 16px 8px 8px;border-radius:22px;background:var(--surf-low);overflow:hidden;isolation:isolate;animation:rise .6s var(--spring) both;animation-delay:calc(var(--j) * 60ms + 200ms);transition:transform .35s var(--spring)}
.lbr:hover{transform:translateX(4px)}
.lbr::before{content:'';position:absolute;left:0;top:0;bottom:0;z-index:-1;width:var(--b);background:linear-gradient(90deg,var(--primary-c),color-mix(in oklab,var(--primary-c) 30%,transparent));border-radius:inherit;transform-origin:left;animation:growX 1.1s var(--ease) both;animation-delay:calc(var(--j) * 60ms + 300ms);transition:width .8s var(--spring)}
.lbr.up::before{background:linear-gradient(90deg,var(--tertiary-c),color-mix(in oklab,var(--tertiary-c) 30%,transparent))}
.lbr .rk{font-weight:900;font-size:24px;font-stretch:72%;text-align:center}
.lbr .amt{font-weight:800;font-size:18px;font-stretch:80%;text-align:right;white-space:nowrap}
.btabs{position:relative;display:grid;grid-template-columns:repeat(var(--cnt),minmax(0,1fr));border-radius:26px;background:var(--surf);box-shadow:var(--e1);padding:6px;gap:0;isolation:isolate}
.btabs button{min-height:56px;padding:6px 16px;border-radius:20px;font-weight:760;font-size:15px;display:flex;align-items:center;justify-content:center;gap:10px;color:var(--sub);transition:color .3s,transform .3s var(--spring)}
.btabs button:active{transform:scale(.96)}
.btabs button[aria-selected=true]{color:var(--on-primary)}
.btabs .ind{position:absolute;z-index:-1;top:6px;bottom:6px;left:6px;width:calc((100% - 12px) / var(--cnt));border-radius:20px;background:var(--primary);transform:translateX(calc(var(--idx) * 100%));transition:transform .6s var(--spring)}

/* ---------- hardware, chains, portal ---------- */
.led{display:inline-block;width:12px;height:12px;border-radius:6px;background:var(--lc,#6f6);color:var(--lc,#6f6);box-shadow:0 0 12px currentColor}
.led.bl{animation:blink calc(.5s + var(--k,0) * .13s) steps(2) infinite}
.led.off{background:#444;box-shadow:none;color:#444}
.backp{display:grid;grid-template-columns:repeat(var(--c,8),minmax(0,1fr));gap:8px;padding:16px;border-radius:26px;background:#0b0d1a;box-shadow:inset 0 2px 0 rgb(255 255 255 / .1)}
.backp .port{color:#fff}.backp .port[aria-pressed=true]{background:rgb(255 255 255 / .22);box-shadow:inset 0 0 0 2px #fff;transform:translateY(-4px)}
.fan{animation:spin calc(60s / var(--rpm,40)) linear infinite}
.chainf{display:flex;align-items:stretch;flex-wrap:wrap;row-gap:12px}
.chainf .cb{flex:1 1 118px;min-height:84px;border-radius:22px;padding:12px;background:var(--surf-low);display:flex;flex-direction:column;gap:4px;text-align:left;animation:pop .5s var(--spring) both;animation-delay:calc(var(--j) * 90ms + 200ms);transition:background .3s,transform .4s var(--spring),border-radius .4s var(--spring)}
.chainf .cb:hover{transform:translateY(-4px);border-radius:16px}
.chainf .cb[aria-pressed=true]{background:var(--primary);color:var(--on-primary)}
.chainf .cb[aria-pressed=true] .t2{color:inherit;opacity:.9}
.hero .chainf .cb{background:rgb(255 255 255 / .14);color:#fff;border:1px solid rgb(255 255 255 / .26)}.hero .chainf .cb[aria-pressed=true]{background:#fff;color:var(--f1)}.hero .chainf .cb .t2{color:inherit;opacity:.85}
.lbr.r4{grid-template-columns:44px 104px minmax(0,1fr) auto}
.chainf .ca{flex:0 0 30px;align-self:center;height:6px;border-radius:3px;background:repeating-linear-gradient(90deg,var(--primary) 0 8px,transparent 8px 16px);animation:dash .7s linear infinite}
.pphone{width:270px;flex:none;border-radius:40px;padding:12px;background:#0b0d1a;box-shadow:var(--e3);animation:rise .9s var(--spring) both .3s}
.pphone .scr{border-radius:30px;min-height:470px;padding:26px 18px;display:flex;flex-direction:column;gap:12px;align-items:center;text-align:center;color:#fff;background:linear-gradient(160deg,var(--b1),var(--f2));overflow:hidden;position:relative;isolation:isolate}
.pphone .scr h4{margin:0;font-size:24px;font-weight:850;font-stretch:76%;line-height:1}
.pphone .scr .btn{width:100%}
.tones{display:flex;align-items:flex-end;gap:2px;height:var(--h,150px)}
.tones i{flex:1;min-width:0;border-radius:3px 3px 0 0;height:var(--b);background:var(--tc,var(--primary));transform-origin:bottom;animation:growY .8s var(--ease) both;animation-delay:calc(var(--k) * 9ms + 200ms)}
.tones i.ok{--tc:var(--good)}.tones i.up{--tc:var(--tertiary)}.tones i.gap{--tc:var(--bad)}
.lockc{position:relative;border-radius:32px;padding:26px;background:var(--surf);box-shadow:var(--e1);display:flex;gap:18px;align-items:center}

.fmap{display:flex;gap:4px;height:78px}
.fmap i{flex:var(--f);min-width:16px;border-radius:12px;background:rgb(255 255 255 / .18);transform-origin:left;animation:growX .7s var(--ease) both;animation-delay:calc(var(--k) * 90ms + 200ms);transition:background .5s}
.fmap i.done{background:#fff}
.fmap i.now{background:linear-gradient(90deg,#fff,rgb(255 255 255 / .25),#fff);background-size:200% 100%;animation:shim 1.4s linear infinite}

/* ---------- keyframes for this part ---------- */
@keyframes hazard{to{background-position:124.5px 0}}
@keyframes slam{from{opacity:0;transform:scale(3.2) rotate(-6deg)}}
@keyframes quake{0%,100%{transform:translate(0,0)}20%{transform:translate(-5px,3px)}40%{transform:translate(5px,-3px)}60%{transform:translate(-4px,-2px)}80%{transform:translate(4px,3px)}}
@keyframes puff{from{opacity:.9;transform:translate(0,0) scale(.4)}to{opacity:0;transform:translate(var(--dx),-50px) scale(1.6)}}
@keyframes flick{from{transform:scaleY(.82) scaleX(1.06)}to{transform:scaleY(1.1) scaleX(.94)}}
@keyframes twinkle{50%{opacity:.2;transform:scale(.6)}}
@keyframes billow{from{transform:translate(0,0) scale(.3);opacity:.8}to{transform:translate(calc(var(--x) * 1.6),-30px) scale(1.9);opacity:0}}
@keyframes lid{0%,60%,100%{transform:rotate(0)}75%{transform:rotate(-7deg)}88%{transform:rotate(-2deg)}}
@keyframes steam{from{transform:translateY(20px) scaleX(.6);opacity:0}30%{opacity:.6}to{transform:translateY(-110px) translateX(18px) scaleX(1.8);opacity:0}}
@keyframes bob{50%{transform:translateY(-7px)}}
@keyframes drain{to{transform:scaleX(0)}}

/* ---------- motion Tweak for this part ---------- */
.std .take.mad::before,.std .take.mad::after,.std .take.mad .tkh,.std .madface,.std .madface .puff,.std .sky,.std .sky *:not(.cd10),.std .take.mad .tki>.madface,.std .steamer .lid,.std .steam i,.std .bun,.std .madm i.on.top,.std .keyc.next .keyhole,.std .dropz .i,.std .pod .crown,.std .chainf .ca,.std .fan,.std .htl .fil::after{animation:none!important}
.std .steam,.std .madface .puff,.std .sky .smoke{display:none}
.calm .steam,.calm .madface .puff,.calm .sky .smoke{display:none}
@media (prefers-reduced-motion:reduce){.mx .steam,.mx .madface .puff,.mx .sky .smoke{display:none}}
`;
