/**
 * API Route: /api/service-categories/crud
 * Handle Create, Read, Update, Delete operations for service categories
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get auth token from header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    // Verify token
    const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !data.user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, propertyId, category, categoryId } = body;

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns this property
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('property_id')
      .eq('id', data.user.id)
      .single();

    if (userError || !userData || userData.property_id !== propertyId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // HANDLE CREATE ACTION
    if (action === 'create') {
      if (!category || !category.name) {
        return NextResponse.json(
          { error: 'Category name is required' },
          { status: 400 }
        );
      }

      try {
        const newCategory = {
          id: uuidv4(),
          property_id: propertyId,
          name: category.name.trim(),
          parent_id: category.parentId || null,
          description: category.description || null,
          sort_order: category.sortOrder || 0,
          is_active: category.isActive !== undefined ? category.isActive : true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: createdCategory, error: createError } = await supabaseAdmin
          .from('service_categories')
          .insert([newCategory])
          .select();

        if (createError) {
          console.error('Create error:', createError);
          return NextResponse.json(
            { error: createError.message || 'Failed to create category' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Category created successfully',
          data: createdCategory,
        });
      } catch (err: any) {
        console.error('Create exception:', err);
        return NextResponse.json(
          { error: err.message || 'Failed to create category' },
          { status: 500 }
        );
      }
    }

    // HANDLE UPDATE ACTION
    if (action === 'update') {
      if (!categoryId || !category || !category.name) {
        return NextResponse.json(
          { error: 'Category ID and category name are required' },
          { status: 400 }
        );
      }

      try {
        const updatePayload = {
          name: category.name.trim(),
          parent_id: category.parentId || null,
          description: category.description || null,
          sort_order: category.sortOrder || 0,
          is_active: category.isActive !== undefined ? category.isActive : true,
          updated_at: new Date().toISOString(),
        };

        const { data: updatedCategory, error: updateError } = await supabaseAdmin
          .from('service_categories')
          .update(updatePayload)
          .eq('id', categoryId)
          .eq('property_id', propertyId)
          .select();

        if (updateError) {
          console.error('Update error:', updateError);
          return NextResponse.json(
            { error: updateError.message || 'Failed to update category' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Category updated successfully',
          data: updatedCategory,
        });
      } catch (err: any) {
        console.error('Update exception:', err);
        return NextResponse.json(
          { error: err.message || 'Failed to update category' },
          { status: 500 }
        );
      }
    }

    // HANDLE DELETE ACTION
    if (action === 'delete') {
      if (!categoryId) {
        return NextResponse.json(
          { error: 'Category ID is required' },
          { status: 400 }
        );
      }

      try {
        // Check if category has children before deleting
        const { data: children, error: checkError } = await supabaseAdmin
          .from('service_categories')
          .select('id')
          .eq('parent_id', categoryId)
          .eq('property_id', propertyId);

        if (checkError) {
          throw checkError;
        }

        if (children && children.length > 0) {
          return NextResponse.json(
            { error: 'Cannot delete category with subcategories. Delete subcategories first.' },
            { status: 400 }
          );
        }

        // Check if category is used by services
        const { data: services, error: serviceCheckError } = await supabaseAdmin
          .from('services')
          .select('id')
          .eq('category', categoryId)
          .eq('property_id', propertyId);

        if (serviceCheckError) {
          throw serviceCheckError;
        }

        if (services && services.length > 0) {
          return NextResponse.json(
            { error: 'Cannot delete category that is used by services. Update services first.' },
            { status: 400 }
          );
        }

        const { error: deleteError } = await supabaseAdmin
          .from('service_categories')
          .delete()
          .eq('id', categoryId)
          .eq('property_id', propertyId);

        if (deleteError) {
          console.error('Delete error:', deleteError);
          return NextResponse.json(
            { error: deleteError.message || 'Failed to delete category' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Category deleted successfully',
        });
      } catch (err: any) {
        console.error('Delete exception:', err);
        return NextResponse.json(
          { error: err.message || 'Failed to delete category' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
