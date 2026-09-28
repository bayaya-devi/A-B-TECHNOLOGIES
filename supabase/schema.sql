-- A&B Technologies — configurateur de projet
-- Exécuter ce fichier en une seule fois dans Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'new' check (status in ('new','qualified','contacted','meeting','proposal','won','lost','archived')),
  first_name text not null, last_name text not null, company_name text,
  email text not null, phone text, whatsapp text, country text, city text,
  preferred_language text not null default 'fr',
  request_types text[] not null default '{}',
  summary jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  internal_notes text, assigned_to uuid references auth.users(id),
  submitted_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.request_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.project_requests(id) on delete cascade,
  storage_path text not null unique, original_name text not null, mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);

create table if not exists public.request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.project_requests(id) on delete cascade,
  actor_id uuid references auth.users(id), event_type text not null,
  details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_ab_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.app_admins where user_id = auth.uid());
$$;

create or replace function public.make_request_reference()
returns text language plpgsql security definer set search_path = public as $$
declare candidate text;
begin
  loop
    candidate := 'AB-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('project_reference_seq')::text, 6, '0');
    exit when not exists(select 1 from public.project_requests where reference = candidate);
  end loop;
  return candidate;
end;
$$;

create sequence if not exists public.project_reference_seq;

create or replace function public.submit_project_request(payload jsonb)
returns table(id uuid, reference text) language plpgsql security definer set search_path = public as $$
declare request_id uuid; request_reference text; request_email text;
begin
  if coalesce(payload->>'consent','false') <> 'true' then raise exception 'Le consentement est requis'; end if;
  request_email := lower(trim(coalesce(payload->'identity'->>'email','')));
  if request_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Email invalide'; end if;
  if length(coalesce(payload->'identity'->>'first_name','')) < 1 or length(coalesce(payload->'identity'->>'last_name','')) < 1 then raise exception 'Identité incomplète'; end if;
  request_reference := public.make_request_reference();
  insert into public.project_requests(reference, first_name, last_name, company_name, email, phone, whatsapp, country, city, preferred_language, request_types, summary, answers)
  values (request_reference, trim(payload->'identity'->>'first_name'), trim(payload->'identity'->>'last_name'), nullif(trim(payload->'identity'->>'company_name'),''), request_email, nullif(trim(payload->'identity'->>'phone'),''), nullif(trim(payload->'identity'->>'whatsapp'),''), nullif(trim(payload->'identity'->>'country'),''), nullif(trim(payload->'identity'->>'city'),''), coalesce(payload->'identity'->>'preferred_language','fr'), array(select jsonb_array_elements_text(coalesce(payload->'answers'->'request_types','[]'::jsonb))), jsonb_build_object('vision', payload->'answers'->>'vision','objectives',payload->'answers'->'objectives','budget',payload->'answers'->>'budget','timeline',payload->'answers'->>'timeline'), payload->'answers') returning project_requests.id into request_id;
  insert into public.request_events(request_id,event_type,details) values (request_id,'submitted',jsonb_build_object('source','configurator'));
  return query select request_id, request_reference;
end;
$$;

create or replace function public.attach_request_documents(target_request_id uuid, documents jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare doc jsonb;
begin
  if not exists(select 1 from public.project_requests where id = target_request_id) then raise exception 'Demande inconnue'; end if;
  for doc in select * from jsonb_array_elements(coalesce(documents,'[]'::jsonb)) loop
    insert into public.request_documents(request_id,storage_path,original_name,mime_type,size_bytes)
    values(target_request_id, doc->>'path', doc->>'name', doc->>'type', (doc->>'size')::bigint);
  end loop;
end;
$$;

create or replace function public.touch_project_request()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists project_requests_touch on public.project_requests;
create trigger project_requests_touch before update on public.project_requests for each row execute function public.touch_project_request();

alter table public.project_requests enable row level security;
alter table public.request_documents enable row level security;
alter table public.request_events enable row level security;
alter table public.app_admins enable row level security;

create policy "admins manage requests" on public.project_requests for all using (public.is_ab_admin()) with check (public.is_ab_admin());
create policy "admins manage documents" on public.request_documents for all using (public.is_ab_admin()) with check (public.is_ab_admin());
create policy "admins manage events" on public.request_events for all using (public.is_ab_admin()) with check (public.is_ab_admin());
create policy "admins read admin list" on public.app_admins for select using (public.is_ab_admin());

-- Stockage privé : le navigateur peut déposer un fichier, mais personne ne peut
-- le lire directement. L'administration génère des URL signées temporaires.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('project-documents','project-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public=false, file_size_limit=10485760;
create policy "anonymous upload project document" on storage.objects for insert to anon with check (bucket_id = 'project-documents');
create policy "admins read project document" on storage.objects for select using (bucket_id = 'project-documents' and public.is_ab_admin());

grant execute on function public.submit_project_request(jsonb) to anon, authenticated;
grant execute on function public.attach_request_documents(uuid,jsonb) to anon, authenticated;

-- Après avoir créé votre utilisateur Auth dans Supabase, exécutez UNE fois :
-- insert into public.app_admins(user_id) values ('UUID_DE_VOTRE_UTILISATEUR_AUTH');
