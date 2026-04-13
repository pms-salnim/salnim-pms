/**
 * Email Template Settings API Routes
 * GET: Fetch email templates for property
 * POST: Save email templates for property
 * 
 * Authentication: Uses cookie-based Supabase SSR pattern
 * Cookies set by Supabase middleware are automatically included in requests
 * No manual token extraction needed
 */

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET Handler - Retrieve email templates for a property
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

    // Fetch email templates for the property
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("property_id", propertyId);

    if (error) {
      console.error("Error fetching templates:", error);
      return NextResponse.json({ templates: [] }, { status: 200 });
    }

    return NextResponse.json(
      { templates: data || [] },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error in GET handler:", error);
    return NextResponse.json(
      { templates: [] },
      { status: 200 }
    );
  }
}

/**
 * POST Handler - Save individual email template for a property
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Parse request body
    const body = await request.json();
    const { template, propertyId } = body;

    console.log("POST request received:", { propertyId, templateId: template?.template_id });

    if (!template) {
      return NextResponse.json(
        { error: "Template data is required" },
        { status: 400 }
      );
    }

    if (!propertyId) {
      return NextResponse.json(
        { error: "Property ID is required" },
        { status: 400 }
      );
    }

    // Prepare template data
    const templateData = {
      property_id: propertyId,
      template_id: template.template_id,
      name: template.name || '',
      category: template.category || 'other',
      enabled: template.enabled !== undefined ? template.enabled : true,
      is_default: template.is_default || false,
      subject: template.subject || '',
      preheader_text: template.preheader_text || '',
      html_content: template.html_content || '',
      description: template.description || '',
      from_name: template.from_name || '',
      from_email: template.from_email || '',
      reply_to: template.reply_to || '',
      cc_list: template.cc_list || '',
      bcc_list: template.bcc_list || '',
      email_type: template.email_type || 'transactional',
      languages: template.languages || ['en'],
      signature_data: template.signature_social_media || {},
      created_at: template.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Upsert individual template
    const { error: upsertError } = await supabase
      .from("email_templates")
      .upsert(templateData, { onConflict: "property_id,template_id" });

    if (upsertError) {
      console.error("Error saving template:", upsertError);
      return NextResponse.json(
        { error: "Failed to save template", details: upsertError.message },
        { status: 500 }
      );
    }

    console.log("Template saved successfully for propertyId:", propertyId);
    return NextResponse.json(
      {
        message: "Template saved successfully",
        template_id: template.template_id,
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

/**
 * DELETE Handler - Delete individual email template
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    const templateId = searchParams.get("templateId");

    if (!propertyId || !templateId) {
      return NextResponse.json(
        { error: "Property ID and Template ID are required" },
        { status: 400 }
      );
    }

    // Delete template
    const { error: deleteError } = await supabase
      .from("email_templates")
      .delete()
      .eq("property_id", propertyId)
      .eq("template_id", templateId);

    if (deleteError) {
      console.error("Error deleting template:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete template", details: deleteError.message },
        { status: 500 }
      );
    }

    console.log("Template deleted successfully for propertyId:", propertyId);
    return NextResponse.json(
      {
        message: "Template deleted successfully",
        template_id: templateId,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Unexpected error in DELETE handler:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
