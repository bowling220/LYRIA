/* Personal appearance: safe colors, immediate previews, shared across every page. */
(() => {
 const key='lyria-appearance';
 const defaults={mode:'dark',accent:'#c5f277',hue:145,roundness:'soft',density:'comfortable'};
 const valid=v=>({mode:v?.mode==='light'?'light':'dark',accent:/^#[0-9a-f]{6}$/i.test(v?.accent)?v.accent:defaults.accent,hue:Number.isFinite(Number(v?.hue))?Math.max(0,Math.min(360,Number(v.hue))):145,roundness:v?.roundness==='square'?'square':'soft',density:v?.density==='compact'?'compact':'comfortable'});
 let current={...defaults};try{current=valid(JSON.parse(localStorage.getItem(key)))}catch{}
 function apply(value){
  current=valid(value);const r=document.documentElement,s=r.style,light=current.mode==='light',h=current.hue;
  r.dataset.appearance=current.mode;r.dataset.density=current.density;r.dataset.roundness=current.roundness;
  s.colorScheme=current.mode;
  const colors=light?{bg:`hsl(${h} 22% 96%)`,surface:`hsl(${h} 20% 99%)`,'surface-raised':`hsl(${h} 22% 91%)`,'surface-hover':`hsl(${h} 22% 86%)`,text:`hsl(${h} 25% 12%)`,muted:`hsl(${h} 15% 33%)`,subtle:`hsl(${h} 12% 40%)`,line:`hsl(${h} 15% 72%)`}:{bg:`hsl(${h} 25% 8%)`,surface:`hsl(${h} 24% 12%)`,'surface-raised':`hsl(${h} 24% 16%)`,'surface-hover':`hsl(${h} 24% 21%)`,text:`hsl(${h} 18% 94%)`,muted:`hsl(${h} 15% 71%)`,subtle:`hsl(${h} 13% 61%)`,line:`hsl(${h} 18% 29%)`};
  for(const [k,v]of Object.entries(colors))s.setProperty('--'+k,v);
  let channels=current.accent.match(/\w\w/g).map(v=>parseInt(v,16));
  const luminance=arr=>{const a=arr.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*a[0]+.7152*a[1]+.0722*a[2]};
  // Keep accent text readable even when a custom color is very dark or pale.
  for(let i=0;i<30 && (light?luminance(channels)>.18:luminance(channels)<.35);i++)channels=channels.map(v=>light?v*.9:v+(255-v)*.1);
  const accent='#'+channels.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
  s.setProperty('--accent',accent);s.setProperty('--accent-hover',accent);s.setProperty('--accent-ink',luminance(channels)>.179?'#101418':'#ffffff');s.setProperty('--aqua','var(--text)');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',colors.bg);
  try{localStorage.setItem(key,JSON.stringify(current))}catch{}
 }
 apply(current);
 function setup(){
  const host=document.getElementById('appearance-settings');if(!host)return;
  host.innerHTML=`<h3>Make LYRIA yours</h3><p>Your colors apply to chats, calls, menus, and pages.</p><div class="theme-presets" aria-label="Theme presets"></div><div class="theme-fields"><label>Mode<select id="theme-mode"><option value="dark">Dark</option><option value="light">Light</option></select></label><label>Accent color<input id="theme-accent" type="color"></label><label>Background color<input id="theme-hue" type="range" min="0" max="360"></label><label>Corners<select id="theme-roundness"><option value="soft">Rounded</option><option value="square">Subtle</option></select></label><label>Spacing<select id="theme-density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label></div><button type="button" id="theme-save">Save appearance to account</button><p id="theme-save-status" class="save-status" role="status" aria-live="polite"></p>`;
  function sync(){for(const field of ['mode','accent','hue','roundness','density'])document.getElementById('theme-'+field).value=current[field]}
  for(const [name,accent,hue,mode]of [['Forest','#c5f277',145,'dark'],['Midnight','#acb5ff',235,'dark'],['Ocean','#72dded',205,'dark'],['Rose','#ffb3d1',325,'dark'],['Ember','#ffc078',25,'dark'],['Paper','#3e55b8',225,'light']]){
   const b=document.createElement('button');b.type='button';b.textContent=name;b.style.borderColor=accent;b.onclick=()=>{apply({...current,accent,hue,mode});sync();status()};host.querySelector('.theme-presets').append(b);
  }
  const status=()=>{document.getElementById('theme-save-status').textContent='Applied on this browser. Save to keep it in your account.'};
  host.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>{apply({...current,[el.id.replace('theme-','')]:el.value});status()}));
  document.getElementById('theme-save').onclick=()=>window.LyriaAccount?.save({appearance:current},{button:document.getElementById('theme-save'),statusId:'theme-save-status'});
  sync();window.addEventListener('lyria:appearance',sync);
 }
 window.LyriaAppearance={apply:v=>{apply(v);window.dispatchEvent(new Event('lyria:appearance'))},get:()=>({...current})};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
