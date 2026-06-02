import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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

      case 'markAsRead':
        return await handleMarkAsRead(propertyId, data);

      case 'startConversation':
        return await handleStartConversation(userId, propertyId, data);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in WhatsApp communication API:', error);
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
      .from('whatsapp_conversations')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, conversations });
  } catch (error) {
    console.error('Error listing WhatsApp conversations:', error);
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
    const { conversationId, pageSize = 50 } = data;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    // Verify conversation belongs to this property
    const { data: conversation } = await supabase
      .from('whatsapp_conversations')
      .select('property_id')
      .eq('id', conversationId)
      .single();

    if (!conversation || conversation.property_id !== propertyId) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const { data: messages, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(pageSize);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      messages: messages?.reverse() || [],
    });
  } catch (error) {
    console.error('Error getting WhatsApp messages:', error);
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
    const { conversationId, message } = data;

    if (!conversationId || !message) {
      return NextResponse.json(
        { error: 'conversationId and message are required' },
        { status: 400 }
      );
    }

    // Verify conversation
    const { data: conversation } = await supabase
      .from('whatsapp_conversations')
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
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversationId,
        property_id: propertyId,
        sender_type: 'property',
        sender_id: userId,
        sender_name: 'Property Staff',
        message,
        message_status: 'sent',
        is_read: false,
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Update conversation last message
    await supabase
      .from('whatsapp_conversations')
      .update({
        last_message_text: message,
        last_message_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    return NextResponse.json({ success: true, message: messageData });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
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
      .from('whatsapp_conversations')
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

    // Mark all messages in conversation as read
    const { error } = await supabase
      .from('whatsapp_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId);

    if (error) throw error;

    // Update conversation unread count
    await supabase
      .from('whatsapp_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking WhatsApp as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark as read' },
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
    const { guestPhone, guestName, guestEmail, initialMessage } = data;

    if (!guestPhone) {
      return NextResponse.json(
        { error: 'guestPhone is required' },
        { status: 400 }
      );
    }

    // Create conversation
    const { data: conversation, error: convError } = await supabase
      .from('whatsapp_conversations')
      .insert({
        property_id: propertyId,
        guest_name: guestName || 'Guest',
        guest_phone: guestPhone,
        guest_email: guestEmail,
        is_active: true,
      })
      .select()
      .single();

    if (convError) throw convError;

    // Create initial message if provided
    if (initialMessage) {
      const { error: msgError } = await supabase
        .from('whatsapp_messages')
        .insert({
          conversation_id: conversation.id,
          property_id: propertyId,
          sender_type: 'property',
          sender_id: userId,
          sender_name: 'Property Staff',
          message: initialMessage,
          message_status: 'sent',
          is_read: false,
        });

      if (msgError) throw msgError;

      // Update conversation with last message
      await supabase
        .from('whatsapp_conversations')
        .update({
          last_message_text: initialMessage,
          last_message_timestamp: new Date().toISOString(),
        })
        .eq('id', conversation.id);
    }

    return NextResponse.json({ success: true, conversation });
  } catch (error) {
    console.error('Error starting WhatsApp conversation:', error);
    return NextResponse.json(
      { error: 'Failed to start conversation' },
      { status: 500 }
    );
  }
}
