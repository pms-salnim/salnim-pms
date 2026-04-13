/**
 * API Route: /api/properties/infos/update
 * Updates property info and specifications in Supabase PostgreSQL
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

    // Basic property info
    if (updates.propertyName !== undefined) updatePayload.name = updates.propertyName;
    if (updates.propertyType !== undefined) updatePayload.type = updates.propertyType;
    if (updates.description !== undefined) updatePayload.description = updates.description;
    if (updates.tagline !== undefined) updatePayload.tagline = updates.tagline;
    if (updates.yearEstablished !== undefined) updatePayload.year_established = updates.yearEstablished;
    if (updates.logoUrl !== undefined) updatePayload.logo_url = updates.logoUrl;
    if (updates.starRating !== undefined) updatePayload.star_rating = updates.starRating;

    // Location information
    if (updates.streetAddress !== undefined) updatePayload.address = updates.streetAddress;
    if (updates.city !== undefined) updatePayload.city = updates.city;
    if (updates.stateProvince !== undefined) updatePayload.state_province = updates.stateProvince;
    if (updates.postalCode !== undefined) updatePayload.postal_code = updates.postalCode;
    if (updates.country !== undefined) updatePayload.country = updates.country;
    if (updates.googleMapsLink !== undefined) updatePayload.google_maps_link = updates.googleMapsLink;
    if (updates.jurisdiction !== undefined) updatePayload.jurisdiction = updates.jurisdiction;

    // Legal and business details - European
    if (updates.legalBusinessName !== undefined) updatePayload.legal_business_name = updates.legalBusinessName;
    if (updates.europeanCompanyRegNumber !== undefined) updatePayload.european_company_reg_number = updates.europeanCompanyRegNumber;
    if (updates.europeanVATNumber !== undefined) updatePayload.european_vat_number = updates.europeanVATNumber;
    if (updates.europeanTradeRegEntry !== undefined) updatePayload.european_trade_reg_entry = updates.europeanTradeRegEntry;
    if (updates.europeanChamberRegistration !== undefined) updatePayload.european_chamber_registration = updates.europeanChamberRegistration;
    if (updates.europeanTaxRegistration !== undefined) updatePayload.european_tax_registration = updates.europeanTaxRegistration;

    // Legal and business details - Moroccan
    if (updates.moroccanLegalCompanyForm !== undefined) updatePayload.moroccan_legal_company_form = updates.moroccanLegalCompanyForm;
    if (updates.moroccanICE !== undefined) updatePayload.moroccan_ice = updates.moroccanICE;
    if (updates.moroccanRC !== undefined) updatePayload.moroccan_rc = updates.moroccanRC;
    if (updates.moroccanIF !== undefined) updatePayload.moroccan_if = updates.moroccanIF;
    if (updates.moroccanCNSS !== undefined) updatePayload.moroccan_cnss = updates.moroccanCNSS;
    if (updates.moroccanPatentNumber !== undefined) updatePayload.moroccan_patent_number = updates.moroccanPatentNumber;

    // Legal and business details - USA
    if (updates.usaEIN !== undefined) updatePayload.usa_ein = updates.usaEIN;
    if (updates.usaStateLicenseNumber !== undefined) updatePayload.usa_state_license_number = updates.usaStateLicenseNumber;
    if (updates.usaSecretaryOfStateNumber !== undefined) updatePayload.usa_secretary_of_state_number = updates.usaSecretaryOfStateNumber;
    if (updates.usaFederalTaxID !== undefined) updatePayload.usa_federal_tax_id = updates.usaFederalTaxID;

    // Property specifications
    if (updates.totalRooms !== undefined) updatePayload.total_rooms = updates.totalRooms;
    if (updates.maxGuestCapacity !== undefined) updatePayload.max_guest_capacity = updates.maxGuestCapacity;
    if (updates.propertySizeSquareFeet !== undefined) updatePayload.property_size_square_feet = updates.propertySizeSquareFeet;
    if (updates.numberFloors !== undefined) updatePayload.number_floors = updates.numberFloors;
    if (updates.numberBuildings !== undefined) updatePayload.number_buildings = updates.numberBuildings;
    if (updates.propertyStyle !== undefined) updatePayload.property_style = updates.propertyStyle;

    console.log('Updating property infos:', {
      propertyId,
      updatePayload,
      fieldCount: Object.keys(updatePayload).length,
    });

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

    console.log('Property infos updated successfully:', updatedProperty.id);

    return NextResponse.json({
      success: true,
      updates: updatedProperty,
    });
  } catch (error: any) {
    console.error('Property infos update API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update property' },
      { status: 500 }
    );
  }
}
