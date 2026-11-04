/* Registros: pone «Importar registro» arriba del todo y añade «Comparativa» (gráfico) al final.
   Se carga desde ui.js solo en registros.html. Lee la colección «registros» por su cuenta y sigue la semana elegida en #mesSel. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

if (!document.getElementById('grafPanel')) {
  const db = getFirestore(initializeApp({
    apiKey: "AIzaSyB8kDJ_Yq3wBHAoxCJSsGn-GGh4g6r4mXk", authDomain: "sunaely-teamm.firebaseapp.com", projectId: "sunaely-teamm",
    storageBucket: "sunaely-teamm.firebasestorage.app", messagingSenderId: "487274825899", appId: "1:487274825899:web:a12b4812a8c978d4410fee"
  }));
  const $ = (id) => document.getElementById(id);
  const paneles = [...document.querySelectorAll('.wrap > section.panel')];

  // 1) «Importar registro» arriba del todo
  const imp = $('importPanel');
  if (imp && paneles[0] && imp !== paneles[0]) paneles[0].before(imp);

  // 2) Panel de la comparativa, abajo del todo
  const st = document.createElement('style');
  st.textContent = `.g-modos{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px}
  .g-modo{font-family:inherit;font-size:.98rem;padding:7px 14px;border:1px solid var(--border);border-radius:999px;background:var(--paper-alt);color:var(--ink-soft);cursor:pointer;transition:background .15s,border-color .15s}
  .g-modo:hover{border-color:var(--gold)} .g-modo.on{background:linear-gradient(180deg,#ffeeb8,#ffdc84);border-color:rgba(217,120,11,.55);color:#5a3a08;font-weight:600}
  #grafBox svg{width:100%;height:auto;display:block} .g-leyenda{display:flex;flex-wrap:wrap;gap:6px 16px;margin:10px 0 0;font-size:.95rem;color:var(--ink-soft)}
  .g-leyenda i{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;vertical-align:-1px}`;
  document.head.appendChild(st);
  const sec = document.createElement('section'); sec.className = 'panel'; sec.id = 'grafPanel';
  sec.innerHTML = `<h2>Comparativa</h2>
    <p class="panel-desc">Cómo se mueve la actividad semana a semana (hasta 12 semanas, terminando en la que has elegido arriba).</p>
    <div class="g-modos" role="tablist"><button type="button" class="g-modo on" data-m="total">Mensajes por semana</button><button type="button" class="g-modo" data-m="top">Top 5 de la semana elegida</button></div>
    <div id="grafBox"></div>`;
  [...document.querySelectorAll('.wrap > section.panel')].pop().after(sec);   // el último de verdad, ya con «Importar» movido

  const MIN = 60, MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const COL = ['#e8780c', '#2f86c0', '#6aa84f', '#c0482f', '#8e6bbf'];
  const fmt = (n) => n.toLocaleString('es-ES');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const corto = (id) => { const [, m, d] = id.split('-'); return (+d) + ' ' + MESES[+m - 1].slice(0, 3); };
  const label = (id) => {
    const [y, m, d] = id.split('-').map(Number), a = new Date(y, m - 1, d), b = new Date(y, m - 1, d + 6), mm = (t) => MESES[t.getMonth()];
    if (a.getFullYear() !== b.getFullYear()) return `Semana del ${a.getDate()} de ${mm(a)} de ${a.getFullYear()} al ${b.getDate()} de ${mm(b)} de ${b.getFullYear()}`;
    if (a.getMonth() !== b.getMonth()) return `Semana del ${a.getDate()} de ${mm(a)} al ${b.getDate()} de ${mm(b)} de ${b.getFullYear()}`;
    return `Semana del ${a.getDate()} al ${b.getDate()} de ${mm(b)} de ${b.getFullYear()}`;
  };
  const techoDe = (v) => { const e = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1)))), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; };

  let regs = [], modo = 'total', ultima = null;
  function graf(){
    const box = $('grafBox'), sel = $('mesSel'), actual = sel && sel.value, idx = regs.findIndex(r => r.id === actual);
    ultima = actual;
    if (idx < 0){ box.innerHTML = '<p class="empty-note">Aún no hay semanas para comparar.</p>'; return; }
    const sem = regs.slice(idx, idx + 12).reverse(), n = sem.length;
    const W = 720, H = 300, L = 52, R = 16, T = 18, B = 40, pw = W - L - R, ph = H - T - B;
    const keyE = (e) => e.miembroId || ('n:' + (e.nombre || (e.personajes || []).join('/')));
    let series = null, techo, leyenda = '';
    if (modo === 'top'){
      const top = [...(sem[n - 1].entradas || [])].sort((a, b) => b.mensajes - a.mensajes).slice(0, 5);
      series = top.map((e, i) => ({ nombre: (e.personajes || []).join(' / ') || e.nombre || 'Antiguo miembro', color: COL[i],
        v: sem.map(w => (w.entradas || []).filter(x => keyE(x) === keyE(e)).reduce((a, x) => a + x.mensajes, 0)) }));
      techo = techoDe(Math.max(MIN, ...series.flatMap(x => x.v)));
      leyenda = '<div class="g-leyenda">' + series.map(x => `<span><i style="background:${x.color}"></i>${esc(x.nombre)}</span>`).join('') + '<span>- - - mínimo de ' + MIN + '</span></div>';
    } else techo = techoDe(Math.max(...sem.map(w => w.total || 0)));
    const X = (i) => L + (n === 1 ? pw / 2 : (i + .5) * pw / n), Y = (v) => T + ph - (v / techo) * ph;
    let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico comparativo de mensajes por semana"><defs><linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd75e"/><stop offset="1" stop-color="#e8780c"/></linearGradient></defs>`;
    for (let t = 0; t <= 4; t++){ const v = techo * t / 4, y = Y(v); g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="rgba(190,115,15,.2)"/><text x="${L - 8}" y="${y + 4}" text-anchor="end" font-size="12" fill="#7d5a2a">${fmt(Math.round(v))}</text>`; }
    sem.forEach((w, i) => { g += `<text x="${X(i)}" y="${H - 14}" text-anchor="middle" font-size="12" fill="${i === n - 1 ? '#5a3a08' : '#7d5a2a'}"${i === n - 1 ? ' font-weight="700"' : ''}>${corto(w.id)}</text>`; });
    if (!series){
      const bw = Math.min(46, pw / n * .62);
      sem.forEach((w, i) => { const tot = w.total || 0, y = Y(tot), sel = i === n - 1;
        g += `<rect x="${X(i) - bw / 2}" y="${y}" width="${bw}" height="${T + ph - y}" rx="5" fill="${sel ? 'url(#gb)' : 'rgba(230,140,20,.38)'}"><title>${esc(label(w.id))}: ${fmt(tot)} mensajes</title></rect><text x="${X(i)}" y="${y - 6}" text-anchor="middle" font-size="12" fill="#5a3a08">${fmt(tot)}</text>`; });
    } else {
      const ym = Y(MIN); g += `<line x1="${L}" x2="${W - R}" y1="${ym}" y2="${ym}" stroke="#c0482f" stroke-dasharray="6 5" opacity=".7"/>`;
      series.forEach(s => {
        g += `<polyline fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" points="${s.v.map((v, i) => X(i) + ',' + Y(v)).join(' ')}"/>`;
        s.v.forEach((v, i) => { g += `<circle cx="${X(i)}" cy="${Y(v)}" r="4" fill="${s.color}" stroke="#fff" stroke-width="1.5"><title>${esc(s.nombre)} · ${esc(label(sem[i].id))}: ${fmt(v)} mensajes</title></circle>`; });
      });
    }
    box.innerHTML = g + '</svg>' + leyenda;
  }
  sec.querySelectorAll('.g-modo').forEach(b => b.addEventListener('click', () => { modo = b.dataset.m; sec.querySelectorAll('.g-modo').forEach(x => x.classList.toggle('on', x === b)); graf(); }));
  onSnapshot(collection(db, 'registros'), (snap) => { regs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.id.localeCompare(a.id)); setTimeout(graf, 80); }, () => {});
  setInterval(() => { const s = $('mesSel'); if (s && s.value !== ultima) graf(); }, 400);   // sigue las flechas y el selector de semana
}
