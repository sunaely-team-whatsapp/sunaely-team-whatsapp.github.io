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
