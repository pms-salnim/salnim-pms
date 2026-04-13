/**
 * API Route: /api/auth/signup
 * Handles user signup with Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { signUpUser } from '@/lib/supabase-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { email, password, fullName, country, city, address, propertyName, propertyAddress, propertyType } =
      body;

    // Validate required fields
    if (!email || !password || !fullName || !propertyName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Sign up the user and create property
    const result = await signUpUser({
      fullName,
      email,
      password,
      country: country || '',
      city: city || '',
      address: address || '',
      propertyName,
      propertyAddress: propertyAddress || '',
      propertyType: propertyType || 'Other',
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Signup API error:', error);

    // Handle specific error messages
    if (error.message.includes('already exists')) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Signup failed' },
      { status: 500 }
    );
  }
}
