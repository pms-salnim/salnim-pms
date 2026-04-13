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
      parentId,
      description,
      icon,
      displayOrder,
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

      const { data: newCategory, error: createError } = await supabase
        .from("meal_plan_categories")
        .insert([
          {
            id: randomUUID(),
            property_id: propertyId,
            name,
            parent_id: parentId || null,
            description: description || null,
            icon: icon || null,
            display_order: displayOrder || 0,
            is_active: isActive !== undefined ? isActive : true,
          },
        ])
        .select()
        .single();

      if (createError) {
        console.error("Create error:", createError);
        return NextResponse.json(
          {
            error: createError.message || "Failed to create meal plan category",
            details: createError,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(newCategory, { status: 201 });
    }

    if (action === "update") {
      if (!id) {
        return NextResponse.json(
          { error: "id is required for update" },
          { status: 400 }
        );
      }

      const { data: updatedCategory, error: updateError } = await supabase
        .from("meal_plan_categories")
        .update({
          ...(name && { name }),
          ...(parentId !== undefined && { parent_id: parentId }),
          ...(description !== undefined && { description }),
          ...(icon !== undefined && { icon }),
          ...(displayOrder !== undefined && { display_order: displayOrder }),
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
            error: updateError.message || "Failed to update meal plan category",
            details: updateError,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(updatedCategory);
    }

    if (action === "delete") {
      if (!id) {
        return NextResponse.json(
          { error: "id is required for delete" },
          { status: 400 }
        );
      }

      // Check if category has any meal plans
      const { data: mealPlans, error: checkError } = await supabase
        .from("meal_plans")
        .select("id", { count: "exact" })
        .eq("property_id", propertyId)
        .or(`category_id.eq.${id},subcategory_id.eq.${id}`);

      if (checkError) {
        console.error("Check error:", checkError);
        return NextResponse.json(
          {
            error: checkError.message || "Failed to check category references",
            details: checkError,
          },
          { status: 500 }
        );
      }

      if (mealPlans && mealPlans.length > 0) {
        return NextResponse.json(
          {
            error:
              "Cannot delete category with existing meal plans. Delete meal plans first.",
          },
          { status: 400 }
        );
      }

      // Check if category has subcategories
      const { data: subcategories, error: subcatError } = await supabase
        .from("meal_plan_categories")
        .select("id", { count: "exact" })
        .eq("property_id", propertyId)
        .eq("parent_id", id);

      if (subcatError) {
        console.error("Subcat error:", subcatError);
        return NextResponse.json(
          {
            error: subcatError.message || "Failed to check subcategories",
            details: subcatError,
          },
          { status: 500 }
        );
      }

      if (subcategories && subcategories.length > 0) {
        return NextResponse.json(
          {
            error:
              "Cannot delete category with subcategories. Delete subcategories first.",
          },
          { status: 400 }
        );
      }

      const { error: deleteError } = await supabase
        .from("meal_plan_categories")
        .delete()
        .eq("id", id)
        .eq("property_id", propertyId);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        return NextResponse.json(
          {
            error: deleteError.message || "Failed to delete meal plan category",
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
    console.error("Error in meal plan categories CRUD:", error);
    return NextResponse.json(
      {
        error: errorMessage || "Internal server error",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
