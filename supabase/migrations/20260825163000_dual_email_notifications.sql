-- Suivi indépendant des notifications administrateur et client.
alter table public.notification_deliveries
  add column if not exists notification_type text,
  add column if not exists attempt_count integer not null default 0;

update public.notification_deliveries
set notification_type = 'admin'
where notification_type is null;

alter table public.notification_deliveries
  alter column notification_type set default 'admin',
  alter column notification_type set not null;

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_notification_type_check;
alter table public.notification_deliveries
  add constraint notification_deliveries_notification_type_check
  check (notification_type in ('admin', 'client'));

create unique index if not exists notification_deliveries_request_type_uidx
  on public.notification_deliveries(request_id, notification_type);

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
  insert into public.notification_deliveries(request_id,notification_type,recipient)
  values
    (request_id,'admin','aetbconseil@gmail.com'),
    (request_id,'client',request_email);
  return query select request_id, request_reference;
end;
$$;

revoke all on function public.submit_project_request(jsonb) from public;
grant execute on function public.submit_project_request(jsonb) to anon,authenticated;
