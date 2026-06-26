import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

function mapConversation(row: any) {
  return {
    id: row.id,
    propertyId: row.property_id,
    reservationId: row.reservation_id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    roomName: row.room_name,
    roomType: row.room_type,
    reservationStatus: String(row.reservation_status || '').toLowerCase(),
    unreadCount: row.unread_count || 0,
    guestUnreadCount: row.guest_unread_count || 0,
    pinned: !!row.is_pinned,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessage: row.last_message_text
      ? {
          text: row.last_message_text,
          senderType: row.last_message_sender_type,
          senderName: row.last_message_sender_name,
          timestamp: row.last_message_timestamp,
        }
      : undefined,
  };
}

function mapMessage(row: any) {
  const timestampMs = row.created_at ? new Date(row.created_at).getTime() : Date.now();
  const attachments = Array.isArray(row.attachments)
    ? row.attachments.map((attachment: any) => ({
        fileName: attachment.file_name,
        fileType: attachment.file_type,
        fileSize: attachment.file_size,
        fileUrl: attachment.file_url,
      }))
    : [];
  const firstAttachment = attachments[0] || null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderType: row.sender_type,
    senderId: row.sender_id,
    senderName: row.sender_name,
    message: row.message,
    timestamp: row.created_at,
    timestampMs,
    status: row.message_status || 'sent',
    attachments,
    fileAttachment: firstAttachment
      ? {
          fileName: firstAttachment.fileName,
          fileType: firstAttachment.fileType,
          fileSize: firstAttachment.fileSize,
          fileUrl: firstAttachment.fileUrl,
        }
      : undefined,
  };
}

async function mirrorGuestPortalMessageToInbox(params: {
  conversation: any;
  messageRow: any;
  senderType: 'guest' | 'property';
  attachments?: Array<{
    file_name?: string;
    filename?: string;
    content_type?: string;
    contentType?: string;
    file_type?: string;
    file_size?: number | null;
    size?: number | null;
    file_url?: string;
    fileUrl?: string;
    dataUri?: string;
  }>;
}) {
  try {
    const conversation = params.conversation || {};
    const messageRow = params.messageRow || {};
    const senderType = params.senderType;
    const guestName = String(conversation.guest_name || messageRow.sender_name || 'Guest').trim() || 'Guest';
    const senderDisplayName = String(
      messageRow.sender_name
      || (senderType === 'property' ? 'Property Staff' : guestName)
    ).trim() || (senderType === 'property' ? 'Property Staff' : guestName);
    const threadIdentity = String(conversation.reservation_id || conversation.id || messageRow.conversation_id || messageRow.id || 'guest').trim();
    const threadEmail = `guest-portal+${threadIdentity}@guest-portal.local`;
    const bodyText = String(messageRow.message || '').trim();
    const createdAt = String(messageRow.created_at || new Date().toISOString());
    const dateMs = new Date(createdAt).getTime();
    const emailId = `gp-${String(messageRow.id || `${threadIdentity}-${createdAt}`)}`;
    const hasAttachments = Array.isArray(params.attachments) && params.attachments.length > 0;

    await supabase
      .from('property_emails')
      .update({
        is_in_trash: false,
        is_trash: false,
        is_archived: false,
        is_spam: false,
        updated_at: new Date().toISOString(),
      })
      .eq('property_id', conversation.property_id)
      .eq('source', 'guest_portal')
      .eq('source_conversation_id', String(conversation.id || messageRow.conversation_id || ''));

    const emailPayload: any = {
      id: emailId,
      property_id: conversation.property_id,
      uid: null,
      from_name: senderDisplayName,
      from_email: threadEmail,
      subject: `Guest Portal • ${guestName}`,
      date: createdAt,
      date_ms: Number.isFinite(dateMs) ? dateMs : Date.now(),
      snippet: bodyText.slice(0, 150),
      body_text: bodyText,
      body_html: '',
      is_unread: senderType === 'guest',
      is_starred: false,
      is_archived: false,
      is_spam: false,
      is_in_trash: false,
      is_trash: false,
      has_attachments: hasAttachments,
      source: 'guest_portal',
      source_sender_type: senderType,
      source_reservation_id: String(conversation.reservation_id || ''),
      source_conversation_id: String(conversation.id || messageRow.conversation_id || ''),
      source_message_id: String(messageRow.id || ''),
      updated_at: new Date().toISOString(),
    };

    let { error: emailError } = await supabase
      .from('property_emails')
      .upsert(emailPayload, { onConflict: 'id' });

    const isMissingReservationColumn = String((emailError as any)?.message || '').toLowerCase().includes('source_reservation_id');
    if (emailError && isMissingReservationColumn) {
      console.warn('[GuestPortalMirror] Retrying mirror insert without source_reservation_id column');

      const { source_reservation_id: _dropped, ...fallbackPayload } = emailPayload;
      const retry = await supabase
        .from('property_emails')
        .upsert(fallbackPayload, { onConflict: 'id' });
      emailError = retry.error;
    }

    if (emailError) {
      console.warn('[GuestPortalMirror] Failed to mirror message to inbox:', String((emailError as any)?.message || 'unknown error'));
      return;
    }

    if (hasAttachments) {
      await supabase.from('email_attachments').delete().eq('email_id', emailId);
      const rows = (params.attachments || []).map((att) => ({
        email_id: emailId,
        file_name: String(att.file_name || att.filename || 'attachment'),
        content_type: String(att.content_type || att.contentType || att.file_type || 'application/octet-stream'),
        file_size: typeof att.file_size === 'number'
          ? att.file_size
          : typeof att.size === 'number'
            ? att.size
            : null,
        file_url: String(att.file_url || att.fileUrl || att.dataUri || '') || null,
      }));

      if (rows.length > 0) {
        let { error: attachmentError } = await supabase
          .from('email_attachments')
          .insert(rows);

        const missingFileUrlColumn = String((attachmentError as any)?.message || '').toLowerCase().includes('file_url');
        if (attachmentError && missingFileUrlColumn) {
          const fallbackRows = rows.map(({ file_url: _drop, ...rest }) => rest);
          const retry = await supabase
            .from('email_attachments')
            .insert(fallbackRows);
          attachmentError = retry.error;
        }

        if (attachmentError) {
          console.warn('[GuestPortalMirror] Failed to mirror attachments:', String((attachmentError as any)?.message || 'unknown error'));
        }
      }
    }
  } catch (error) {
    console.warn('Unexpected inbox mirror error for guest portal message:', error instanceof Error ? error.message : 'unknown error');
  }
}

async function verifyUser(req: NextRequest): Promise<string | null> {
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
    return data.user.id;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

async function verifyUserProperty(
  userId: string,
  propertyId: string
): Promise<boolean> {
  try {
    // Check users table
    const { data: user } = await supabase
      .from('users')
      .select('property_id')
      .eq('id', userId)
      .single();

    if (user?.property_id === propertyId) {
      return true;
    }

    // Check team_members table
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('property_id')
      .eq('id', userId)
      .single();

    if (teamMember?.property_id === propertyId) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Property verification error:', error);
    return false;
  }
}

async function resolveSenderDisplayName(userId: string): Promise<string> {
  try {
    const { data: userRow } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const userName = String(
      userRow?.full_name
      || userRow?.name
      || [userRow?.first_name, userRow?.last_name].filter(Boolean).join(' ')
      || ''
    ).trim();
    if (userName) return userName;

    const { data: teamMember } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const teamMemberName = String(
      teamMember?.full_name
      || teamMember?.name
      || [teamMember?.first_name, teamMember?.last_name].filter(Boolean).join(' ')
      || ''
    ).trim();
    if (teamMemberName) return teamMemberName;
  } catch (error) {
    console.warn('Failed to resolve sender display name:', error);
  }

  return 'Property Staff';
}

export async function POST(req: NextRequest) {
  try {
    const userId = await verifyUser(req);
    if (!userId) {
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
    const hasAccess = await verifyUserProperty(userId, propertyId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to property' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'listConversations':
        return await handleListConversations(propertyId, data);

      case 'getMessages':
        return await handleGetMessages(propertyId, data);

      case 'sendMessage':
        return await handleSendMessage(userId, propertyId, data);

      case 'startConversation':
        return await handleStartConversation(userId, propertyId, data);

      case 'setPinned':
        return await handleSetPinned(propertyId, data);

      case 'deleteConversation':
        return await handleDeleteConversation(propertyId, data);

      case 'markAsRead':
        return await handleMarkAsRead(propertyId, data);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in guest portal communication API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function handleListConversations(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { data: conversations, error } = await supabase
      .from('guest_portal_conversations')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      conversations: (conversations || []).map(mapConversation),
    });
  } catch (error) {
    console.error('Error listing conversations:', error);
    return NextResponse.json(
      { error: 'Failed to list conversations' },
      { status: 500 }
    );
  }
}

async function handleGetMessages(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { conversationId, lastMessageId, pageSize = 50 } = data;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    // Verify conversation belongs to this property
    const { data: conversation } = await supabase
      .from('guest_portal_conversations')
      .select('property_id')
      .eq('id', conversationId)
      .single();

    if (!conversation || conversation.property_id !== propertyId) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    let query = supabase
      .from('guest_portal_messages')
      .select(`
        *,
        attachments:guest_portal_message_attachments(*)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(pageSize);

    if (lastMessageId) {
      const { data: lastMessage } = await supabase
        .from('guest_portal_messages')
        .select('created_at')
        .eq('id', lastMessageId)
        .single();

      if (lastMessage) {
        query = query.lt('created_at', lastMessage.created_at);
      }
    }

    const { data: messages, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      messages: (messages?.reverse() || []).map(mapMessage),
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    return NextResponse.json(
      { error: 'Failed to get messages' },
      { status: 500 }
    );
  }
}

async function handleSendMessage(
  userId: string,
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const {
      conversationId,
      message,
      attachments,
    } = data;

    if (!conversationId || !message) {
      return NextResponse.json(
        { error: 'conversationId and message are required' },
        { status: 400 }
      );
    }

    // Verify conversation
    const { data: conversation } = await supabase
      .from('guest_portal_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('property_id', propertyId)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const senderDisplayName = await resolveSenderDisplayName(userId);

    // Create message
    const { data: messageData, error: msgError } = await supabase
      .from('guest_portal_messages')
      .insert({
        conversation_id: conversationId,
        property_id: propertyId,
        sender_type: 'property',
        sender_id: userId,
        sender_name: senderDisplayName,
        message,
        message_status: 'sent',
      })
      .select()
      .single();

    if (msgError) throw msgError;

    await mirrorGuestPortalMessageToInbox({
      conversation,
      messageRow: messageData,
      senderType: 'property',
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    // Add attachments if any
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const attachmentData = attachments.map((att: any) => ({
        message_id: messageData.id,
        file_name: att.file_name || att.filename,
        file_type: att.file_type || att.contentType,
        file_size: att.file_size || att.size,
        file_url: att.file_url || att.dataUri,
      }));

      const { error: attError } = await supabase
        .from('guest_portal_message_attachments')
        .insert(attachmentData);

      if (attError) throw attError;
    }

    // Update conversation last message
    await supabase
      .from('guest_portal_conversations')
      .update({
        last_message_text: message,
        last_message_sender_type: 'property',
        last_message_sender_name: senderDisplayName,
        last_message_timestamp: new Date().toISOString(),
        guest_unread_count: (conversation.guest_unread_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    const { data: hydratedMessage } = await supabase
      .from('guest_portal_messages')
      .select('*, attachments:guest_portal_message_attachments(*)')
      .eq('id', messageData.id)
      .single();

    return NextResponse.json({
      success: true,
      message: hydratedMessage ? mapMessage(hydratedMessage) : mapMessage(messageData),
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

async function handleStartConversation(
  userId: string,
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { reservationId, initialMessage } = data;

    if (!reservationId || !initialMessage) {
      return NextResponse.json(
        { error: 'reservationId and initialMessage are required' },
        { status: 400 }
      );
    }

    // Get reservation data
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .eq('property_id', propertyId)
      .single();

    if (resError || !reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    // Check if conversation already exists
    const { data: existing } = await supabase
      .from('guest_portal_conversations')
      .select('id')
      .eq('reservation_id', reservationId)
      .eq('is_active', true)
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        conversation: existing,
        message: 'Conversation already exists',
      });
    }

    // Create conversation
    const { data: conversation, error: convError } = await supabase
      .from('guest_portal_conversations')
      .insert({
        property_id: propertyId,
        reservation_id: reservationId,
        guest_name: reservation.guest_name || 'Guest',
        guest_email: reservation.guest_email,
        room_name: reservation.room_name,
        room_type: reservation.room_type,
        reservation_status: reservation.status,
        unread_count: 0,
        guest_unread_count: 0,
        is_active: true,
      })
      .select()
      .single();

    if (convError) throw convError;

    const senderDisplayName = await resolveSenderDisplayName(userId);

    // Create initial message
    const { data: messageData, error: msgError } = await supabase
      .from('guest_portal_messages')
      .insert({
        conversation_id: conversation.id,
        property_id: propertyId,
        sender_type: 'property',
        sender_id: userId,
        sender_name: senderDisplayName,
        message: initialMessage,
        message_status: 'sent',
      })
      .select()
      .single();

    if (msgError) throw msgError;

    await mirrorGuestPortalMessageToInbox({
      conversation,
      messageRow: messageData,
      senderType: 'property',
      attachments: [],
    });

    // Update conversation with last message
    await supabase
      .from('guest_portal_conversations')
      .update({
        last_message_text: initialMessage,
        last_message_sender_type: 'property',
        last_message_sender_name: senderDisplayName,
        last_message_timestamp: new Date().toISOString(),
        guest_unread_count: (conversation.guest_unread_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id);

    return NextResponse.json({ success: true, conversation: mapConversation(conversation) });
  } catch (error) {
    console.error('Error starting conversation:', error);
    return NextResponse.json(
      { error: 'Failed to start conversation' },
      { status: 500 }
    );
  }
}

async function handleSetPinned(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { conversationId, pinned } = data;

    if (!conversationId || typeof pinned !== 'boolean') {
      return NextResponse.json(
        { error: 'conversationId and pinned are required' },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from('guest_portal_conversations')
      .update({ is_pinned: pinned })
      .eq('id', conversationId)
      .eq('property_id', propertyId)
      .select()
      .single();

    if (error) throw error;

    if (!updated) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, conversation: mapConversation(updated) });
  } catch (error) {
    console.error('Error setting pinned:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

async function handleDeleteConversation(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { conversationId } = data;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('guest_portal_conversations')
      .update({ is_active: false })
      .eq('id', conversationId)
      .eq('property_id', propertyId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}

async function handleMarkAsRead(
  propertyId: string,
  data: any
): Promise<NextResponse> {
  try {
    const { conversationId } = data;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    // Verify conversation exists
    const { data: conversation } = await supabase
      .from('guest_portal_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('property_id', propertyId)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Update conversation unread count
    const { error } = await supabase
      .from('guest_portal_conversations')
      .update({
        unread_count: 0,
      })
      .eq('id', conversationId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark as read' },
      { status: 500 }
    );
  }
}
