import { createClient } from '@/utils/supabase/client';

export const emailApi = {
  
  
  async fetch(action: string, data: any) {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.warn('emailApi: No session available');
        return null;
      }

      const res = await fetch('/api/communication/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action, data })
      });

      if (!res.ok) {
        const text = await res.text().catch(() => null);
        console.warn('emailApi non-ok response', { status: res.status, statusText: res.statusText, body: text });
        return null;
      }

      return await res.json();
    } catch (err) {
      console.warn('emailApi error:', err);
      return null;
    }
  },

  async listEmails(propertyId: string, folder: string, options?: any) {
    return this.fetch('listEmails', { propertyId, folder, ...options });
  },

  async getEmail(propertyId: string, emailId: string) {
    return this.fetch('getEmail', { propertyId, emailId });
  },

  async getEmailGuestContext(
    propertyId: string,
    email: string,
    emailId?: string,
    phone?: string,
    reservationId?: string,
    sourceConversationId?: string
  ) {
    return this.fetch('getEmailGuestContext', { propertyId, email, emailId, phone, reservationId, sourceConversationId });
  },

  async markRead(propertyId: string, emailIds: string[], emailUids?: number[]) {
    return this.fetch('markRead', { propertyId, emailIds, emailUids });
  },

  async markUnread(propertyId: string, emailIds: string[]) {
    return this.fetch('markUnread', { propertyId, emailIds });
  },

  async star(propertyId: string, emailIds: string[]) {
    return this.fetch('star', { propertyId, emailIds });
  },

  async unstar(propertyId: string, emailIds: string[]) {
    return this.fetch('unstar', { propertyId, emailIds });
  },

  async archive(propertyId: string, emailIds: string[]) {
    return this.fetch('archive', { propertyId, emailIds });
  },

  async unarchive(propertyId: string, emailIds: string[]) {
    return this.fetch('unarchive', { propertyId, emailIds });
  },

  async spam(propertyId: string, emailIds: string[]) {
    return this.fetch('spam', { propertyId, emailIds });
  },

  async unspam(propertyId: string, emailIds: string[]) {
    return this.fetch('unspam', { propertyId, emailIds });
  },

  async delete(propertyId: string, emailIds: string[]) {
    return this.fetch('delete', { propertyId, emailIds });
  },

  async deletePermanently(propertyId: string, emailIds: string[]) {
    return this.fetch('deletePermanently', { propertyId, emailIds });
  },

  async restore(propertyId: string, emailIds: string[]) {
    return this.fetch('restore', { propertyId, emailIds });
  },

  async getLabels(propertyId: string) {
    return this.fetch('getLabels', { propertyId });
  },

  async addLabel(propertyId: string, name: string, emailIds: string[], color?: string) {
    return this.fetch('addLabel', { propertyId, name, emailIds, color });
  },

  async removeLabel(propertyId: string, labelId: string, emailIds: string[]) {
    return this.fetch('removeLabel', { propertyId, labelId, emailIds });
  },

  async sendComposed(
    propertyId: string,
    to: string,
    subject: string,
    body_html: string,
    body_text?: string,
    attachments?: any[],
    cc?: string,
    bcc?: string,
    threadContactName?: string
  ) {
    return this.fetch('sendComposed', { propertyId, to, cc, bcc, subject, body_html, body_text, attachments, threadContactName });
  },

  async sendReply(
    propertyId: string,
    emailId: string,
    to: string,
    subject: string,
    body_html: string,
    body_text?: string,
    attachments?: any[],
    threadContactName?: string
  ) {
    return this.fetch('sendReply', { propertyId, emailId, to, subject, body_html, body_text, attachments, threadContactName });
  },

  async testSmtp(propertyId: string) {
    return this.fetch('testSmtp', { propertyId });
  },

  async testImap(propertyId: string) {
    return this.fetch('testImap', { propertyId });
  },

  async syncEmails(propertyId: string, options?: { maxNew?: number }) {
    return this.fetch('syncEmails', { propertyId, ...(options || {}) });
  },
};

export const whatsappApi = {
  async fetch(action: string, data: any) {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.warn('whatsappApi: No session available');
        return null;
      }

      const res = await fetch('/api/communication/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action, data })
      });

      if (!res.ok) {
        const text = await res.text().catch(() => null);
        console.warn('whatsappApi non-ok response', { status: res.status, statusText: res.statusText, body: text });
        return null;
      }

      return await res.json();
    } catch (err) {
      console.warn('whatsappApi error:', err);
      return null;
    }
  },

  async listConversations(propertyId: string) {
    return this.fetch('listConversations', { propertyId });
  },

  async getMessages(propertyId: string, conversationId: string, pageSize?: number) {
    return this.fetch('getMessages', { propertyId, conversationId, pageSize });
  },

  async sendMessage(propertyId: string, conversationId: string, message: string) {
    return this.fetch('sendMessage', { propertyId, conversationId, message });
  },

  async markAsRead(propertyId: string, conversationId: string) {
    return this.fetch('markAsRead', { propertyId, conversationId });
  },

  async startConversation(propertyId: string, guestPhone: string, guestName?: string, guestEmail?: string, initialMessage?: string) {
    return this.fetch('startConversation', { propertyId, guestPhone, guestName, guestEmail, initialMessage });
  },
};

export const guestPortalApi = {
  async fetch(action: string, data: any) {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.warn('guestPortalApi: No session available');
        return null;
      }

      const res = await fetch('/api/communication/guest-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, data }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => null);
        console.warn('guestPortalApi non-ok response', { status: res.status, statusText: res.statusText, body: text });
        return null;
      }

      return await res.json();
    } catch (err) {
      console.warn('guestPortalApi error:', err);
      return null;
    }
  },

  async listConversations(propertyId: string) {
    return this.fetch('listConversations', { propertyId });
  },

  async getMessages(propertyId: string, conversationId: string, pageSize?: number) {
    return this.fetch('getMessages', { propertyId, conversationId, pageSize });
  },

  async sendMessage(propertyId: string, conversationId: string, message: string, attachments?: any[]) {
    return this.fetch('sendMessage', { propertyId, conversationId, message, attachments });
  },

  async startConversation(propertyId: string, reservationId: string, initialMessage: string) {
    return this.fetch('startConversation', { propertyId, reservationId, initialMessage });
  },

  async markAsRead(propertyId: string, conversationId: string) {
    return this.fetch('markAsRead', { propertyId, conversationId });
  },
};
