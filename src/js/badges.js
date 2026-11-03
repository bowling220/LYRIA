/* One registry and renderer for non-entitlement community and role badges. */
(() => {
  const categories=Object.freeze({staff:'Staff',community:'Community',achievement:'Achievement',legacy:'Legacy',event:'Event',contribution:'Contribution'});
  const definitions=[
    {id:'admin',name:'Admin',description:'Official LYRIA administrator.',category:'staff',aliases:['Admin','administrator'],symbol:'crown'},
    {id:'moderator',name:'Moderator',description:'Helps keep the community safe and welcoming.',category:'staff',aliases:['Mod'],symbol:'shield'},
    {id:'developer',name:'Developer',description:'Helps build and maintain LYRIA.',category:'staff',aliases:['DevBadge'],symbol:'builder'},
    {id:'beta',name:'Beta Tester',description:'Recognizes participation in LYRIA beta testing.',category:'achievement',aliases:['Beta'],symbol:'flask'},
    {id:'early-access',name:'Early Access',description:'Awarded to members from LYRIA’s early-access era.',category:'legacy',legacy:true,aliases:['EarlyAccess','early_access','Early Access'],symbol:'comet'},
    {id:'featured',name:'Featured',description:'A community member recognized by LYRIA.',category:'community',aliases:['feature','Featured'],symbol:'star'}
  ].map(b=>Object.freeze({...b,asset:'assets/badges/'+b.id+'.svg',aliases:Object.freeze(b.aliases)}));
  const registry=Object.freeze(Object.fromEntries(definitions.map(b=>[b.id,b])));
  const aliases=new Map();for(const b of definitions)for(const alias of [b.id,...b.aliases])aliases.set(alias.toLowerCase(),b.id);
  // Preserve the two existing manually awarded Featured distinctions, without a database migration.
  const legacyFeaturedMembers=new Set(['miu0tI2oHJUiNx2gxtPwSpJ136w1','dIc6q6xdqsTuiVC9JWGQT9XVH6T2']);
  const normalize=value=>typeof value==='string'?aliases.get(value.trim().toLowerCase()) || null:null;
  function forProfile(profile,uid){
    if(profile?.showBadges===false)return [];
    const ids=new Set((Array.isArray(profile?.badges)?profile.badges:[]).map(normalize).filter(Boolean));
    if(legacyFeaturedMembers.has(uid))ids.add('featured');return [...ids].map(id=>registry[id]);
  }
  let tooltip,active,pinned=false;
  function hide(){if(active)active.removeAttribute('aria-describedby');active=null;pinned=false;if(tooltip)tooltip.hidden=true}
  function position(){
    if(!active?.isConnected || !active.getClientRects().length){hide();return}
    const anchor=active.getBoundingClientRect(),rect=tooltip.getBoundingClientRect();
    if(anchor.bottom<0 || anchor.top>innerHeight){hide();return}
    const left=Math.max(10,Math.min(innerWidth-rect.width-10,anchor.left+anchor.width/2-rect.width/2));
    const above=anchor.top-rect.height-8,top=above>=10?above:Math.min(innerHeight-rect.height-10,anchor.bottom+8);
    tooltip.style.left=left+'px';tooltip.style.top=Math.max(10,top)+'px';
  }
  function show(button,badge){
    if(active!==button)hide();active=button;
    if(!tooltip){tooltip=document.createElement('div');tooltip.id='badge-tooltip';tooltip.className='badge-tooltip';tooltip.setAttribute('role','tooltip');document.body.append(tooltip)}
    tooltip.replaceChildren();const name=document.createElement('strong'),description=document.createElement('p'),category=document.createElement('span');
    name.textContent=badge.name;description.textContent=badge.description;category.textContent=categories[badge.category];tooltip.append(name,description,category);tooltip.hidden=false;
    button.setAttribute('aria-describedby',tooltip.id);position();
  }
  function render(container,profile,uid,{inline=false}={}){
    if(!container)return 0;if(active && container.contains(active))hide();container.replaceChildren();
    const badges=forProfile(profile,uid);
    for(const badge of badges){
      const button=document.createElement('button');button.type='button';button.className=inline?'lyria-badge lyria-badge-inline':'lyria-badge';button.dataset.badgeId=badge.id;button.dataset.badgeName=badge.id;
      button.setAttribute('aria-label',badge.name+' · '+categories[badge.category]+'. '+badge.description);
      const art=document.createElement('span');art.className='badge-art';art.setAttribute('aria-hidden','true');
      const img=document.createElement('img');img.src=badge.asset;img.alt='';img.width=inline?20:32;img.height=inline?20:32;img.dataset.managedMedia='true';
      img.addEventListener('error',()=>{art.replaceChildren();const fallback=document.createElement('span');fallback.className='badge-fallback';fallback.textContent=badge.name.charAt(0);art.append(fallback);button.dataset.assetUnavailable='true'},{once:true});
      art.append(img);button.append(art);
      if(!inline){const label=document.createElement('span');label.className='badge-label';label.textContent=badge.name;button.append(label)}
      button.addEventListener('mouseenter',()=>{if(!pinned)show(button,badge)});
      button.addEventListener('mouseleave',()=>{if(!pinned && document.activeElement!==button)hide()});
      button.addEventListener('focus',()=>show(button,badge));button.addEventListener('blur',hide);
      button.addEventListener('click',()=>{if(active===button && pinned){hide();return}show(button,badge);pinned=true});
      container.append(button);
    }
    return badges.length;
  }
  if(typeof document!=='undefined'){
    document.addEventListener('pointerdown',event=>{if(active && !active.contains(event.target))hide()},true);
    document.addEventListener('keydown',event=>{if(event.key==='Escape' && active){hide();event.stopImmediatePropagation();event.preventDefault()}},true);
    window.addEventListener('resize',()=>{if(active)position()});document.addEventListener('scroll',()=>{if(active)position()},true);
  }
  window.LyriaBadges={registry,categories,normalize,forProfile,render,hideDetails:hide};
})();
