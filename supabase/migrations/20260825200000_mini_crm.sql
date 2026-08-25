-- A&B Technologies — mini CRM commercial
create sequence if not exists public.quote_reference_seq start 1;

create or replace function public.make_quote_reference()
returns text language sql volatile security definer set search_path = ''
as $$
  select 'DEV-AB-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.quote_reference_seq')::text, 6, '0');
$$;

alter table public.project_requests drop constraint if exists project_requests_status_check;
alter table public.project_requests add constraint project_requests_status_check check (status in (
  'nouvelle_demande','qualification','contacte','rendez_vous','proposition','gagne','perdu','archive',
  'new','qualified','contacted','meeting','proposal','won','lost','archived',
  'a_contacter','rdv_propose','rdv_programme','devis_a_preparer','devis_envoye','devis_accepte','devis_refuse','projet_accepte'
));

alter table public.appointments add column if not exists lead_id uuid references public.leads(id) on delete restrict;
alter table public.appointments add column if not exists mode text;
alter table public.appointments add column if not exists duration_minutes integer;
alter table public.appointments add column if not exists confirmed_slot timestamptz;
update public.appointments a set lead_id = p.lead_id from public.project_requests p
where a.request_id = p.id and a.lead_id is null;
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status in ('propose','confirme','termine','annule','proposed','confirmed','declined','cancelled','completed','draft'));
alter table public.appointments drop constraint if exists appointments_mode_check;
alter table public.appointments add constraint appointments_mode_check
  check (mode is null or mode in ('Visio','Téléphone','Autre'));
alter table public.appointments drop constraint if exists appointments_duration_minutes_check;
alter table public.appointments add constraint appointments_duration_minutes_check
  check (duration_minutes is null or duration_minutes between 5 and 480);

create table if not exists public.appointment_slots (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  starts_at timestamptz not null,
  status text not null default 'proposed' check (status in ('proposed','confirmed','declined','cancelled')),
  created_at timestamptz not null default now(),
  unique(appointment_id, starts_at)
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default public.make_quote_reference()
    check (reference ~ '^DEV-AB-[0-9]{4}-[0-9]{6}$'),
  project_request_id uuid not null references public.project_requests(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete restrict,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'XOF' check (currency in ('XOF','EUR','USD')), 
  estimated_duration text,
  validity_date date,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired','cancelled')),
  storage_path text not null unique,
  filename text not null,
  note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz
);

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  project_request_id uuid not null references public.project_requests(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete restrict,
  quote_id uuid references public.quotes(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  type text not null check (type in (
    'general_email','appointment_proposal','information_request','quote','follow_up',
    'automatic_confirmation','automatic_admin_notification'
  )),
  recipient_email text not null,
  subject text not null check (length(subject) between 1 and 300),
  body text not null check (length(body) between 1 and 50000),
  status text not null default 'pending' check (status in ('draft','pending','processing','sent','failed')),
  provider text,
  provider_message_id text,
  attachment_path text,
  sent_by uuid references auth.users(id) on delete set null,
  idempotency_key uuid not null default gen_random_uuid(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now(),
  attempted_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  error_message text,
  unique(idempotency_key)
);

create table if not exists public.crm_activity (
  id bigint generated always as identity primary key,
  project_request_id uuid not null references public.project_requests(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  title text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists communications_request_idx on public.communications(project_request_id, created_at desc);
create index if not exists communications_status_idx on public.communications(status, created_at);
create index if not exists quotes_request_idx on public.quotes(project_request_id, created_at desc);
create index if not exists appointment_slots_appointment_idx on public.appointment_slots(appointment_id, starts_at);
create index if not exists crm_activity_request_idx on public.crm_activity(project_request_id, created_at desc);

drop trigger if exists quotes_touch on public.quotes;
create trigger quotes_touch before update on public.quotes for each row execute function public.touch_updated_at();

create or replace function public.record_crm_entity_activity()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_request uuid; v_lead uuid; v_type text; v_title text;
begin
  if tg_table_name = 'admin_notes' then
    v_request := new.request_id; v_type := 'note_created'; v_title := 'Note interne ajoutée';
    select lead_id into v_lead from public.project_requests where id = v_request;
  elsif tg_table_name = 'quotes' then
    v_request := new.project_request_id; v_lead := new.lead_id; v_type := 'quote_created'; v_title := 'Devis ' || new.reference || ' créé';
  elsif tg_table_name = 'project_files' then
    v_request := new.request_id; v_type := 'file_added'; v_title := 'Fichier ajouté : ' || new.original_name;
    select lead_id into v_lead from public.project_requests where id = v_request;
  end if;
  insert into public.crm_activity(project_request_id,lead_id,actor_id,event_type,title)
  values(v_request,v_lead,auth.uid(),v_type,v_title);
  return new;
end;
$$;

drop trigger if exists crm_note_activity on public.admin_notes;
create trigger crm_note_activity after insert on public.admin_notes for each row execute function public.record_crm_entity_activity();
drop trigger if exists crm_quote_activity on public.quotes;
create trigger crm_quote_activity after insert on public.quotes for each row execute function public.record_crm_entity_activity();
drop trigger if exists crm_file_activity on public.project_files;
create trigger crm_file_activity after insert on public.project_files for each row execute function public.record_crm_entity_activity();

alter table public.appointment_slots enable row level security;
alter table public.quotes enable row level security;
alter table public.communications enable row level security;
alter table public.crm_activity enable row level security;

create policy "admins manage appointment slots" on public.appointment_slots for all to authenticated
  using (public.is_ab_admin()) with check (public.is_ab_admin());
create policy "admins manage quotes" on public.quotes for all to authenticated
  using (public.is_ab_admin()) with check (public.is_ab_admin());
create policy "admins manage communications" on public.communications for all to authenticated
  using (public.is_ab_admin()) with check (public.is_ab_admin());
create policy "admins manage crm activity" on public.crm_activity for all to authenticated
  using (public.is_ab_admin()) with check (public.is_ab_admin());

grant select,insert,update,delete on public.appointment_slots,public.quotes,public.communications,public.crm_activity to authenticated;
grant usage,select on sequence public.quote_reference_seq to authenticated;
grant usage,select on sequence public.crm_activity_id_seq to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('crm-documents','crm-documents',false,10485760,array['application/pdf'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

create policy "admins upload crm documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'crm-documents' and public.is_ab_admin());
create policy "admins read crm documents" on storage.objects for select to authenticated
  using (bucket_id = 'crm-documents' and public.is_ab_admin());
create policy "admins update crm documents" on storage.objects for update to authenticated
  using (bucket_id = 'crm-documents' and public.is_ab_admin()) with check (bucket_id = 'crm-documents' and public.is_ab_admin());
create policy "admins delete crm documents" on storage.objects for delete to authenticated
  using (bucket_id = 'crm-documents' and public.is_ab_admin());

insert into public.crm_activity(project_request_id,lead_id,event_type,title,created_at)
select p.id,p.lead_id,'request_created','Demande reçue',p.submitted_at
from public.project_requests p
where not exists (
  select 1 from public.crm_activity a where a.project_request_id=p.id and a.event_type='request_created'
);
