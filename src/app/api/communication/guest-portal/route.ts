import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;
const jwtSecret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!);

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

interface AuthToken {
  sub: string;
  aud: string;
  role?: string;
}

async function verifyUser(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const verified = await jwtVerify(token, jwtSecret);
    const payload = verified.payload as AuthToken;
    return payload.sub;
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

    return NextResponse.json({ success: true, conversations });
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
      messages: messages?.reverse() || [],
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

    // Create message
    const { data: messageData, error: msgError } = await supabase
      .from('guest_portal_messages')
      .insert({
        conversation_id: conversationId,
        property_id: propertyId,
        sender_type: 'property',
        sender_id: userId,
        sender_name: 'Property Staff', // Should come from user profile
        message,
        message_status: 'sent',
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Add attachments if any
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const attachmentData = attachments.map((att: any) => ({
        message_id: messageData.id,
        file_name: att.file_name,
        file_type: att.file_type,
        file_size: att.file_size,
        file_url: att.file_url,
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
        last_message_sender_name: 'Property Staff',
        last_message_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    return NextResponse.json({ success: true, message: messageData });
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

    // Create initial message
    const { error: msgError } = await supabase
      .from('guest_portal_messages')
      .insert({
        conversation_id: conversation.id,
        property_id: propertyId,
        sender_type: 'property',
        sender_id: userId,
        sender_name: 'Property Staff',
        message: initialMessage,
        message_status: 'sent',
      });

    if (msgError) throw msgError;

    // Update conversation with last message
    await supabase
      .from('guest_portal_conversations')
      .update({
        last_message_text: initialMessage,
        last_message_sender_type: 'property',
        last_message_sender_name: 'Property Staff',
        last_message_timestamp: new Date().toISOString(),
      })
      .eq('id', conversation.id);

    return NextResponse.json({ success: true, conversation });
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

    return NextResponse.json({ success: true, conversation: updated });
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
