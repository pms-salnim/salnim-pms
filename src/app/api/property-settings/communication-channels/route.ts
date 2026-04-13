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
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

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

    // Fetch communication channel settings for the property
    const { data, error } = await supabase
      .from("communication_channel_settings")
      .select("*")
      .eq("property_id", propertyId)
      .maybeSingle();

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
    const { settings, propertyId } = body;

    console.log("POST request received:", { propertyId, settingsKeys: Object.keys(settings || {}) });

    if (!settings || typeof settings !== "object") {
      return NextResponse.json(
        { error: "Invalid settings payload" },
        { status: 400 }
      );
    }

    if (!propertyId) {
      return NextResponse.json(
        { error: "Property ID is required" },
        { status: 400 }
      );
    }

    // Check if record already exists
    const { data: existingRecord, error: checkError } = await supabase
      .from("communication_channel_settings")
      .select("id")
      .eq("property_id", propertyId)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing settings:", checkError);
    }

    let result;
    if (existingRecord?.id) {
      // Update existing record
      console.log("Updating existing record for propertyId:", propertyId);
      result = await supabase
        .from("communication_channel_settings")
        .update({
          settings: settings,
        })
        .eq("property_id", propertyId)
        .select()
        .single();
    } else {
      // Insert new record
      console.log("Inserting new record for propertyId:", propertyId);
      result = await supabase
        .from("communication_channel_settings")
        .insert({
          property_id: propertyId,
          settings: settings,
        })
        .select()
        .single();
    }

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
