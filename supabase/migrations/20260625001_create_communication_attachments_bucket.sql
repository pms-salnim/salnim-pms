insert into storage.buckets (id, name, public)
values ('communication-attachments', 'communication-attachments', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Authenticated users can upload communication attachments" on storage.objects;
create policy "Authenticated users can upload communication attachments"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'communication-attachments');

drop policy if exists "Authenticated users can read communication attachments" on storage.objects;
create policy "Authenticated users can read communication attachments"
on storage.objects
for select
to authenticated
using (bucket_id = 'communication-attachments');

drop policy if exists "Authenticated users can delete communication attachments" on storage.objects;
create policy "Authenticated users can delete communication attachments"
on storage.objects
for delete
to authenticated
using (bucket_id = 'communication-attachments');
