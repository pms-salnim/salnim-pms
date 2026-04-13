/**
 * Utility Functions for Availability Updates
 * 
 * Provides typed client-side wrappers for calling the save-availability function.
 * Can be used with either:
 * - Next.js API route (current)
 * - Supabase Edge Function directly (future)
 */

type AvailabilityStatus = 'available' | 'unavailable' | 'blocked' | 'not_available' | 'closed_to_arrival' | 'closed_to_departure'
type AppliedAtLevel = 'room' | 'room_type' | 'property'

export interface AvailabilityUpdateInput {
  date: string  // YYYY-MM-DD
  endDate?: string  // Optional: expands to range if provided
  status: AvailabilityStatus
  roomId?: string
  roomTypeId?: string
  minNights?: number
  maxNights?: number
  occupancy?: number
  notes?: string
  appliedAtLevel: AppliedAtLevel
  blockedRooms?: number
}

export interface SaveAvailabilityRequest {
  propertyId: string
  availabilities: AvailabilityUpdateInput[]
}

export interface SaveAvailabilityResponse {
  success: boolean
  message: string
  data: {
    recordsProcessed: number
    recordsUpserted: number
    affectedRooms: string[]
    affectedRoomTypes: string[]
    timestamp: string
  }
}

export interface ValidationErrorItem {
  field: string
  message: string
  code: string
}

export interface SaveAvailabilityErrorResponse {
  error: string
  code: string
  details?: string
  validationErrors?: Array<{
    recordIndex: number
    errors: ValidationErrorItem[]
  }>
  totalErrors?: number
}

// ============================================================================
// API CALLER
// ============================================================================

/**
 * Save availability updates to Supabase
 * 
 * Handles both success and validation errors from the function.
 * 
 * @param request - Availability update request
 * @returns Response with upserted count and affected rooms
 * @throws Error if request fails
 */
export async function saveAvailability(
  request: SaveAvailabilityRequest
): Promise<SaveAvailabilityResponse> {
  const response = await fetch('/api/property-settings/rates-availability/availability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  const result = await response.json()

  if (!response.ok) {
    const errorResponse = result as SaveAvailabilityErrorResponse
    
    // Handle validation errors specially
    if (errorResponse.code === 'VALIDATION_ERROR' && errorResponse.validationErrors) {
      const errors = errorResponse.validationErrors
        .flatMap(item => item.errors.map(e => `(Record ${item.recordIndex}) ${e.field}: ${e.message}`))
        .join('\n')
      throw new Error(`Validation failed:\n${errors}`)
    }

    throw new Error(errorResponse.error || 'Failed to save availability')
  }

  return result as SaveAvailabilityResponse
}

// ============================================================================
// BUILDER HELPERS
// ============================================================================

/**
 * Build a single availability update (common case)
 */
export function buildAvailabilityUpdate(options: {
  date: string  // YYYY-MM-DD
  status: AvailabilityStatus
  roomId?: string
  roomTypeId?: string
  minNights?: number
  maxNights?: number
}): AvailabilityUpdateInput {
  return {
    date: options.date,
    status: options.status,
    roomId: options.roomId,
    roomTypeId: options.roomTypeId,
    minNights: options.minNights,
    maxNights: options.maxNights,
    appliedAtLevel: options.roomId ? 'room' : options.roomTypeId ? 'room_type' : 'property',
  }
}

/**
 * Build a date range availability update
 * 
 * Expands single date + endDate on server side
 */
export function buildRangeUpdate(options: {
  startDate: string  // YYYY-MM-DD
  endDate: string  // YYYY-MM-DD
  status: AvailabilityStatus
  roomIds?: string[]
  roomTypeId?: string
  minNights?: number
  maxNights?: number
}): AvailabilityUpdateInput[] {
  const base = {
    status: options.status,
    roomTypeId: options.roomTypeId,
    minNights: options.minNights,
    maxNights: options.maxNights,
    appliedAtLevel: (options.roomIds?.[0] ? 'room' : options.roomTypeId ? 'room_type' : 'property') as AppliedAtLevel,
  }

  // If room IDs specified, create separate update for each
  if (options.roomIds && options.roomIds.length > 0) {
    return options.roomIds.map(roomId => ({
      date: options.startDate,
      endDate: options.endDate,
      roomId,
      ...base,
    }))
  }

  // Otherwise single update (for room-type or property level)
  return [
    {
      date: options.startDate,
      endDate: options.endDate,
      ...base,
    } as AvailabilityUpdateInput,
  ]
}

/**
 * Build open-ended availability (ends 5 years from today)
 * Example: Today is April 12, 2026 → endDate will be December 31, 2031
 */
export function buildOpenEndedUpdate(options: {
  startDate: string  // YYYY-MM-DD
  status: AvailabilityStatus
  roomId?: string
  roomTypeId?: string
}): AvailabilityUpdateInput {
  return {
    date: options.startDate,
    endDate: getFiveYearEndDate(),  // 5 years from today
    status: options.status,
    roomId: options.roomId,
    roomTypeId: options.roomTypeId,
    appliedAtLevel: options.roomId ? 'room' : options.roomTypeId ? 'room_type' : 'property',
  }
}

/**
 * Build bulk update with multiple parameters
 */
export function buildBulkUpdate(options: {
  dates: string[]  // Array of YYYY-MM-DD strings
  status: AvailabilityStatus
  roomIds: string[]
  minNights?: number
  maxNights?: number
}): AvailabilityUpdateInput[] {
  const updates: AvailabilityUpdateInput[] = []

  for (const date of options.dates) {
    for (const roomId of options.roomIds) {
      updates.push({
        date,
        status: options.status,
        roomId,
        minNights: options.minNights,
        maxNights: options.maxNights,
        appliedAtLevel: 'room',
      })
    }
  }

  return updates
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate availability update locally (before sending to server)
 * 
 * @returns Array of error messages, empty if valid
 */
export function validateAvailabilityLocally(
  update: AvailabilityUpdateInput
): string[] {
  const errors: string[] = []

  // Check date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(update.date)) {
    errors.push(`Invalid date format: ${update.date} (expected YYYY-MM-DD)`)
  }

  // Check end date format
  if (update.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(update.endDate)) {
    errors.push(`Invalid end date format: ${update.endDate} (expected YYYY-MM-DD)`)
  }

  // Check date range
  if (update.endDate && update.date > update.endDate) {
    errors.push(`Start date after end date: ${update.date} > ${update.endDate}`)
  }

  // Check stay rules
  if (update.minNights !== undefined && update.maxNights !== undefined) {
    if (update.minNights > update.maxNights) {
      errors.push(`Min nights (${update.minNights}) > max nights (${update.maxNights})`)
    }
  }

  // Check at least one scope is set
  if (!update.roomId && !update.roomTypeId) {
    console.warn('Neither roomId nor roomTypeId provided - update will apply to property level')
  }

  return errors
}

/**
 * Validate entire request before sending
 */
export function validateAvailabilityRequest(request: SaveAvailabilityRequest): string[] {
  const errors: string[] = []

  if (!request.propertyId) {
    errors.push('propertyId is required')
  }

  if (!Array.isArray(request.availabilities) || request.availabilities.length === 0) {
    errors.push('At least one availability update is required')
  }

  // Validate each update
  request.availabilities.forEach((update, index) => {
    const updateErrors = validateAvailabilityLocally(update)
    updateErrors.forEach(err => {
      errors.push(`Update ${index}: ${err}`)
    })
  })

  return errors
}

// ============================================================================
// STATUS HELPERS
// ============================================================================

/**
 * Get human-readable status label with color
 */
export function getStatusInfo(status: AvailabilityStatus) {
  const statusMap: Record<AvailabilityStatus, { label: string; color: string; icon: string }> = {
    available: { label: 'Available', color: '#10b981', icon: '✓' },
    unavailable: { label: 'Unavailable', color: '#6b7280', icon: '-' },
    blocked: { label: 'Blocked', color: '#ef4444', icon: '🚫' },
    not_available: { label: 'Not Available', color: '#ef4444', icon: '-' },
    closed_to_arrival: { label: 'Closed to Arrival', color: '#f97316', icon: '←' },
    closed_to_departure: { label: 'Closed to Departure', color: '#8b5cf6', icon: '→' },
  }
  return statusMap[status] || { label: status, color: '#9ca3af', icon: '?' }
}

// ============================================================================
// REACT HOOK (Optional)
// ============================================================================

/**
 * React hook for managing availability save operations
 * 
 * Usage:
 * ```
 * const { save, isLoading, error, success } = useAvailabilitySave()
 * 
 * const handleSave = async () => {
 *   await save({
 *     propertyId: 'prop-1',
 *     availabilities: [...]
 *   })
 * }
 * ```
 */
export function useAvailabilitySave() {
  // Note: This would need React context - simplified here
  // In actual implementation: use useState + useCallback
  
  return {
    save: async (request: SaveAvailabilityRequest) => {
      const errors = validateAvailabilityRequest(request)
      if (errors.length > 0) {
        throw new Error(`Validation errors:\n${errors.join('\n')}`)
      }
      return saveAvailability(request)
    },
    isLoading: false,
    error: null,
    success: false,
  }
}

// ============================================================================
// EXAMPLES
// ============================================================================

/**
 * Example: Save single room as available
 */
export const exampleSingleRoom = () => {
  const update = buildAvailabilityUpdate({
    date: '2026-04-15',
    status: 'available',
    roomId: 'room-001',
  })

  return saveAvailability({
    propertyId: 'prop-001',
    availabilities: [update],
  })
}

/**
 * Example: Save date range as available for multiple rooms
 */
export const exampleDateRange = () => {
  const updates = buildRangeUpdate({
    startDate: '2026-04-15',
    endDate: '2026-04-20',
    status: 'available',
    roomIds: ['room-001', 'room-002'],
  })

  return saveAvailability({
    propertyId: 'prop-001',
    availabilities: updates,
  })
}

/**
 * Example: Save open-ended availability (from now on)
 */
export const exampleOpenEnded = () => {
  const update = buildOpenEndedUpdate({
    startDate: '2026-04-15',
    status: 'available',
    roomId: 'room-001',
  })

  return saveAvailability({
    propertyId: 'prop-001',
    availabilities: [update],
  })
}

/**
 * Example: Stop Sell with notes
 */
export const exampleStopSell = () => {
  const updates: AvailabilityUpdateInput[] = [
    {
      date: '2026-04-20',
      status: 'blocked',
      roomId: 'room-001',
      notes: 'Maintenance scheduled',
      appliedAtLevel: 'room',
    },
  ]

  return saveAvailability({
    propertyId: 'prop-001',
    availabilities: updates,
  })
}

// ============================================================================
// RANGE-BASED QUERY HELPERS
// ============================================================================

/**
 * Format date for API queries (YYYY-MM-DD)
 */
export function formatDateForQuery(date: Date | string): string {
  if (typeof date === 'string') return date
  return date.toISOString().split('T')[0]
}

/**
 * Get date range for calendar month
 */
export function getMonthDateRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return {
    startDate: formatDateForQuery(start),
    endDate: formatDateForQuery(end),
  }
}

/**
 * Get date range for next N days
 */
export function getUpcomingDateRange(daysFromNow: number = 90) {
  const start = new Date()
  const end = new Date(start.getTime() + daysFromNow * 24 * 60 * 60 * 1000)
  return {
    startDate: formatDateForQuery(start),
    endDate: formatDateForQuery(end),
  }
}

/**
 * Get date range for last N days
 */
export function getPastDateRange(daysBack: number = 30) {
  const end = new Date()
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000)
  return {
    startDate: formatDateForQuery(start),
    endDate: formatDateForQuery(end),
  }
}

/**
 * Get end date 5 years from today (for open-ended availability)
 * Today: April 12, 2026 → Returns: December 31, 2031
 */
export function getFiveYearEndDate(): string {
  const today = new Date()
  const fiveYearsLater = new Date(today.getFullYear() + 5, 11, 31) // Dec 31, 5 years from now
  return formatDateForQuery(fiveYearsLater)
}

/**
 * Create a blocked period update for maintenance
 */
export function buildMaintenanceBlock(options: {
  propertyId: string
  startDate: string
  endDate: string
  reason?: string
  roomIds?: string[]
}): SaveAvailabilityRequest {
  const roomLevelUpdates = options.roomIds?.map(roomId => ({
    date: options.startDate,
    endDate: options.endDate,
    status: 'not_available' as AvailabilityStatus,
    roomId,
    notes: options.reason || 'Maintenance',
    appliedAtLevel: 'room' as AppliedAtLevel,
  }))

  return {
    propertyId: options.propertyId,
    availabilities: roomLevelUpdates || [
      {
        date: options.startDate,
        endDate: options.endDate,
        status: 'not_available',
        notes: options.reason || 'Maintenance',
        appliedAtLevel: 'property',
      },
    ],
  }
}

/**
 * Create a "seasonal" availability pattern
 * Useful for opening/closing seasons
 */
export function buildSeasonalPattern(options: {
  propertyId: string
  openDate: string
  closeDate: string
  availabilityStatus?: AvailabilityStatus
  occupancy?: number
  minNights?: number
}): SaveAvailabilityRequest {
  return {
    propertyId: options.propertyId,
    availabilities: [
      {
        date: options.openDate,
        endDate: options.closeDate,
        status: options.availabilityStatus || 'available',
        occupancy: options.occupancy,
        minNights: options.minNights,
        appliedAtLevel: 'property',
      },
    ],
  }
}
