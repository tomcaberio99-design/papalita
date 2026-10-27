
/* Papalita Notifications */
(() => {
  'use strict';

  const db = () => window.PAPALITA_DB;
  const state = { user: null, rows: [], panel: false };

  // Add your VAPID PUBLIC key after Supabase push setup.
  const vapidPublicKey = '';

  const esc = value => String(value ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]
  );

  const style = document.createElement('style');
  style.textContent = `
    .pn-badge {
      position:absolute;top:-3px;right:-3px;
      background:#dc2626;color:white;
      border-radius:99px;min-width:17px;
      padding:1px 4px;font-size:10px;
      font-weight:800;text-align:center
    }
    .pn-shade {
      position:fixed;inset:0;
      background:#101b1499;z-index:99990;
      display:flex;align-items:flex-end;
      justify-content:center
    }
    .pn-panel {
      width:min(100%,540px);max-height:85dvh;
      overflow:auto;background:white;
      border-radius:22px 22px 0 0;
      padding:22px 18px 32px;color:#15251b
    }
    .pn-row {
      border:1px solid #e4eee7;
      border-radius:14px;padding:13px;
      margin:9px 0;background:white
    }
    .pn-row.unread {
      background:#edf8f0;
      border-color:#c2e8cc
    }
    .pn-actions {
      display:flex;gap:8px;
      flex-wrap:wrap;margin:12px 0
    }
    .pn-btn {
      background:#087f32;color:white;
      border:0;border-radius:11px;
      padding:10px 14px;font-weight:700;
      cursor:pointer
    }
    .pn-btn.alt {
      background:#eef4ef;color:#14502a
    }
    .pn-panel small { color:#64756a }
  `;
  document.head.append(style);

  async function currentUser() {
    const client = db();
    if (!client) return null;
    try {
      const { data } = await client.auth.getUser();
      return data?.user || null;
    } catch {
      return null;
    }
  }

  async function refresh() {
    const client = db();
    state.user = await currentUser();

    if (!state.user) {
      state.rows = [];
      updateBadges();
      if (state.panel) draw();
      return;
    }

    const { data, error } = await client
      .from('customer_notifications')
      .select('id,title,body,type,url,read_at,created_at')
      .order('created_at', { ascending: false })
      .limit(80);

    if (error) {
      console.warn('[Papalita notifications]', error.message);
      return;
    }

    state.rows = data || [];
    updateBadges();
    if (state.panel) draw();
  }

  function updateBadges() {
    const count = state.rows.filter(n => !n.read_at).length;

    document.querySelectorAll('a[href="#/notifications"]')
      .forEach(el => {
        el.style.position = 'relative';

        let badge = el.querySelector('.pn-badge');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'pn-badge';
          el.append(badge);
        }

        badge.hidden = !count;
        badge.textContent = count > 99 ? '99+' : count;
      });
  }

  function draw() {
    let shade = document.querySelector('#pn-shade');

    if (!state.panel) {
      shade?.remove();
      return;
    }

    if (!shade) {
      shade = document.createElement('div');
      shade.id = 'pn-shade';
      shade.className = 'pn-shade';
      document.body.append(shade);
    }

    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    shade.innerHTML = `
      <div class="pn-panel" role="dialog"
           aria-modal="true" aria-label="Papalita notifications">
        <div style="display:flex;align-items:center;
                    justify-content:space-between">
          <h2 style="margin:0">🔔 Notifications</h2>
          <button class="pn-btn alt" data-pn="close">
            Close ✕
          </button>
        </div>

        <div class="pn-actions">
          <button class="pn-btn" data-pn="enable"
            ${!state.user || !supported ? 'disabled' : ''}>
            Enable phone notifications
          </button>
          <button class="pn-btn alt" data-pn="readall"
            ${!state.user ? 'disabled' : ''}>
            Mark all read
          </button>
        </div>

        <small>
          ${!state.user
            ? 'Sign in to sync notifications across devices.'
            : !supported
              ? 'Phone push is unavailable in this browser.'
              : Notification.permission === 'granted'
                ? 'Notification permission: allowed'
                : 'Tap Enable to request permission.'}
        </small>

        ${state.rows.length
          ? state.rows.map(n => `
            <div class="pn-row ${n.read_at ? '' : 'unread'}">
              <strong>${esc(n.title)}</strong>
              <p style="margin:6px 0">${esc(n.body)}</p>
              <small>${new Date(n.created_at)
                .toLocaleString('en-PH')}</small>
              <div class="pn-actions">
                ${!n.read_at ? `
                  <button class="pn-btn alt"
                    data-pn="read" data-id="${esc(n.id)}">
                    Mark read
                  </button>` : ''}
                ${n.url ? `
                  <button class="pn-btn"
                    data-pn="open" data-id="${esc(n.id)}">
                    View
                  </button>` : ''}
              </div>
            </div>
          `).join('')
          : '<p style="padding:20px 0">No new notifications yet.</p>'}
      </div>
    `;
  }

  function close() {
    state.panel = false;
    draw();
  }

  function decodeKey(key) {
    const padding = '='.repeat((4 - key.length % 4) % 4);
    const raw = atob(
      (key + padding).replace(/-/g, '+').replace(/_/g, '/')
    );
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }

  async function enable() {
    if (!state.user) {
      alert('Please sign in first.');
      return;
    }

    if (!vapidPublicKey) {
      alert('Push notifications need the VAPID public key configured.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        alert('Notifications were not allowed.');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(vapidPublicKey)
        });
      }

      const raw = sub.toJSON();

      const { error } = await db()
        .from('push_subscriptions')
        .upsert({
          user_id: state.user.id,
          endpoint: raw.endpoint,
          p256dh: raw.keys.p256dh,
          auth: raw.keys.auth,
          user_agent: navigator.userAgent
        }, { onConflict: 'endpoint' });

      if (error) throw error;

      alert('Papalita phone notifications enabled! 💚');
    } catch (err) {
      console.error(err);
      alert('Could not enable notifications: ' + err.message);
    }
  }

  async function mark(ids) {
    if (!state.user || !ids.length) return;

    const { error } = await db()
      .from('customer_notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids);

    if (error) alert(error.message);
    await refresh();
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-pn]');

    if (button) {
      event.preventDefault();
      const action = button.dataset.pn;

      if (action === 'close') close();
      if (action === 'enable') await enable();
      if (action === 'read') await mark([button.dataset.id]);

      if (action === 'readall') {
        await mark(
          state.rows.filter(n => !n.read_at).map(n => n.id)
        );
      }

      if (action === 'open') {
        const n = state.rows.find(
          x => x.id === button.dataset.id
        );

        if (n) {
          await mark([n.id]);
          close();

          if (/^#\/[a-z0-9/?=&_-]*$/i.test(n.url || '')) {
            location.hash = n.url;
          }
        }
      }
      return;
    }

    if (event.target.id === 'pn-shade') close();

    const link = event.target.closest(
      'a[href="#/notifications"]'
    );

    if (link) {
      event.preventDefault();
      event.stopPropagation();
      state.panel = true;
      await refresh();
      draw();
    }
  }, true);

  window.addEventListener('hashchange', () => {
    if (location.hash === '#/notifications') {
      state.panel = true;
      refresh().then(draw);
    }
  });

  window.addEventListener('focus', refresh);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });

  setInterval(refresh, 60000);

  function start() {
    refresh();
    if (location.hash === '#/notifications') {
      state.panel = true;
      draw();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.PAPALITA_NOTIFICATIONS = {
    refresh,
    open: () => {
      state.panel = true;
      refresh().then(draw);
    }
  };
})();
