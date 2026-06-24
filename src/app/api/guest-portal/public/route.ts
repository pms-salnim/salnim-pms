import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type JsonRecord = Record<string, any>;

function isMissingSlugColumnError(error: any): boolean {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("column") &&
    message.includes("slug") &&
    (message.includes("does not exist") || message.includes("could not find"))
  );
}

function isMissingTableError(error: any, tableName: string): boolean {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("could not find the table") && message.includes(tableName.toLowerCase())
  ) || (
    message.includes("relation") &&
    message.includes(tableName.toLowerCase()) &&
    message.includes("does not exist")
  );
}

function isAnyMissingTableError(error: any): boolean {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("could not find the table") ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

function normalizeSlug(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .replace(/-+/g, "-");
}

function deriveSlugFromName(name: string): string {
  const normalized = normalizeSlug(name || "");
  return normalized || "property";
}

function normalizeReservation(row: JsonRecord) {
  return {
    id: row.id,
    reservationNumber: row.reservation_number || row.id,
    guestName: row.guest_name || "Guest",
    guestEmail: row.guest_email || "",
    guestPhone: row.guest_phone || "",
    guestCountry: row.guest_country || "",
    guestPassportOrId: row.guest_passport_id || "",
    startDate: row.start_date,
    endDate: row.end_date,
    adults: row.adults,
    children: row.children,
    additionalGuests: row.additional_guests || [],
    actualCheckInTime: row.actual_check_in_time,
    actualCheckOutTime: row.actual_check_out_time,
    status: row.status || "confirmed",
    rooms: row.rooms_data || [],
    totalPrice: Number(row.total_price || 0),
    paymentStatus: row.payment_status || "pending",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeProperty(row: JsonRecord, slugOverride?: string) {
  const bookingPageSettings =
    row.booking_page_settings && typeof row.booking_page_settings === "object"
      ? row.booking_page_settings
      : {};

  const computedSlug = deriveSlugFromName(String(row.name || ""));
  const finalSlug = String(row.slug || "").trim() || slugOverride || computedSlug;

  return {
    id: row.id,
    slug: finalSlug,
    name: row.name,
    address: row.address || "",
    phone: row.phone || "",
    currency: row.currency || "MAD",
    logo: row.logo || row.logo_url || bookingPageSettings.logoUrl || null,
    logoUrl: row.logo_url || row.logo || bookingPageSettings.logoUrl || null,
    primaryColor: row.primary_color || row.invoice_primary_color || "#003166",
    secondaryColor: row.secondary_color || "#ea580c",
    bookingPageSettings,
  };
}

function mapConversation(row: JsonRecord) {
  return {
    id: row.id,
    propertyId: row.property_id,
    reservationId: row.reservation_id,
    guestName: row.guest_name,
    roomName: row.room_name,
    roomType: row.room_type,
    reservationStatus: row.reservation_status,
    unreadCount: row.unread_count || 0,
    guestUnreadCount: row.guest_unread_count || 0,
    isActive: row.is_active,
    lastMessage: row.last_message_text
      ? {
          text: row.last_message_text,
          senderType: row.last_message_sender_type,
          senderName: row.last_message_sender_name,
          timestamp: row.last_message_timestamp,
        }
      : undefined,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: JsonRecord) {
  const timestampMs = row.created_at ? new Date(row.created_at).getTime() : Date.now();
  const firstAttachment = Array.isArray(row.attachments) ? row.attachments[0] : null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderType: row.sender_type,
    senderId: row.sender_id,
    senderName: row.sender_name,
    message: row.message,
    timestamp: row.created_at,
    timestampMs,
    status: row.message_status || "sent",
    fileAttachment: firstAttachment
      ? {
          fileName: firstAttachment.file_name,
          fileType: firstAttachment.file_type,
          fileSize: firstAttachment.file_size,
          fileUrl: firstAttachment.file_url,
        }
      : undefined,
  };
}

async function mirrorGuestPortalMessageToInbox(params: {
  conversation: JsonRecord;
  messageRow: JsonRecord;
  senderType: "guest" | "property";
  guestName?: string;
  attachments?: Array<{ file_name: string; content_type: string; file_size: number | null }>;
}) {
  try {
    const conversation = params.conversation || {};
    const messageRow = params.messageRow || {};
    const senderType = params.senderType;
    const guestName = String(
      params.guestName
      || conversation.guest_name
      || messageRow.sender_name
      || "Guest"
    ).trim() || "Guest";
    const threadIdentity = String(conversation.reservation_id || conversation.id || messageRow.conversation_id || messageRow.id || "guest").trim();
    const threadEmail = `guest-portal+${threadIdentity}@guest-portal.local`;
    const bodyText = String(messageRow.message || "").trim();
    const createdAt = String(messageRow.created_at || new Date().toISOString());
    const dateMs = new Date(createdAt).getTime();
    const emailId = `gp-${String(messageRow.id || `${threadIdentity}-${createdAt}`)}`;
    const hasAttachments = Array.isArray(params.attachments) && params.attachments.length > 0;
    const traceId = `gp-public-mirror:${String(conversation.id || messageRow.conversation_id || "unknown")}:${String(messageRow.id || "unknown")}`;

    console.info("[GuestPortalPublicMirror][start]", {
      traceId,
      propertyId: conversation.property_id,
      conversationId: String(conversation.id || messageRow.conversation_id || ""),
      reservationId: String(conversation.reservation_id || ""),
      senderType,
      emailId,
      hasAttachments,
    });

    await supabase
      .from("property_emails")
      .update({
        is_trash: false,
        is_archived: false,
        is_spam: false,
        updated_at: new Date().toISOString(),
      })
      .eq("property_id", conversation.property_id)
      .eq("source", "guest_portal")
      .eq("source_conversation_id", String(conversation.id || messageRow.conversation_id || ""));

    const emailPayload: any = {
      id: emailId,
      property_id: conversation.property_id,
      uid: null,
      from_name: guestName,
      from_email: threadEmail,
      subject: `Guest Portal • ${guestName}`,
      date: createdAt,
      date_ms: Number.isFinite(dateMs) ? dateMs : Date.now(),
      snippet: bodyText.slice(0, 150),
      body_text: bodyText,
      body_html: "",
      is_unread: senderType === "guest",
      is_starred: false,
      is_archived: false,
      is_spam: false,
      is_trash: false,
      has_attachments: hasAttachments,
      source: "guest_portal",
      source_sender_type: senderType,
      source_reservation_id: String(conversation.reservation_id || ""),
      source_conversation_id: String(conversation.id || messageRow.conversation_id || ""),
      source_message_id: String(messageRow.id || ""),
      updated_at: new Date().toISOString(),
    };

    let { error: emailError } = await supabase
      .from("property_emails")
      .upsert(emailPayload, { onConflict: "id" });

    const isMissingReservationColumn = String((emailError as any)?.message || "").toLowerCase().includes("source_reservation_id");
    if (emailError && isMissingReservationColumn) {
      console.warn("[GuestPortalPublicMirror][fallback-without-source-reservation-id]", {
        traceId,
        reason: (emailError as any)?.message,
      });

      const { source_reservation_id: _dropped, ...fallbackPayload } = emailPayload;
      const retry = await supabase
        .from("property_emails")
        .upsert(fallbackPayload, { onConflict: "id" });
      emailError = retry.error;
    }

    if (emailError) {
      console.warn("[GuestPortalPublicMirror][failed]", { traceId, error: emailError });
      return;
    }

    console.info("[GuestPortalPublicMirror][upserted]", { traceId, emailId });

    if (hasAttachments) {
      await supabase.from("email_attachments").delete().eq("email_id", emailId);
      const rows = (params.attachments || []).map((att) => ({
        email_id: emailId,
        file_name: att.file_name,
        content_type: att.content_type,
        file_size: att.file_size,
      }));
      if (rows.length > 0) {
        const { error: attachmentError } = await supabase
          .from("email_attachments")
          .insert(rows);
        if (attachmentError) {
          console.warn("[GuestPortalPublicMirror][attachment-failed]", { traceId, error: attachmentError });
        }
      }
    }
  } catch (error) {
    console.warn("Unexpected inbox mirror error for guest portal message", error);
  }
}

function normalizeMealPlan(row: JsonRecord) {
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    description: row.description,
    shortDescription: row.short_description,
    fullDescription: row.full_description,
    pricePerNight: row.price_per_night,
    basePrice: row.base_price,
    visibleInGuestPortal: row.visible_in_guest_portal,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizePackage(row: JsonRecord) {
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    shortDescription: row.short_description,
    fullDescription: row.full_description,
    packagePrice: row.package_price,
    basePrice: row.package_price,
    featured: row.featured,
    visibleInGuestPortal: row.visible_in_guest_portal,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeService(row: JsonRecord) {
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    description: row.description,
    longDescription: row.long_description,
    price: row.price,
    currency: row.currency,
    featuredImage: row.featured_image,
    images: row.images || [],
    tags: row.tags || [],
    guestPortal: row.guest_portal,
    status: row.status,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPortalSettings(portalRow: JsonRecord | null) {
  if (!portalRow) return null;

  return {
    general: {
      portalName: portalRow.portal_name,
      welcomeTitle: portalRow.welcome_title,
      welcomeMessage: portalRow.welcome_message,
      primaryColor: portalRow.primary_color,
      accentColor: portalRow.accent_color,
    },
    branding: {
      welcomeTitle: portalRow.welcome_title,
      welcomeMessage: portalRow.welcome_message,
      primaryColor: portalRow.primary_color,
      accentColor: portalRow.accent_color,
      backgroundColor: portalRow.background_color,
      footerText: portalRow.footer_text,
      copyrightText: portalRow.copyright_text,
    },
  };
}

async function getOptionalPortalSettings(propertyId: string): Promise<JsonRecord | null> {
  const { data, error } = await supabase
    .from("guest_portals")
    .select("*")
    .eq("property_id", propertyId)
    .eq("default_portal", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, "guest_portals")) {
      return null;
    }
    throw error;
  }

  return data || null;
}

async function getOptionalTableRows(
  queryFactory: () => Promise<{ data: any[] | null; error: any }>
): Promise<any[]> {
  const { data, error } = await queryFactory();
  if (error) {
    if (isAnyMissingTableError(error)) {
      return [];
    }
    throw error;
  }
  return Array.isArray(data) ? data : [];
}

async function getPropertyBySlug(propertySlug: string) {
  const inputSlug = normalizeSlug(decodeURIComponent(String(propertySlug || "")));
  if (!inputSlug) return null;

  const direct = await supabase
    .from("properties")
    .select("*")
    .eq("slug", inputSlug)
    .limit(1)
    .maybeSingle();

  const slugColumnMissing = !!direct.error && isMissingSlugColumnError(direct.error);
  if (direct.error && !slugColumnMissing) throw direct.error;
  if (direct.data) return direct.data;

  // Backward-compatible fallback: derive slug from property name.
  const candidatesQuery = slugColumnMissing
    ? supabase.from("properties").select("id,name")
    : supabase.from("properties").select("id,name,slug");

  const { data: candidates, error } = await candidatesQuery;

  if (error) throw error;

  const matched = (candidates || []).find((row: JsonRecord) => {
    const storedSlug = normalizeSlug(String(row.slug || ""));
    const nameSlug = deriveSlugFromName(String(row.name || ""));
    return storedSlug === inputSlug || nameSlug === inputSlug;
  });

  if (!matched?.id) return null;

  const full = await supabase
    .from("properties")
    .select("*")
    .eq("id", matched.id)
    .limit(1)
    .maybeSingle();

  if (full.error) throw full.error;
  return full.data || null;
}

async function getReservation(propertyId: string, reservationNumber: string) {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("property_id", propertyId)
    .or(`reservation_number.eq.${reservationNumber},id.eq.${reservationNumber}`)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function buildGuestPortalPayload(
  propertyRow: JsonRecord,
  reservationRow: JsonRecord,
  slugOverride?: string
) {
  const propertyId = propertyRow.id;
  const reservation = normalizeReservation(reservationRow);
  const property = normalizeProperty(propertyRow, slugOverride);

  const roomTypeIds = (reservation.rooms || [])
    .map((r: JsonRecord) => r.roomTypeId || r.room_type_id)
    .filter(Boolean);

  const [portalSettingsRow, roomTypesRows, servicesRows, mealPlansRows, packagesRows] = await Promise.all([
    getOptionalPortalSettings(propertyId),
    getOptionalTableRows(async () => {
      if (roomTypeIds.length === 0) return { data: [], error: null } as any;
      return supabase
        .from("room_types")
        .select("*")
        .in("id", roomTypeIds);
    }),
    getOptionalTableRows(async () => {
      return supabase
        .from("services")
        .select("*")
        .eq("property_id", propertyId)
        .eq("guest_portal", true)
        .order("created_at", { ascending: false });
    }),
    getOptionalTableRows(async () => {
      return supabase
        .from("meal_plans")
        .select("*")
        .eq("property_id", propertyId)
        .eq("visible_in_guest_portal", true)
        .order("created_at", { ascending: false });
    }),
    getOptionalTableRows(async () => {
      return supabase
        .from("packages")
        .select("*")
        .eq("property_id", propertyId)
        .eq("visible_in_guest_portal", true)
        .order("created_at", { ascending: false });
    }),
  ]);

  const totalAmount = Number(reservationRow.total_price || 0);
  const totalPaid = 0;

  const payload = {
    property,
    reservation,
    rooms: reservation.rooms || [],
    roomTypes: roomTypesRows.map((row: JsonRecord) => ({
      id: row.id,
      name: row.name,
      maxGuests: row.max_guests,
      thumbnailImageUrl: row.thumbnail_image_url,
      galleryImageUrls: row.gallery_image_urls || [],
    })),
    ratePlans: [],
    services: servicesRows.map(normalizeService),
    mealPlans: mealPlansRows.map(normalizeMealPlan),
    packages: packagesRows.map(normalizePackage),
    menus: [],
    payments: [],
    propertyInfo: {
      id: property.id,
      name: property.name,
      currency: property.currency,
    },
    portalSettings: mapPortalSettings(portalSettingsRow),
    summary: {
      totalAmount,
      totalPaid,
      remainingBalance: Math.max(totalAmount - totalPaid, 0),
      paymentStatus: reservation.paymentStatus,
    },
  };

  return payload;
}

export async function POST(req: NextRequest) {
  try {
    const { action, data } = await req.json();

    if (!action || !data) {
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 }
      );
    }

    if (action === "checkProperty") {
      const propertySlug = String(data.propertySlug || "").trim();
      if (!propertySlug) {
        return NextResponse.json({ success: false, propertyExists: false }, { status: 200 });
      }

      const propertyRow = await getPropertyBySlug(propertySlug);
      if (!propertyRow) {
        return NextResponse.json({ success: true, propertyExists: false }, { status: 200 });
      }

      const portalSettingsRow = await getOptionalPortalSettings(propertyRow.id);

      return NextResponse.json({
        success: true,
        propertyExists: true,
        property: normalizeProperty(propertyRow, propertySlug),
        portalSettings: mapPortalSettings(portalSettingsRow),
      });
    }

    const propertySlug = String(data.propertySlug || "").trim();
    if (!propertySlug) {
      return NextResponse.json(
        { error: "propertySlug is required" },
        { status: 400 }
      );
    }

    const propertyRow = await getPropertyBySlug(propertySlug);
    if (!propertyRow) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    if (action === "getExtras") {
      const [servicesRows, mealPlansRows, packagesRows] = await Promise.all([
        getOptionalTableRows(async () => {
          return supabase
            .from("services")
            .select("*")
            .eq("property_id", propertyRow.id)
            .eq("guest_portal", true)
            .order("created_at", { ascending: false });
        }),
        getOptionalTableRows(async () => {
          return supabase
            .from("meal_plans")
            .select("*")
            .eq("property_id", propertyRow.id)
            .eq("visible_in_guest_portal", true)
            .order("created_at", { ascending: false });
        }),
        getOptionalTableRows(async () => {
          return supabase
            .from("packages")
            .select("*")
            .eq("property_id", propertyRow.id)
            .eq("visible_in_guest_portal", true)
            .order("created_at", { ascending: false });
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          services: servicesRows.map(normalizeService),
          mealPlans: mealPlansRows.map(normalizeMealPlan),
          packages: packagesRows.map(normalizePackage),
          menus: [],
          property: normalizeProperty(propertyRow, propertySlug),
        },
      });
    }

    const reservationNumber = String(data.reservationNumber || "").trim();
    if (!reservationNumber) {
      return NextResponse.json(
        { error: "reservationNumber is required" },
        { status: 400 }
      );
    }

    const reservationRow = await getReservation(propertyRow.id, reservationNumber);
    if (!reservationRow) {
      return NextResponse.json({ error: "Invalid reservation number" }, { status: 403 });
    }

    if (action === "authenticate") {
      const payload = await buildGuestPortalPayload(propertyRow, reservationRow, propertySlug);
      return NextResponse.json({ success: true, data: payload });
    }

    if (action === "getConversations") {
      const { data: conversations, error } = await supabase
        .from("guest_portal_conversations")
        .select("*")
        .eq("property_id", propertyRow.id)
        .eq("reservation_id", reservationRow.id)
        .eq("is_active", true)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return NextResponse.json({ success: true, conversations: (conversations || []).map(mapConversation) });
    }

    if (action === "getMessages") {
      const conversationId = String(data.conversationId || "").trim();
      if (!conversationId) {
        return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
      }

      const { data: conversation, error: convError } = await supabase
        .from("guest_portal_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("property_id", propertyRow.id)
        .eq("reservation_id", reservationRow.id)
        .maybeSingle();

      if (convError) throw convError;
      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }

      const { data: messages, error } = await supabase
        .from("guest_portal_messages")
        .select("*, attachments:guest_portal_message_attachments(*)")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return NextResponse.json({ success: true, messages: (messages || []).map(mapMessage) });
    }

    if (action === "createConversation") {
      const message = String(data.message || "").trim();
      const fileAttachment = data.fileAttachment;

      const { data: existing } = await supabase
        .from("guest_portal_conversations")
        .select("*")
        .eq("property_id", propertyRow.id)
        .eq("reservation_id", reservationRow.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      let conversation = existing;
      if (!conversation) {
        const rooms = Array.isArray(reservationRow.rooms_data) ? reservationRow.rooms_data : [];
        const firstRoom = rooms[0] || {};

        const { data: created, error: createError } = await supabase
          .from("guest_portal_conversations")
          .insert({
            property_id: propertyRow.id,
            reservation_id: reservationRow.id,
            guest_name: reservationRow.guest_name || "Guest",
            guest_email: reservationRow.guest_email,
            room_name: firstRoom.name || firstRoom.roomName || null,
            room_type: firstRoom.type || firstRoom.roomType || null,
            reservation_status: reservationRow.status,
            unread_count: 0,
            guest_unread_count: 0,
            is_active: true,
          })
          .select("*")
          .single();

        if (createError) throw createError;
        conversation = created;
      }

      const { data: messageRow, error: messageError } = await supabase
        .from("guest_portal_messages")
        .insert({
          conversation_id: conversation.id,
          property_id: propertyRow.id,
          sender_type: "guest",
          sender_id: String(reservationRow.id),
          sender_name: reservationRow.guest_name || "Guest",
          message,
          message_status: "sent",
        })
        .select("*")
        .single();

      if (messageError) throw messageError;

      if (fileAttachment && fileAttachment.fileName) {
        const { error: attachmentError } = await supabase
          .from("guest_portal_message_attachments")
          .insert({
            message_id: messageRow.id,
            file_name: fileAttachment.fileName,
            file_type: fileAttachment.fileType,
            file_size: fileAttachment.fileSize,
            file_url: fileAttachment.fileData || null,
          });

        if (attachmentError) throw attachmentError;
      }

      await mirrorGuestPortalMessageToInbox({
        conversation,
        messageRow,
        senderType: "guest",
        guestName: reservationRow.guest_name || "Guest",
        attachments: fileAttachment && fileAttachment.fileName
          ? [{
              file_name: fileAttachment.fileName,
              content_type: fileAttachment.fileType || "application/octet-stream",
              file_size: Number(fileAttachment.fileSize || 0) || null,
            }]
          : [],
      });

      await supabase
        .from("guest_portal_conversations")
        .update({
          last_message_text: message,
          last_message_sender_type: "guest",
          last_message_sender_name: reservationRow.guest_name || "Guest",
          last_message_timestamp: new Date().toISOString(),
          unread_count: (conversation.unread_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation.id);

      const { data: hydratedMessage, error: hydratedError } = await supabase
        .from("guest_portal_messages")
        .select("*, attachments:guest_portal_message_attachments(*)")
        .eq("id", messageRow.id)
        .single();

      if (hydratedError) throw hydratedError;

      return NextResponse.json({
        success: true,
        conversation: mapConversation(conversation),
        message: mapMessage(hydratedMessage),
      });
    }

    if (action === "sendMessage") {
      const conversationId = String(data.conversationId || "").trim();
      const message = String(data.message || "").trim();
      const fileAttachment = data.fileAttachment;

      if (!conversationId || !message) {
        return NextResponse.json(
          { error: "conversationId and message are required" },
          { status: 400 }
        );
      }

      const { data: conversation, error: convError } = await supabase
        .from("guest_portal_conversations")
        .select("*")
        .eq("id", conversationId)
        .eq("property_id", propertyRow.id)
        .eq("reservation_id", reservationRow.id)
        .maybeSingle();

      if (convError) throw convError;
      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }

      const { data: messageRow, error: messageError } = await supabase
        .from("guest_portal_messages")
        .insert({
          conversation_id: conversationId,
          property_id: propertyRow.id,
          sender_type: "guest",
          sender_id: String(reservationRow.id),
          sender_name: reservationRow.guest_name || "Guest",
          message,
          message_status: "sent",
        })
        .select("*")
        .single();

      if (messageError) throw messageError;

      if (fileAttachment && fileAttachment.fileName) {
        const { error: attachmentError } = await supabase
          .from("guest_portal_message_attachments")
          .insert({
            message_id: messageRow.id,
            file_name: fileAttachment.fileName,
            file_type: fileAttachment.fileType,
            file_size: fileAttachment.fileSize,
            file_url: fileAttachment.fileData || null,
          });

        if (attachmentError) throw attachmentError;
      }

      await mirrorGuestPortalMessageToInbox({
        conversation,
        messageRow,
        senderType: "guest",
        guestName: reservationRow.guest_name || "Guest",
        attachments: fileAttachment && fileAttachment.fileName
          ? [{
              file_name: fileAttachment.fileName,
              content_type: fileAttachment.fileType || "application/octet-stream",
              file_size: Number(fileAttachment.fileSize || 0) || null,
            }]
          : [],
      });

      await supabase
        .from("guest_portal_conversations")
        .update({
          last_message_text: message,
          last_message_sender_type: "guest",
          last_message_sender_name: reservationRow.guest_name || "Guest",
          last_message_timestamp: new Date().toISOString(),
          unread_count: (conversation.unread_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

      const { data: hydratedMessage, error: hydratedError } = await supabase
        .from("guest_portal_messages")
        .select("*, attachments:guest_portal_message_attachments(*)")
        .eq("id", messageRow.id)
        .single();

      if (hydratedError) throw hydratedError;

      return NextResponse.json({ success: true, message: mapMessage(hydratedMessage) });
    }

    if (action === "markAsRead") {
      const conversationId = String(data.conversationId || "").trim();
      if (!conversationId) {
        return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
      }

      const { data: conversation, error: convError } = await supabase
        .from("guest_portal_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("property_id", propertyRow.id)
        .eq("reservation_id", reservationRow.id)
        .maybeSingle();

      if (convError) throw convError;
      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }

      const { error } = await supabase
        .from("guest_portal_conversations")
        .update({ guest_unread_count: 0 })
        .eq("id", conversationId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "updateGuestProfile") {
      const updates = data.updates || {};
      const allowed: JsonRecord = {};

      if (typeof updates.guestName === "string") allowed.guest_name = updates.guestName.trim();
      if (typeof updates.guestEmail === "string") allowed.guest_email = updates.guestEmail.trim();
      if (typeof updates.guestPhone === "string") allowed.guest_phone = updates.guestPhone.trim();
      if (typeof updates.guestCountry === "string") allowed.guest_country = updates.guestCountry.trim();
      if (typeof updates.guestPassportOrId === "string") {
        allowed.guest_passport_id = updates.guestPassportOrId.trim();
      }

      const { data: updated, error } = await supabase
        .from("reservations")
        .update(allowed)
        .eq("id", reservationRow.id)
        .eq("property_id", propertyRow.id)
        .select("*")
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        result: {
          updatedFields: Object.keys(updates),
          reservation: normalizeReservation(updated),
        },
      });
    }

    if (action === "submitReview") {
      const ratings = data.ratings || {};
      const reviewText = String(data.reviewText || "").trim();

      if (!ratings?.overall || !reviewText) {
        return NextResponse.json(
          { error: "overall rating and reviewText are required" },
          { status: 400 }
        );
      }

      const insertPayload = {
        property_id: propertyRow.id,
        reservation_id: reservationRow.id,
        reservation_number: reservationRow.reservation_number || reservationRow.id,
        source: "guest_portal",
        guest_name: reservationRow.guest_name || "Guest",
        guest_email: reservationRow.guest_email || null,
        ratings,
        review_text: reviewText,
        status: "pending",
        submitted_at: new Date().toISOString(),
      };

      const { data: created, error } = await supabase
        .from("reviews")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, review: created });
    }

    if (action === "listReviews") {
      const { data: reviews, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("property_id", propertyRow.id)
        .eq("reservation_id", reservationRow.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return NextResponse.json({ success: true, reviews: reviews || [] });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Guest portal public API error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}