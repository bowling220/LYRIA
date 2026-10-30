/* Bundled Unicode data; no third-party picker, tracking, or account writes. */
(() => {
  const $ = id => document.getElementById(id), UI = window.LyriaUI;
  const modal = $('emoji-modal'), input = $('message-input'), grid = $('emoji-results');
  const dataURL = new URL('../assets/emoji/emoji-16.0.json', document.currentScript.src);
  const labels = {'Smileys & Emotion':'Smileys','People & Body':'People','Component':'Skin tones','Animals & Nature':'Nature','Food & Drink':'Food','Travel & Places':'Travel'};
  let data, loading, category = 'All', shown = 120, matches = [], selection;
  let recent = [];
  try { const saved = JSON.parse(localStorage.getItem('lyria:recent-emojis')); if (Array.isArray(saved)) recent = saved.filter(x => typeof x === 'string').slice(0,24); } catch {}
  const rememberSelection = () => { selection = {start:input.selectionStart,end:input.selectionEnd}; };
  for (const event of ['select','input','keyup','pointerup']) input.addEventListener(event,rememberSelection);
  function render() {
    if (!data) return;
    const words = $('emoji-search').value.toLocaleLowerCase().replace(/:/g,' ').trim().split(/\s+/).filter(Boolean);
    const byEmoji = new Map(data.emojis.map(item => [item.emoji,item]));
    matches = words.length ? data.emojis.filter(item => words.every(word => (item.name+' '+item.group+' '+item.emoji).toLocaleLowerCase().includes(word)))
      : category === 'Recent' ? recent.map(emoji => byEmoji.get(emoji)).filter(Boolean)
      : data.emojis.filter(item => category === 'All' || item.group === category);
    grid.replaceChildren();
    for (const item of matches.slice(0,shown)) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'emoji-option'; button.textContent = item.emoji;
      button.title = item.name; button.setAttribute('aria-label','Insert '+item.name);
      button.addEventListener('click',() => choose(item)); grid.append(button);
    }
    $('emoji-status').textContent = matches.length ? matches.length.toLocaleString()+' emojis'+(words.length?' found':' · '+(labels[category] || category))
      : category === 'Recent' && !words.length ? 'Your recently used emojis will appear here.' : 'No emojis found. Try another word.';
    $('emoji-more').hidden = shown >= matches.length;
    for (const button of $('emoji-categories').children) button.setAttribute('aria-pressed',String(button.dataset.category === category));
  }
  function choose(item) {
    const start = Math.min(selection?.start ?? input.value.length,input.value.length);
    const end = Math.max(start,Math.min(selection?.end ?? start,input.value.length));
    if (input.maxLength >= 0 && input.value.length-end+start+item.emoji.length > input.maxLength) {
      $('emoji-status').textContent = 'Your message is full. Shorten it before adding an emoji.'; return;
    }
    UI.closeModal(modal); input.focus();
    input.setRangeText(item.emoji,start,end,'end');
    input.dispatchEvent(new Event('input',{bubbles:true})); rememberSelection();
    // The shared dialog observer restores its trigger first; selection returns
    // to writing instead, while Escape still restores the emoji trigger.
    requestAnimationFrame(() => { if (modal.style.display === 'none') input.focus(); });
    recent = [item.emoji,...recent.filter(emoji => emoji !== item.emoji)].slice(0,24);
    try { localStorage.setItem('lyria:recent-emojis',JSON.stringify(recent)); } catch {}
  }
  async function load() {
    if (data) { render(); return; }
    $('emoji-status').textContent = 'Loading emojis…'; $('emoji-retry').hidden = true;
    try {
      if (!loading) loading = fetch(dataURL,{credentials:'omit'}).then(async response => {
        if (!response.ok) throw new Error('unavailable');
        const value = await response.json();
        if (!Array.isArray(value.emojis) || !Array.isArray(value.groups)) throw new Error('invalid');
        return value;
      });
      data = await loading;
      const nav = $('emoji-categories'); nav.replaceChildren();
      for (const group of ['All','Recent',...data.groups]) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.category = group;
        button.textContent = labels[group] || group;
        button.addEventListener('click',() => { category = group; shown = 120; $('emoji-search').value = ''; render(); $('emoji-results').parentElement.scrollTop = 0; });
        nav.append(button);
      }
      render();
    } catch {
      loading = null; $('emoji-status').textContent = 'Emojis couldn’t load. Your message is still here.'; $('emoji-retry').hidden = false;
    }
  }
  function open() {
    if (document.activeElement === input) rememberSelection();
    UI.closeModal($('composer-tools-modal'));
    category = 'All'; shown = 120; $('emoji-search').value = ''; $('emoji-categories').scrollLeft = 0;
    UI.openModal(modal); load();
  }
  for (const id of ['composer-emoji','tools-emojis']) $(id).addEventListener('click',open);
  $('emoji-search').addEventListener('input',() => { category = 'All'; shown = 120; $('emoji-categories').scrollLeft = 0; render(); $('emoji-results').parentElement.scrollTop = 0; });
  $('emoji-more').addEventListener('click',() => {
    const index = grid.children.length; shown += 120; render(); grid.children[index]?.focus();
  });
  $('emoji-retry').addEventListener('click',load);
  grid.addEventListener('keydown',event => {
    const index = [...grid.children].indexOf(event.target); if (index < 0) return;
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const offset = {ArrowRight:1,ArrowLeft:-1,ArrowDown:columns,ArrowUp:-columns}[event.key];
    if (offset === undefined) return;
    event.preventDefault(); grid.children[Math.max(0,Math.min(grid.children.length-1,index+offset))]?.focus();
  });
})();
