-- A&B Technologies — backend du configurateur client
create extension if not exists pgcrypto;

create sequence if not exists public.project_reference_seq start 1;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  last_name text not null check (length(trim(last_name)) between 1 and 100),
  company_name text,
  email text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone text,
  whatsapp text,
  country text,
  city text,
  preferred_language text not null default 'français',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  reference text not null unique check (reference ~ '^AB-[0-9]{4}-[0-9]{6}$'),
  submission_key uuid not null unique,
  status text not null default 'nouvelle_demande' check (status in (
    'nouvelle_demande','qualification','contacte','rendez_vous','proposition','gagne','perdu','archive',
    'new','qualified','contacted','meeting','proposal','won','lost','archived'
  )),
  first_name text not null,
  last_name text not null,
  company_name text,
  email text not null,
  phone text,
  whatsapp text,
  country text,
  city text,
  preferred_language text not null default 'français',
  request_types text[] not null default '{}',
  summary jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  internal_notes text,
  assigned_to uuid references auth.users(id) on delete set null,
  consent_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_answers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.project_requests(id) on delete cascade,
  section_key text not null,
  answer_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(request_id, section_key)
);

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.project_requests(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);

create table if not exists public.project_status_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.project_requests(id) on delete cascade,
  old_status text,
  new_status text not null,
  actor_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.project_requests(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  note text not null check (length(trim(note)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.project_requests(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  meeting_url text,
  status text not null default 'propose' check (status in ('propose','confirme','termine','annule')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.project_requests(id) on delete cascade,
  channel text not null default 'email',
  recipient text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  provider_id text,
  error_message text,
  attempted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists project_requests_status_idx on public.project_requests(status, submitted_at desc);
create index if not exists project_requests_lead_idx on public.project_requests(lead_id);
create index if not exists project_answers_request_idx on public.project_answers(request_id);
create index if not exists project_files_request_idx on public.project_files(request_id);
create index if not exists project_status_history_request_idx on public.project_status_history(request_id, created_at desc);
create index if not exists appointments_request_idx on public.appointments(request_id, starts_at);
create index if not exists notification_deliveries_pending_idx on public.notification_deliveries(status, created_at) where status = 'pending';

create or replace function public.is_ab_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(select 1 from public.app_admins where user_id = auth.uid());
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.make_request_reference()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select 'AB-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.project_reference_seq')::text, 6, '0');
$$;

create or replace function public.submit_project_request(payload jsonb)
returns table(id uuid, reference text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id uuid;
  request_reference text;
  lead_record_id uuid;
  request_email text;
  submission_id uuid;
  answer_pair record;
begin
  if coalesce(payload->>'consent','false') <> 'true' then
    raise exception 'Le consentement est requis' using errcode = '22023';
  end if;

  request_email := lower(trim(coalesce(payload->'identity'->>'email','')));
  if request_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Email invalide' using errcode = '22023';
  end if;
  if length(trim(coalesce(payload->'identity'->>'first_name',''))) < 1
     or length(trim(coalesce(payload->'identity'->>'last_name',''))) < 1 then
    raise exception 'Identité incomplète' using errcode = '22023';
  end if;

  begin
    submission_id := coalesce(nullif(payload->>'submission_id','')::uuid, gen_random_uuid());
  exception when invalid_text_representation then
    submission_id := gen_random_uuid();
  end;

  select pr.id, pr.reference into request_id, request_reference
  from public.project_requests pr where pr.submission_key = submission_id;
  if request_id is not null then
    return query select request_id, request_reference;
    return;
  end if;

  insert into public.leads(first_name,last_name,company_name,email,phone,whatsapp,country,city,preferred_language)
  values (
    trim(payload->'identity'->>'first_name'), trim(payload->'identity'->>'last_name'),
    nullif(trim(payload->'identity'->>'company_name'),''), request_email,
    nullif(trim(payload->'identity'->>'phone'),''), nullif(trim(payload->'identity'->>'whatsapp'),''),
    nullif(trim(payload->'identity'->>'country'),''), nullif(trim(payload->'identity'->>'city'),''),
    coalesce(nullif(payload->'identity'->>'preferred_language',''),'français')
  ) returning leads.id into lead_record_id;

  request_reference := public.make_request_reference();
  insert into public.project_requests(
    lead_id,reference,submission_key,first_name,last_name,company_name,email,phone,whatsapp,country,city,
    preferred_language,request_types,summary,answers,consent_at
  ) values (
    lead_record_id,request_reference,submission_id,
    trim(payload->'identity'->>'first_name'),trim(payload->'identity'->>'last_name'),
    nullif(trim(payload->'identity'->>'company_name'),''),request_email,
    nullif(trim(payload->'identity'->>'phone'),''),nullif(trim(payload->'identity'->>'whatsapp'),''),
    nullif(trim(payload->'identity'->>'country'),''),nullif(trim(payload->'identity'->>'city'),''),
    coalesce(nullif(payload->'identity'->>'preferred_language',''),'français'),
    array(select jsonb_array_elements_text(coalesce(payload->'answers'->'request_types','[]'::jsonb))),
    jsonb_build_object(
      'vision',payload->'answers'->>'vision','objectives',payload->'answers'->'objectives',
      'budget',payload->'answers'->>'budget','timeline',payload->'answers'->>'timeline'
    ),coalesce(payload->'answers','{}'::jsonb),now()
  ) returning project_requests.id into request_id;

  for answer_pair in select key,value from jsonb_each(coalesce(payload->'answers','{}'::jsonb)) loop
    insert into public.project_answers(request_id,section_key,answer_data)
    values(request_id,answer_pair.key,jsonb_build_object('value',answer_pair.value));
  end loop;

  insert into public.project_status_history(request_id,new_status,details)
  values(request_id,'nouvelle_demande',jsonb_build_object('source','configurator'));
  insert into public.notification_deliveries(request_id,recipient)
  values(request_id,'aetbconseil@gmail.com');

  return query select request_id, request_reference;
end;
$$;

create or replace function public.attach_request_documents(target_request_id uuid, documents jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare doc jsonb;
begin
  if not exists(select 1 from public.project_requests where id = target_request_id) then
    raise exception 'Demande inconnue' using errcode = '22023';
  end if;
  for doc in select * from jsonb_array_elements(coalesce(documents,'[]'::jsonb)) loop
    if split_part(doc->>'path','/',1) <> target_request_id::text then
      raise exception 'Chemin de document invalide' using errcode = '22023';
    end if;
    insert into public.project_files(request_id,storage_path,original_name,mime_type,size_bytes)
    values(target_request_id,doc->>'path',left(doc->>'name',255),doc->>'type',(doc->>'size')::bigint);
  end loop;
end;
$$;

create or replace function public.record_project_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.project_status_history(request_id,old_status,new_status,actor_id)
    values(new.id,old.status,new.status,auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_at();
drop trigger if exists project_requests_touch on public.project_requests;
create trigger project_requests_touch before update on public.project_requests for each row execute function public.touch_updated_at();
drop trigger if exists project_answers_touch on public.project_answers;
create trigger project_answers_touch before update on public.project_answers for each row execute function public.touch_updated_at();
drop trigger if exists admin_notes_touch on public.admin_notes;
create trigger admin_notes_touch before update on public.admin_notes for each row execute function public.touch_updated_at();
drop trigger if exists appointments_touch on public.appointments;
create trigger appointments_touch before update on public.appointments for each row execute function public.touch_updated_at();
drop trigger if exists project_status_audit on public.project_requests;
create trigger project_status_audit after update of status on public.project_requests for each row execute function public.record_project_status_change();

create or replace view public.request_documents with (security_invoker = true) as
select id,request_id,storage_path,original_name,mime_type,size_bytes,created_at from public.project_files;
create or replace view public.request_events with (security_invoker = true) as
select id,request_id,actor_id,'status_changed'::text as event_type,
       jsonb_build_object('old_status',old_status,'new_status',new_status) as details,created_at
from public.project_status_history;

alter table public.leads enable row level security;
alter table public.project_requests enable row level security;
alter table public.project_answers enable row level security;
alter table public.project_files enable row level security;
alter table public.project_status_history enable row level security;
alter table public.admin_notes enable row level security;
alter table public.appointments enable row level security;
alter table public.app_admins enable row level security;
alter table public.notification_deliveries enable row level security;

create policy "admins manage leads" on public.leads for all to authenticated using (public.is_ab_admin()) with check (public.is_ab_admin());
create policy "admins manage requests" on public.project_requests for all to authenticated using (public.is_ab_admin()) with check (public.is_ab_admin());
create policy "admins manage answers" on public.project_answers for all to authenticated using (public.is_ab_admin()) with check (public.is_ab_admin());
create policy "admins manage files" on public.project_files for all to authenticated using (public.is_ab_admin()) with check (public.is_ab_admin());
create policy "admins manage status history" on public.project_status_history for all to authenticated using (public.is_ab_admin()) with check (public.is_ab_admin());
create policy "admins manage notes" on public.admin_notes for all to authenticated using (public.is_ab_admin()) with check (public.is_ab_admin());
create policy "admins manage appointments" on public.appointments for all to authenticated using (public.is_ab_admin()) with check (public.is_ab_admin());
create policy "admins read admin list" on public.app_admins for select to authenticated using (public.is_ab_admin());
create policy "admins manage notifications" on public.notification_deliveries for all to authenticated using (public.is_ab_admin()) with check (public.is_ab_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'project-documents','project-documents',false,10485760,
  array['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

create policy "prospects upload private project files"
on storage.objects for insert to anon
with check (
  bucket_id = 'project-documents'
  and exists(
    select 1 from public.project_requests pr
    where pr.id::text = (storage.foldername(name))[1]
  )
);
create policy "admins read private project files"
on storage.objects for select to authenticated
using (bucket_id = 'project-documents' and public.is_ab_admin());
create policy "admins delete private project files"
on storage.objects for delete to authenticated
using (bucket_id = 'project-documents' and public.is_ab_admin());

revoke all on function public.submit_project_request(jsonb) from public;
revoke all on function public.attach_request_documents(uuid,jsonb) from public;
grant execute on function public.submit_project_request(jsonb) to anon,authenticated;
grant execute on function public.attach_request_documents(uuid,jsonb) to anon,authenticated;
grant select on public.request_documents to authenticated;
grant select on public.request_events to authenticated;
