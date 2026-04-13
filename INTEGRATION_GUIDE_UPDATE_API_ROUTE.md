/**
 * INTEGRATION GUIDE: Update Existing API Route to Use Edge Function
 * 
 * File: src/app/api/property-settings/rates-availability/availability/route.ts
 * 
 * Replace the POST handler with this new implementation that:
 * - Validates auth and basic inputs
 * - Forwards to Supabase Edge Function
 * - Returns consistent response format
 * - Handles errors properly
 */

// ============================================================================
// REQUIRED IMPORTS
// ============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// ============================================================================
// KEEP THE GET HANDLER AS-IS (no changes needed)
// ============================================================================

export async function GET(request: NextRequest) {
  // ... your existing GET implementation ...
}

// ============================================================================
// UPDATED POST HANDLER (use Supabase Edge Function)
// ============================================================================

/**
 * POST: Save availability updates (expands ranges, validates, upserts atomically)
 * 
 * Now forwards to Supabase Edge Function for:
 * - Transactional processing
 * - Business rule validation
 * - Real-time synchronization
 * - Better error handling
 */
export async function POST(request: NextRequest) {
  try {
    // ====================================================================
    // STEP 1: Parse and validate request body
    // ====================================================================
    
    const body = await request.json()
    const { propertyId, availabilities } = body

    if (!propertyId || !availabilities || !Array.isArray(availabilities)) {
      return NextResponse.json(
        { 
          error: 'propertyId and availabilities array are required',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      )
    }

    if (availabilities.length === 0) {
      return NextResponse.json(
        { 
          error: 'availabilities array cannot be empty',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      )
    }

    // ====================================================================
    // STEP 2: Verify user authentication
    // ====================================================================
    
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // ====================================================================
    // STEP 3: Verify user has permission to modify this property
    // ====================================================================
    // (Add your authorization logic here if needed)
    
    // Example:
    // const { data: property } = await supabase
    //   .from('properties')
    //   .select('id, owner_id')
    //   .eq('id', propertyId)
    //   .single()
    //
    // if (!property || property.owner_id !== user.id) {
    //   return NextResponse.json(
    //     { error: 'Not authorized to modify this property' },
    //     { status: 403 }
    //   )
    // }

    // ====================================================================
    // STEP 4: Forward to Supabase Edge Function
    // ====================================================================
    
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          code: 'SERVER_CONFIG_ERROR',
        },
        { status: 500 }
      )
    }

    console.log(`[Availability API] Forwarding to edge function: ${availabilities.length} updates for property ${propertyId}`)

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/save-availability`
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ propertyId, availabilities }),
    })

    const result = await response.json()

    // ====================================================================
    // STEP 5: Handle response from edge function
    // ====================================================================

    if (!response.ok) {
      console.warn(`[Availability API] Edge function returned error:`, result)
      
      // Pass through the error response (already properly formatted)
      return NextResponse.json(result, { status: response.status })
    }

    console.log(`[Availability API] Success: Updated ${result.data?.recordsUpserted || 0} records`)

    // ====================================================================
    // STEP 6: Return success response
    // ====================================================================
    
    return NextResponse.json(result, { status: 200 })

  } catch (error) {
    console.error('[Availability API] Unexpected error:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to process availability update',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// OPTIONAL: Enhanced Error Logging
// ============================================================================

/**
 * Helper: Log availability updates for audit trail
 * Call this after successful upsert if you need audit logs
 */
async function logAvailabilityUpdate(
  propertyId: string,
  userId: string,
  recordsCount: number,
  timestamp: string
) {
  const supabase = createClient()
  
  await supabase
    .from('audit_logs')
    .insert({
      event: 'availability_updated',
      user_id: userId,
      property_id: propertyId,
      metadata: { records_count: recordsCount },
      created_at: timestamp,
    })
    .then(({ error }) => {
      if (error) console.warn('Failed to log audit:', error)
    })
}

// ============================================================================
// TESTING CURL COMMANDS
// ============================================================================

/*
Test the updated API route:

# Single room, single day
curl -X POST http://localhost:3000/api/property-settings/rates-availability/availability \
  -H "Content-Type: application/json" \
  -H "Cookie: $(get_your_auth_cookie)" \
  -d '{
    "propertyId": "prop-001",
    "availabilities": [{
      "date": "2026-04-20",
      "status": "available",
      "roomId": "room-001",
      "appliedAtLevel": "room"
    }]
  }'

# Date range (server expands to multiple records)
curl -X POST http://localhost:3000/api/property-settings/rates-availability/availability \
  -H "Content-Type: application/json" \
  -H "Cookie: $(get_your_auth_cookie)" \
  -d '{
    "propertyId": "prop-001",
    "availabilities": [{
      "date": "2026-04-15",
      "endDate": "2026-04-20",
      "status": "available",
      "roomId": "room-001",
      "appliedAtLevel": "room"
    }]
  }'

# Open-ended (9999-12-31)
curl -X POST http://localhost:3000/api/property-settings/rates-availability/availability \
  -H "Content-Type: application/json" \
  -H "Cookie: $(get_your_auth_cookie)" \
  -d '{
    "propertyId": "prop-001",
    "availabilities": [{
      "date": "2026-04-15",
      "endDate": "9999-12-31",
      "status": "available",
      "roomId": "room-001",
      "appliedAtLevel": "room"
    }]
  }'
*/

// ============================================================================
// MIGRATION NOTES
// ============================================================================

/*
1. After deploying the edge function, update this file with new POST handler

2. The API route now acts as a "bridge":
   - Handles authentication
   - Validates input format
   - Forwards to edge function
   - Returns edge function result

3. Future migration (Phase 2):
   - Remove this API route
   - Call edge function directly from frontend:
     
     const { data, error } = await supabase.functions.invoke('save-availability', {
       body: { propertyId, availabilities }
     })

4. No frontend changes needed during this phase!
   - Frontend keeps calling same API endpoint
   - Behavior changes on backend

5. To troubleshoot:
   - Check edge function logs: supabase functions logs save-availability
   - Check this API route logs: Check your Next.js server logs
   - Verify environment variables are set
*/
