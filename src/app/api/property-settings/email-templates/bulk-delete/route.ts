/**
 * Email Template Bulk Delete API Route
 * POST: Delete multiple email templates
 * 
 * Authentication: Uses cookie-based Supabase SSR pattern
 */

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST Handler - Bulk delete email templates
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Parse request body
    const body = await request.json();
    const { propertyId, templateIds } = body;

    console.log("Bulk delete request received:", { propertyId, templateCount: templateIds?.length });

    if (!propertyId || !Array.isArray(templateIds) || templateIds.length === 0) {
      return NextResponse.json(
        { error: "Property ID and template IDs array are required" },
        { status: 400 }
      );
    }

    // Delete templates
    const { error: deleteError } = await supabase
      .from("email_templates")
      .delete()
      .eq("property_id", propertyId)
      .in("template_id", templateIds);

    if (deleteError) {
      console.error("Error deleting templates:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete templates", details: deleteError.message },
        { status: 500 }
      );
    }

    console.log("Templates deleted successfully for propertyId:", propertyId);
    return NextResponse.json(
      {
        message: "Templates deleted successfully",
        count: templateIds.length,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Unexpected error in bulk-delete handler:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
