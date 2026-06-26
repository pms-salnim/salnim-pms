alter table if exists public.email_attachments
add column if not exists file_url text;

-- Backfill mirrored guest portal attachment URLs into inbox attachment rows.
update public.email_attachments ea
set file_url = (
  select gpa.file_url
  from public.property_emails pe
  join public.guest_portal_message_attachments gpa
    on gpa.message_id = pe.source_message_id
   and gpa.file_name = ea.file_name
  where pe.id = ea.email_id
    and pe.source = 'guest_portal'
  order by gpa.created_at desc
  limit 1
)
where (ea.file_url is null or ea.file_url = '')
  and exists (
    select 1
    from public.property_emails pe
    where pe.id = ea.email_id
      and pe.source = 'guest_portal'
  );
