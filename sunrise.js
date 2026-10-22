/* Efectos de amanecer de la portada. Script clásico con "defer": no espera a Firebase. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ---------- Efectos del amanecer ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const hero = $('hero');

  // Polen / polvo en suspensión
  if (!prefersReducedMotion){
    const layer = $('motesLayer'), n = innerWidth < 768 ? 6 : 14, f = document.createDocumentFragment();
    for (let i = 0; i < n; i++){
      const m = document.createElement('span'); m.className = 'mote'; const s = rnd(1.5, 3.8).toFixed(1);
      m.style.cssText = `left:${rnd(0,100).toFixed(1)}%;width:${s}px;height:${s}px`;
      m.style.setProperty('--dur', rnd(12, 24).toFixed(1) + 's'); m.style.setProperty('--delay', (4 + rnd(0, 14)).toFixed(1) + 's');
      m.style.setProperty('--sway', rnd(-70, 70).toFixed(0) + 'px'); f.appendChild(m);
    }
    layer.appendChild(f);
  }

  // Estrellas de la noche
  (function(){
    const layer = $('starsLayer'), n = innerWidth < 768 ? 24 : 50, f = document.createDocumentFragment();
    for (let i = 0; i < n; i++){
      const s = document.createElement('span'); s.className = 'star'; const z = rnd(.7, 2.2).toFixed(2);
      s.style.cssText = `top:${rnd(0,100).toFixed(1)}%;left:${rnd(0,100).toFixed(1)}%;width:${z}px;height:${z}px`;
      s.style.setProperty('--dur', rnd(2,5).toFixed(2) + 's'); s.style.setProperty('--delay', rnd(0,5).toFixed(2) + 's');
      s.style.setProperty('--o-min', rnd(.15,.35).toFixed(2)); s.style.setProperty('--o-max', rnd(.7,1).toFixed(2)); f.appendChild(s);
    }
    layer.appendChild(f);
  })();


  // Cordilleras generadas con desplazamiento del punto medio + luz de borde hacia el sol
  (function(){
    const ridge = (seed, base, amp, rough, dip) => {
      let s = seed; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
      let p = [base + (R() - .5) * amp, base + (R() - .5) * amp], a = amp;
      for (let k = 0; k < 8; k++){ const q = []; for (let i = 0; i < p.length - 1; i++) q.push(p[i], (p[i] + p[i+1]) / 2 + (R() - .5) * a); q.push(p[p.length-1]); p = q; a *= rough; }
      const n = p.length - 1;
      return p.map((y, i) => { const x = i / n * 1440; return [x.toFixed(1), (v => (v < 24 ? Math.max(6, 24 + (v - 24) * .15) : v))(y + dip * Math.exp(-Math.pow((x - 720) / 260, 2))).toFixed(1)]; });
    };
    const L = [ // semilla, base, amplitud, rugosidad, hueco bajo el sol, color arriba, color abajo, luz de borde, z
      [7919, 56, 78, .6, 30, '#f6bd5c', '#ea9c3a', .95, 4],
      [104729, 78, 62, .6, 8, '#e08a2c', '#c5701f', .6, 7],
      [1299709, 114, 44, .58, 0, '#c9781e', '#e09a34', .32, 9],
      [15485863, 148, 22, .52, 0, '#e29a32', '#fff3d1', 0, 10]];
    L.forEach(([sd, b, am, ro, dp, c1, c2, rim, z], i) => {
      const pts = ridge(sd, b, am, ro, dp), top = 'M' + pts.map(q => q.join(' ')).join('L');
      hero.insertAdjacentHTML('beforeend', `<svg class="ridge" data-d="${[.4,.8,1.3,1.8][i]}" style="z-index:${z}" viewBox="0 0 1440 170" preserveAspectRatio="xMidYMax slice"><defs><linearGradient id="rg${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient><linearGradient id="rm${i}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1440" y2="0"><stop offset="0" stop-color="#fff2a8" stop-opacity="0"/><stop offset=".5" stop-color="#fffbd0" stop-opacity="${rim}"/><stop offset="1" stop-color="#fff2a8" stop-opacity="0"/></linearGradient></defs><path d="${top}L1440 170L0 170Z" fill="url(#rg${i})"/><path d="${top}" fill="none" stroke="url(#rm${i})" stroke-width="1.6"/></svg>`);
    });
  })();



  // Título letra a letra
  (function(){
    const el = $('heroTitle'), text = el.textContent; el.textContent = '';
    [...text].forEach((ch, i) => { const s = document.createElement('span'); s.className = 'letter'; s.style.setProperty('--i', i); s.textContent = ch === ' ' ? '\u00A0' : ch; el.appendChild(s); });
  })();

  // Apagar lo que ya terminó (menos trabajo para el navegador)
  setTimeout(() => { ['.hero-night','.night-veil','.flash','.stars'].forEach(s => document.querySelectorAll(s).forEach(e => e.remove())); }, 8000);

  // Paralaje por capas (ratón + scroll) y brillo de las tarjetas
  if (!prefersReducedMotion){
    const layers = [...hero.querySelectorAll('.sun-wrap,.cl')]; layers.forEach((el, i) => el.dataset.d = i ? [.3, .6, 1][i-1] : .15);
    let mx = 0, my = 0, sy = 0, tick = false;
    const apply = () => { tick = false; layers.forEach(el => { const d = +el.dataset.d; el.style.translate = `${(mx * d).toFixed(1)}px ${(my * d + sy * (.04 + d * .05)).toFixed(1)}px`; }); };
    const req = () => { if (!tick){ tick = true; requestAnimationFrame(apply); } };
    if (!('ontouchstart' in window) && innerWidth > 900) document.addEventListener('mousemove', e => { mx = (e.clientX / innerWidth - .5) * 12; my = (e.clientY / innerHeight - .5) * 8; req(); });
    document.addEventListener('pointermove', e => {
      const c = e.target.closest && e.target.closest('.nav-card'); if (!c) return;
      const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }

  // El título solo reacciona al cursor cuando termina la animación de entrada (~5,6 s)
  setTimeout(() => document.documentElement.classList.add('intro-done'), prefersReducedMotion ? 0 : 6000);
})();
