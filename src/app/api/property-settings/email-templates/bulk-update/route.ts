/**
 * Email Template Bulk Update API Route
 * POST: Update multiple email templates (enable/disable)
 * 
 * Authentication: Uses cookie-based Supabase SSR pattern
 */

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST Handler - Bulk update email templates (enable/disable)
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Parse request body
    const body = await request.json();
    const { propertyId, templateIds, enabled } = body;

    console.log("Bulk update request received:", { propertyId, templateCount: templateIds?.length, enabled });

    if (!propertyId || !Array.isArray(templateIds) || templateIds.length === 0) {
      return NextResponse.json(
        { error: "Property ID and template IDs array are required" },
        { status: 400 }
      );
    }

    if (enabled === undefined) {
      return NextResponse.json(
        { error: "Enabled field is required" },
        { status: 400 }
      );
    }

    // Update templates
    const { error: updateError } = await supabase
      .from("email_templates")
      .update({
        enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("property_id", propertyId)
      .in("template_id", templateIds);

    if (updateError) {
      console.error("Error updating templates:", updateError);
      return NextResponse.json(
        { error: "Failed to update templates", details: updateError.message },
        { status: 500 }
      );
    }

    console.log("Templates updated successfully for propertyId:", propertyId);
    return NextResponse.json(
      {
        message: "Templates updated successfully",
        count: templateIds.length,
        enabled,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Unexpected error in bulk-update handler:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
