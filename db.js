/* ============================================================
   Alstercafé · Unified Data Layer
   ============================================================
   Abstrahiert Auth, Daten- und Bildspeicherung. Wechselt
   automatisch zwischen Supabase (production) und localStorage
   (demo), je nach Konfiguration in config.js.

   API:
     window.alsterDb.isProd        — true wenn Supabase aktiv
     window.alsterDb.ready()       — Promise, fertig nach Hydratation
     window.alsterDb.get(key)      — Wert lesen (synchron, aus Cache)
     window.alsterDb.set(key, v)   — Wert schreiben (Promise)
     window.alsterDb.remove(key)   — Wert löschen (Promise)
     window.alsterDb.uploadImage(file, slot) — Bild hochladen, gibt URL
     window.alsterDb.auth.*        — login / logout / isAuthed / onChange
   ============================================================ */

(function () {
  const cfg = window.ALSTERCAFE_CONFIG || {};
  const useSupabase = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const sb = useSupabase
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      })
    : null;

  // Schlüssel die wir in beiden Modi unterstützen
  const SYNCED_KEYS = ['weekly-menu', 'menu', 'hours', 'notice', 'content', 'design'];
  const PREFIX = 'alstercafe.';

  /* ---------- Auth ---------- */
  const auth = useSupabase ? {
    async signIn(emailOrUser, password) {
      const email = String(emailOrUser || '').includes('@')
        ? emailOrUser
        : (cfg.ownerEmail || emailOrUser);
      const { error } = await sb.auth.signInWithPassword({ email, password });
      return { ok: !error, error: error?.message };
    },
    async signOut()   { await sb.auth.signOut(); },
    async isAuthed()  { const { data } = await sb.auth.getSession(); return !!data?.session; },
    async getEmail()  { const { data } = await sb.auth.getUser(); return data?.user?.email || null; },
    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/admin.html?reset=1`
      });
      return { ok: !error, error: error?.message };
    },
    async updatePassword(newPassword) {
      const { error } = await sb.auth.updateUser({ password: newPassword });
      return { ok: !error, error: error?.message };
    },
    async inviteUser(email, password) {
      // Public signUp (anon-key): erzeugt einen neuen User. Bestaetigung
      // entweder per E-Mail-Link oder direkt nutzbar (je nach Supabase-Setting).
      const { error } = await sb.auth.signUp({ email, password });
      return { ok: !error, error: error?.message };
    },
    async listUsers() {
      // Liste aller Users: erfordert eine Edge-Function mit Service-Role-Key,
      // da der Anon-Key keine User listen darf. Stub fuer Production.
      return [];
    },
    async removeUser() {
      // Erfordert ebenfalls Edge-Function. Stub.
      return { ok: false, error: 'Bitte Mitarbeiter im Supabase-Dashboard entfernen.' };
    },
    onChange(cb) {
      sb.auth.onAuthStateChange((_event, session) => cb(!!session));
    }
  } : {
    /* Demo-Fallback (keine Cloud, aber funktional fuer Multi-User-Tests) */
    /* Speichert User-Liste lokal — in Production via Supabase Auth */
    async signIn(user, password) {
      const u = String(user || '').trim().toLowerCase();
      const p = String(password || '').trim();
      const store = readDemoAuth();
      const match = store.users.find(x => x.email.toLowerCase() === u && x.password === p);
      // Legacy-Fallback fuer Original-Demo-Login (nur wenn noch keine User angelegt)
      const isLegacy = store.users.length <= 1
        && (u === 'inhaber' || u === 'inhaber@alstercafe.de')
        && p === 'IfflandStr45!';
      if (match || isLegacy) {
        const email = match ? match.email : (cfg.ownerEmail || 'inhaber@alstercafe.de');
        store.currentEmail = email;
        writeDemoAuth(store);
        try { localStorage.setItem('alstercafe.auth', '1'); } catch {}
        return { ok: true, error: null };
      }
      return { ok: false, error: 'Benutzername oder Passwort ist nicht korrekt.' };
    },
    async signOut()  {
      try { localStorage.removeItem('alstercafe.auth'); } catch {}
      const store = readDemoAuth();
      store.currentEmail = null;
      writeDemoAuth(store);
    },
    async isAuthed() { try { return localStorage.getItem('alstercafe.auth') === '1'; } catch { return false; } },
    async getEmail() {
      const store = readDemoAuth();
      return store.currentEmail || cfg.ownerEmail || 'inhaber@alstercafe.de';
    },
    async resetPassword() { return { ok: false, error: 'Im Demo-Modus nicht verfügbar — bitte direkt im Konto neu setzen.' }; },
    async updatePassword(newPassword) {
      if (!newPassword || newPassword.length < 8) return { ok: false, error: 'Mindestens 8 Zeichen erforderlich.' };
      const store = readDemoAuth();
      const email = store.currentEmail || cfg.ownerEmail || 'inhaber@alstercafe.de';
      let user = store.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        user = { email, password: newPassword };
        store.users.push(user);
      } else {
        user.password = newPassword;
      }
      writeDemoAuth(store);
      return { ok: true, error: null };
    },
    async inviteUser(email, password) {
      if (!email || !email.includes('@')) return { ok: false, error: 'Gültige E-Mail erforderlich.' };
      if (!password || password.length < 8) return { ok: false, error: 'Passwort mindestens 8 Zeichen.' };
      const store = readDemoAuth();
      if (store.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        return { ok: false, error: 'Diese E-Mail ist bereits angelegt.' };
      }
      store.users.push({ email, password });
      writeDemoAuth(store);
      return { ok: true, error: null };
    },
    async listUsers() {
      const store = readDemoAuth();
      return store.users.map(u => ({ email: u.email }));
    },
    async removeUser(email) {
      const store = readDemoAuth();
      store.users = store.users.filter(u => u.email.toLowerCase() !== email.toLowerCase());
      writeDemoAuth(store);
      return { ok: true };
    },
    onChange() { /* no-op */ }
  };

  function readDemoAuth() {
    try {
      const raw = localStorage.getItem('alstercafe.demo-auth');
      if (raw) return JSON.parse(raw);
    } catch {}
    // Initial: Standard-Inhaber-Account anlegen
    const init = {
      users: [{ email: cfg.ownerEmail || 'inhaber@alstercafe.de', password: 'IfflandStr45!' }],
      currentEmail: null
    };
    try { localStorage.setItem('alstercafe.demo-auth', JSON.stringify(init)); } catch {}
    return init;
  }
  function writeDemoAuth(obj) {
    try { localStorage.setItem('alstercafe.demo-auth', JSON.stringify(obj)); } catch {}
  }

  /* ---------- Storage (Daten) ---------- */
  const cache = {};
  function readCache(key) {
    if (key in cache) return cache[key];
    try {
      const raw = localStorage.getItem(PREFIX + key);
      const val = raw ? JSON.parse(raw) : null;
      cache[key] = val;
      return val;
    } catch { return null; }
  }
  function writeCache(key, value) {
    cache[key] = value;
    try {
      if (value == null) localStorage.removeItem(PREFIX + key);
      else localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) { console.warn('Cache-Schreibfehler', e); }
  }

  async function hydrateFromSupabase() {
    if (!useSupabase) return;
    const { data, error } = await sb.from('content').select('id,data');
    if (error) { console.warn('Hydratation fehlgeschlagen', error); return; }
    (data || []).forEach(row => writeCache(row.id, row.data));
  }

  async function dbSet(key, value) {
    writeCache(key, value);
    if (!useSupabase) return true;
    const { error } = await sb.from('content').upsert(
      { id: key, data: value, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
    if (error) { console.error('Supabase-Schreibfehler', error); return false; }
    return true;
  }

  async function dbRemove(key) {
    writeCache(key, null);
    if (!useSupabase) return true;
    const { error } = await sb.from('content').delete().eq('id', key);
    return !error;
  }

  /* ---------- Image Upload ---------- */
  async function uploadImage(file, slot) {
    if (!useSupabase) {
      // Demo: data-URL zurückgeben (wie bisher)
      return await fileToCompressedDataUrl(file, slot);
    }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${slot}/${Date.now()}.${ext}`;
    const { error } = await sb.storage
      .from(cfg.storageBucket || 'images')
      .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
    if (error) { console.error('Storage-Upload fehlgeschlagen', error); throw error; }
    const { data } = sb.storage.from(cfg.storageBucket || 'images').getPublicUrl(path);
    return data.publicUrl;
  }

  function fileToCompressedDataUrl(file, slot) {
    const MAX = { logo: 480, heroImage: 1400, aboutImage: 1400, gallery: 1200 };
    const max = MAX[slot] || 1200;
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
      r.onload = e => {
        const img = new Image();
        img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
        img.onload = () => {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', 0.85));
        };
        img.src = e.target.result;
      };
      r.readAsDataURL(file);
    });
  }

  /* ---------- Realtime Sync (nur Supabase) ---------- */
  function subscribeChanges(cb) {
    if (!useSupabase) {
      window.addEventListener('storage', e => {
        if (e.key && e.key.startsWith(PREFIX)) cb(e.key.slice(PREFIX.length));
      });
      return;
    }
    sb.channel('content-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content' }, payload => {
        const row = payload.new || payload.old;
        if (row?.id) {
          if (payload.eventType === 'DELETE') writeCache(row.id, null);
          else writeCache(row.id, row.data);
          cb(row.id);
        }
      })
      .subscribe();
  }

  /* ---------- Init ---------- */
  let readyPromise = null;
  function ready() {
    if (!readyPromise) readyPromise = hydrateFromSupabase().catch(() => {});
    return readyPromise;
  }

  window.alsterDb = {
    isProd: useSupabase,
    ready,
    get: readCache,
    set: dbSet,
    remove: dbRemove,
    uploadImage,
    subscribe: subscribeChanges,
    auth
  };
})();
