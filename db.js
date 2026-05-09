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
    onChange(cb) {
      sb.auth.onAuthStateChange((_event, session) => cb(!!session));
    }
  } : {
    /* Demo-Fallback (NICHT für Produktion) */
    async signIn(user, password) {
      const u = String(user || '').trim().toLowerCase();
      const p = String(password || '').trim();
      const VALID_USERS = ['inhaber', 'inhaber@alstercafe.de'];
      const ok = VALID_USERS.includes(u) && p === 'IfflandStr45!';
      if (ok) try { localStorage.setItem('alstercafe.auth', '1'); } catch {}
      return { ok, error: ok ? null : 'Benutzername oder Passwort ist nicht korrekt.' };
    },
    async signOut()  { try { localStorage.removeItem('alstercafe.auth'); } catch {} },
    async isAuthed() { try { return localStorage.getItem('alstercafe.auth') === '1'; } catch { return false; } },
    async getEmail() { return cfg.ownerEmail || 'inhaber@alstercafe.de'; },
    async resetPassword() { return { ok: false, error: 'Im Demo-Modus nicht verfügbar.' }; },
    onChange() { /* no-op */ }
  };

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
