import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const featured = searchParams.get("featured");

    if (!propertyId) {
      return NextResponse.json(
        { error: "property_id is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let query = supabase
      .from("packages")
      .select("*")
      .eq("property_id", propertyId);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (category && category !== "all") {
      query = query.eq("package_category", category);
    }

    if (featured === "true") {
      query = query.eq("featured", true);
    }

    const { data: packages, error } = await query;

    if (error) {
      console.error("Fetch error:", error);
      return NextResponse.json(
        {
          error: error.message || "Failed to fetch packages",
          details: error,
        },
        { status: 500 }
      );
    }

    // Transform snake_case to camelCase
    const transformedPackages = packages?.map((pkg: any) => ({
      id: pkg.id,
      propertyId: pkg.property_id,
      name: pkg.name,
      shortDescription: pkg.short_description,
      fullDescription: pkg.full_description,
      images: pkg.images,
      packageCategory: pkg.package_category,
      applicableRoomTypes: pkg.applicable_room_types,
      minimumNights: pkg.minimum_nights,
      maximumNights: pkg.maximum_nights,
      includedMealPlanId: pkg.included_meal_plan_id,
      allowMealPlanUpgrade: pkg.allow_meal_plan_upgrade,
      includedServices: pkg.included_services,
      pricingType: pkg.pricing_type,
      packagePrice: pkg.package_price,
      discountDisplay: pkg.discount_display,
      pricingLogic: pkg.pricing_logic,
      validFrom: pkg.valid_from ? new Date(pkg.valid_from) : null,
      validTo: pkg.valid_to ? new Date(pkg.valid_to) : null,
      blackoutDates: pkg.blackout_dates,
      advanceBookingDays: pkg.advance_booking_days,
      cancellationPolicy: pkg.cancellation_policy,
      stackableWithOffers: pkg.stackable_with_offers,
      visibleOnBooking: pkg.visible_on_booking,
      visibleInGuestPortal: pkg.visible_in_guest_portal,
      autoApply: pkg.auto_apply,
      featured: pkg.featured,
      status: pkg.status,
      createdAt: new Date(pkg.created_at),
      updatedAt: pkg.updated_at ? new Date(pkg.updated_at) : null,
    })) || [];

    return NextResponse.json(transformedPackages);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in packages list:", error);
    return NextResponse.json(
      {
        error: errorMessage || "Internal server error",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
