/* Pedro OS · Enhance — on-device image & video upscaling. Nothing is uploaded. */
(()=>{
const $=id=>document.getElementById(id);
const CDN={tf:'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js',
 up:'https://cdn.jsdelivr.net/npm/upscaler@1.0.0-beta.19/dist/browser/umd/upscaler.min.js',
 m2:'https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0-beta.12/dist/umd/models/esrgan-slim/src/x2/index.min.js',
 m4:'https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0-beta.12/dist/umd/models/esrgan-slim/src/x4/index.min.js',
 mux:'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.js'};
const loaded={};
const load=src=>loaded[src]||(loaded[src]=new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>{delete loaded[src];no(new Error('load '+src))};document.head.appendChild(s)}));
let file=null,kind=null,target=1080,cancel=false,busy=false,outURL=null,ups={};
const st=t=>$('enStat').textContent=t;
const fmtT=s=>!isFinite(s)?'…':s<60?Math.round(s)+'s':Math.floor(s/60)+'m '+Math.round(s%60)+'s';
function dims(w,h,t){const sc=t/Math.min(w,h);let W=Math.round(w*sc/2)*2,H=Math.round(h*sc/2)*2;return{W,H,sc}}
function prog(p,eta){$('enBar').style.width=(p*100).toFixed(1)+'%';$('enPct').textContent=Math.round(p*100)+'%'+(eta!=null?' · ETA '+fmtT(eta):'')}

/* ---- high-quality resize + unsharp ---- */
function hqResize(src,sw,sh,W,H){let c=src,cw=sw,ch=sh;
 while(cw*2<W&&ch*2<H){const n=new OffscreenCanvas(cw*2,ch*2),x=n.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(c,0,0,cw*2,ch*2);c=n;cw*=2;ch*=2}
 const o=document.createElement('canvas');o.width=W;o.height=H;const x=o.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(c,0,0,W,H);return o}
function sharpen(cv,amt=.35){const x=cv.getContext('2d'),W=cv.width,H=cv.height,id=x.getImageData(0,0,W,H),d=id.data,s=new Uint8ClampedArray(d),r=W*4;
 for(let y=1;y<H-1;y++)for(let i=y*r+4,e=y*r+r-4;i<e;i++){if((i&3)===3)continue;const v=s[i]*(1+4*amt)-amt*(s[i-4]+s[i+4]+s[i-r]+s[i+r]);d[i]=v}
 x.putImageData(id,0,0);return cv}

/* ---- AI (ESRGAN-slim via UpscalerJS, tiled) ---- */
async function getAI(f){if(ups[f])return ups[f];await load(CDN.tf);
 try{if(await tf.setBackend('webgl'))await tf.ready()}catch(e){await tf.setBackend('cpu')}
 await load(CDN.up);await load(f===4?CDN.m4:CDN.m2);
 const u=new Upscaler({model:f===4?ESRGANSlim4x:ESRGANSlim2x});await u.getModel();return ups[f]=u}
async function aiUpscale(srcCanvas,W,H,onp){const sw=srcCanvas.width,sh=srcCanvas.height,need=W/sw;
 const f=need>2.6?4:2;const u=await getAI(f);
 // pre-size input so AI output ≈ target (keeps work and memory bounded)
 const iw=Math.max(8,Math.round(W/f)),ih=Math.max(8,Math.round(H/f));
 const inp=need>=f*0.98?hqResize(srcCanvas,sw,sh,iw,ih):srcCanvas;
 const ac=new AbortController();const chk=setInterval(()=>cancel&&ac.abort(),200);
 try{const t=await u.upscale(inp,{output:'tensor',patchSize:64,padding:4,awaitNextFrame:true,signal:ac.signal,progress:p=>onp&&onp(p)});
  const [h,w]=t.shape;const c=document.createElement('canvas');c.width=w;c.height=h;await tf.browser.toPixels(tf.tidy(()=>t.clipByValue(0,255).cast('int32')),c);t.dispose();
  return w===W&&h===H?c:hqResize(c,w,h,W,H)}finally{clearInterval(chk)}}

/* ---- UI ---- */
function pick(f){file=f;kind=f.type.startsWith('video')?'video':'image';$('enOut').classList.add('hidden');$('enDl').classList.add('hidden');
 const u=URL.createObjectURL(f);const el=kind==='image'?new Image():document.createElement('video');
 const done=()=>{const w=el.naturalWidth||el.videoWidth,h=el.naturalHeight||el.videoHeight;file._w=w;file._h=h;file._d=el.duration;
  let msg=`${kind==='image'?'Photo':'Video'} · ${w}×${h}`+(kind==='video'?` · ${el.duration.toFixed(1)}s`:'');
  if(kind==='video'&&el.duration>20)msg+=' — long clip: on a phone this can take a very long time. Short clips (≤15s) work best.';
  $('enInfo').textContent=msg;$('enGo').disabled=false;$('enAIrow').classList.toggle('hidden',kind!=='video');updTarget()};
 if(kind==='image'){el.onload=done;el.src=u}else{el.preload='metadata';el.onloadedmetadata=done;el.src=u}
 $('enBefore').src=kind==='image'?u:'';}
function updTarget(){$$('#enRes button').forEach(b=>b.classList.toggle('on',+b.dataset.r===target));if(file&&file._w){const{W,H}=dims(file._w,file._h,target);$('enTgt').textContent=`Output ${W}×${H}`}}
const $$=s=>document.querySelectorAll(s);

async function runImage(){const img=new Image();img.src=URL.createObjectURL(file);await img.decode();
 const{W,H}=dims(img.naturalWidth,img.naturalHeight,target);const src=document.createElement('canvas');src.width=img.naturalWidth;src.height=img.naturalHeight;src.getContext('2d').drawImage(img,0,0);
 const t0=performance.now();let out,how;
 if(W>src.width*1.15&&$('enAI').checked){try{st('Loading AI model (first time ~2 MB)…');out=await aiUpscale(src,W,H,p=>{const el=(performance.now()-t0)/1000;prog(p,p>0.02?el/p-el:null);st('AI upscaling (tiled)…')});how='AI (ESRGAN)'}catch(e){if(cancel)throw e;console.warn('AI failed, fallback',e);st('AI unavailable — using HQ resize…')}}
 if(!out){out=sharpen(hqResize(src,src.width,src.height,W,H),W>src.width?.3:.1);how='HQ resize + sharpen'}
 prog(1);const blob=await new Promise(r=>out.toBlob(r,'image/png'));
 return{blob,name:file.name.replace(/\.\w+$/,'')+`_${target}p.png`,W:out.width,H:out.height,how,secs:(performance.now()-t0)/1000}}

async function runVideo(){await load(CDN.mux);const v=document.createElement('video');v.muted=true;v.playsInline=true;v.src=URL.createObjectURL(file);await new Promise(r=>v.onloadeddata=r);
 const{W,H}=dims(v.videoWidth,v.videoHeight,target),dur=v.duration,fps=Math.min(30,+$('enFps').value||30),N=Math.max(1,Math.floor(dur*fps));
 // pick encoder
 const cands=[['avc','avc1.640034'],['avc','avc1.4d0034'],['vp9','vp09.00.51.08'],['av1','av01.0.12M.08']];let vc=null;
 for(const[m,c]of cands){try{const s=await VideoEncoder.isConfigSupported({codec:c,width:W,height:H,bitrate:W*H*fps*0.12,framerate:fps});if(s.supported){vc={m,c};break}}catch(e){}}
 if(!vc)throw new Error('This browser cannot encode video at '+W+'×'+H);
 // audio
 let audio=null;try{const ab=await file.arrayBuffer();const ctx=new OfflineAudioContext(2,1,48000);const buf=await ctx.decodeAudioData(ab);
  for(const[m,c]of[['aac','mp4a.40.2'],['opus','opus']]){const s=await AudioEncoder.isConfigSupported({codec:c,sampleRate:buf.sampleRate,numberOfChannels:Math.min(2,buf.numberOfChannels),bitrate:160000});if(s.supported){audio={buf,m,c};break}}}catch(e){console.warn('no audio',e)}
 const muxer=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:vc.m,width:W,height:H},audio:audio?{codec:audio.m,sampleRate:audio.buf.sampleRate,numberOfChannels:Math.min(2,audio.buf.numberOfChannels)}:undefined,fastStart:'in-memory',firstTimestampBehavior:'offset'});
 let encErr=null;const ve=new VideoEncoder({output:(c,m)=>muxer.addVideoChunk(c,m),error:e=>encErr=e});
 ve.configure({codec:vc.c,width:W,height:H,bitrate:Math.round(W*H*fps*0.12),framerate:fps,latencyMode:'quality'});
 const useAI=$('enVAI').checked;const src=document.createElement('canvas');src.width=v.videoWidth;src.height=v.videoHeight;const sx=src.getContext('2d',{willReadFrequently:true});
 const t0=performance.now();
 for(let i=0;i<N;i++){if(cancel)throw new Error('cancelled');if(encErr)throw encErr;
  v.currentTime=Math.min(dur-0.001,i/fps);await new Promise(r=>v.onseeked=r);sx.drawImage(v,0,0);
  let out;if(useAI){try{out=await aiUpscale(src,W,H)}catch(e){if(cancel)throw e;out=null}}
  if(!out)out=sharpen(hqResize(src,src.width,src.height,W,H),.25);
  const fr=new VideoFrame(out,{timestamp:Math.round(i*1e6/fps),duration:Math.round(1e6/fps)});ve.encode(fr,{keyFrame:i%(fps*2)===0});fr.close();
  while(ve.encodeQueueSize>4)await new Promise(r=>setTimeout(r,5));
  const el=(performance.now()-t0)/1000,p=(i+1)/N;prog(p*0.97,el/p-el);st(`Frame ${i+1}/${N} · ${(el/(i+1)).toFixed(2)}s per frame`)}
 await ve.flush();
 if(audio){st('Adding audio…');const b=audio.buf,ch=Math.min(2,b.numberOfChannels),sr=b.sampleRate;let aerr=null;
  const ae=new AudioEncoder({output:(c,m)=>muxer.addAudioChunk(c,m),error:e=>aerr=e});ae.configure({codec:audio.c,sampleRate:sr,numberOfChannels:ch,bitrate:160000});
  const L=Math.min(b.length,Math.round(N/fps*sr)),step=sr;for(let o=0;o<L;o+=step){const n=Math.min(step,L-o),pl=new Float32Array(n*ch);for(let c=0;c<ch;c++)pl.set(b.getChannelData(c).subarray(o,o+n),c*n);
   const ad=new AudioData({format:'f32-planar',sampleRate:sr,numberOfFrames:n,numberOfChannels:ch,timestamp:Math.round(o/sr*1e6),data:pl});ae.encode(ad);ad.close()}
  await ae.flush();if(aerr)console.warn(aerr)}
 muxer.finalize();prog(1);const blob=new Blob([muxer.target.buffer],{type:'video/mp4'});
 return{blob,name:file.name.replace(/\.\w+$/,'')+`_${target}p.mp4`,W,H,how:(useAI?'AI per frame':'HQ resize + sharpen')+` · ${vc.c}`+(audio?' + '+audio.m+' audio':' (no audio)'),secs:(performance.now()-t0)/1000,frames:N}}

async function go(){if(!file||busy)return;busy=true;cancel=false;$('enGo').classList.add('hidden');$('enCancel').classList.remove('hidden');$('enProg').classList.remove('hidden');$('enOut').classList.add('hidden');$('enDl').classList.add('hidden');prog(0);
 try{const r=await(kind==='image'?runImage():runVideo());window.__enhanceResult={W:r.W,H:r.H,how:r.how,secs:r.secs,frames:r.frames,size:r.blob.size};
  if(outURL)URL.revokeObjectURL(outURL);outURL=URL.createObjectURL(r.blob);
  $('enDl').href=outURL;$('enDl').download=r.name;$('enDl').classList.remove('hidden');
  st(`Done · ${r.W}×${r.H} · ${r.how} · ${fmtT(r.secs)}`);
  $('enOut').classList.remove('hidden');$('enCmp').classList.toggle('hidden',kind!=='image');$('enVid').classList.toggle('hidden',kind!=='video');
  if(kind==='image'){$('enAfter').src=outURL;$('enSl').value=50;slide()}else{$('enVid').src=outURL}
 }catch(e){window.__enhanceResult={error:String(e)};st(cancel?'Cancelled.':'Error: '+e.message)}
 busy=false;$('enGo').classList.remove('hidden');$('enCancel').classList.add('hidden')}
function slide(){const p=$('enSl').value;$('enAfterWrap').style.clipPath=`inset(0 0 0 ${p}%)`;$('enLine').style.left=p+'%'}

window.addEventListener('DOMContentLoaded',init);if(document.readyState!=='loading')init();
function init(){if(init.d||!$('enFile'))return;init.d=1;
 $('enFile').onchange=e=>e.target.files[0]&&pick(e.target.files[0]);
 $$('#enRes button').forEach(b=>b.onclick=()=>{target=+b.dataset.r;updTarget()});
 $('enGo').onclick=go;$('enCancel').onclick=()=>{cancel=true;st('Cancelling…')};$('enSl').oninput=slide;
 if(!('VideoEncoder' in window))$('enVNote').textContent='Video enhance needs a recent Chrome (WebCodecs). Photos still work.';}
})();
