-- Ensure mirrored guest-portal inbox rows keep the real per-message sender name.
update public.property_emails pe
set from_name = gpm.sender_name,
    updated_at = now()
from public.guest_portal_messages gpm
where pe.source = 'guest_portal'
  and pe.source_message_id = gpm.id
  and coalesce(gpm.sender_name, '') <> ''
  and coalesce(pe.from_name, '') is distinct from coalesce(gpm.sender_name, '');
