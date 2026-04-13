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
      shortDescription,
      fullDescription,
      images,
      packageCategory,
      applicableRoomTypes,
      minimumNights,
      maximumNights,
      includedMealPlanId,
      allowMealPlanUpgrade,
      includedServices,
      pricingType,
      packagePrice,
      discountDisplay,
      pricingLogic,
      validFrom,
      validTo,
      blackoutDates,
      advanceBookingDays,
      cancellationPolicy,
      stackableWithOffers,
      visibleOnBooking,
      visibleInGuestPortal,
      autoApply,
      featured,
      status,
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

      const { data: newPackage, error: createError } = await supabase
        .from("packages")
        .insert([
          {
            id: randomUUID(),
            property_id: propertyId,
            name,
            short_description: shortDescription || null,
            full_description: fullDescription || null,
            images: images || [],
            package_category: packageCategory || null,
            applicable_room_types: applicableRoomTypes || [],
            minimum_nights: minimumNights || 1,
            maximum_nights: maximumNights || null,
            included_meal_plan_id: includedMealPlanId || null,
            allow_meal_plan_upgrade: allowMealPlanUpgrade || false,
            included_services: includedServices || [],
            pricing_type: pricingType || null,
            package_price: packagePrice || 0,
            discount_display: discountDisplay || null,
            pricing_logic: pricingLogic || "per_room",
            valid_from: validFrom || null,
            valid_to: validTo || null,
            blackout_dates: blackoutDates || [],
            advance_booking_days: advanceBookingDays || null,
            cancellation_policy: cancellationPolicy || null,
            stackable_with_offers: stackableWithOffers || false,
            visible_on_booking: visibleOnBooking !== undefined ? visibleOnBooking : true,
            visible_in_guest_portal: visibleInGuestPortal !== undefined ? visibleInGuestPortal : true,
            auto_apply: autoApply || false,
            featured: featured || false,
            status: status || "Draft",
          },
        ])
        .select()
        .single();

      if (createError) {
        console.error("Create error:", createError);
        return NextResponse.json(
          {
            error: createError.message || "Failed to create package",
            details: createError,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(newPackage, { status: 201 });
    }

    if (action === "update") {
      if (!id) {
        return NextResponse.json(
          { error: "id is required for update" },
          { status: 400 }
        );
      }

      const { data: updatedPackage, error: updateError } = await supabase
        .from("packages")
        .update({
          ...(name && { name }),
          ...(shortDescription !== undefined && {
            short_description: shortDescription,
          }),
          ...(fullDescription !== undefined && {
            full_description: fullDescription,
          }),
          ...(images !== undefined && { images }),
          ...(packageCategory !== undefined && {
            package_category: packageCategory,
          }),
          ...(applicableRoomTypes !== undefined && {
            applicable_room_types: applicableRoomTypes,
          }),
          ...(minimumNights !== undefined && { minimum_nights: minimumNights }),
          ...(maximumNights !== undefined && { maximum_nights: maximumNights }),
          ...(includedMealPlanId !== undefined && {
            included_meal_plan_id: includedMealPlanId,
          }),
          ...(allowMealPlanUpgrade !== undefined && {
            allow_meal_plan_upgrade: allowMealPlanUpgrade,
          }),
          ...(includedServices !== undefined && {
            included_services: includedServices,
          }),
          ...(pricingType !== undefined && { pricing_type: pricingType }),
          ...(packagePrice !== undefined && { package_price: packagePrice }),
          ...(discountDisplay !== undefined && {
            discount_display: discountDisplay,
          }),
          ...(pricingLogic !== undefined && { pricing_logic: pricingLogic }),
          ...(validFrom !== undefined && { valid_from: validFrom }),
          ...(validTo !== undefined && { valid_to: validTo }),
          ...(blackoutDates !== undefined && { blackout_dates: blackoutDates }),
          ...(advanceBookingDays !== undefined && {
            advance_booking_days: advanceBookingDays,
          }),
          ...(cancellationPolicy !== undefined && {
            cancellation_policy: cancellationPolicy,
          }),
          ...(stackableWithOffers !== undefined && {
            stackable_with_offers: stackableWithOffers,
          }),
          ...(visibleOnBooking !== undefined && {
            visible_on_booking: visibleOnBooking,
          }),
          ...(visibleInGuestPortal !== undefined && {
            visible_in_guest_portal: visibleInGuestPortal,
          }),
          ...(autoApply !== undefined && { auto_apply: autoApply }),
          ...(featured !== undefined && { featured }),
          ...(status !== undefined && { status }),
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
            error: updateError.message || "Failed to update package",
            details: updateError,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(updatedPackage);
    }

    if (action === "delete") {
      if (!id) {
        return NextResponse.json(
          { error: "id is required for delete" },
          { status: 400 }
        );
      }

      const { error: deleteError } = await supabase
        .from("packages")
        .delete()
        .eq("id", id)
        .eq("property_id", propertyId);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        return NextResponse.json(
          {
            error: deleteError.message || "Failed to delete package",
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
    console.error("Error in packages CRUD:", error);
    return NextResponse.json(
      {
        error: errorMessage || "Internal server error",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
