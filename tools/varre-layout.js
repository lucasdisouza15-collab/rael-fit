// Varredura de layout em 375 e 390 px (precisa do Playwright: NODE_PATH=$(npm root -g) node tools/varre-layout.js).
// Aponta reticências em texto, selects com texto maior que o campo e elementos que vazam à direita. Saída vazia = ok (a faixa de chips de Exercícios rola de propósito).
const {chromium}=require('playwright');
const tag=process.argv[2]||'antes';
(async()=>{
 const b=await chromium.launch(); const out=[];
 for(const W of [375,390]){
 const ctx=await b.newContext({viewport:{width:W,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(()=>{const D=Date; const delta=new D('2026-11-11T13:00:00-03:00').getTime()-D.now(); class F extends D{constructor(...a){a.length?super(...a):super(D.now()+delta)} static now(){return D.now()+delta}} window.Date=F;});
 await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(1800);
 await pg.evaluate(()=>{const b=document.querySelector('[data-act="onbRapido"]');b&&b.click();});
 for(let i=0;i<6;i++){await pg.waitForTimeout(250);await pg.evaluate(()=>{const b=document.querySelector('.sheet-f .btn.pri');b&&!b.disabled&&b.click();});}
 await pg.evaluate(()=>{const x=document.querySelector('[data-act="onbDone"],[data-act="sheetClose"],[data-act="onbSkip"]');x&&x.click();});
 await pg.evaluate(()=>{const ro=['PUSH A','PULL A','LEGS','PUSH B','PULL B','UPPER BÔNUS'].map((n,i)=>({id:'r'+i,nome:n,itens:[{eid:'supino-reto-barra',series:3,min:8,max:12,desc:90}]}));updP(p=>{p.rotinas=ro;delete p.semana;p.metaPeso=95;p.metaData='2026-12-31';});const mk=(id,nome,data)=>putDoc('treino-'+id,{id,nome,data,inicio:new Date(data+'T10:00:00').getTime(),ex:[]});mk('a','PULL B','2026-11-09');mk('b','PUSH A','2026-11-10');render();});
 const scan=async(label)=>{
  const r=await pg.evaluate(()=>{
   const vw=document.documentElement.clientWidth, bad=[];
   const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
   document.querySelectorAll('body *').forEach(e=>{ if(!vis(e)) return; const r=e.getBoundingClientRect(), cs=getComputedStyle(e);
     const nm=(e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.className&&e.className.baseVal===undefined?'.'+String(e.className).trim().split(/\s+/).join('.'):''));
     if(e.closest('nav.tabs')) return;
     if(r.right>vw+1 && !e.closest('svg') && cs.position!=='fixed') bad.push('vaza-direita '+nm+' '+Math.round(r.right-vw)+'px');
     if(e.classList.contains('r') && e.closest('.wd') && e.scrollWidth>e.clientWidth+0.5) bad.push('palavra-corta '+nm+' "'+(e.textContent||'').trim()+'"');
     if(cs.textOverflow==='ellipsis' && e.scrollWidth>e.clientWidth+1) bad.push('reticencias '+nm+' "'+(e.textContent||'').trim().slice(0,24)+'"');
     if((e.tagName==='SELECT'||e.tagName==='INPUT') && e.scrollWidth>e.clientWidth+2 && e.type!=='checkbox') bad.push('campo-cortado '+nm);
     if(e.tagName==='SELECT'){ const o=e.options[e.selectedIndex]; if(o){ const c=document.createElement('canvas').getContext('2d'); c.font=cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily; const w=c.measureText(o.text).width; const avail=e.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-24; if(w>avail) bad.push('select-texto-longo '+nm+' "'+o.text+'"'); } }
   });
   const cur=[...document.querySelectorAll('input[type=date]')].map(e=>Math.round(e.getBoundingClientRect().height)+'h/'+Math.round(e.getBoundingClientRect().width)+'w');
   return {bad:[...new Set(bad)],dates:cur};});
  if(r.bad.length||r.dates.length) out.push(W+' '+label+': '+JSON.stringify(r));
 };
 const tabs=await pg.evaluate(()=>document.querySelectorAll('nav.tabs button').length);
 for(let i=0;i<tabs;i++){
  await pg.evaluate(i=>document.querySelectorAll('nav.tabs button')[i].click(),i); await pg.waitForTimeout(500);
  const subs=await pg.evaluate(()=>[...document.querySelectorAll('.seg button')].map(b=>b.textContent.trim()));
  await scan('aba'+i);
  for(let s=0;s<subs.length;s++){ await pg.evaluate(s=>document.querySelectorAll('.seg button')[s]&&document.querySelectorAll('.seg button')[s].click(),s); await pg.waitForTimeout(400); await scan('aba'+i+'/'+subs[s]); }
  if(W===390&&tag){ await pg.evaluate(()=>window.scrollTo(0,0)); }
 }
 // telas de perfil rolando
 await pg.evaluate(()=>document.querySelectorAll('nav.tabs button')[4].click()); await pg.waitForTimeout(400);
 if(W===390) await pg.evaluate(()=>{const e=document.querySelector('#pfMetaData'); e&&e.scrollIntoView({block:'center'});});
 if(W===390) await pg.screenshot({path:`/tmp/perfil-${tag}.png`});
 if(W===390){ await pg.evaluate(()=>document.querySelectorAll('nav.tabs button')[2].click()); await pg.waitForTimeout(400); await pg.evaluate(()=>{const s=document.querySelectorAll('.seg button')[0];s&&s.click();}); await pg.waitForTimeout(400); await pg.evaluate(()=>window.scrollTo(0,0)); await pg.screenshot({path:`/tmp/semana-${tag}.png`}); }
 if(errs.length) out.push('ERROS JS '+errs.slice(0,2));
 }
 const ruins=out.filter(l=>!/aba2\/Exercícios/.test(l) && !/"bad":\[\]/.test(l)); console.log(ruins.join('\n')||'layout ok (375 e 390 px)'); await b.close(); process.exit(ruins.length?1:0);
})();
