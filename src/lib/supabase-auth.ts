/**
 * Supabase Authentication Service
 * Handles all auth operations with Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { fullPermissions } from '@/types/staff';

// Use service role key for admin operations (server-side only)
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  : null;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface SignupData {
  fullName: string;
  email: string;
  password: string;
  country: string;
  city: string;
  address: string;
  propertyName: string;
  propertyAddress: string;
  propertyType: 'Apartment' | 'House' | 'Hotel' | 'Hostel' | 'BedAndBreakfast' | 'Villa' | 'Resort' | 'Other';
}

/**
 * Sign up a new user with Supabase Auth
 * Creates user account and initializes their property
 */
export async function signUpUser(data: SignupData) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  try {
    // 1. Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });

    if (authError || !authData?.user) {
      throw new Error(authError?.message || 'Failed to create auth user');
    }

    const userId = authData.user.id;
    const propertyId = generateId();

    // 2. Create property first
    const { error: propertyError } = await supabaseAdmin
      .from('properties')
      .insert([
        {
          id: propertyId,
          name: data.propertyName,
          address: data.propertyAddress,
          country: data.country,
          city: data.city,
          currency: 'USD',
          language: 'en',
          time_zone: 'UTC',
          check_in_time: '14:00',
          check_out_time: '12:00',
          loyalty_enabled: false,
        },
      ]);

    if (propertyError) {
      throw new Error(propertyError.message || 'Failed to create property');
    }

    // 3. Create user profile with property_id linked
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: userId,
          email: data.email,
          name: data.fullName,
          role: 'owner',
          property_id: propertyId, // Link to property immediately
          phone: null,
          country: data.country,
          city: data.city,
          address: data.address,
          preferred_language: 'en',
          permissions: fullPermissions, // Grant full access to account owner
        },
      ]);

    if (userError) {
      throw new Error(userError.message || 'Failed to create user profile');
    }

    console.log('User created:', { userId, propertyId });

    return {
      userId,
      propertyId,
      email: data.email,
      name: data.fullName,
    };
  } catch (error: any) {
    console.error('Signup error:', error);
    throw error;
  }
}

/**
 * Get user profile from PostgreSQL
 */
export async function getUserProfile(userId: string) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select(
      `
      id,
      email,
      name,
      role,
      property_id,
      country,
      city,
      address,
      preferred_language,
      phone,
      permissions,
      created_at
    `
    )
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to fetch user profile');
  }

  return data;
}

/**
 * Get user's property details
 */
export async function getUserProperty(propertyId: string) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  const { data, error } = await supabaseAdmin
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to fetch property');
  }

  return data;
}

/**
 * Update user language preference
 */
export async function updateUserLanguage(userId: string, language: string) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ preferred_language: language })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message || 'Failed to update language preference');
  }
}

/**
 * Simple ID generator (replacing Firebase's auto-generated IDs)
 */
function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}
