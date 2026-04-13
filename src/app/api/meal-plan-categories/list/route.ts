import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");
    const parentId = searchParams.get("parent_id");
    const isActive = searchParams.get("is_active");

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
      .from("meal_plan_categories")
      .select("*")
      .eq("property_id", propertyId)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    // Apply filters
    if (parentId !== null && parentId !== undefined) {
      if (parentId === "null") {
        query = query.is("parent_id", null);
      } else {
        query = query.eq("parent_id", parentId);
      }
    }

    if (isActive === "true") {
      query = query.eq("is_active", true);
    } else if (isActive === "false") {
      query = query.eq("is_active", false);
    }

    const { data: categories, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        {
          error: error.message || "Failed to fetch meal plan categories",
          details: error,
        },
        { status: 500 }
      );
    }

    // Transform data: snake_case to camelCase
    const transformedCategories = categories?.map((category: any) => ({
      id: category.id,
      propertyId: category.property_id,
      name: category.name,
      parentId: category.parent_id,
      description: category.description,
      icon: category.icon,
      displayOrder: category.display_order,
      isActive: category.is_active,
      createdAt: new Date(category.created_at),
      updatedAt: new Date(category.updated_at),
    }));

    return NextResponse.json(transformedCategories);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching meal plan categories:", error);
    return NextResponse.json(
      {
        error: errorMessage || "Internal server error",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
