/* Shared helpers for the Store, Rider and Admin portals (demo mode: data lives in localStorage, shared with the customer app).
   In production these portals read and write Supabase with role-based RLS and Realtime. */
(function () {
  'use strict';
  const KEY = 'foodie.alegria.v1', MODE = 'foodie.alegria.mode', T = [0, 15, 35, 50, 65, 95];
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const peso = n => '₱' + Math.round(n).toLocaleString('en-PH');
  const blank = () => ({ orders: [], cater: [], notes: [] });
  const load = () => { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return blank(); } };
  const save = s => localStorage.setItem(KEY, JSON.stringify(s));
  const stageOf = o => { if (o.status === 'cancelled' || o.status === 'refunded') return -1; if (o.demo === false) return o.stage; const e = (Date.now() - o.createdAt) / 1000; let s = 0; T.forEach((t, i) => { if (e >= t) s = i; }); return s; };
  const STEPS = ['Order received', 'Preparing', 'Rider assigned', 'Picking up', 'On the way', 'Delivered'];
  const R = id => window.RESTAURANTS.find(r => r.id === id);
  const live = () => localStorage.getItem(MODE) === 'live';
  const setLive = on => localStorage.setItem(MODE, on ? 'live' : 'demo');
  /* update one order: takes it over from the demo timeline, stamps it, saves. */
  const update = (id, fn) => { const s = load(), o = s.orders.find(x => x.id === id); if (!o) return; if (o.demo !== false) { o.stage = stageOf(o); o.demo = false; } fn(o, s); o.upd = Date.now(); save(s); };
  const tell = (s, o, t, b) => { s.notes.unshift({ id: 'n' + Math.random().toString(36).slice(2, 8), type: 'order', t: `${t} · ${o.id}`, b, at: Date.now(), read: false, uid: o.uid || 'demo' }); };
  const toast = m => { let c = $('#toasts'); if (!c) { c = document.createElement('div'); c.id = 'toasts'; document.body.append(c); } const e = document.createElement('div'); e.className = 'toast'; e.textContent = m; c.append(e); setTimeout(() => e.remove(), 3000); };
  const addrBrgy = o => ((o.addr || '').split(',').slice(-2, -1)[0] || '').trim() || 'Alegria';
  const items = o => o.items.map(l => `${l.qty} × ${esc(l.name)}${Object.values(l.sel || {}).flat().length ? ' <span class="mu">(' + esc(Object.values(l.sel).flat().join(', ')) + ')</span>' : ''}${l.note ? ' <em class="mu">“' + esc(l.note) + '”</em>' : ''}`).join('<br>');
  const modeBar = () => `<div class="note row sp wrap" style="margin-bottom:14px"><span>${live() ? '<b>Live mode is ON.</b> New customer orders wait for the store.' : '<b>Demo mode.</b> Customer orders update automatically. Turn on Live mode so the store and rider control them.'}</span><button class="btn p sm" id="modebtn">${live() ? 'Switch to demo' : 'Turn on Live mode'}</button></div>`;
  const printHTML = (title, body) => { const w = window.open('', '_blank', 'width=380,height=640'); if (!w) { toast('Allow pop-ups to print.'); return; }
    w.document.write(`<!doctype html><title>${esc(title)}</title><style>@page{size:80mm auto;margin:4mm}body{font:14px/1.35 'Courier New',monospace;width:72mm;margin:0 auto;color:#000}h1{font-size:18px;text-align:center;margin:4px 0}.c{text-align:center}.d{border-top:2px dashed #000;margin:8px 0}.b{font-weight:bold}.big{font-size:22px}.r{display:flex;justify-content:space-between;gap:8px}.it{font-size:17px;font-weight:bold;margin:6px 0 0}.n{font-size:13px;padding-left:12px}</style>${body}<script>onload=()=>{print();setTimeout(()=>close(),300)}<\/script>`); w.document.close(); };
  const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null;
  const ov = () => window.getOverrides(), setOv = o => window.setOverrides(o);
  window.OPS = { printHTML, avg, $, $$, esc, peso, load, save, stageOf, STEPS, R, live, setLive, update, tell, toast, addrBrgy, items, modeBar, ov, setOv, MODE };
})();
