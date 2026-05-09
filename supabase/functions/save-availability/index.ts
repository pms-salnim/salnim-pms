/**
 * Supabase Edge Function: save-availability
 * 
 * Routes availability updates to the correct tables:
 * - availability_calendar: availability status only
 * - availability_restrictions: min/max stay, CTA, CTD
 * - rate_overrides: rate override data
 * 
 * Deploy: supabase functions deploy save-availability
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface AvailabilityUpdate {
  date: string
  endDate?: string
  status?: 'available' | 'not_available' | 'closed_to_arrival' | 'closed_to_departure'
  roomId?: string
  roomTypeId?: string
  minNights?: number
  maxNights?: number
  closeToArrival?: boolean
  closeToDeparture?: boolean
  occupancy?: number
  notes?: string
  appliedAtLevel?: 'room' | 'room_type' | 'property'
  rateOverrideType?: 'percentage' | 'fixed'
  rateOverrideValue?: number
  ratePlanIds?: string[]
  derivePricing?: boolean
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

function getFiveYearEndDate(): string {
  const today = new Date()
  const fiveYearsLater = new Date(today.getFullYear() + 5, 11, 31)
  const year = fiveYearsLater.getFullYear()
  const month = String(fiveYearsLater.getMonth() + 1).padStart(2, '0')
  const day = String(fiveYearsLater.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function generateUniqueId(
  propertyId: string,
  date: string,
  roomId: string | null,
  roomTypeId: string | null,
  endDate: string
): Promise<string> {
  const idInfo = `${propertyId}|${date}|${roomId || 'null'}|${roomTypeId || 'null'}|${endDate}`
  const msgBuffer = new TextEncoder().encode(idInfo)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex.substring(0, 50)
}

function detectUpdateType(update: AvailabilityUpdate): 'availability' | 'restriction' | 'rate' {
  // If has rate fields → rate update
  if (update.rateOverrideType || update.rateOverrideValue !== undefined || update.ratePlanIds || update.derivePricing) {
    return 'rate'
  }
  
  // If has restriction fields → restriction update
  if (update.minNights !== undefined || update.maxNights !== undefined || update.closeToArrival || update.closeToDeparture) {
    return 'restriction'
  }
  
  // Otherwise → availability update
  return 'availability'
}

async function saveToAvailabilityTable(propertyId: string, update: AvailabilityUpdate): Promise<void> {
  const id = await generateUniqueId(
    propertyId,
    update.date,
    update.roomId || null,
    update.roomTypeId || null,
    update.endDate || getFiveYearEndDate()
  )

  const record = {
    id,
    property_id: propertyId,
    room_id: update.roomId || null,
    room_type_id: update.roomTypeId || null,
    date: update.date,
    end_date: update.endDate || getFiveYearEndDate(),
    status: update.status || 'available',
    occupancy: update.occupancy || 1,
    notes: update.notes || null,
    applied_at_level: update.appliedAtLevel || 'room',
  }

  console.log(`[save-availability] Saving to availability_calendar: room=${update.roomId}, status=${update.status}`)

  const { error } = await supabase
    .from('availability_calendar')
    .upsert([record], { onConflict: 'id' })

  if (error) throw error
}

async function saveToRestrictionsTable(propertyId: string, update: AvailabilityUpdate): Promise<void> {
  if (!update.roomId) {
    console.warn('[save-availability] Skipping restriction - requires room_id')
    return
  }

  const id = await generateUniqueId(
    propertyId,
    update.date,
    update.roomId,
    null,
    update.endDate || getFiveYearEndDate()
  )

  const record = {
    id,
    property_id: propertyId,
    room_id: update.roomId,
    room_type_id: update.roomTypeId || null,
    date: update.date,
    end_date: update.endDate || getFiveYearEndDate(),
    min_nights: update.minNights || null,
    max_nights: update.maxNights || null,
    close_to_arrival: update.closeToArrival || false,
    close_to_departure: update.closeToDeparture || false,
  }

  console.log(`[save-availability] Saving to availability_restrictions: room=${update.roomId}, min=${update.minNights}, max=${update.maxNights}`)

  const { error } = await supabase
    .from('availability_restrictions')
    .upsert([record], { onConflict: 'id' })

  if (error) throw error
}

async function saveToRateOverridesTable(propertyId: string, update: AvailabilityUpdate): Promise<void> {
  if (!update.roomId) {
    console.warn('[save-availability] Skipping rate override - requires room_id')
    return
  }

  const id = await generateUniqueId(
    propertyId,
    update.date,
    update.roomId,
    null,
    update.endDate || getFiveYearEndDate()
  )

  const record = {
    id,
    property_id: propertyId,
    room_id: update.roomId,
    date: update.date,
    end_date: update.endDate || getFiveYearEndDate(),
    override_type: update.rateOverrideType || null,
    override_value: update.rateOverrideValue || null,
    rate_plan_ids: update.ratePlanIds || [],
    derive_pricing: update.derivePricing || false,
  }

  console.log(`[save-availability] Saving to rate_overrides: room=${update.roomId}, type=${update.rateOverrideType}, value=${update.rateOverrideValue}`)

  const { error } = await supabase
    .from('rate_overrides')
    .upsert([record], { onConflict: 'id' })

  if (error) throw error
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body = await req.json()
    const { propertyId, availabilities } = body

    if (!propertyId || !Array.isArray(availabilities) || availabilities.length === 0) {
      return new Response(
        JSON.stringify({ error: 'propertyId and non-empty availabilities array are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[save-availability] Processing ${availabilities.length} updates for property ${propertyId}`)

    let successCount = 0
    const errors: any[] = []

    for (let i = 0; i < availabilities.length; i++) {
      const update = availabilities[i]
      
      try {
        const updateType = detectUpdateType(update)
        console.log(`[save-availability] Record ${i + 1}/${availabilities.length}: type=${updateType}`)

        if (updateType === 'rate') {
          await saveToRateOverridesTable(propertyId, update)
        } else if (updateType === 'restriction') {
          await saveToRestrictionsTable(propertyId, update)
        } else {
          await saveToAvailabilityTable(propertyId, update)
        }

        successCount++
        console.log(`[save-availability] ✅ Saved record ${i + 1}`)
      } catch (recordError: any) {
        console.error(`[save-availability] ❌ Error saving record ${i + 1}:`, recordError)
        errors.push({
          index: i,
          error: recordError.message,
        })
      }
    }

    console.log(`[save-availability] Completed: ${successCount}/${availabilities.length} records saved`)

    if (errors.length > 0) {
      console.warn(`[save-availability] Errors: ${errors.length}`)
    }

    return new Response(
      JSON.stringify({
        data: {
          recordsUpserted: successCount,
          totalProcessed: availabilities.length,
          message: `Saved ${successCount}/${availabilities.length} records`,
          errors: errors.length > 0 ? errors : undefined,
        },
      }),
      { status: successCount > 0 ? 200 : 400, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[save-availability] Fatal error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to process updates',
        details: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
