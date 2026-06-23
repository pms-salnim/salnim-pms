/**
 * Communication Channel Settings API Routes
 * GET: Fetch communication channel settings for property
 * POST: Save communication channel settings for property
 * 
 * Authentication: Uses cookie-based Supabase SSR pattern
 * Cookies set by Supabase middleware are automatically included in requests
 * No manual token extraction needed
 */

import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import imaps from "imap-simple";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const CHANNEL_SETTINGS_TABLES = [
  "communication_channels_settings",
  "communication_channel_settings",
] as const;

const isMissingRelationError = (error: any): boolean => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01" || message.includes("does not exist") || message.includes("relation");
};

async function getChannelSettingsRecord(
  client: any,
  propertyId: string,
  selectColumns = "settings"
): Promise<{ tableName: string; data: any; error: any }> {
  let lastError: any = null;

  for (const tableName of CHANNEL_SETTINGS_TABLES) {
    const { data, error } = await client
      .from(tableName)
      .select(selectColumns)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (error && isMissingRelationError(error)) {
      lastError = error;
      continue;
    }

    return { tableName, data, error };
  }

  return {
    tableName: CHANNEL_SETTINGS_TABLES[0],
    data: null,
    error: lastError,
  };
}

type SmtpSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromName?: string;
};

type ImapSettings = {
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  useTls: boolean;
};

const HIDDEN_SECRET_MASKS = new Set(["***", "••••••••", "********"]);

const isMaskedSecret = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return HIDDEN_SECRET_MASKS.has(trimmed);
};

async function getExistingChannelSettings(propertyId: string): Promise<Record<string, any>> {
  const { data } = await getChannelSettingsRecord(supabaseAdmin, propertyId, "settings");

  return (data?.settings as Record<string, any>) || {};
}

async function normalizeSecretsForProperty({
  propertyId,
  smtpSettings,
  imapSettings,
}: {
  propertyId: string;
  smtpSettings?: SmtpSettings;
  imapSettings?: ImapSettings;
}): Promise<{ smtpSettings?: SmtpSettings; imapSettings?: ImapSettings }> {
  if (!smtpSettings && !imapSettings) {
    return { smtpSettings, imapSettings };
  }

  const hasMaskedSmtpPass = !!smtpSettings && isMaskedSecret(smtpSettings.smtpPass);
  const hasMaskedImapPass = !!imapSettings && isMaskedSecret(imapSettings.imapPass);

  if (!hasMaskedSmtpPass && !hasMaskedImapPass) {
    return { smtpSettings, imapSettings };
  }

  const existing = await getExistingChannelSettings(propertyId);
  const existingSmtpPass = existing?.smtpSettings?.smtpPass;
  const existingImapPass = existing?.imapSettings?.imapPass;

  return {
    smtpSettings: smtpSettings
      ? {
          ...smtpSettings,
          smtpPass: hasMaskedSmtpPass ? String(existingSmtpPass || "") : smtpSettings.smtpPass,
        }
      : undefined,
    imapSettings: imapSettings
      ? {
          ...imapSettings,
          imapPass: hasMaskedImapPass ? String(existingImapPass || "") : imapSettings.imapPass,
        }
      : undefined,
  };
}

async function verifySmtpConnection(settings: SmtpSettings) {
  const transport = nodemailer.createTransport({
    host: settings.smtpHost,
    port: Number(settings.smtpPort),
    secure: Number(settings.smtpPort) === 465,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  await transport.verify();
}

async function verifyImapConnection(settings: ImapSettings) {
  const connection = await imaps.connect({
    imap: {
      user: settings.imapUser,
      password: settings.imapPass,
      host: settings.imapHost,
      port: Number(settings.imapPort),
      tls: settings.useTls !== false,
      authTimeout: 10000,
      connTimeout: 10000,
      tlsOptions: {
        rejectUnauthorized: false,
      },
    },
  });

  try {
    await connection.openBox("INBOX");
  } finally {
    connection.end();
  }
}

async function saveChannelSettings({
  supabase,
  propertyId,
  settings,
  smtpSettings,
  imapSettings,
}: {
  supabase: any;
  propertyId: string;
  settings?: Record<string, any>;
  smtpSettings?: SmtpSettings;
  imapSettings?: ImapSettings;
}) {
  const {
    tableName,
    data: existingRecord,
    error: existingLookupError,
  } = await getChannelSettingsRecord(supabase, propertyId, "id, settings");

  if (existingLookupError && isMissingRelationError(existingLookupError)) {
    return { data: null, error: existingLookupError };
  }

  const mergedSettings = {
    ...(existingRecord?.settings || {}),
    ...(settings || {}),
    ...(smtpSettings ? { smtpSettings } : {}),
    ...(imapSettings ? { imapSettings } : {}),
  };

  if (existingRecord?.id) {
    return supabase
      .from(tableName)
      .update({ settings: mergedSettings })
      .eq("property_id", propertyId)
      .select()
      .single();
  }

  return supabase
    .from(tableName)
    .insert({
      property_id: propertyId,
      settings: mergedSettings,
    })
    .select()
    .single();
}

async function verifyUserPropertyAccess(supabase: any, propertyId: string): Promise<boolean> {
  let user: any = null;

  const {
    data: { user: cookieUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (!authError && cookieUser) {
    user = cookieUser;
  }

  if (!user) {
    return false;
  }

  const userEmail = typeof user.email === "string" ? user.email.toLowerCase() : null;

  if (authError || !user) {
    return false;
  }

  const { data: fromUsers } = await supabaseAdmin
    .from("users")
    .select("property_id")
    .eq("id", user.id)
    .maybeSingle();

  if (fromUsers?.property_id === propertyId) {
    return true;
  }

  const { data: fromTeamMembers } = await supabaseAdmin
    .from("team_members")
    .select("property_id")
    .eq("id", user.id)
    .maybeSingle();

  if (fromTeamMembers?.property_id === propertyId) {
    return true;
  }

  // Some datasets link team members by email instead of auth uid.
  if (userEmail) {
    const { data: fromTeamMembersByEmail } = await supabaseAdmin
      .from("team_members")
      .select("property_id")
      .ilike("email", userEmail)
      .maybeSingle();

    if (fromTeamMembersByEmail?.property_id === propertyId) {
      return true;
    }
  }

  return false;
}

async function verifyUserPropertyAccessFromRequest(
  supabase: any,
  request: NextRequest,
  propertyId: string
): Promise<boolean> {
  const hasCookieAccess = await verifyUserPropertyAccess(supabase, propertyId);
  if (hasCookieAccess) {
    return true;
  }

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return false;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return false;
  }

  const user = data.user;

  const { data: fromUsers } = await supabaseAdmin
    .from("users")
    .select("property_id")
    .eq("id", user.id)
    .maybeSingle();

  if (fromUsers?.property_id === propertyId) {
    return true;
  }

  const { data: fromTeamMembers } = await supabaseAdmin
    .from("team_members")
    .select("property_id")
    .eq("id", user.id)
    .maybeSingle();

  if (fromTeamMembers?.property_id === propertyId) {
    return true;
  }

  const userEmail = typeof user.email === "string" ? user.email.toLowerCase() : null;
  if (userEmail) {
    const { data: fromTeamMembersByEmail } = await supabaseAdmin
      .from("team_members")
      .select("property_id")
      .ilike("email", userEmail)
      .maybeSingle();

    if (fromTeamMembersByEmail?.property_id === propertyId) {
      return true;
    }
  }

  return false;
}

/**
 * GET Handler - Retrieve communication channel settings for a property
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    if (!propertyId) {
      return NextResponse.json(
        { error: "Property ID is required" },
        { status: 400 }
      );
    }

    const hasAccess = await verifyUserPropertyAccessFromRequest(supabase, request, propertyId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized - property access denied" },
        { status: 403 }
      );
    }

    // Fetch communication channel settings for the property
    const { data, error } = await getChannelSettingsRecord(supabase, propertyId, "*");

    if (error) {
      console.error("Error fetching settings:", error);
      return NextResponse.json({ settings: {} }, { status: 200 });
    }

    return NextResponse.json(
      { settings: data?.settings || {} },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error in GET handler:", error);
    return NextResponse.json(
      { settings: {} },
      { status: 200 }
    );
  }
}

/**
 * POST Handler - Save communication channel settings for a property
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Parse request body
    const body = await request.json();
    const { action, settings, propertyId, smtpSettings, imapSettings } = body;

    console.log("POST request received:", {
      action,
      propertyId,
      settingsKeys: Object.keys(settings || {}),
      hasSmtpSettings: !!smtpSettings,
      hasImapSettings: !!imapSettings,
    });

    if (!propertyId) {
      return NextResponse.json(
        { error: "Property ID is required" },
        { status: 400 }
      );
    }

    const hasAccess = await verifyUserPropertyAccessFromRequest(supabase, request, propertyId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized - property access denied" },
        { status: 403 }
      );
    }

    const normalized = await normalizeSecretsForProperty({
      propertyId,
      smtpSettings,
      imapSettings,
    });
    const normalizedSmtpSettings = normalized.smtpSettings;
    const normalizedImapSettings = normalized.imapSettings;

    if (action === "testSmtp") {
      if (!normalizedSmtpSettings?.smtpHost || !normalizedSmtpSettings?.smtpPort || !normalizedSmtpSettings?.smtpUser || !normalizedSmtpSettings?.smtpPass) {
        return NextResponse.json(
          { success: false, error: "Missing required SMTP fields" },
          { status: 200 }
        );
      }

      try {
        await verifySmtpConnection(normalizedSmtpSettings);
        return NextResponse.json(
          {
            success: true,
            message: "SMTP connection verified successfully",
            verifiedAt: new Date().toISOString(),
          },
          { status: 200 }
        );
      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: error?.message || "SMTP connection failed" },
          { status: 200 }
        );
      }
    }

    if (action === "testImap") {
      if (!normalizedImapSettings?.imapHost || !normalizedImapSettings?.imapPort || !normalizedImapSettings?.imapUser || !normalizedImapSettings?.imapPass) {
        return NextResponse.json(
          { success: false, error: "Missing required IMAP fields" },
          { status: 200 }
        );
      }

      try {
        await verifyImapConnection(normalizedImapSettings);
        return NextResponse.json(
          {
            success: true,
            message: "IMAP connection verified successfully",
            verifiedAt: new Date().toISOString(),
          },
          { status: 200 }
        );
      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: error?.message || "IMAP connection failed" },
          { status: 200 }
        );
      }
    }

    if (!settings || typeof settings !== "object") {
      return NextResponse.json(
        { error: "Invalid settings payload" },
        { status: 400 }
      );
    }

    const result = await saveChannelSettings({
      supabase,
      propertyId,
      settings,
      smtpSettings: normalizedSmtpSettings,
      imapSettings: normalizedImapSettings,
    });

    const { data, error } = result;

    if (error) {
      console.error("Error saving settings:", error);
      return NextResponse.json(
        { error: "Failed to save settings", details: error.message },
        { status: 500 }
      );
    }

    console.log("Settings saved successfully for propertyId:", propertyId);
    return NextResponse.json(
      {
        success: true,
        message: "Settings saved successfully",
        settings: data?.settings,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Unexpected error in POST handler:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
