/**
 * Guest Portal Settings API Routes
 * GET: Fetch guest portals for property
 * POST: Save guest portal settings
 * DELETE: Delete guest portal
 * 
 * Authentication: Uses cookie-based Supabase SSR pattern
 */

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET Handler - Retrieve guest portals for a property
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

    // Fetch all portals for the property
    const { data, error } = await supabase
      .from("guest_portals")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching portals:", error);
      return NextResponse.json({ portals: [] }, { status: 200 });
    }

    // Transform snake_case from DB to camelCase for frontend
    const transformedPortals = (data || []).map((portal: any) => ({
      id: portal.id,
      general: {
        portalName: portal.portal_name,
        enabled: portal.enabled,
        properties: portal.properties || [],
        roomTypes: portal.room_types || [],
        defaultPortal: portal.default_portal,
        customDomain: portal.custom_domain,
        customDomainFull: portal.custom_domain_full,
        shortLinkEnabled: portal.short_link_enabled,
        preArrivalDays: portal.pre_arrival_days,
        postDepartureDays: portal.post_departure_days,
        permanentAccessEnabled: portal.permanent_access_enabled,
        maintenanceMode: portal.maintenance_mode,
        testMode: portal.test_mode,
        globalKillSwitch: portal.global_kill_switch,
        authenticationMethod: portal.authentication_method,
        magicLinkExpiration: portal.magic_link_expiration,
        manualLoginFields: portal.manual_login_fields || [],
        keepLoggedInEnabled: portal.keep_logged_in_enabled,
        deviceLimit: portal.device_limit,
        autoSendLinkTiming: portal.auto_send_link_timing,
        autoSendTriggers: portal.auto_send_triggers || [],
        pmsSyncStatus: portal.pms_sync_status,
      },
      branding: {
        logo: portal.logo,
        darkLogo: portal.dark_logo,
        favicon: portal.favicon,
        primaryColor: portal.primary_color,
        accentColor: portal.accent_color,
        backgroundColor: portal.background_color,
        fontFamily: portal.font_family,
        darkModeEnabled: portal.dark_mode_enabled,
        welcomeTitle: portal.welcome_title,
        welcomeMessage: portal.welcome_message,
        heroImages: portal.hero_images || [],
        heroCaptions: portal.hero_captions || [],
        contactPhone: portal.contact_phone,
        contactWhatsApp: portal.contact_whatsapp,
        contactEmail: portal.contact_email,
        socialLinks: portal.social_links || {},
        footerText: portal.footer_text,
        copyrightText: portal.copyright_text,
        legalLinks: portal.legal_links || [],
      },
      navigation: {
        menuItems: portal.menu_items || [],
        builtInPages: portal.built_in_pages || {},
        customPages: portal.custom_pages || [],
        quickLinks: portal.quick_links || [],
      },
      features: {
        digitalCheckInEnabled: portal.digital_check_in_enabled,
        checkInSteps: portal.check_in_steps || {},
        checkInTimeWindow: portal.check_in_time_window,
        mobileKeyEnabled: portal.mobile_key_enabled,
        accessCodeDelivery: portal.access_code_delivery,
        inPortalChat: portal.in_portal_chat,
        folioViewEnabled: portal.folio_view_enabled,
        upsellMarketplaceEnabled: portal.upsell_marketplace_enabled,
        reviewRequestTiming: portal.review_request_timing,
        checkoutFlowEnabled: portal.checkout_flow_enabled,
        qrCodeSettingsEnabled: portal.qr_code_settings_enabled,
      },
      languages: {
        availableLanguages: portal.available_languages || [],
        defaultLanguage: portal.default_language,
        autoDetect: portal.auto_detect,
        autoTranslateEnabled: portal.auto_translate_enabled,
        translationCompletion: portal.translation_completion || {},
      },
      advanced: {
        dataRetention: portal.data_retention,
        httpsEnforced: portal.https_enforced,
        analyticPixel: portal.analytic_pixel,
        customCss: portal.custom_css,
        customJs: portal.custom_js,
      },
      createdAt: portal.created_at,
      updatedAt: portal.updated_at,
    }));

    return NextResponse.json(
      { portals: transformedPortals },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error in GET handler:", error);
    return NextResponse.json(
      { portals: [] },
      { status: 200 }
    );
  }
}

/**
 * POST Handler - Save guest portal settings
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Parse request body
    const body = await request.json();
    const { portal, propertyId } = body;

    if (!portal || !propertyId) {
      return NextResponse.json(
        { error: "Portal data and Property ID are required" },
        { status: 400 }
      );
    }

    // Transform camelCase from frontend to snake_case for DB
    const portalData = {
      property_id: propertyId,
      portal_id: portal.id,
      portal_name: portal.general?.portalName,
      enabled: portal.general?.enabled,
      default_portal: portal.general?.defaultPortal,
      properties: portal.general?.properties || [],
      room_types: portal.general?.roomTypes || [],
      custom_domain: portal.general?.customDomain,
      custom_domain_full: portal.general?.customDomainFull,
      short_link_enabled: portal.general?.shortLinkEnabled,
      pre_arrival_days: portal.general?.preArrivalDays,
      post_departure_days: portal.general?.postDepartureDays,
      permanent_access_enabled: portal.general?.permanentAccessEnabled,
      maintenance_mode: portal.general?.maintenanceMode,
      test_mode: portal.general?.testMode,
      global_kill_switch: portal.general?.globalKillSwitch,
      authentication_method: portal.general?.authenticationMethod,
      magic_link_expiration: portal.general?.magicLinkExpiration,
      manual_login_fields: portal.general?.manualLoginFields || [],
      keep_logged_in_enabled: portal.general?.keepLoggedInEnabled,
      device_limit: portal.general?.deviceLimit,
      auto_send_link_timing: portal.general?.autoSendLinkTiming,
      auto_send_triggers: portal.general?.autoSendTriggers || [],
      pms_sync_status: portal.general?.pmsSyncStatus,

      // Branding
      logo: portal.branding?.logo,
      dark_logo: portal.branding?.darkLogo,
      favicon: portal.branding?.favicon,
      primary_color: portal.branding?.primaryColor,
      accent_color: portal.branding?.accentColor,
      background_color: portal.branding?.backgroundColor,
      font_family: portal.branding?.fontFamily,
      dark_mode_enabled: portal.branding?.darkModeEnabled,
      welcome_title: portal.branding?.welcomeTitle,
      welcome_message: portal.branding?.welcomeMessage,
      hero_images: portal.branding?.heroImages || [],
      hero_captions: portal.branding?.heroCaptions || [],
      contact_phone: portal.branding?.contactPhone,
      contact_whatsapp: portal.branding?.contactWhatsApp,
      contact_email: portal.branding?.contactEmail,
      social_links: portal.branding?.socialLinks || {},
      footer_text: portal.branding?.footerText,
      copyright_text: portal.branding?.copyrightText,
      legal_links: portal.branding?.legalLinks || [],

      // Navigation
      menu_items: portal.navigation?.menuItems || [],
      built_in_pages: portal.navigation?.builtInPages || {},
      custom_pages: portal.navigation?.customPages || [],
      quick_links: portal.navigation?.quickLinks || [],

      // Features
      digital_check_in_enabled: portal.features?.digitalCheckInEnabled,
      check_in_steps: portal.features?.checkInSteps || {},
      check_in_time_window: portal.features?.checkInTimeWindow,
      mobile_key_enabled: portal.features?.mobileKeyEnabled,
      access_code_delivery: portal.features?.accessCodeDelivery,
      in_portal_chat: portal.features?.inPortalChat,
      folio_view_enabled: portal.features?.folioViewEnabled,
      upsell_marketplace_enabled: portal.features?.upsellMarketplaceEnabled,
      review_request_timing: portal.features?.reviewRequestTiming,
      checkout_flow_enabled: portal.features?.checkoutFlowEnabled,
      qr_code_settings_enabled: portal.features?.qrCodeSettingsEnabled,

      // Languages
      available_languages: portal.languages?.availableLanguages || [],
      default_language: portal.languages?.defaultLanguage,
      auto_detect: portal.languages?.autoDetect,
      auto_translate_enabled: portal.languages?.autoTranslateEnabled,
      translation_completion: portal.languages?.translationCompletion || {},

      // Advanced
      data_retention: portal.advanced?.dataRetention,
      https_enforced: portal.advanced?.httpsEnforced,
      analytic_pixel: portal.advanced?.analyticPixel,
      custom_css: portal.advanced?.customCss,
      custom_js: portal.advanced?.customJs,
    };

    // Upsert portal (update if exists, insert if not)
    const { error: upsertError } = await supabase
      .from("guest_portals")
      .upsert(portalData, { onConflict: "property_id,portal_id" });

    if (upsertError) {
      console.error("Error saving portal:", upsertError);
      return NextResponse.json(
        { error: "Failed to save portal", details: upsertError.message },
        { status: 500 }
      );
    }

    console.log("Portal saved successfully for propertyId:", propertyId);
    return NextResponse.json(
      {
        message: "Portal saved successfully",
        portal_id: portal.id,
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
 * DELETE Handler - Delete guest portal
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    const portalId = searchParams.get("portalId");

    if (!propertyId || !portalId) {
      return NextResponse.json(
        { error: "Property ID and Portal ID are required" },
        { status: 400 }
      );
    }

    // Delete portal
    const { error: deleteError } = await supabase
      .from("guest_portals")
      .delete()
      .eq("property_id", propertyId)
      .eq("id", portalId);

    if (deleteError) {
      console.error("Error deleting portal:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete portal", details: deleteError.message },
        { status: 500 }
      );
    }

    console.log("Portal deleted successfully for propertyId:", propertyId);
    return NextResponse.json(
      {
        message: "Portal deleted successfully",
        portal_id: portalId,
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
