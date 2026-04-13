import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, propertyId, data } = body;

    if (!action || !propertyId) {
      return NextResponse.json(
        { error: "action and propertyId are required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // CREATE action
    if (action === "create") {
      if (!data?.email || !data?.fullName) {
        return NextResponse.json(
          { error: "email and fullName are required" },
          { status: 400 }
        );
      }

      if (!data?.password) {
        return NextResponse.json(
          { error: "password is required for new team members" },
          { status: 400 }
        );
      }

      console.log('Creating team member:', { 
        email: data.email, 
        status: data.status,
        role: data.role 
      });

      try {
        // Step 1: Create authentication user
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: data.email,
          password: data.password,
          email_confirm: true,
          user_metadata: {
            full_name: data.fullName,
            property_id: propertyId,
          },
        });

        if (authError) {
          console.error("Auth creation error:", authError);
          return NextResponse.json(
            {
              error: "Failed to create authentication user",
              details: authError.message,
            },
            { status: 500 }
          );
        }

        if (!authUser?.user?.id) {
          return NextResponse.json(
            {
              error: "Failed to create authentication user - no user ID",
            },
            { status: 500 }
          );
        }

        // Step 2: Create team member record with auth user ID
        const { data: result, error: dbError } = await supabase
          .from("team_members")
          .insert([
            {
              id: authUser.user.id,
              property_id: propertyId,
              email: data.email,
              full_name: data.fullName,
              phone: data.phone || null,
              role: data.role || "staff",
              permissions: data.permissions || {},
              status: data.status || "Active",
              created_by: data.createdBy || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (dbError) {
          console.error("Database insert error:", dbError);
          // Attempt to delete the created auth user if DB insert fails
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          return NextResponse.json(
            {
              error: "Failed to create team member record",
              details: dbError.message,
            },
            { status: 500 }
          );
        }

        return NextResponse.json({
          id: result.id,
          propertyId: result.property_id,
          email: result.email,
          fullName: result.full_name,
          phone: result.phone,
          role: result.role,
          permissions: result.permissions,
          status: result.status,
          lastLogin: result.last_login,
          createdBy: result.created_by,
          createdAt: new Date(result.created_at),
          updatedAt: new Date(result.updated_at),
        });
      } catch (innerError) {
        console.error("Unexpected error during create:", innerError);
        return NextResponse.json(
          {
            error: "Unexpected error during team member creation",
            details: innerError instanceof Error ? innerError.message : "Unknown error",
          },
          { status: 500 }
        );
      }
    }

    // UPDATE action
    if (action === "update") {
      if (!data?.id) {
        return NextResponse.json(
          { error: "id is required for update" },
          { status: 400 }
        );
      }

      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (data.email) updatePayload.email = data.email;
      if (data.fullName) updatePayload.full_name = data.fullName;
      if (data.phone !== undefined) updatePayload.phone = data.phone;
      if (data.role) updatePayload.role = data.role;
      if (data.permissions) updatePayload.permissions = data.permissions;
      if (data.status) updatePayload.status = data.status;

      const { data: result, error } = await supabase
        .from("team_members")
        .update(updatePayload)
        .eq("id", data.id)
        .eq("property_id", propertyId)
        .select()
        .single();

      if (error) {
        console.error("Supabase update error:", error);
        return NextResponse.json(
          {
            error: "Failed to update team member",
            details: error.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        id: result.id,
        propertyId: result.property_id,
        email: result.email,
        fullName: result.full_name,
        phone: result.phone,
        role: result.role,
        permissions: result.permissions,
        status: result.status,
        lastLogin: result.last_login,
        createdBy: result.created_by,
        createdAt: new Date(result.created_at),
        updatedAt: new Date(result.updated_at),
      });
    }

    // DELETE action
    if (action === "delete") {
      if (!data?.id) {
        return NextResponse.json(
          { error: "id is required for delete" },
          { status: 400 }
        );
      }

      try {
        // Step 1: Delete team member record from database
        const { error: dbError } = await supabase
          .from("team_members")
          .delete()
          .eq("id", data.id)
          .eq("property_id", propertyId);

        if (dbError) {
          console.error("Supabase delete error:", dbError);
          return NextResponse.json(
            {
              error: "Failed to delete team member",
              details: dbError.message,
            },
            { status: 500 }
          );
        }

        // Step 2: Delete auth user
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(data.id);

        if (authError) {
          console.error("Auth deletion error:", authError);
          // Log but don't fail - DB record is already deleted
          console.warn(`Auth user ${data.id} could not be deleted: ${authError.message}`);
        }

        return NextResponse.json({
          success: true,
          message: "Team member deleted successfully",
        });
      } catch (innerError) {
        console.error("Unexpected error during delete:", innerError);
        return NextResponse.json(
          {
            error: "Unexpected error during deletion",
            details: innerError instanceof Error ? innerError.message : "Unknown error",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
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
