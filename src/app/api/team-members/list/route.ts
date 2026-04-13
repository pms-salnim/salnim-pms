import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);
    
    const propertyId = searchParams.get("property_id");
    const status = searchParams.get("status");
    const role = searchParams.get("role");
    const search = searchParams.get("search");

    if (!propertyId) {
      return NextResponse.json(
        { error: "property_id is required" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("team_members")
      .select("*")
      .eq("property_id", propertyId);

    if (status) {
      query = query.eq("status", status);
    }

    if (role) {
      query = query.eq("role", role);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        {
          error: "Failed to fetch team members",
          details: error.message,
        },
        { status: 500 }
      );
    }

    // Transform snake_case to camelCase
    const transformedData = data?.map((member) => ({
      id: member.id,
      propertyId: member.property_id,
      email: member.email,
      fullName: member.full_name,
      phone: member.phone,
      role: member.role,
      permissions: member.permissions,
      status: member.status,
      lastLogin: member.last_login ? new Date(member.last_login) : null,
      createdBy: member.created_by,
      createdAt: new Date(member.created_at),
      updatedAt: new Date(member.updated_at),
    })) || [];

    // Apply search filter on client-transformed data if provided
    const filteredData = search
      ? transformedData.filter(
          (member) =>
            member.fullName.toLowerCase().includes(search.toLowerCase()) ||
            member.email.toLowerCase().includes(search.toLowerCase()) ||
            member.phone?.toLowerCase().includes(search.toLowerCase())
        )
      : transformedData;

    return NextResponse.json({
      teamMembers: filteredData,
      count: filteredData.length,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
