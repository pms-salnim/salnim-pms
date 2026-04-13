import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");
    const categoryId = searchParams.get("category_id");
    const subcategoryId = searchParams.get("subcategory_id");
    const status = searchParams.get("status");
    const bookingOnly = searchParams.get("booking_only");
    const portalOnly = searchParams.get("portal_only");

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
      .from("meal_plans")
      .select(
        `
        *,
        category:category_id(id, name),
        subcategory:subcategory_id(id, name)
      `
      )
      .eq("property_id", propertyId);

    // Apply filters
    if (categoryId && categoryId !== "all") {
      query = query.eq("category_id", categoryId);
    }

    if (subcategoryId && subcategoryId !== "all") {
      query = query.eq("subcategory_id", subcategoryId);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (bookingOnly === "true") {
      query = query.eq("visible_on_booking", true);
    }

    if (portalOnly === "true") {
      query = query.eq("visible_in_guest_portal", true);
    }

    const { data: mealPlans, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        {
          error: error.message || "Failed to fetch meal plans",
          details: error,
        },
        { status: 500 }
      );
    }

    // Transform data: snake_case to camelCase
    const transformedMealPlans = mealPlans?.map((plan: any) => ({
      id: plan.id,
      propertyId: plan.property_id,
      name: plan.name,
      description: plan.description,
      shortDescription: plan.short_description,
      fullDescription: plan.full_description,
      pricePerNight: plan.price_per_night,
      mealsIncluded: plan.meals_included,
      categoryId: plan.category_id,
      categoryName: plan.category?.name,
      subcategoryId: plan.subcategory_id,
      subcategoryName: plan.subcategory?.name,
      mealPlanType: plan.meal_plan_type,
      includedMeals: plan.included_meals,
      pricingModel: plan.pricing_model,
      basePrice: plan.base_price,
      adultPrice: plan.adult_price,
      childPrice: plan.child_price,
      infantPrice: plan.infant_price,
      infantFree: plan.infant_free,
      enableAgePricing: plan.enable_age_pricing,
      availableDatesStart: plan.available_dates_start
        ? new Date(plan.available_dates_start)
        : null,
      availableDatesEnd: plan.available_dates_end
        ? new Date(plan.available_dates_end)
        : null,
      minimumStay: plan.minimum_stay,
      blackoutDates: plan.blackout_dates,
      cancellationPolicy: plan.cancellation_policy,
      upgradeAllowed: plan.upgrade_allowed,
      applicableRoomTypes: plan.applicable_room_types,
      applicableRatePlans: plan.applicable_rate_plans,
      isDefault: plan.is_default,
      visibleOnBooking: plan.visible_on_booking,
      visibleInGuestPortal: plan.visible_in_guest_portal,
      status: plan.status,
      isActive: plan.is_active,
      createdAt: new Date(plan.created_at),
      updatedAt: new Date(plan.updated_at),
    }));

    return NextResponse.json(transformedMealPlans);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching meal plans:", error);
    return NextResponse.json(
      {
        error: errorMessage || "Internal server error",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
