(function(){
  'use strict';
  let installPrompt=null;
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
  const installButton=()=>document.getElementById('pwa-install');
  function refreshInstallButton(){
    const button=installButton();
    if(button)button.hidden=!installPrompt || standalone();
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    installPrompt=event;
    refreshInstallButton();
  });
  window.addEventListener('appinstalled',()=>{
    installPrompt=null;
    refreshInstallButton();
  });
  document.addEventListener('DOMContentLoaded',()=>{
    const button=installButton();
    button?.addEventListener('click',async()=>{
      if(!installPrompt)return;
      const prompt=installPrompt;
      installPrompt=null;
      refreshInstallButton();
      await prompt.prompt();
      await prompt.userChoice;
    });
    refreshInstallButton();
  });
  window.addEventListener('load',()=>{
    if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(error=>console.warn('Offline app shell unavailable:',error));
  });
})();
