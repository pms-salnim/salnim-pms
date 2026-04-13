import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

interface RolePayload {
  propertyId: string;
  name: string;
  description?: string;
  permissions?: Record<string, boolean>;
  status?: 'active' | 'inactive';
  id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    if (!data?.propertyId) {
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    if (action === 'create') {
      return await handleCreate(data);
    } else if (action === 'update') {
      return await handleUpdate(data);
    } else if (action === 'delete') {
      return await handleDelete(data);
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error in roles CRUD:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleCreate(data: RolePayload) {
  if (!data.name?.trim()) {
    return NextResponse.json(
      { error: 'Role name is required' },
      { status: 400 }
    );
  }

  console.log('Creating role:', { name: data.name, propertyId: data.propertyId });

  const { data: newRole, error } = await supabase
    .from('roles')
    .insert({
      property_id: data.propertyId,
      name: data.name,
      description: data.description || null,
      permissions: data.permissions || {},
      status: data.status || 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating role:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  // Transform response
  const transformedRole = {
    id: newRole.id,
    propertyId: newRole.property_id,
    name: newRole.name,
    description: newRole.description,
    permissions: newRole.permissions || {},
    status: newRole.status,
    createdAt: new Date(newRole.created_at).toISOString(),
    updatedAt: new Date(newRole.updated_at).toISOString(),
  };

  return NextResponse.json({ role: transformedRole }, { status: 201 });
}

async function handleUpdate(data: RolePayload & { id: string }) {
  if (!data.id) {
    return NextResponse.json(
      { error: 'Role id is required' },
      { status: 400 }
    );
  }

  if (!data.name?.trim()) {
    return NextResponse.json(
      { error: 'Role name is required' },
      { status: 400 }
    );
  }

  console.log('Updating role:', { id: data.id, name: data.name });

  const { data: updatedRole, error } = await supabase
    .from('roles')
    .update({
      name: data.name,
      description: data.description || null,
      permissions: data.permissions || {},
      status: data.status || 'active',
    })
    .eq('id', data.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating role:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  // Transform response
  const transformedRole = {
    id: updatedRole.id,
    propertyId: updatedRole.property_id,
    name: updatedRole.name,
    description: updatedRole.description,
    permissions: updatedRole.permissions || {},
    status: updatedRole.status,
    createdAt: new Date(updatedRole.created_at).toISOString(),
    updatedAt: new Date(updatedRole.updated_at).toISOString(),
  };

  return NextResponse.json({ role: transformedRole });
}

async function handleDelete(data: { id: string; propertyId: string }) {
  if (!data.id) {
    return NextResponse.json(
      { error: 'Role id is required' },
      { status: 400 }
    );
  }

  console.log('Deleting role:', { id: data.id });

  const { error } = await supabase
    .from('roles')
    .delete()
    .eq('id', data.id)
    .eq('property_id', data.propertyId);

  if (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
