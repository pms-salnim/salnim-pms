import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const CHANNEL_SETTINGS_TABLES = [
  'communication_channels_settings',
  'communication_channel_settings',
] as const;

const isMissingRelationError = (error: any): boolean => {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || message.includes('does not exist') || message.includes('relation');
};

async function verifyUser(req: NextRequest): Promise<{ id: string; email?: string } | null> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) {
      return null;
    }
    return {
      id: data.user.id,
      email: data.user.email || undefined,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

async function verifyUserProperty(
  authUser: { id: string; email?: string },
  propertyId: string
): Promise<boolean> {
  try {
    // Check users table
    const { data: userRow } = await supabase
      .from('users')
      .select('property_id')
      .eq('id', authUser.id)
      .maybeSingle();

    if (userRow?.property_id === propertyId) {
      return true;
    }

    // Check team_members table
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('property_id')
      .eq('id', authUser.id)
      .maybeSingle();

    if (teamMember?.property_id === propertyId) {
      return true;
    }

    // Some datasets map team members by email instead of auth uid.
    if (authUser.email) {
      const { data: teamMemberByEmail } = await supabase
        .from('team_members')
        .select('property_id')
        .ilike('email', authUser.email.toLowerCase())
        .maybeSingle();

      if (teamMemberByEmail?.property_id === propertyId) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Property verification error:', error);
    return false;
  }
}

async function resolveSenderDisplayName(authUser: { id: string; email?: string }): Promise<string | null> {
  try {
    const { data: userRow } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    const userName = String(
      userRow?.full_name
      || userRow?.name
      || userRow?.name || [userRow?.first_name, userRow?.last_name].filter(Boolean).join(' ')
      || ''
    ).trim();
    if (userName) return userName;

    const { data: teamMember } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    const teamMemberName = String(
      teamMember?.full_name
      || teamMember?.name
      || teamMember?.name || [teamMember?.first_name, teamMember?.last_name].filter(Boolean).join(' ')
      || ''
    ).trim();
    if (teamMemberName) return teamMemberName;

    if (authUser.email) {
      const { data: teamMemberByEmail } = await supabase
        .from('team_members')
        .select('*')
        .ilike('email', authUser.email.toLowerCase())
        .maybeSingle();

      const teamMemberByEmailName = String(
        teamMemberByEmail?.full_name
        || teamMemberByEmail?.name
        || teamMemberByEmail?.name || [teamMemberByEmail?.first_name, teamMemberByEmail?.last_name].filter(Boolean).join(' ')
        || ''
      ).trim();
      if (teamMemberByEmailName) return teamMemberByEmailName;
    }
  } catch (error) {
    console.warn('Failed to resolve sender display name:', error);
  }

  return null;
}

function formatImapDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

function extractEmailAddress(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const bracketMatch = trimmed.match(/<([^>]+)>/);
  if (bracketMatch?.[1]) {
    return bracketMatch[1].trim().toLowerCase();
  }

  return trimmed.toLowerCase();
}

function getPrimaryRecipient(to: any): { email: string; name?: string } {
  const asString = Array.isArray(to) ? String(to[0] || '') : String(to || '');
  if (!asString.trim()) return { email: '' };

  const firstRecipient = asString.split(',')[0]?.trim() || '';
  if (!firstRecipient) return { email: '' };

  const email = extractEmailAddress(firstRecipient);
  const namePart = firstRecipient.replace(/<[^>]+>/g, '').replace(/"/g, '').trim();

  return {
    email,
    name: namePart || undefined,
  };
}

function dedupeEmailsByUid<T extends { uid?: number | null; id?: string; date_ms?: number | null; updated_at?: string | null }>(rows: T[]): T[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const byIdentity = new Map<string, T>();

  rows.forEach((row) => {
    const uid = Number(row?.uid || 0);
    const key = uid > 0 ? `uid:${uid}` : `id:${String(row?.id || '')}`;
    const existing = byIdentity.get(key);

    if (!existing) {
      byIdentity.set(key, row);
      return;
    }

    const existingDate = Number(existing?.date_ms || 0);
    const currentDate = Number(row?.date_ms || 0);

    if (currentDate > existingDate) {
      byIdentity.set(key, row);
      return;
    }

    if (currentDate === existingDate) {
      const existingUpdatedAt = new Date(String(existing?.updated_at || 0)).getTime();
      const currentUpdatedAt = new Date(String(row?.updated_at || 0)).getTime();
      if (currentUpdatedAt > existingUpdatedAt) {
        byIdentity.set(key, row);
      }
    }
  });

  return Array.from(byIdentity.values());
}

const normalizeText = (value: any): string => String(value || '').trim();

async function resolveThreadEmailIds(
  propertyId: string,
  emailIds: string[],
  options?: { trashOnly?: boolean }
): Promise<string[]> {
  const uniqueInputIds = Array.from(new Set((emailIds || []).map((id) => normalizeText(id)).filter(Boolean)));
  if (uniqueInputIds.length === 0) return [];

  const { data: seedRows, error: seedError } = await supabase
    .from('property_emails')
    .select('id, from_email, source, source_conversation_id')
    .eq('property_id', propertyId)
    .in('id', uniqueInputIds);

  if (seedError) {
    throw seedError;
  }

  const resolvedIds = new Set<string>(uniqueInputIds);
  const guestPortalConversations = new Set<string>();
  const senderEmails = new Set<string>();

  (seedRows || []).forEach((row: any) => {
    const source = normalizeText(row?.source).toLowerCase();
    const sourceConversationId = normalizeText(row?.source_conversation_id);
    const fromEmail = normalizeText(row?.from_email).toLowerCase();

    if (source === 'guest_portal' && sourceConversationId) {
      guestPortalConversations.add(sourceConversationId);
      return;
    }

    if (fromEmail) {
      senderEmails.add(fromEmail);
    }
  });

  for (const sourceConversationId of guestPortalConversations) {
    let query = supabase
      .from('property_emails')
      .select('id')
      .eq('property_id', propertyId)
      .eq('source', 'guest_portal')
      .eq('source_conversation_id', sourceConversationId);

    if (options?.trashOnly) {
      query = query.eq('is_trash', true);
    }

    const { data: threadRows, error: threadError } = await query;
    if (threadError) {
      throw threadError;
    }

    (threadRows || []).forEach((row: any) => {
      const id = normalizeText(row?.id);
      if (id) resolvedIds.add(id);
    });
  }

  for (const fromEmail of senderEmails) {
    let query = supabase
      .from('property_emails')
      .select('id')
      .eq('property_id', propertyId)
      .eq('from_email', fromEmail);

    if (options?.trashOnly) {
      query = query.eq('is_trash', true);
    }

    const { data: threadRows, error: threadError } = await query;
    if (threadError) {
      throw threadError;
    }

    (threadRows || []).forEach((row: any) => {
      const id = normalizeText(row?.id);
      if (id) resolvedIds.add(id);
    });
  }

  return Array.from(resolvedIds);
}

async function reviveThreadForIncomingMessage(params: {
  propertyId: string;
  source?: string | null;
  sourceConversationId?: string | null;
  fromEmail?: string | null;
}) {
  const propertyId = normalizeText(params.propertyId);
  if (!propertyId) return;

  const source = normalizeText(params.source).toLowerCase();
  const sourceConversationId = normalizeText(params.sourceConversationId);
  const fromEmail = normalizeText(params.fromEmail).toLowerCase();

  if (source === 'guest_portal' && sourceConversationId) {
    await supabase
      .from('property_emails')
      .update({
        is_trash: false,
        is_archived: false,
        is_spam: false,
        updated_at: new Date().toISOString(),
      })
      .eq('property_id', propertyId)
      .eq('source', 'guest_portal')
      .eq('source_conversation_id', sourceConversationId);
    return;
  }

  if (!fromEmail) return;

  await supabase
    .from('property_emails')
    .update({
      is_trash: false,
      is_archived: false,
      is_spam: false,
      updated_at: new Date().toISOString(),
    })
    .eq('property_id', propertyId)
    .eq('from_email', fromEmail);
}

function extractImapConfigFromSettings(settings: any): {
  host: string;
  port: number;
  user: string;
  pass: string;
  useTls: boolean;
} | null {
  const raw = settings?.imapSettings || settings?.imap_configuration || {};

  const host = raw.imapHost || raw.host;
  const user = raw.imapUser || raw.user;
  const pass = raw.imapPass || raw.pass;
  const portRaw = raw.imapPort || raw.port || 993;
  const tlsRaw = raw.useTls ?? raw.use_tls;

  if (!host || !user || !pass) return null;

  return {
    host: String(host),
    port: Number(portRaw || 993),
    user: String(user),
    pass: String(pass),
    useTls: tlsRaw !== false,
  };
}

function extractSmtpConfigFromSettings(settings: any): {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName?: string;
} | null {
  const raw =
    settings?.smtpSettings
    || settings?.emailConfiguration
    || settings?.emailConfigurations?.[0]?.smtpSettings
    || settings?.emailConfigurations?.[0]
    || {};

  const host = raw.smtpHost || raw.host;
  const user = raw.smtpUser || raw.user;
  const pass = raw.smtpPass || raw.pass;
  const portRaw = raw.smtpPort || raw.port || 587;

  if (!host || !user || !pass) return null;

  return {
    host: String(host),
    port: Number(portRaw || 587),
    user: String(user),
    pass: String(pass),
    fromName: raw.fromName ? String(raw.fromName) : undefined,
  };
}

async function getPropertyCommunicationSettings(propertyId: string): Promise<any | null> {
  for (const tableName of CHANNEL_SETTINGS_TABLES) {
    const { data: row, error } = await supabase
      .from(tableName)
      .select('settings')
      .eq('property_id', propertyId)
      .maybeSingle();

    if (error && isMissingRelationError(error)) {
      continue;
    }

    return row?.settings || null;
  }

  return null;
}

async function getSmtpConfigForProperty(propertyId: string) {
  const channelSettings = await getPropertyCommunicationSettings(propertyId);
  return extractSmtpConfigFromSettings(channelSettings);
}

async function getImapConfigForProperty(propertyId: string) {
  const channelSettings = await getPropertyCommunicationSettings(propertyId);
  return extractImapConfigFromSettings(channelSettings);
}

type PreparedOutgoingAttachment = {
  mail: {
    filename: string;
    content: Buffer;
    contentType?: string;
  };
  db: {
    file_name: string;
    content_type: string;
    file_size: number | null;
  };
};

function prepareOutgoingAttachments(rawAttachments: any): PreparedOutgoingAttachment[] {
  if (!Array.isArray(rawAttachments)) return [];

  return rawAttachments
    .filter((attachment: any) => attachment?.filename && attachment?.content)
    .map((attachment: any) => {
      const filename = String(attachment.filename);
      const contentType = attachment.contentType ? String(attachment.contentType) : 'application/octet-stream';
      const content = Buffer.from(String(attachment.content), 'base64');

      return {
        mail: {
          filename,
          content,
          contentType,
        },
        db: {
          file_name: filename,
          content_type: contentType,
          file_size: Number.isFinite(content.length) ? content.length : null,
        },
      };
    });
}

async function persistSentEmail(params: {
  propertyId: string;
  fromName?: string;
  fromEmail: string;
  threadContactName?: string;
  threadContactEmail?: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  sentAt?: Date;
  attachments?: Array<{ file_name: string; content_type: string; file_size: number | null }>;
}): Promise<string> {
  const sentAt = params.sentAt || new Date();
  const plainBody = (params.bodyText || '').trim()
    || String(params.bodyHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const snippet = plainBody.slice(0, 150);

  const { data: insertedRow, error: insertError } = await supabase
    .from('property_emails')
    .insert({
      property_id: params.propertyId,
      uid: null,
      // Store recipient identity for thread grouping with incoming emails.
      from_name: params.threadContactName || params.fromName || params.threadContactEmail || params.fromEmail,
      from_email: params.threadContactEmail || params.fromEmail,
      subject: params.subject || '(No Subject)',
      date: sentAt.toISOString(),
      date_ms: sentAt.getTime(),
      snippet,
      body_text: params.bodyText || '',
      body_html: params.bodyHtml || '',
      is_unread: false,
      is_starred: false,
      is_archived: false,
      is_spam: false,
      is_trash: false,
      has_attachments: Array.isArray(params.attachments) && params.attachments.length > 0,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertError || !insertedRow?.id) {
    throw insertError || new Error('Failed to persist sent email');
  }

  if (Array.isArray(params.attachments) && params.attachments.length > 0) {
    const attachmentRows = params.attachments.map((att) => ({
      email_id: insertedRow.id,
      file_name: att.file_name,
      content_type: att.content_type,
      file_size: att.file_size,
    }));

    const { error: attachmentError } = await supabase
      .from('email_attachments')
      .insert(attachmentRows);

    if (attachmentError) {
      throw attachmentError;
    }
  }

  return insertedRow.id;
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, data } = await req.json();

    if (!action || !data) {
      return NextResponse.json(
        { error: 'Missing action or data' },
        { status: 400 }
      );
    }

    const { propertyId } = data;
    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    // Verify user has access to property
    const hasAccess = await verifyUserProperty(authUser, propertyId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to property' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'listEmails':
        return await handleListEmails(propertyId, data);

      case 'markRead':
        return await handleMarkRead(propertyId, data);

      case 'markUnread':
        return await handleMarkUnread(propertyId, data);

      case 'star':
        return await handleStar(propertyId, data);

      case 'unstar':
        return await handleUnstar(propertyId, data);

      case 'archive':
        return await handleArchive(propertyId, data);

      case 'unarchive':
        return await handleUnarchive(propertyId, data);

      case 'spam':
        return await handleSpam(propertyId, data);

      case 'unspam':
        return await handleUnspam(propertyId, data);

      case 'delete':
        return await handleDelete(propertyId, data);

      case 'deletePermanently':
        return await handleDeletePermanently(propertyId, data);

      case 'restore':
        return await handleRestore(propertyId, data);

      case 'getLabels':
        return await handleGetLabels(propertyId);

      case 'addLabel':
        return await handleAddLabel(propertyId, data);

      case 'removeLabel':
        return await handleRemoveLabel(propertyId, data);

      case 'getEmail':
        return await handleGetEmail(propertyId, data);

      case 'getEmailGuestContext':
        return await handleGetEmailGuestContext(propertyId, data);

      case 'sendComposed':
        return await handleSendComposed(propertyId, data, authUser);

      case 'sendReply':
        return await handleSendReply(propertyId, data, authUser);

      case 'testSmtp':
        return await handleTestSmtp(propertyId, data);

      case 'testImap':
        return await handleTestImap(propertyId, data);

      case 'syncEmails':
        return await handleSyncEmails(propertyId, data);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in email communication API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function handleSyncEmails(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  let connection: any = null;

  const loadStoredEmails = async () => {
    const { data: storedEmails, error: storedError } = await supabase
      .from('property_emails')
      .select('*, attachments:email_attachments(*), labels:email_message_labels(label_id)')
      .eq('property_id', propertyId)
      .order('date_ms', { ascending: false })
      .range(0, 49);

    if (storedError) {
      throw storedError;
    }

    return dedupeEmailsByUid(storedEmails || [])
      .sort((a: any, b: any) => Number(b?.date_ms || 0) - Number(a?.date_ms || 0));
  };

  try {
    const maxNew = typeof data?.maxNew === 'number'
      ? Math.min(Math.max(data.maxNew, 1), 500)
      : 200;

    const imapConfig = await getImapConfigForProperty(propertyId);

    if (!imapConfig) {
      const emails = await loadStoredEmails();
      return NextResponse.json(
        {
          success: true,
          emails,
          synced: 0,
          degraded: true,
          message: 'IMAP not configured for this property',
        },
        { status: 200 }
      );
    }

    const { data: latestEmail } = await supabase
      .from('property_emails')
      .select('uid')
      .eq('property_id', propertyId)
      .not('uid', 'is', null)
      .order('uid', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastStoredUid = latestEmail?.uid ? Number(latestEmail.uid) : null;

    connection = await imaps.connect({
      imap: {
        user: imapConfig.user,
        password: imapConfig.pass,
        host: imapConfig.host,
        port: imapConfig.port,
        tls: imapConfig.useTls,
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false },
      },
    } as any);

    await connection.openBox('INBOX');

    const searchCriteria = lastStoredUid
      ? [['UID', `${lastStoredUid + 1}:*`]]
      : [['SINCE', formatImapDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))]];

    const fetchOptions = {
      bodies: [''],
      markSeen: false,
      struct: true,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    const selectedMessages = messages.slice(0, maxNew);

    // Do not auto-flip existing unread messages to read during background sync.
    // Some IMAP providers can return inconsistent UNSEEN+UID search results,
    // which causes unrelated threads to lose unread status when new mail arrives.
    // Read state is updated explicitly via app actions (open/markRead/markUnread).

    const parsedEmails = await Promise.all(
      selectedMessages.map(async (item: any) => {
        try {
          const uid = Number(item.attributes?.uid);
          const fullMessagePart = item.parts?.find((part: any) => part.which === '');

          if (!uid || !fullMessagePart?.body) {
            return null;
          }

          const parsed = await simpleParser(fullMessagePart.body);

          const fromHeader = parsed.from?.value?.[0];
          const fromName = fromHeader?.name || (fromHeader?.address ? fromHeader.address.split('@')[0] : 'Unknown');
          const fromEmail = fromHeader?.address || 'unknown@example.com';

          const date = parsed.date || new Date();
          const textBody = parsed.text || '';
          const htmlBody = typeof parsed.html === 'string' ? parsed.html : '';
          const plainBody = textBody || (htmlBody ? htmlBody.replace(/<[^>]+>/g, ' ') : '');
          const snippet = plainBody.slice(0, 150).replace(/\s+/g, ' ').trim();
          const flags = item.attributes?.flags || [];
          const normalizedFlags = Array.isArray(flags)
            ? flags.map((flag: any) => String(flag || '').trim().toLowerCase())
            : [];
          const isSeen = normalizedFlags.some((flag: string) => flag === '\\seen' || flag === 'seen' || flag.includes('seen'));

          const attachments = (parsed.attachments || []).map((att: any) => ({
            file_name: att.filename || 'attachment',
            content_type: att.contentType || 'application/octet-stream',
            file_size: typeof att.size === 'number' ? att.size : null,
          }));

          return {
            uid,
            email: {
              property_id: propertyId,
              uid,
              from_name: fromName,
              from_email: fromEmail,
              subject: parsed.subject || '(No Subject)',
              date: date.toISOString(),
              date_ms: date.getTime(),
              snippet,
              body_text: textBody,
              body_html: htmlBody,
              is_unread: !isSeen,
              has_attachments: attachments.length > 0,
            },
            attachments,
          };
        } catch (error) {
          console.error('Failed to parse IMAP message:', error);
          return null;
        }
      })
    );

    const validParsed = parsedEmails.filter(Boolean) as Array<{
      uid: number;
      email: any;
      attachments: Array<{ file_name: string; content_type: string; file_size: number | null }>;
    }>;

    // Safety net: if IMAP returns duplicate entries for the same UID, only process one.
    const validParsedByUid = Array.from(
      validParsed.reduce((acc, item) => {
        if (!acc.has(item.uid)) {
          acc.set(item.uid, item);
        }
        return acc;
      }, new Map<number, (typeof validParsed)[number]>()).values()
    );

    if (validParsedByUid.length > 0) {
      const uniqueIncomingSenders = Array.from(
        new Set(
          validParsedByUid
            .map((item) => normalizeText(item?.email?.from_email).toLowerCase())
            .filter(Boolean)
        )
      );

      await Promise.all(
        uniqueIncomingSenders.map((fromEmail) =>
          reviveThreadForIncomingMessage({
            propertyId,
            fromEmail,
          })
        )
      );
    }

    if (validParsedByUid.length > 0) {
      const uids = validParsedByUid.map((v) => v.uid);

      const { data: existingRows } = await supabase
        .from('property_emails')
        .select('id, uid, is_unread')
        .eq('property_id', propertyId)
        .in('uid', uids);

      const existingUidSet = new Set((existingRows || []).map((row) => Number(row.uid)));
      const existingUnreadByUid = new Map<number, boolean>(
        (existingRows || []).map((row: any) => [Number(row.uid), Boolean(row.is_unread)])
      );
      const toInsert = validParsedByUid.filter((v) => !existingUidSet.has(v.uid));
      const toUpdate = validParsedByUid.filter((v) => existingUidSet.has(v.uid));

      if (toUpdate.length > 0) {
        await Promise.all(
          toUpdate.map(async (v) => {
            const existingIsUnread = existingUnreadByUid.get(v.uid);
            // Keep messages read once opened in app, while still allowing first-time read detection from IMAP.
            const mergedIsUnread = typeof existingIsUnread === 'boolean'
              ? (existingIsUnread && Boolean(v.email.is_unread))
              : Boolean(v.email.is_unread);

            const { error: updateError } = await supabase
              .from('property_emails')
              .update({
                from_name: v.email.from_name,
                from_email: v.email.from_email,
                subject: v.email.subject,
                date: v.email.date,
                date_ms: v.email.date_ms,
                snippet: v.email.snippet,
                body_text: v.email.body_text,
                body_html: v.email.body_html,
                is_unread: mergedIsUnread,
                has_attachments: v.email.has_attachments,
                updated_at: new Date().toISOString(),
              })
              .eq('property_id', propertyId)
              .eq('uid', v.uid);

            if (updateError) {
              throw updateError;
            }
          })
        );
      }

      if (toInsert.length > 0) {
        const { data: insertedRows, error: insertError } = await supabase
          .from('property_emails')
          .insert(toInsert.map((v) => v.email))
          .select('id, uid');

        if (insertError) {
          throw insertError;
        }

        const insertedByUid = new Map<number, string>();
        (insertedRows || []).forEach((row: any) => insertedByUid.set(Number(row.uid), row.id));

        const attachmentRows: Array<{
          email_id: string;
          file_name: string;
          content_type: string;
          file_size: number | null;
        }> = [];

        toInsert.forEach((email) => {
          const emailId = insertedByUid.get(email.uid);
          if (!emailId || email.attachments.length === 0) return;

          email.attachments.forEach((att) => {
            attachmentRows.push({
              email_id: emailId,
              file_name: att.file_name,
              content_type: att.content_type,
              file_size: att.file_size,
            });
          });
        });

        if (attachmentRows.length > 0) {
          const { error: attachmentInsertError } = await supabase
            .from('email_attachments')
            .insert(attachmentRows);

          if (attachmentInsertError) {
            throw attachmentInsertError;
          }
        }
      }
    }

    const dedupedEmails = await loadStoredEmails();

    return NextResponse.json({
      success: true,
      emails: dedupedEmails,
      synced: validParsedByUid.length,
    });
  } catch (error) {
    console.error('Error syncing emails:', error);

    try {
      const fallbackEmails = await loadStoredEmails();
      return NextResponse.json(
        {
          success: true,
          emails: fallbackEmails,
          synced: 0,
          degraded: true,
          message: 'Email sync failed. Showing last stored emails.',
        },
        { status: 200 }
      );
    } catch (fallbackError) {
      console.error('Failed to load fallback stored emails:', fallbackError);
    }

    return NextResponse.json(
      { error: 'Failed to sync emails' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (endError) {
        console.warn('Failed to close IMAP connection cleanly:', endError);
      }
    }
  }
}

async function handleListEmails(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const {
      folder = 'inbox',
      limit = 50,
      offset = 0,
      search = '',
    } = data;

    let query = supabase
      .from('property_emails')
      .select('*, attachments:email_attachments(*), labels:email_message_labels(label_id)')
      .eq('property_id', propertyId);

    // Filter by folder status
    if (folder === 'inbox') {
      query = query
        .eq('is_archived', false)
        .eq('is_spam', false)
        .eq('is_trash', false);
    } else if (folder === 'unread') {
      query = query
        .eq('is_unread', true)
        .eq('is_archived', false)
        .eq('is_spam', false)
        .eq('is_trash', false);
    } else if (folder === 'starred') {
      query = query.eq('is_starred', true);
    } else if (folder === 'archived') {
      query = query.eq('is_archived', true);
    } else if (folder === 'spam') {
      query = query.eq('is_spam', true);
    } else if (folder === 'trash') {
      query = query.eq('is_trash', true);
    } else if (folder === 'sent') {
      // Outgoing emails persisted by this API are stored with null UID.
      query = query
        .is('uid', null)
        .eq('is_spam', false)
        .eq('is_trash', false);
    }

    // Search in subject and body
    if (search) {
      const searchLower = search.toLowerCase();
      query = query.or(
        `subject.ilike.%${searchLower}%,from_email.ilike.%${searchLower}%,snippet.ilike.%${searchLower}%`
      );
    }

    const { data: emails, error } = await query
      .order('date_ms', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ success: true, emails });
  } catch (error) {
    console.error('Error listing emails:', error);
    return NextResponse.json(
      { error: 'Failed to list emails' },
      { status: 500 }
    );
  }
}

async function handleGetEmail(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { emailId } = data;

    if (!emailId) {
      return NextResponse.json(
        { error: 'emailId is required' },
        { status: 400 }
      );
    }

    const { data: email, error } = await supabase
      .from('property_emails')
      .select('*, attachments:email_attachments(*), labels:email_message_labels(label_id)')
      .eq('id', emailId)
      .eq('property_id', propertyId)
      .single();

    if (error) throw error;

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, email });
  } catch (error) {
    console.error('Error getting email:', error);
    return NextResponse.json(
      { error: 'Failed to get email' },
      { status: 500 }
    );
  }
}

async function handleGetEmailGuestContext(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const rawEmail = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
    const rawPhone = typeof data?.phone === 'string' ? data.phone.trim() : '';
    const emailId = typeof data?.emailId === 'string' ? data.emailId : '';

    let guestEmail = rawEmail;
    let guestPhone = rawPhone;

    if (!guestEmail && emailId) {
      const { data: emailRow } = await supabase
        .from('property_emails')
        .select('from_email')
        .eq('property_id', propertyId)
        .eq('id', emailId)
        .maybeSingle();

      guestEmail = String(emailRow?.from_email || '').trim().toLowerCase();
    }

    if (!guestEmail && !guestPhone) {
      return NextResponse.json({ success: true, context: null });
    }

    const { data: guestRows, error: guestRowsError } = await supabase
      .from('guests')
      .select('*')
      .eq('property_id', propertyId)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (guestRowsError) throw guestRowsError;

    const normalizedPhone = guestPhone.replace(/\s+/g, '');
    const matchingGuests = (guestRows || []).filter((guest: any) => {
      const guestEmailNormalized = String(guest?.email || '').trim().toLowerCase();
      const guestPhoneNormalized = String(guest?.phone || '').replace(/\s+/g, '');

      if (guestEmail && guestEmailNormalized && guestEmailNormalized === guestEmail) return true;
      if (normalizedPhone && guestPhoneNormalized && guestPhoneNormalized === normalizedPhone) return true;
      return false;
    });

    const primaryGuest = matchingGuests[0] || null;

    if (!primaryGuest) {
      return NextResponse.json({ success: true, context: null });
    }

    if (!guestPhone && primaryGuest?.phone) {
      guestPhone = String(primaryGuest.phone);
    }

    const { data: reservationRows, error: reservationsError } = await supabase
      .from('reservations')
      .select('*')
      .eq('property_id', propertyId)
      .order('start_date', { ascending: false })
      .limit(300);

    if (reservationsError) throw reservationsError;

    const guestIdSet = new Set(matchingGuests.map((guest: any) => String(guest.id)));
    const normalizedEmail = guestEmail.trim().toLowerCase();
    const normalizedGuestPhone = guestPhone.replace(/\s+/g, '');

    const matchedReservations = (reservationRows || []).filter((reservation: any) => {
      const reservationGuestId = String(reservation?.guest_id || '');
      const reservationEmails = [reservation?.guest_email, reservation?.contact_email]
        .map((value: any) => String(value || '').trim().toLowerCase())
        .filter(Boolean);
      const reservationPhones = [reservation?.guest_phone, reservation?.contact_phone]
        .map((value: any) => String(value || '').replace(/\s+/g, ''))
        .filter(Boolean);

      if (reservationGuestId && guestIdSet.has(reservationGuestId)) return true;
      if (normalizedEmail && reservationEmails.includes(normalizedEmail)) return true;
      if (normalizedGuestPhone && reservationPhones.includes(normalizedGuestPhone)) return true;
      return false;
    });

    const reservationIds = matchedReservations
      .map((reservation: any) => String(reservation?.id || ''))
      .filter(Boolean);

    let paymentRows: any[] = [];
    if (reservationIds.length > 0) {
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('reservation_id, amount, status')
        .eq('property_id', propertyId)
        .in('reservation_id', reservationIds);

      if (paymentError) throw paymentError;
      paymentRows = paymentData || [];
    }

    const paidAmountByReservationId = new Map<string, number>();
    paymentRows.forEach((payment: any) => {
      const status = String(payment?.status || '').toLowerCase();
      if (status !== 'completed') return;
      const reservationId = String(payment?.reservation_id || '');
      if (!reservationId) return;
      const amount = Number(payment?.amount || 0);
      if (!Number.isFinite(amount)) return;

      paidAmountByReservationId.set(
        reservationId,
        (paidAmountByReservationId.get(reservationId) || 0) + amount
      );
    });

    const reservations = matchedReservations
      .map((reservation: any) => {
        const reservationId = String(reservation?.id || '');
        const totalPrice = Number(reservation?.total_price ?? reservation?.net_amount ?? NaN);
        const paidAmount = paidAmountByReservationId.get(reservationId) || 0;
        const outstandingBalance = Number.isFinite(totalPrice)
          ? Math.max(0, Number((totalPrice - paidAmount).toFixed(2)))
          : null;

        const roomName = reservation?.room_name
          || reservation?.rooms_data?.[0]?.roomName
          || reservation?.rooms_data?.[0]?.room_name
          || reservation?.rooms_data?.[0]?.roomId
          || null;

        return {
          id: reservationId,
          status: reservation?.status || 'Unknown',
          arrival: reservation?.start_date || null,
          departure: reservation?.end_date || null,
          room: roomName,
          outstandingBalance,
        };
      })
      .sort((a: any, b: any) => {
        const aStart = new Date(a?.arrival || 0).getTime();
        const bStart = new Date(b?.arrival || 0).getTime();
        return bStart - aStart;
      });

    const context = {
      guest: {
        id: primaryGuest.id,
        fullName: primaryGuest.name || `${primaryGuest.first_name || ''} ${primaryGuest.last_name || ''}`.trim() || guestEmail,
        email: primaryGuest.email || guestEmail,
        phone: primaryGuest.phone || null,
        country: primaryGuest.country || null,
        city: primaryGuest.city || null,
      },
      reservations,
    };

    return NextResponse.json({ success: true, context });
  } catch (error) {
    console.error('Error getting email guest context:', error);
    return NextResponse.json(
      { error: 'Failed to load email guest context' },
      { status: 500 }
    );
  }
}

async function handleMarkRead(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { emailIds, emailUids } = data;

    const normalizedIds = Array.isArray(emailIds)
      ? emailIds.filter((id: any) => typeof id === 'string' && id.trim().length > 0)
      : [];

    const normalizedUids = Array.isArray(emailUids)
      ? emailUids
          .map((uid: any) => Number(uid))
          .filter((uid: number) => Number.isFinite(uid) && uid > 0)
      : [];

    if (normalizedIds.length === 0 && normalizedUids.length === 0) {
      return NextResponse.json(
        { error: 'emailIds or emailUids array is required' },
        { status: 400 }
      );
    }

    const updatePayload = { is_unread: false, updated_at: new Date().toISOString() };

    if (normalizedIds.length > 0) {
      const { error: updateByIdError } = await supabase
        .from('property_emails')
        .update(updatePayload)
        .eq('property_id', propertyId)
        .in('id', normalizedIds);

      if (updateByIdError) throw updateByIdError;
    }

    if (normalizedUids.length > 0) {
      const { error: updateByUidError } = await supabase
        .from('property_emails')
        .update(updatePayload)
        .eq('property_id', propertyId)
        .in('uid', normalizedUids);

      if (updateByUidError) throw updateByUidError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking email as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark email as read' },
      { status: 500 }
    );
  }
}

async function handleMarkUnread(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { emailIds } = data;

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: 'emailIds array is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('property_emails')
      .update({ is_unread: true, updated_at: new Date().toISOString() })
      .eq('property_id', propertyId)
      .in('id', emailIds);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking email as unread:', error);
    return NextResponse.json(
      { error: 'Failed to mark email as unread' },
      { status: 500 }
    );
  }
}

async function handleStar(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { emailIds } = data;

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: 'emailIds array is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('property_emails')
      .update({ is_starred: true, updated_at: new Date().toISOString() })
      .eq('property_id', propertyId)
      .in('id', emailIds);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error starring email:', error);
    return NextResponse.json(
      { error: 'Failed to star email' },
      { status: 500 }
    );
  }
}

async function handleUnstar(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { emailIds } = data;

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: 'emailIds array is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('property_emails')
      .update({ is_starred: false, updated_at: new Date().toISOString() })
      .eq('property_id', propertyId)
      .in('id', emailIds);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unstarring email:', error);
    return NextResponse.json(
      { error: 'Failed to unstar email' },
      { status: 500 }
    );
  }
}

async function handleArchive(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { emailIds } = data;

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: 'emailIds array is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('property_emails')
      .update({ 
        is_archived: true, 
        is_spam: false,
        is_trash: false,
        updated_at: new Date().toISOString() 
      })
      .eq('property_id', propertyId)
      .in('id', emailIds);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error archiving email:', error);
    return NextResponse.json(
      { error: 'Failed to archive email' },
      { status: 500 }
    );
  }
}

async function handleUnarchive(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { emailIds } = data;

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: 'emailIds array is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('property_emails')
      .update({ is_archived: false, updated_at: new Date().toISOString() })
      .eq('property_id', propertyId)
      .in('id', emailIds);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unarchiving email:', error);
    return NextResponse.json(
      { error: 'Failed to unarchive email' },
      { status: 500 }
    );
  }
}

async function handleSpam(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { emailIds } = data;

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: 'emailIds array is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('property_emails')
      .update({ 
        is_spam: true,
        is_archived: false,
        is_trash: false,
        updated_at: new Date().toISOString() 
      })
      .eq('property_id', propertyId)
      .in('id', emailIds);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking email as spam:', error);
    return NextResponse.json(
      { error: 'Failed to mark email as spam' },
      { status: 500 }
    );
  }
}

async function handleUnspam(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { emailIds } = data;

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: 'emailIds array is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('property_emails')
      .update({ is_spam: false, updated_at: new Date().toISOString() })
      .eq('property_id', propertyId)
      .in('id', emailIds);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unspamming email:', error);
    return NextResponse.json(
      { error: 'Failed to unspam email' },
      { status: 500 }
    );
  }
}

async function handleDelete(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { emailIds } = data;

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: 'emailIds array is required' },
        { status: 400 }
      );
    }

    const threadEmailIds = await resolveThreadEmailIds(propertyId, emailIds);

    const { error } = await supabase
      .from('property_emails')
      .update({ 
        is_trash: true,
        is_archived: false,
        is_spam: false,
        updated_at: new Date().toISOString() 
      })
      .eq('property_id', propertyId)
      .in('id', threadEmailIds);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting email:', error);
    return NextResponse.json(
      { error: 'Failed to delete email' },
      { status: 500 }
    );
  }
}

async function handleDeletePermanently(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { emailIds } = data;

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: 'emailIds array is required' },
        { status: 400 }
      );
    }

    const threadEmailIds = await resolveThreadEmailIds(propertyId, emailIds, { trashOnly: true });

    if (threadEmailIds.length === 0) {
      return NextResponse.json({ success: true });
    }

    const { error: labelDeleteError } = await supabase
      .from('email_message_labels')
      .delete()
      .in('email_id', threadEmailIds);

    if (labelDeleteError && !isMissingRelationError(labelDeleteError)) {
      throw labelDeleteError;
    }

    const { error: attachmentDeleteError } = await supabase
      .from('email_attachments')
      .delete()
      .in('email_id', threadEmailIds);

    if (attachmentDeleteError && !isMissingRelationError(attachmentDeleteError)) {
      throw attachmentDeleteError;
    }

    const { error } = await supabase
      .from('property_emails')
      .delete()
      .eq('property_id', propertyId)
      .eq('is_trash', true)
      .in('id', threadEmailIds);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error permanently deleting email:', error);
    return NextResponse.json(
      { error: 'Failed to permanently delete email' },
      { status: 500 }
    );
  }
}

async function handleRestore(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { emailIds } = data;

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: 'emailIds array is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('property_emails')
      .update({ is_trash: false, updated_at: new Date().toISOString() })
      .eq('property_id', propertyId)
      .in('id', emailIds);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error restoring email:', error);
    return NextResponse.json(
      { error: 'Failed to restore email' },
      { status: 500 }
    );
  }
}

async function handleGetLabels(propertyId: string): Promise<NextResponse> {
  try {
    const { data: labels, error } = await supabase
      .from('email_labels')
      .select('*')
      .eq('property_id', propertyId)
      .order('name');

    if (error) throw error;

    return NextResponse.json({ success: true, labels });
  } catch (error) {
    console.error('Error getting labels:', error);
    return NextResponse.json(
      { error: 'Failed to get labels' },
      { status: 500 }
    );
  }
}

async function handleAddLabel(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { name, color, emailIds } = data;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: 'emailIds array is required' },
        { status: 400 }
      );
    }

    // Get or create label
    let label = await supabase
      .from('email_labels')
      .select('id')
      .eq('property_id', propertyId)
      .eq('name', name)
      .single();

    let labelId = label.data?.id;

    if (!labelId) {
      const { data: newLabel, error: createError } = await supabase
        .from('email_labels')
        .insert({ property_id: propertyId, name, color })
        .select()
        .single();

      if (createError) throw createError;
      labelId = newLabel?.id;
    }

    // Add label to emails
    const labelEntries = emailIds.map((emailId: string) => ({
      email_id: emailId,
      label_id: labelId,
    }));

    const { error: linkError } = await supabase
      .from('email_message_labels')
      .insert(labelEntries)
      .onConflict('email_id,label_id')
      .ignore();

    if (linkError) throw linkError;

    return NextResponse.json({ success: true, labelId });
  } catch (error) {
    console.error('Error adding label:', error);
    return NextResponse.json(
      { error: 'Failed to add label' },
      { status: 500 }
    );
  }
}

async function handleRemoveLabel(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { labelId, emailIds } = data;

    if (!labelId || !Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: 'labelId and emailIds array are required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('email_message_labels')
      .delete()
      .eq('label_id', labelId)
      .in('email_id', emailIds);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing label:', error);
    return NextResponse.json(
      { error: 'Failed to remove label' },
      { status: 500 }
    );
  }
}

async function handleSendComposed(
  propertyId: string,
  data: any,
  authUser: { id: string; email?: string }
): Promise<NextResponse> {
  try {
    const { to, cc, bcc, subject, body_html, body_text, attachments, threadContactName } = data;

    if (!to || !subject || (!body_html && !body_text)) {
      return NextResponse.json(
        { error: 'to, subject, and body (html or text) are required' },
        { status: 400 }
      );
    }

    const smtpConfig = await getSmtpConfigForProperty(propertyId);
    if (!smtpConfig) {
      return NextResponse.json(
        { error: 'SMTP is not configured for this property' },
        { status: 400 }
      );
    }

    const transport = nodemailer.createTransport({
      host: smtpConfig.host,
      port: Number(smtpConfig.port),
      secure: Number(smtpConfig.port) === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    const fromAddress = smtpConfig.fromName
      ? `"${smtpConfig.fromName}" <${smtpConfig.user}>`
      : smtpConfig.user;

    const preparedAttachments = prepareOutgoingAttachments(attachments);

    const primaryRecipient = getPrimaryRecipient(to);

    const sent = await transport.sendMail({
      from: fromAddress,
      to,
      cc,
      bcc,
      subject,
      text: body_text,
      html: body_html,
      attachments: preparedAttachments.map((attachment) => attachment.mail),
    });

    const messageId = sent?.messageId || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const sentAt = new Date();

    const senderDisplayName = await resolveSenderDisplayName(authUser);

    const savedEmailId = await persistSentEmail({
      propertyId,
      fromName: senderDisplayName || smtpConfig.fromName,
      fromEmail: smtpConfig.user,
      threadContactName: String(threadContactName || primaryRecipient.name || '').trim() || undefined,
      threadContactEmail: primaryRecipient.email || undefined,
      subject: String(subject),
      bodyText: body_text ? String(body_text) : undefined,
      bodyHtml: body_html ? String(body_html) : undefined,
      sentAt,
      attachments: preparedAttachments.map((attachment) => attachment.db),
    });

    return NextResponse.json({
      success: true,
      messageId,
      savedEmailId,
      message: 'Email composed and sent successfully',
    });
  } catch (error) {
    console.error('Error sending composed email:', error);
    return NextResponse.json(
      { error: 'Failed to send composed email' },
      { status: 500 }
    );
  }
}

async function handleSendReply(
  propertyId: string,
  data: any,
  authUser: { id: string; email?: string }
): Promise<NextResponse> {
  try {
    const { emailId, to, subject, body_html, body_text, attachments, threadContactName } = data;

    if (!emailId || !to || !subject || (!body_html && !body_text)) {
      return NextResponse.json(
        { error: 'emailId, to, subject, and body (html or text) are required' },
        { status: 400 }
      );
    }

    // Verify the original email exists and belongs to this property
    const { data: originalEmail } = await supabase
      .from('property_emails')
      .select('id, from_email, date_ms')
      .eq('id', emailId)
      .eq('property_id', propertyId)
      .single();

    if (!originalEmail) {
      return NextResponse.json(
        { error: 'Original email not found' },
        { status: 404 }
      );
    }

    const smtpConfig = await getSmtpConfigForProperty(propertyId);
    if (!smtpConfig) {
      return NextResponse.json(
        { error: 'SMTP is not configured for this property' },
        { status: 400 }
      );
    }

    const transport = nodemailer.createTransport({
      host: smtpConfig.host,
      port: Number(smtpConfig.port),
      secure: Number(smtpConfig.port) === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    const fromAddress = smtpConfig.fromName
      ? `"${smtpConfig.fromName}" <${smtpConfig.user}>`
      : smtpConfig.user;

    const normalizedSubject = /^re:/i.test(String(subject))
      ? String(subject)
      : `Re: ${subject}`;

    const preparedAttachments = prepareOutgoingAttachments(attachments);

    const primaryRecipient = getPrimaryRecipient(to);

    const sent = await transport.sendMail({
      from: fromAddress,
      to,
      subject: normalizedSubject,
      text: body_text,
      html: body_html,
      attachments: preparedAttachments.map((attachment) => attachment.mail),
    });

    const messageId = sent?.messageId || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const sentAt = new Date();

    const senderDisplayName = await resolveSenderDisplayName(authUser);

    const savedEmailId = await persistSentEmail({
      propertyId,
      fromName: senderDisplayName || smtpConfig.fromName,
      fromEmail: smtpConfig.user,
      threadContactName: String(threadContactName || primaryRecipient.name || '').trim() || undefined,
      threadContactEmail: primaryRecipient.email || undefined,
      subject: normalizedSubject,
      bodyText: body_text ? String(body_text) : undefined,
      bodyHtml: body_html ? String(body_html) : undefined,
      sentAt,
      attachments: preparedAttachments.map((attachment) => attachment.db),
    });

    return NextResponse.json({
      success: true,
      messageId,
      savedEmailId,
      message: 'Reply sent successfully',
    });
  } catch (error) {
    console.error('Error sending reply email:', error);
    return NextResponse.json(
      { error: 'Failed to send reply' },
      { status: 500 }
    );
  }
}

async function handleTestSmtp(
  propertyId: string,
  _data: any
): Promise<NextResponse> {
  try {
    const smtpConfig = await getSmtpConfigForProperty(propertyId);
    if (!smtpConfig) {
      return NextResponse.json({ success: false, error: 'SMTP is not configured for this property' });
    }

    const transport = nodemailer.createTransport({
      host: smtpConfig.host,
      port: Number(smtpConfig.port),
      secure: Number(smtpConfig.port) === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    await transport.verify();
    return NextResponse.json({ success: true, message: 'SMTP configuration valid' });
  } catch (error) {
    console.error('Error testing SMTP:', error);
    return NextResponse.json({ success: false, error: 'Failed to test SMTP' });
  }
}

async function handleTestImap(
  propertyId: string,
  _data: any
): Promise<NextResponse> {
  let connection: any = null;
  try {
    const imapConfig = await getImapConfigForProperty(propertyId);
    if (!imapConfig) {
      return NextResponse.json({ success: false, error: 'IMAP is not configured for this property' });
    }

    connection = await imaps.connect({
      imap: {
        user: imapConfig.user,
        password: imapConfig.pass,
        host: imapConfig.host,
        port: imapConfig.port,
        tls: imapConfig.useTls,
        authTimeout: 10000,
        connTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false },
      },
    } as any);

    await connection.openBox('INBOX');
    return NextResponse.json({ success: true, message: 'IMAP configuration valid' });
  } catch (error) {
    console.error('Error testing IMAP:', error);
    return NextResponse.json({ success: false, error: 'Failed to test IMAP' });
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch {
        // Ignore close errors for test flow.
      }
    }
  }
}
