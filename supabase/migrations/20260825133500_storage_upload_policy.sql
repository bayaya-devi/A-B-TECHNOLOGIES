-- Le visiteur peut déposer un fichier uniquement sous l'identifiant opaque
-- d'une demande existante. La fonction ne révèle aucune donnée du dossier.
create or replace function public.project_request_exists(request_id_text text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists(
    select 1 from public.project_requests
    where id = request_id_text::uuid
  );
exception when invalid_text_representation then
  return false;
end;
$$;

revoke all on function public.project_request_exists(text) from public;
grant execute on function public.project_request_exists(text) to anon,authenticated;

drop policy if exists "prospects upload private project files" on storage.objects;
create policy "prospects upload private project files"
on storage.objects for insert to anon
with check (
  bucket_id = 'project-documents'
  and public.project_request_exists((storage.foldername(name))[1])
);
