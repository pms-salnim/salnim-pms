import { onRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebase';
import { FieldValue } from 'firebase-admin/firestore';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

export const fetchEmailsHttp = onRequest({
  region: 'europe-west1',
  cors: true,
  memory: '1GiB',
  timeoutSeconds: 60,
}, async (req, res) => {
  const cooldownMs = 2 * 60 * 1000;
  const inProgressTimeoutMs = 5 * 60 * 1000;
  const maxNewLimitDefault = 200;

  const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  };

  const formatImapDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
  };
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.status(204).send('');
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.set('Access-Control-Allow-Origin', '*');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Verify authentication
  if (!req.headers.authorization?.startsWith('Bearer ')) {
    res.set('Access-Control-Allow-Origin', '*');
    res.status(401).json({ error: 'Unauthorized - No token provided' });
    return;
  }

  try {
    // Verify Firebase Auth token
    const idToken = req.headers.authorization.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Get user and verify permissions
    const staffDoc = await db.collection('staff').doc(userId).get();
    if (!staffDoc.exists) {
      res.set('Access-Control-Allow-Origin', '*');
      res.status(403).json({ error: 'User not found' });
      return;
    }

    const userData = staffDoc.data();
    const propertyId = userData?.propertyId;

    if (!propertyId) {
      res.set('Access-Control-Allow-Origin', '*');
      res.status(403).json({ error: 'No property associated with user' });
      return;
    }

    // Get property's IMAP configuration
    const propertyDoc = await db.collection('properties').doc(propertyId).get();
    if (!propertyDoc.exists) {
      res.set('Access-Control-Allow-Origin', '*');
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const propertyData = propertyDoc.data();
    const imapConfig = propertyData?.imapConfiguration;
    const emailLastSyncAt = propertyData?.emailLastSyncAt;
    const emailSyncInProgress = propertyData?.emailSyncInProgress;
    const emailSyncStartedAt = propertyData?.emailSyncStartedAt;

    const resolvedImapHost = imapConfig?.imapHost ?? imapConfig?.host;
    const resolvedImapUser = imapConfig?.imapUser ?? imapConfig?.user;
    const resolvedImapPass = imapConfig?.imapPass ?? imapConfig?.pass;
    const resolvedImapPort = imapConfig?.imapPort ?? imapConfig?.port;
    const resolvedUseTls = imapConfig?.useTls;

    if (!imapConfig || !resolvedImapHost || !resolvedImapUser || !resolvedImapPass) {
      logger.warn('IMAP not configured for property:', propertyId, 'Config:', imapConfig);
      res.set('Access-Control-Allow-Origin', '*');
      res.status(400).json({ error: 'IMAP not configured for this property' });
      return;
    }

    const emailsRef = db.collection('properties').doc(propertyId).collection('emails');

    const getCachedEmails = async () => {
      const cachedSnap = await emailsRef.orderBy('dateMs', 'desc').limit(50).get();
      return cachedSnap.docs.map(doc => doc.data());
    };

    const lastSyncMs = emailLastSyncAt?.toMillis ? emailLastSyncAt.toMillis() : (typeof emailLastSyncAt === 'number' ? emailLastSyncAt : null);
    const startedMs = emailSyncStartedAt?.toMillis ? emailSyncStartedAt.toMillis() : (typeof emailSyncStartedAt === 'number' ? emailSyncStartedAt : null);
    const now = Date.now();

    if (emailSyncInProgress && startedMs && now - startedMs < inProgressTimeoutMs) {
      const cachedEmails = await getCachedEmails();
      res.set('Access-Control-Allow-Origin', '*');
      res.status(200).json(cachedEmails);
      return;
    }

    const mode = req.body?.mode;
    const shouldSync = mode === 'sync';

    if (!shouldSync) {
      const cachedEmails = await getCachedEmails();
      res.set('Access-Control-Allow-Origin', '*');
      res.status(200).json(cachedEmails);
      return;
    }

    if (lastSyncMs && now - lastSyncMs < cooldownMs) {
      const cachedEmails = await getCachedEmails();
      res.set('Access-Control-Allow-Origin', '*');
      res.status(200).json(cachedEmails);
      return;
    }

    // Determine latest stored UID to fetch only new emails
    const lastUidSnap = await emailsRef.orderBy('uid', 'desc').limit(1).get();
    const lastStoredUid = lastUidSnap.empty ? null : lastUidSnap.docs[0].data()?.uid;

    // Connect to IMAP server
    const config = {
      imap: {
        user: resolvedImapUser,
        password: resolvedImapPass,
        host: resolvedImapHost,
        port: resolvedImapPort || 993,
        tls: resolvedUseTls !== false,
        authTimeout: 10000,
        tlsOptions: {
          rejectUnauthorized: false
        }
      },
    };

    await propertyDoc.ref.update({
      emailSyncInProgress: true,
      emailSyncStartedAt: FieldValue.serverTimestamp(),
    });

    logger.log('Connecting to IMAP server for user:', userId);
    const connection = await withTimeout(imaps.connect(config), 15000, 'IMAP connect');

    try {
      await withTimeout(connection.openBox('INBOX'), 15000, 'IMAP openBox');

      // Fetch only new emails based on last stored UID
      const searchCriteria = lastStoredUid
        ? [['UID', `${Number(lastStoredUid) + 1}:*`]]
        : [['SINCE', formatImapDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))]];
      const fetchOptions = {
        bodies: [''], // Fetch full RFC822 message source
        markSeen: false,
      };

      const messages = await withTimeout(connection.search(searchCriteria, fetchOptions), 25000, 'IMAP search');

      // Sort by date descending
      const maxNewLimit = typeof req.body?.maxNew === 'number'
        ? Math.min(Math.max(req.body.maxNew, 1), 500)
        : maxNewLimitDefault;

      const sortedMessages = messages
        .sort((a, b) => {
          const dateA = a.parts.find((p: any) => p.which === 'HEADER')?.body?.date?.[0];
          const dateB = b.parts.find((p: any) => p.which === 'HEADER')?.body?.date?.[0];
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        })
        .slice(0, maxNewLimit);

      const emails = await Promise.all(
        sortedMessages.map(async (item: any) => {
          try {
            const uid = item.attributes.uid;
            const fullMessagePart = item.parts.find((part: any) => part.which === '');

            if (!fullMessagePart?.body) {
              logger.error('Could not find full message body for UID:', uid);
              return null;
            }

            // Use simpleParser on the full raw email source
            const parsed = await simpleParser(fullMessagePart.body);
            
            const bodyText = parsed.text || '';
            const bodyHtml = parsed.html || '';
            let attachments: any[] = [];

            if (parsed.attachments && parsed.attachments.length > 0) {
              attachments = parsed.attachments.map((att: any) => ({
                filename: att.filename,
                contentType: att.contentType,
                size: att.size,
                // Note: Full attachment data/URI is not stored in Firestore to avoid size limits.
              }));
            }
            
            const fromHeader = parsed.from?.value[0];
            const fromName = fromHeader?.name || (fromHeader?.address ? fromHeader.address.split('@')[0] : 'Unknown');
            const fromEmail = fromHeader?.address || 'unknown@example.com';

            const subject = parsed.subject || '(No Subject)';
            const date = parsed.date?.toISOString() || new Date().toISOString();
            const flags = item.attributes.flags || [];
            const unread = !flags.includes('\\Seen');

            const plainBody = bodyText || (bodyHtml ? bodyHtml.replace(/<[^>]+>/g, ' ') : '');
            const snippet = plainBody.slice(0, 150).replace(/\s+/g, ' ').trim();
            const dateMs = parsed.date ? parsed.date.getTime() : Date.now();

            const emailData: any = {
              uid,
              from: {
                name: fromName,
                email: fromEmail,
              },
              subject,
              date,
              dateMs,
              snippet,
              body: plainBody, // For backward compatibility
              bodyText: bodyText, // Clean plain text
              bodyHtml: bodyHtml, // Clean HTML
              unread,
            };

            if (attachments.length > 0) {
              emailData.attachments = attachments;
            }

            return emailData;
          } catch (error) {
            logger.error('Error parsing email with UID:', item?.attributes?.uid, error);
            return null;
          }
        })
      );

      // Filter out null values
      const validEmails = emails.filter(email => email !== null) as any[];

      if (validEmails.length > 0) {
        const batch = db.batch();
        validEmails.forEach((email) => {
          const docRef = emailsRef.doc(String(email.uid));
          const cleanEmail: any = {
            ...email,
            uid: Number(email.uid),
            bodyHtml: email.bodyHtml || '',
            attachments: Array.isArray(email.attachments) ? email.attachments : [],
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
          };
          if (!cleanEmail.attachments || cleanEmail.attachments.length === 0) {
            delete cleanEmail.attachments;
          }
          batch.set(docRef, cleanEmail, { merge: true });
        });
        await batch.commit();
      }

      await connection.end();

      await propertyDoc.ref.update({
        emailSyncInProgress: false,
        emailSyncStartedAt: FieldValue.delete(),
        emailLastSyncAt: FieldValue.serverTimestamp(),
      });

      const storedEmails = await getCachedEmails();

      logger.log(`Fetched ${validEmails.length} new emails for property:`, propertyId);
      res.set('Access-Control-Allow-Origin', '*');
      res.status(200).json(storedEmails);

    } catch (error) {
      await connection.end();
      await propertyDoc.ref.update({
        emailSyncInProgress: false,
        emailSyncStartedAt: FieldValue.delete(),
      });
      logger.warn('IMAP sync failed; returning cache:', error);
      const cachedEmails = await getCachedEmails();
      res.set('Access-Control-Allow-Origin', '*');
      res.status(200).json(cachedEmails);
      return;
    }

  } catch (error: any) {
    logger.error('Error fetching emails:', error);
    res.set('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      error: 'Failed to fetch emails',
      message: error.message || 'Unknown error'
    });
  }
});
