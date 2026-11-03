/* Utilidades de interfaz compartidas. sunConfirm(mensaje, {ok, cancel, peligro}) -> Promise<boolean> */
window.sunConfirm = (msg, o = {}) => new Promise((res) => {
  const d = document.createElement('dialog'); d.className = 'sun-dialog';
  d.innerHTML = '<form method="dialog"><p class="sd-msg"></p><div class="sd-actions"><button type="submit" value="no" class="btn-sol sd-cancel"></button><button type="submit" value="si" class="btn-sol"></button></div></form>';
  d.querySelector('.sd-msg').textContent = msg;
  const [no, si] = d.querySelectorAll('button'); no.textContent = o.cancel || 'Cancelar'; si.textContent = o.ok || 'Aceptar'; if (o.peligro) si.classList.add('peligro');
  d.addEventListener('close', () => { res(d.returnValue === 'si'); d.remove(); });
  d.addEventListener('click', (e) => { if (e.target === d) d.close('no'); });
  document.body.appendChild(d); d.showModal(); (o.peligro ? no : si).focus();
});

/* Pestañas de juego (lista.html): usan los logos de la raíz (giLogo.png, hvLogo.png…) y recortan la barra «HOYOVERSE» de abajo. */
(() => {
  const FILES_LOGOS = { todo: 'hvLogo', genshin: 'giLogo', hsr: 'hsrRailLogo', zzz: 'zzzLogo' };
  const ajustar = (im) => {
    const tab = im.closest('.juego-tab'), id = tab && tab.dataset.j;
    if (im.dataset.ok || !FILES_LOGOS[id]) return; im.dataset.ok = '1';
    const w = document.createElement('span'); w.style.cssText = 'display:block;width:36px;height:36px;border-radius:50%;overflow:hidden';
    im.replaceWith(w); w.appendChild(im);
    im.style.cssText = id === 'todo'
      ? 'width:36px;height:36px;max-width:none;margin:0;border-radius:0;display:block;object-fit:contain;background:#fff'   // logo de Hoyoverse entero
      : 'width:48px;height:48px;max-width:none;margin:-5px 0 0 -6px;border-radius:0;display:block;object-fit:cover';   // recorta la barra de abajo
    im.onerror = () => { w.remove(); tab.textContent = im.alt || ''; };
    im.src = FILES_LOGOS[id] + '.png';
  };
  new MutationObserver(() => document.querySelectorAll('.tab-logo').forEach(ajustar)).observe(document.documentElement, { childList: true, subtree: true });
})();
