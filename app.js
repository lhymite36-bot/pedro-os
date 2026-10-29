'use strict';
const $=id=>document.getElementById(id),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LS=(k,v)=>v===undefined?localStorage.getItem(k):localStorage.setItem(k,v);
const fmt=t=>new Date(t).toLocaleString([], {dateStyle:'medium',timeStyle:'short'});
const LANGS={hi:['Hindi','hi-IN'],en:['English','en-IN'],ta:['Tamil','ta-IN'],bn:['Bengali','bn-IN'],te:['Telugu','te-IN'],mr:['Marathi','mr-IN'],pa:['Punjabi','pa-IN'],ur:['Urdu','ur-IN'],ak:['Twi','ak-GH'],fr:['French','fr-FR'],es:['Spanish','es-ES'],de:['German','de-DE'],ar:['Arabic','ar-SA'],zh:['Chinese','zh-CN'],ja:['Japanese','ja-JP'],pt:['Portuguese','pt-BR'],ru:['Russian','ru-RU']};

/* ---------- Gemini + translation ---------- */
const key=()=>LS('gkey')||'';
async function gemini(prompt){const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key='+encodeURIComponent(key()),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});if(!r.ok)throw new Error('gemini '+r.status);const j=await r.json();return j.candidates[0].content.parts.map(p=>p.text).join('').trim()}
const tcache=new Map();
async function translate(t,from,to){t=t.trim();if(!t||from===to)return t;const ck=from+to+t;if(tcache.has(ck))return tcache.get(ck);let out;
 if(key()){try{out=await gemini(`Translate this ${LANGS[from][0]} speech into natural ${LANGS[to][0]}. Output only the translation.\n\n${t}`)}catch(e){}}
 if(!out){try{const r=await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(t)}`);if(r.ok){const j=await r.json();out=j[0].map(x=>x[0]).join('')}}catch(e){}}
 if(!out){const r=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(t.slice(0,480))}&langpair=${from}|${to}`);const j=await r.json();out=j.responseData.translatedText}
 tcache.set(ck,out);return out}

/* ---------- Speech: recognition with dedupe + TTS feedback guard ---------- */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const norm=s=>String(s).toLowerCase().replace(/[^\p{L}\p{N} ]/gu,'').replace(/\s+/g,' ').trim();
const similar=(a,b)=>{a=norm(a);b=norm(b);return !!a&&!!b&&(a===b||(a.length>4&&(a.includes(b)||b.includes(a))))};
const Speech={speaking:false,lastSpoken:'',active:null};
function listener({lang,onInterim,onFinal,onState}){
 const L={lang,on:false,rec:null,last:'',seen:new Set(),
  build(){this.rec&&(this.rec.onend=null);const r=new SR();r.lang=this.lang;r.continuous=true;r.interimResults=true;this.seen=new Set();
   r.onresult=e=>{if(Speech.speaking)return;let fin='',int='';for(let i=e.resultIndex;i<e.results.length;i++){const x=e.results[i];if(x.isFinal){if(this.seen.has(i))continue;this.seen.add(i);fin+=x[0].transcript}else int+=x[0].transcript}
    if(int&&onInterim)onInterim(int);fin=fin.trim();if(fin&&!similar(fin,this.last)&&!similar(fin,Speech.lastSpoken)){this.last=fin;window.speechSynthesis&&speechSynthesis.cancel();onFinal&&onFinal(fin)}};
   r.onerror=e=>{onState&&onState(e.error==='not-allowed'?'Microphone blocked — allow mic access in site settings.':e.error==='no-speech'?'':'Mic: '+e.error);if(e.error==='not-allowed')this.stop()};
   r.onend=()=>{if(this.on&&!Speech.speaking)setTimeout(()=>this.resume(),250)};this.rec=r},
  resume(){if(!this.on||Speech.speaking)return;try{this.build();this.rec.start()}catch(e){}},
  start(){if(!SR){onState&&onState('Speech recognition needs Chrome (Android or desktop).');return false}if(Speech.active&&Speech.active!==this)Speech.active.stop();Speech.active=this;this.on=true;this.resume();onState&&onState('Listening…');return true},
  pause(){try{this.rec&&this.rec.abort()}catch(e){}},
  stop(){this.on=false;if(Speech.active===this)Speech.active=null;try{this.rec&&(this.rec.onend=null,this.rec.abort())}catch(e){}onState&&onState('')}};
 return L}
function say(text,langCode,{force}={}){if(!window.speechSynthesis||!text)return Promise.resolve();speechSynthesis.cancel();Speech.lastSpoken=text;Speech.speaking=true;Speech.active&&Speech.active.pause();
 return new Promise(res=>{const u=new SpeechSynthesisUtterance(text);u.lang=langCode;u.rate=1.03;const v=speechSynthesis.getVoices().find(v=>v.lang.replace('_','-').startsWith(langCode.slice(0,2)));if(v)u.voice=v;
  let d=false;const done=()=>{if(d)return;d=true;Speech.speaking=false;setTimeout(()=>{Speech.active&&Speech.active.resume()},400);res()};u.onend=done;u.onerror=done;setTimeout(done,Math.min(30000,2000+text.length*90));speechSynthesis.speak(u)})}

/* ---------- Tabs ---------- */
const TITLES={translate:'Translate',captions:'Captions',memory:'Memory Palace',brief:'Daily Brief',more:'More'};
function tab(t){$$('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));$$('main>.view').forEach(v=>v.classList.toggle('hidden',v.id!=='v-'+t));$('title').textContent=TITLES[t];LS('tab',t);if(t==='memory')renderMem();if(t==='more')sub(null);location.hash=t}
$$('.tabs button').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
function seg(sel,attr,cb){$$(sel+' button').forEach(b=>b.onclick=()=>{$$(sel+' button').forEach(x=>x.classList.toggle('on',x===b));cb(b.dataset[attr])})}
const setNet=()=>$('netdot').classList.toggle('off',!navigator.onLine);addEventListener('online',setNet);addEventListener('offline',setNet);setNet();

/* ---------- Translate: live ---------- */
let dir='hi',hist=JSON.parse(LS('hist')||'[]'),deb,lastInt='';
const tl=()=>dir==='hi'?['hi','en']:['en','hi'];
$('speak').checked=LS('speak')!=='0';$('speak').onchange=e=>LS('speak',e.target.checked?'1':'0');
function renderHist(){$('hist').innerHTML=hist.slice(-80).reverse().map(h=>`<div class="it"><div class="s">${esc(h.s)}</div><div class="t">${esc(h.t)}</div><div class="d">${fmt(h.at)}</div></div>`).join('')||'<div class="muted small">Nothing yet.</div>';LS('hist',JSON.stringify(hist.slice(-500)))}
renderHist();
let live=mkLive();
function mkLive(){return listener({lang:LANGS[tl()[0]][1],
 onInterim:int=>{$('src').innerHTML=esc(int)+' <span class="muted">…</span>';clearTimeout(deb);deb=setTimeout(async()=>{if(int===lastInt)return;lastInt=int;try{$('dst').textContent=await translate(int,...tl())}catch(e){}},600)},
 onFinal:async s=>{clearTimeout(deb);$('src').textContent=s;try{const [f,t]=tl();const o=await translate(s,f,t);$('dst').textContent=o;hist.push({s,t:o,at:Date.now()});renderHist();if($('speak').checked)say(o,LANGS[t][1])}catch(e){$('status').textContent='Translation failed — check your internet.'}},
 onState:m=>$('status').textContent=m})}
function liveUI(){$('mic').textContent=live.on?'Stop listening':'Start listening';$('mic').classList.toggle('live',live.on)}
$('mic').onclick=()=>{if(live.on){live.stop();speechSynthesis.cancel()}else live.start();liveUI()};
seg('#t-single .seg.sm','dir',d=>{dir=d;const was=live.on;live.stop();live=mkLive();$('sl').textContent=d==='hi'?'Hindi · heard':'English · you';$('tl').textContent=d==='hi'?'English':'Hindi';if(was)live.start();liveUI()});
const histTxt=()=>hist.map(h=>`[${fmt(h.at)}] ${h.s}\n→ ${h.t}`).join('\n\n');
function download(name,text,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click()}
$('copy').onclick=()=>navigator.clipboard.writeText(histTxt()).then(()=>$('status').textContent='Copied');
$('exp').onclick=()=>download('pedro-translations.txt',histTxt());
$('clr').onclick=()=>{if(confirm('Clear history?')){hist=[];renderHist()}};

/* ---------- Translate: conversation ---------- */
seg('#v-translate>.seg','tm',m=>{$('t-single').classList.toggle('hidden',m!=='single');$('t-convo').classList.toggle('hidden',m!=='convo');live.stop();liveUI();convoStop()});
let cl=null,cSide=null;
function convoStop(){cl&&cl.stop();cl=null;cSide=null;$('micTop').classList.remove('live');$('micBot').classList.remove('live')}
function convo(side){if(cSide===side){convoStop();return}convoStop();cSide=side;const [f,t]=side==='top'?['hi','en']:['en','hi'];$(side==='top'?'micTop':'micBot').classList.add('live');
 cl=listener({lang:LANGS[f][1],onInterim:i=>$(side==='top'?'cTopSrc':'cBotSrc').textContent=i,
  onFinal:async s=>{$(side==='top'?'cTopSrc':'cBotSrc').textContent=s;const o=await translate(s,f,t);$(side==='top'?'cBot':'cTop').textContent=o;$(side==='top'?'cBotSrc':'cTopSrc').textContent='';hist.push({s,t:o,at:Date.now()});renderHist();
   if($('cAuto').checked){convoStop();await say(o,LANGS[t][1]);convo(side==='top'?'bot':'top')}else say(o,LANGS[t][1])},onState:()=>{}});cl.start()}
$('micTop').onclick=()=>convo('top');$('micBot').onclick=()=>convo('bot');

/* ---------- Captions ---------- */
let cap=null,pipVid=null,pipCv=null,pipWin=null;
function capText(src,txt){$('capSrc').textContent=src;$('capTxt').textContent=txt;if(pipWin){pipWin.document.getElementById('c').textContent=txt}if(pipCv)drawPip(txt)}
function capStart(){const lang=$('capLang').value,f=lang.slice(0,2);let d;cap&&cap.stop();
 cap=listener({lang,onInterim:i=>{$('capSrc').textContent=i;clearTimeout(d);d=setTimeout(async()=>{try{capText(i,await translate(i,f,'en'))}catch(e){}},500)},onFinal:async s=>{clearTimeout(d);try{capText(s,await translate(s,f,'en'))}catch(e){}},onState:m=>m&&($('capNote').textContent=m)});cap.start()}
$('capStart').onclick=()=>{$('capFull').classList.remove('hidden');capStart();document.documentElement.requestFullscreen?.().catch(()=>{})};
$('capClose').onclick=()=>{$('capFull').classList.add('hidden');if(!pipWin&&!pipVid)cap&&cap.stop();document.fullscreenElement&&document.exitFullscreen()};
function drawPip(t){const c=pipCv,x=c.getContext('2d');x.fillStyle='#0b0d10';x.fillRect(0,0,c.width,c.height);x.fillStyle='#eceef2';x.font='600 34px Inter,sans-serif';const w=t.split(' '),lines=[];let l='';for(const s of w){if(x.measureText(l+s).width>c.width-40){lines.push(l);l=''}l+=s+' '}lines.push(l);lines.slice(-4).forEach((s,i,a)=>x.fillText(s,20,c.height-24-(a.length-1-i)*42))}
$('capPip').onclick=async()=>{capStart();
 if(window.documentPictureInPicture){try{pipWin=await documentPictureInPicture.requestWindow({width:520,height:180});pipWin.document.body.innerHTML='<div id="c" style="font:600 26px Inter,system-ui,sans-serif;color:#eceef2;background:#0b0d10;height:100vh;margin:0;padding:16px;box-sizing:border-box;display:flex;align-items:flex-end">Listening…</div>';pipWin.document.body.style.margin='0';pipWin.addEventListener('pagehide',()=>{pipWin=null});$('capNote').textContent='Floating captions window is open.';return}catch(e){}}
 if(document.pictureInPictureEnabled&&HTMLCanvasElement.prototype.captureStream){pipCv=document.createElement('canvas');pipCv.width=720;pipCv.height=240;drawPip('Listening…');pipVid=document.createElement('video');pipVid.muted=true;pipVid.playsInline=true;pipVid.srcObject=pipCv.captureStream(10);pipVid.style.cssText='position:fixed;width:1px;height:1px;opacity:0';document.body.append(pipVid);await pipVid.play();setInterval(()=>pipCv&&drawPip($('capTxt').textContent),1000);try{await pipVid.requestPictureInPicture();$('capNote').textContent='Floating captions started. Note: Android may pause the mic when Chrome is in the background.'}catch(e){$('capNote').textContent='Picture-in-Picture was refused: '+e.message}return}
 $('capNote').textContent='Floating captions are not supported in this browser. Use full-screen captions.'};

/* ---------- IndexedDB ---------- */
const DB={db:null,async open(){if(this.db)return this.db;return this.db=await new Promise((res,rej)=>{const r=indexedDB.open('pedro-os',1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('memories',{keyPath:'id',autoIncrement:true});d.createObjectStore('dreams',{keyPath:'id',autoIncrement:true})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
 async tx(s,m,f){const d=await this.open();return new Promise((res,rej)=>{const t=d.transaction(s,m),st=t.objectStore(s),q=f(st);t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)})},
 add(s,v){return this.tx(s,'readwrite',st=>st.add(v))},all(s){return this.tx(s,'readonly',st=>st.getAll())},del(s,id){return this.tx(s,'readwrite',st=>st.delete(id))},clear(s){return this.tx(s,'readwrite',st=>st.clear())}};

/* ---------- Memory Palace ---------- */
seg('#v-memory>.seg','mm',m=>{['record','timeline','ask'].forEach(x=>$('m-'+x).classList.toggle('hidden',x!==m));if(m==='timeline')renderMem()});
function dictInto(el,btn,lang='en-IN'){let d=null;btn.onclick=()=>{if(d){d.stop();d=null;btn.classList.remove('on');btn.textContent='🎙 Dictate';return}const base=el.value?el.value+' ':'';let acc=base;d=listener({lang:LS('dictLang')||lang,onInterim:i=>el.value=acc+i,onFinal:f=>{acc+=f+' ';el.value=acc},onState:()=>{}});if(d.start())btn.textContent='■ Stop'}}
dictInto($('memText'),$('memMic'));
let memPhoto=null;
$('memPhoto').onchange=e=>{const f=e.target.files[0];if(!f)return;const img=new Image();img.onload=()=>{const c=document.createElement('canvas'),s=Math.min(1,900/Math.max(img.width,img.height));c.width=img.width*s;c.height=img.height*s;c.getContext('2d').drawImage(img,0,0,c.width,c.height);memPhoto=c.toDataURL('image/jpeg',.8);$('memPrev').src=memPhoto;$('memPrev').classList.remove('hidden')};img.src=URL.createObjectURL(f)};
const getLoc=()=>new Promise(res=>{if(!navigator.geolocation)return res(null);navigator.geolocation.getCurrentPosition(p=>res({lat:+p.coords.latitude.toFixed(5),lon:+p.coords.longitude.toFixed(5)}),()=>res(null),{timeout:8000})});
$('memSave').onclick=async()=>{const text=$('memText').value.trim();if(!text&&!memPhoto)return;const loc=$('memLoc').checked?await getLoc():null;await DB.add('memories',{text,photo:memPhoto,loc,at:Date.now()});$('memText').value='';memPhoto=null;$('memPrev').classList.add('hidden');$('memSave').textContent='Saved ✓';setTimeout(()=>$('memSave').textContent='Save memory',1400)};
const tok=s=>norm(s).split(' ').filter(w=>w.length>2);
function score(m,q){const t=norm(m.text);return tok(q).reduce((a,w)=>a+(t.includes(w)?1:0),0)}
async function renderMem(){const q=$('memSearch').value.trim(),all=(await DB.all('memories')).sort((a,b)=>b.at-a.at);const list=q?all.filter(m=>score(m,q)>0).sort((a,b)=>score(b,q)-score(a,q)):all;
 let day='';$('memList').innerHTML=list.map(m=>{const d=new Date(m.at).toDateString(),h=d!==day?`<div class="lbl" style="margin-top:14px">${d}</div>`:'';day=d;return h+`<div class="it"><div class="t">${esc(m.text)}</div>${m.photo?`<img src="${m.photo}" alt="">`:''}<div class="d">${fmt(m.at)}${m.loc?` · <a class="muted" target="_blank" rel="noopener" href="https://maps.google.com/?q=${m.loc.lat},${m.loc.lon}">📍 map</a>`:''} · <a href="#" class="muted" data-del="${m.id}">delete</a></div></div>`}).join('')||'<p class="muted">No memories yet.</p>';
 $$('[data-del]').forEach(a=>a.onclick=async e=>{e.preventDefault();if(confirm('Delete this memory?')){await DB.del('memories',+a.dataset.del);renderMem()}})}
$('memSearch').oninput=renderMem;
function chat(html,me){const d=document.createElement('div');d.className='msg'+(me?' me':'');d.innerHTML=html;$('chat').append(d);d.scrollIntoView({behavior:'smooth'});return d}
chat('Ask me anything about your saved memories. I answer only from what you recorded, and cite the date.');
$('askGo').onclick=async()=>{const q=$('askIn').value.trim();if(!q)return;$('askIn').value='';chat(esc(q),true);const all=await DB.all('memories');const hits=all.map(m=>({m,s:score(m,q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||b.m.at-a.m.at).slice(0,6).map(x=>x.m);
 if(key()&&all.length){const ctx=(hits.length?hits:all.slice(-25)).map(m=>`[#${m.id} · ${fmt(m.at)}] ${m.text}`).join('\n');const w=chat('<span class="muted">Thinking…</span>');
  try{const a=await gemini(`You are Pedro's memory assistant. Answer ONLY from these memories. Cite the memory id and date in brackets like [#3 · date]. If not found, say so.\n\nMemories:\n${ctx}\n\nQuestion: ${q}`);w.innerHTML=esc(a).replace(/\n/g,'<br>');return}catch(e){w.remove()}}
 if(!hits.length){chat('I couldn\'t find a memory matching that. Try other words.');return}
 chat('Here\'s what I found:'+hits.map(m=>`<div style="margin-top:8px">“${esc(m.text)}”<cite>Memory #${m.id} · ${fmt(m.at)}</cite></div>`).join(''))};
$('askIn').onkeydown=e=>e.key==='Enter'&&$('askGo').onclick();

/* ---------- Daily Brief ---------- */
$('goals').value=LS('goals')||'';$('goals').oninput=e=>LS('goals',e.target.value);
function extractive(mems,goals){const g=goals.split('\n').map(s=>s.trim()).filter(Boolean);let s=`Good morning Pedro. It's ${new Date().toLocaleDateString([], {weekday:'long',month:'long',day:'numeric'})}. `;
 if(mems.length){s+=`Yesterday you saved ${mems.length} memor${mems.length>1?'ies':'y'}. `;mems.slice(0,3).forEach(m=>{const f=m.text.split(/(?<=[.!?।])\s/)[0];s+=f.slice(0,140)+(/[.!?।]$/.test(f)?' ':'. ')})}else s+='No memories from yesterday. ';
 s+=g.length?`Today's focus: ${g.slice(0,4).join('; ')}. `:'You have no goals set for today. ';return s+'Make it a good one.'}
$('briefGo').onclick=async()=>{const y=new Date();y.setDate(y.getDate()-1);y.setHours(0,0,0,0);const e=new Date();e.setHours(0,0,0,0);const mems=(await DB.all('memories')).filter(m=>m.at>=+y&&m.at<+e);let txt=extractive(mems,$('goals').value);
 if(key()){$('briefTxt').textContent='Writing your brief…';try{txt=await gemini(`Write a warm, upbeat spoken morning brief for Pedro, max 75 words (about 30 seconds). Summarize yesterday's memories and list today's goals.\nYesterday's memories:\n${mems.map(m=>'- '+m.text).join('\n')||'none'}\nToday's goals:\n${$('goals').value||'none'}`)}catch(e){}}
 $('briefTxt').textContent=txt;$('briefTxt').classList.remove('muted');LS('briefDay',new Date().toDateString());say(txt,'en-IN')};

/* ---------- More ---------- */
function sub(n){$('moreGrid').classList.toggle('hidden',!!n);$$('#v-more .sub').forEach(s=>s.classList.toggle('hidden',s.id!=='s-'+n));if(n)$('title').textContent={dream:'Dream Recorder',parallel:'Parallel You',living:'Living Language',enhance:'Enhance',settings:'Settings'}[n];else $('title').textContent='More';if(n==='dream')renderDreams()}
$$('[data-go]').forEach(b=>b.onclick=()=>sub(b.dataset.go));$$('.back').forEach(b=>b.onclick=()=>{ll&&ll.stop();sub(null)});

// Dream
dictInto($('dreamIn'),$('dreamMic'));
const EM=[['fly','🕊️'],['water','🌊'],['sea','🌊'],['fall','🌀'],['run','🏃'],['school','🏫'],['exam','📝'],['dog','🐕'],['cat','🐈'],['fire','🔥'],['money','💸'],['love','💜'],['house','🏠'],['car','🚗'],['night','🌙'],['food','🍲'],['friend','🫂'],['ghost','👻']];
function storyCard(d){const em=(EM.filter(([w])=>norm(d.text).includes(w)).map(x=>x[1]).slice(0,3).join(' '))||'🌙 ✨';return `<div class="story"><div class="em">${d.emoji||em}</div><h3>${esc(d.title||'A dream from '+new Date(d.at).toLocaleDateString())}</h3><div class="srcT">${esc(d.story||d.text).replace(/\n/g,'<br>')}</div><div class="d muted small" style="margin-top:10px">${fmt(d.at)}</div></div>`}
$('dreamGo').onclick=async()=>{const text=$('dreamIn').value.trim();if(!text)return;const d={text,at:Date.now()};
 if(key()){$('dreamCard').innerHTML='<p class="muted">Illustrating your dream…</p>';try{const r=await gemini(`Turn this dream into a short whimsical illustrated story card. Reply as JSON {"title":"...","emoji":"3 emojis that illustrate it","story":"4-6 vivid sentences"} only.\nDream: ${text}`);Object.assign(d,JSON.parse(r.replace(/```json|```/g,'').trim()))}catch(e){}}
 await DB.add('dreams',d);$('dreamCard').innerHTML=storyCard(d);$('dreamIn').value='';renderDreams()};
async function renderDreams(){const a=(await DB.all('dreams')).sort((x,y)=>y.at-x.at).slice(1);$('dreamList').innerHTML=a.length?'<div class="lbl" style="margin-top:16px">Dream journal</div>'+a.map(storyCard).join(''):''}

// Parallel
function fakeFutures(q){const seed=[...q].reduce((a,c)=>a+c.charCodeAt(0),0),r=n=>(seed*9301+n*49297)%233280/233280;const base=[['The Bold Path','You commit fully. Month 3 is hard, by month 9 people notice.'],['The Steady Path','You go slowly and consistently. Fewer highs, fewer crashes.'],['The Plot Twist','Something unexpected pulls you sideways — and it turns out better.'],['The Comfort Trap','You delay the choice. A year passes quietly, and you wish you had started.']];let w=base.map((_,i)=>.4+r(i+1));const s=w.reduce((a,b)=>a+b);return base.map((b,i)=>({title:b[0],story:b[1],odds:Math.round(w[i]/s*100)}))}
$('parGo').onclick=async()=>{const q=$('parIn').value.trim();if(!q)return;let f=null;$('parOut').innerHTML='<p class="muted">Simulating 1,000 futures…</p>';
 if(key()){try{const r=await gemini(`Fun simulation (not real prediction): Pedro, a data-analytics student in Delhi, faces: "${q}". Give 4 distinct plausible futures over 3 years. JSON array only: [{"title":"","story":"2-3 vivid sentences","odds":number}] with odds summing to 100.`);f=JSON.parse(r.replace(/```json|```/g,'').trim())}catch(e){}}
 f=f||fakeFutures(q);$('parOut').innerHTML='<p class="muted small">🎲 Fun simulation — not a real prediction.</p>'+f.map(x=>`<div class="card"><span class="pct">${x.odds}%</span><b>${esc(x.title)}</b><div class="srcT" style="margin-top:6px">${esc(x.story)}</div></div>`).join('')};

// Living Language
let ll=null;
for(const s of ['llFrom','llTo'])$(s).innerHTML=Object.entries(LANGS).map(([k,v])=>`<option value="${k}">${v[0]}</option>`).join('');
$('llFrom').value=LS('llFrom')||'en';$('llTo').value=LS('llTo')||'hi';$('llFrom').onchange=e=>LS('llFrom',e.target.value);$('llTo').onchange=e=>LS('llTo',e.target.value);
$('llMic').onclick=()=>{if(ll&&ll.on){ll.stop();$('llMic').textContent='Start';$('llMic').classList.remove('live');return}const f=$('llFrom').value,t=$('llTo').value;
 ll=listener({lang:LANGS[f][1],onInterim:i=>$('llSrc').textContent=i,onFinal:async s=>{$('llSrc').textContent=s;const o=await translate(s,f,t);$('llDst').textContent=o;say(o,LANGS[t][1])},onState:()=>{}});if(ll.start()){$('llMic').textContent='Stop';$('llMic').classList.add('live')}};

/* ---------- Settings & Lock ---------- */
$('key').value=key();$('key').oninput=e=>LS('gkey',e.target.value.trim());
const sha=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('pedro-os:'+s)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))),ub64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function lockState(){$('lockState').textContent=LS('pinHash')?('Lock is on'+(LS('credId')?' · fingerprint added':'')+'. Locks when the app opens.'):'Lock is off.'}lockState();
$('pinSave').onclick=async()=>{const p=$('pinSet').value;if(!/^\d{4,8}$/.test(p))return alert('PIN must be 4–8 digits');LS('pinHash',await sha(p));$('pinSet').value='';lockState()};
$('bioReg').onclick=async()=>{if(!LS('pinHash'))return alert('Set a PIN first (fallback).');try{const c=await navigator.credentials.create({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),rp:{name:'Pedro OS'},user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'pedro',displayName:'Pedro'},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required'},timeout:60000}});LS('credId',b64(c.rawId));lockState()}catch(e){alert('Fingerprint setup failed: '+e.message)}};
$('lockOff').onclick=()=>{if(confirm('Disable app lock?')){localStorage.removeItem('pinHash');localStorage.removeItem('credId');lockState()}};
async function bio(){try{await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),allowCredentials:[{type:'public-key',id:ub64(LS('credId'))}],userVerification:'required',timeout:60000}});unlock()}catch(e){$('lockMsg').textContent='Fingerprint failed — use your PIN.'}}
function unlock(){$('lock').classList.add('hidden');sessionStorage.unlocked='1'}
$('bioUnlock').onclick=bio;$('pinUnlock').onclick=async()=>{if(await sha($('pinIn').value)===LS('pinHash'))unlock();else $('lockMsg').textContent='Wrong PIN.'};$('pinIn').onkeydown=e=>e.key==='Enter'&&$('pinUnlock').onclick();
if(LS('pinHash')&&!sessionStorage.unlocked){$('lock').classList.remove('hidden');$('bioUnlock').classList.toggle('hidden',!LS('credId'));if(LS('credId'))bio()}
$('dataExp').onclick=async()=>download('pedro-os-backup.json',JSON.stringify({memories:await DB.all('memories'),dreams:await DB.all('dreams'),translations:hist,goals:LS('goals')},null,1),'application/json');
$('dataWipe').onclick=async()=>{if(!confirm('Erase ALL memories, dreams and history on this device?'))return;await DB.clear('memories');await DB.clear('dreams');hist=[];renderHist();alert('Erased.')};

/* ---------- Boot ---------- */
tab((location.hash.slice(1) in TITLES)?location.hash.slice(1):'translate');
if(LS('briefDay')!==new Date().toDateString()&&new Date().getHours()<12&&location.hash==='')null;
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
speechSynthesis?.getVoices();
