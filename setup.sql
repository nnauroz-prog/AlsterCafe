-- ================================================================
-- Alstercafé · Supabase Setup
-- ================================================================
-- Diese Datei einmal in der Supabase-SQL-Konsole ausfuehren.
-- (Dashboard → SQL Editor → New query → einfuegen → "Run")
-- ================================================================

-- 1. Content-Tabelle: Key-Value-Speicher fuer alle Inhalte
--    (Wochenplan, Speisekarte, Oeffnungszeiten, Hinweis, Texte, Design)
create table if not exists public.content (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz default now() not null
);

-- 2. Row-Level-Security aktivieren
alter table public.content enable row level security;

-- 3. Policies:
--    LESEN: jeder Webseiten-Besucher darf alle Inhalte lesen (anonym)
--    SCHREIBEN/LOESCHEN: nur eingeloggte Inhaber

drop policy if exists "Public can read content" on public.content;
create policy "Public can read content"
  on public.content for select
  using (true);

drop policy if exists "Authenticated can write content" on public.content;
create policy "Authenticated can write content"
  on public.content for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated can update content" on public.content;
create policy "Authenticated can update content"
  on public.content for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated can delete content" on public.content;
create policy "Authenticated can delete content"
  on public.content for delete
  using (auth.role() = 'authenticated');

-- 4. Realtime aktivieren (damit Aenderungen live auf der Webseite erscheinen)
alter publication supabase_realtime add table public.content;

-- 5. Storage-Bucket "images" anlegen + public lesbar
insert into storage.buckets (id, name, public)
  values ('images', 'images', true)
  on conflict (id) do update set public = true;

-- Storage-Policies: jeder darf Bilder ansehen, nur Inhaber darf hochladen
drop policy if exists "Public can view images" on storage.objects;
create policy "Public can view images"
  on storage.objects for select
  using (bucket_id = 'images');

drop policy if exists "Authenticated can upload images" on storage.objects;
create policy "Authenticated can upload images"
  on storage.objects for insert
  with check (bucket_id = 'images' and auth.role() = 'authenticated');

drop policy if exists "Authenticated can update images" on storage.objects;
create policy "Authenticated can update images"
  on storage.objects for update
  using (bucket_id = 'images' and auth.role() = 'authenticated');

drop policy if exists "Authenticated can delete images" on storage.objects;
create policy "Authenticated can delete images"
  on storage.objects for delete
  using (bucket_id = 'images' and auth.role() = 'authenticated');

-- ================================================================
-- FERTIG. Naechste Schritte:
-- 1. Inhaber-User anlegen:
--    Dashboard → Authentication → Users → "Add user" → "Create new user"
--    E-Mail: inhaber@alstercafe.de
--    Passwort: [sicheres Passwort]
--    "Auto Confirm User" aktivieren
--
-- 2. Aus Dashboard → Project Settings → API folgende Werte kopieren:
--    - Project URL    -> in config.js als supabaseUrl
--    - anon public Key -> in config.js als supabaseAnonKey
--
-- 3. config.js auf den Web-Server hochladen, fertig.
-- ================================================================
