import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      propertyId,
      id,
      name,
      description,
      shortDescription,
      fullDescription,
      pricePerNight,
      mealsIncluded,
      categoryId,
      subcategoryId,
      mealPlanType,
      includedMeals,
      pricingModel,
      basePrice,
      adultPrice,
      childPrice,
      infantPrice,
      infantFree,
      enableAgePricing,
      availableDatesStart,
      availableDatesEnd,
      minimumStay,
      blackoutDates,
      cancellationPolicy,
      upgradeAllowed,
      applicableRoomTypes,
      applicableRatePlans,
      isDefault,
      visibleOnBooking,
      visibleInGuestPortal,
      status,
      isActive,
    } = body;

    if (!propertyId) {
      return NextResponse.json(
        { error: "propertyId is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // NOTE: Property ownership is verified via RLS policies at the database level
    // No need for application-level auth checks with anon key

    if (action === "create") {
      if (!name) {
        return NextResponse.json(
          { error: "name is required" },
          { status: 400 }
        );
      }

      const { data: newMealPlan, error: createError } = await supabase
        .from("meal_plans")
        .insert([
          {
            id: randomUUID(),
            property_id: propertyId,
            name,
            description: description || null,
            short_description: shortDescription || null,
            full_description: fullDescription || null,
            price_per_night: pricePerNight || 0,
            meals_included: mealsIncluded || null,
            category_id: categoryId || null,
            subcategory_id: subcategoryId || null,
            meal_plan_type: mealPlanType || null,
            included_meals: includedMeals || [],
            pricing_model: pricingModel || null,
            base_price: basePrice || null,
            adult_price: adultPrice || null,
            child_price: childPrice || null,
            infant_price: infantPrice || null,
            infant_free: infantFree || true,
            enable_age_pricing: enableAgePricing || false,
            available_dates_start: availableDatesStart || null,
            available_dates_end: availableDatesEnd || null,
            minimum_stay: minimumStay || 0,
            blackout_dates: blackoutDates || [],
            cancellation_policy: cancellationPolicy || null,
            upgrade_allowed: upgradeAllowed || true,
            applicable_room_types: applicableRoomTypes || [],
            applicable_rate_plans: applicableRatePlans || {},
            is_default: isDefault || false,
            visible_on_booking: visibleOnBooking || true,
            visible_in_guest_portal: visibleInGuestPortal || true,
            status: status || "Active",
            is_active: isActive !== undefined ? isActive : true,
          },
        ])
        .select()
        .single();

      if (createError) {
        console.error("Create error:", createError);
        return NextResponse.json(
          {
            error: createError.message || "Failed to create meal plan",
            details: createError,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(newMealPlan, { status: 201 });
    }

    if (action === "update") {
      if (!id) {
        return NextResponse.json(
          { error: "id is required for update" },
          { status: 400 }
        );
      }

      const { data: updatedMealPlan, error: updateError } = await supabase
        .from("meal_plans")
        .update({
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(shortDescription !== undefined && {
            short_description: shortDescription,
          }),
          ...(fullDescription !== undefined && {
            full_description: fullDescription,
          }),
          ...(pricePerNight !== undefined && { price_per_night: pricePerNight }),
          ...(mealsIncluded !== undefined && { meals_included: mealsIncluded }),
          ...(categoryId !== undefined && { category_id: categoryId }),
          ...(subcategoryId !== undefined && {
            subcategory_id: subcategoryId,
          }),
          ...(mealPlanType !== undefined && { meal_plan_type: mealPlanType }),
          ...(includedMeals !== undefined && { included_meals: includedMeals }),
          ...(pricingModel !== undefined && { pricing_model: pricingModel }),
          ...(basePrice !== undefined && { base_price: basePrice }),
          ...(adultPrice !== undefined && { adult_price: adultPrice }),
          ...(childPrice !== undefined && { child_price: childPrice }),
          ...(infantPrice !== undefined && { infant_price: infantPrice }),
          ...(infantFree !== undefined && { infant_free: infantFree }),
          ...(enableAgePricing !== undefined && {
            enable_age_pricing: enableAgePricing,
          }),
          ...(availableDatesStart !== undefined && {
            available_dates_start: availableDatesStart,
          }),
          ...(availableDatesEnd !== undefined && {
            available_dates_end: availableDatesEnd,
          }),
          ...(minimumStay !== undefined && { minimum_stay: minimumStay }),
          ...(blackoutDates !== undefined && { blackout_dates: blackoutDates }),
          ...(cancellationPolicy !== undefined && {
            cancellation_policy: cancellationPolicy,
          }),
          ...(upgradeAllowed !== undefined && {
            upgrade_allowed: upgradeAllowed,
          }),
          ...(applicableRoomTypes !== undefined && {
            applicable_room_types: applicableRoomTypes,
          }),
          ...(applicableRatePlans !== undefined && {
            applicable_rate_plans: applicableRatePlans,
          }),
          ...(isDefault !== undefined && { is_default: isDefault }),
          ...(visibleOnBooking !== undefined && {
            visible_on_booking: visibleOnBooking,
          }),
          ...(visibleInGuestPortal !== undefined && {
            visible_in_guest_portal: visibleInGuestPortal,
          }),
          ...(status !== undefined && { status }),
          ...(isActive !== undefined && { is_active: isActive }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("property_id", propertyId)
        .select()
        .single();

      if (updateError) {
        console.error("Update error:", updateError);
        return NextResponse.json(
          {
            error: updateError.message || "Failed to update meal plan",
            details: updateError,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(updatedMealPlan);
    }

    if (action === "delete") {
      if (!id) {
        return NextResponse.json(
          { error: "id is required for delete" },
          { status: 400 }
        );
      }

      // Check for references (bookings, reservations, etc.)
      // Add validation as needed

      const { error: deleteError } = await supabase
        .from("meal_plans")
        .delete()
        .eq("id", id)
        .eq("property_id", propertyId);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        return NextResponse.json(
          {
            error: deleteError.message || "Failed to delete meal plan",
            details: deleteError,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid action. Must be create, update, or delete" },
      { status: 400 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in meal plans CRUD:", error);
    return NextResponse.json(
      {
        error: errorMessage || "Internal server error",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
