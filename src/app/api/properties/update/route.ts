/**
 * API Route: /api/properties/update
 * Updates property settings in Supabase PostgreSQL
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize admin client for database access
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

export async function POST(request: NextRequest) {
  try {
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

    // Get request body
    const { propertyId, updates } = await request.json();

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
        { error: 'Unauthorized - property does not belong to user' },
        { status: 403 }
      );
    }

    // Build update payload - map Property fields to PostgreSQL columns
    const updatePayload: Record<string, any> = {};

    // Basic fields
    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.description !== undefined) updatePayload.description = updates.description;
    if (updates.address !== undefined) updatePayload.address = updates.address;
    if (updates.city !== undefined) updatePayload.city = updates.city;
    if (updates.country !== undefined) updatePayload.country = updates.country;
    
    // Time and currency
    if (updates.defaultCheckInTime !== undefined) updatePayload.check_in_time = updates.defaultCheckInTime;
    if (updates.defaultCheckOutTime !== undefined) updatePayload.check_out_time = updates.defaultCheckOutTime;
    if (updates.currency !== undefined) updatePayload.currency = updates.currency;
    if (updates.timeZone !== undefined) updatePayload.time_zone = updates.timeZone;
    if (updates.language !== undefined) updatePayload.language = updates.language;

    // Legal info
    if (updates.legalInformation) {
      updatePayload.company_name = updates.legalInformation.companyName;
      updatePayload.legal_form = updates.legalInformation.legalForm;
      updatePayload.capital_amount = updates.legalInformation.capitalAmount;
      updatePayload.business_address = updates.legalInformation.businessAddress;
      updatePayload.rc_number = updates.legalInformation.rcNumber;
      updatePayload.if_number = updates.legalInformation.ifNumber;
      updatePayload.patente_number = updates.legalInformation.patenteNumber;
      updatePayload.ice_number = updates.legalInformation.iceNumber;
      updatePayload.tva_info = updates.legalInformation.tvaInfo;
      updatePayload.bank_account_number = updates.legalInformation.bankAccountNumber;
      updatePayload.iban = updates.legalInformation.iban;
    }

    // Invoice customization
    if (updates.invoicePrefix !== undefined) updatePayload.invoice_prefix = updates.invoicePrefix;
    if (updates.invoicePrimaryColor !== undefined) updatePayload.invoice_primary_color = updates.invoicePrimaryColor;
    if (updates.invoiceFooterText !== undefined) updatePayload.invoice_footer_text = updates.invoiceFooterText;
    if (updates.invoiceHeaderNotes !== undefined) updatePayload.invoice_header_notes = updates.invoiceHeaderNotes;

    // Loyalty program
    if (updates.loyaltyProgramSettings) {
      updatePayload.loyalty_enabled = updates.loyaltyProgramSettings.enabled;
      updatePayload.loyalty_earning_rate = updates.loyaltyProgramSettings.earningRate;
      updatePayload.loyalty_redemption_rate = updates.loyaltyProgramSettings.redemptionRate;
    }

    // Update property in database
    const { data: updatedProperty, error: updateError } = await supabaseAdmin
      .from('properties')
      .update(updatePayload)
      .eq('id', propertyId)
      .select('*')
      .single();

    if (updateError || !updatedProperty) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: updateError?.message || 'Failed to update property' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updates: updatedProperty,
    });
  } catch (error: any) {
    console.error('Property update API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update property' },
      { status: 500 }
    );
  }
}
