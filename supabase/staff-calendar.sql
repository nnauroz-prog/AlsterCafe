-- ============================================================
-- Alstercafé · Mitarbeiter-Kalender (Zugang mit Code)
-- ============================================================
-- Einmal im Supabase-Dashboard ausführen: SQL Editor → New query →
-- diesen ganzen Text einfügen → Run. Kann gefahrlos mehrfach laufen.
--
-- Sicherheit:
-- • Der Code wird nur verschlüsselt (bcrypt) gespeichert.
-- • Geprüft wird in der Datenbank, nicht im Browser.
-- • Mitarbeiter sehen nur Datum, Uhrzeit, Name, Personen bzw.
--   Bestellung — KEINE Telefonnummer, E-Mail, Nachricht oder Notiz.
-- • Bremse: nach 20 falschen Codes in 10 Minuten ist der Zugang
--   für alle kurz gesperrt; jeder falsche Versuch dauert 1 Sekunde.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.staff_access (
  id         int primary key default 1 check (id = 1),
  code_hash  text,
  updated_at timestamptz default now()
);
alter table public.staff_access enable row level security;
-- Bewusst KEINE Policies: nur über die Funktionen unten erreichbar.

create table if not exists public.staff_attempts (
  at timestamptz not null default now(),
  ok boolean not null
);
alter table public.staff_attempts enable row level security;

-- Inhaber legt den Code fest (leer = Mitarbeiter-Zugang aus)
create or replace function public.set_staff_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception 'not allowed';
  end if;
  if p_code is null or p_code = '' then
    insert into public.staff_access (id, code_hash, updated_at) values (1, null, now())
      on conflict (id) do update set code_hash = null, updated_at = now();
    return false;
  end if;
  if p_code !~ '^[0-9]{6,12}$' then
    raise exception 'Code muss 6 bis 12 Ziffern haben';
  end if;
  insert into public.staff_access (id, code_hash, updated_at)
    values (1, extensions.crypt(p_code, extensions.gen_salt('bf')), now())
    on conflict (id) do update set code_hash = excluded.code_hash, updated_at = now();
  return true;
end;
$$;

-- Ist ein Code gesetzt? (nur für den Mitgliederbereich)
create or replace function public.staff_code_set()
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception 'not allowed';
  end if;
  return exists (select 1 from public.staff_access where id = 1 and code_hash is not null);
end;
$$;

-- Kalender für Mitarbeiter: prüft den Code, liefert nur erlaubte Felder
create or replace function public.staff_agenda(p_code text, p_from date, p_days int default 7)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_fails int;
  v_from text;
  v_to text;
begin
  delete from public.staff_attempts where at < now() - interval '1 day';
  select count(*) into v_fails from public.staff_attempts
    where not ok and at > now() - interval '10 minutes';
  if v_fails >= 20 then
    return json_build_object('error', 'locked');
  end if;

  select code_hash into v_hash from public.staff_access where id = 1;
  if v_hash is null or p_code is null or extensions.crypt(p_code, v_hash) <> v_hash then
    insert into public.staff_attempts (ok) values (false);
    perform pg_sleep(1);
    return json_build_object('error', 'invalid');
  end if;

  v_from := to_char(p_from, 'YYYY-MM-DD');
  v_to   := to_char(p_from + least(greatest(coalesce(p_days, 7), 1), 31), 'YYYY-MM-DD');

  return json_build_object(
    'reservations', coalesce((
      select json_agg(json_build_object(
        'date', r.date, 'time', r.time, 'name', r.name,
        'persons', r.persons, 'status', r.status) order by r.date, r.time)
      from public.reservations r
      where r.date >= v_from and r.date < v_to), '[]'::json),
    'orders', coalesce((
      select json_agg(json_build_object(
        'pickupDate', o.pickup_date, 'pickupTime', o.pickup_time, 'name', o.name,
        'items', o.items, 'totalCount', o.total_count, 'status', o.status) order by o.pickup_date, o.pickup_time)
      from public.orders o
      where o.pickup_date >= v_from and o.pickup_date < v_to), '[]'::json)
  );
end;
$$;

revoke all on function public.set_staff_code(text) from public, anon;
revoke all on function public.staff_code_set() from public, anon;
revoke all on function public.staff_agenda(text, date, int) from public;
grant execute on function public.set_staff_code(text) to authenticated;
grant execute on function public.staff_code_set() to authenticated;
grant execute on function public.staff_agenda(text, date, int) to anon, authenticated;
