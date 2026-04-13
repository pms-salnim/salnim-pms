import {
  RatePlan,
  DailyRate,
  AvailabilityEntry,
  Restriction,
  OccupancyRestriction,
  RecurringPattern,
  Season,
  AuditLogEntry,
} from './types';

const BASE_PATH = '/api/property-settings/rates-availability';

// Rate Plans
export async function fetchRatePlans(propertyId: string): Promise<RatePlan[]> {
  const response = await fetch(`${BASE_PATH}/rate-plans?propertyId=${propertyId}`);
  if (!response.ok) throw new Error('Failed to fetch rate plans');
  const { data } = await response.json();
  return data;
}

export async function createRatePlan(propertyId: string, plan: Partial<RatePlan>): Promise<RatePlan> {
  const response = await fetch(`${BASE_PATH}/rate-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId, ...plan }),
  });
  if (!response.ok) throw new Error('Failed to create rate plan');
  const { data } = await response.json();
  return data;
}

export async function updateRatePlan(propertyId: string, ratePlanId: string, updates: Partial<RatePlan>): Promise<RatePlan> {
  const response = await fetch(`${BASE_PATH}/rate-plans`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId, ratePlanId, ...updates }),
  });
  if (!response.ok) throw new Error('Failed to update rate plan');
  const { data } = await response.json();
  return data;
}

export async function deleteRatePlan(ratePlanId: string): Promise<void> {
  const response = await fetch(`${BASE_PATH}/rate-plans?id=${ratePlanId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete rate plan');
}

// Daily Rates
export async function fetchDailyRates(
  propertyId: string,
  startDate: string,
  endDate: string,
  filters?: { roomTypeId?: string; roomId?: string; ratePlanId?: string }
): Promise<DailyRate[]> {
  const params = new URLSearchParams({ propertyId, startDate, endDate });
  if (filters?.roomTypeId) params.append('roomTypeId', filters.roomTypeId);
  if (filters?.roomId) params.append('roomId', filters.roomId);
  if (filters?.ratePlanId) params.append('ratePlanId', filters.ratePlanId);

  const response = await fetch(`${BASE_PATH}/daily-rates?${params}`);
  if (!response.ok) throw new Error('Failed to fetch daily rates');
  const { data } = await response.json();
  return data;
}

export async function createOrUpdateDailyRates(propertyId: string, ratePlanId: string, rates: any[]): Promise<DailyRate[]> {
  const response = await fetch(`${BASE_PATH}/daily-rates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId, ratePlanId, rates }),
  });
  if (!response.ok) throw new Error('Failed to create/update daily rates');
  const { data } = await response.json();
  return data;
}

export async function updateDailyRate(rateId: string, updates: Partial<DailyRate>): Promise<DailyRate> {
  const response = await fetch(`${BASE_PATH}/daily-rates`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rateId, ...updates }),
  });
  if (!response.ok) throw new Error('Failed to update daily rate');
  const { data } = await response.json();
  return data;
}

export async function deleteDailyRates(rateIds: string[]): Promise<void> {
  const response = await fetch(`${BASE_PATH}/daily-rates`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rateIds }),
  });
  if (!response.ok) throw new Error('Failed to delete daily rates');
}

// Availability
export async function fetchAvailability(
  propertyId: string,
  startDate: string,
  endDate: string,
  filters?: { roomTypeId?: string; roomId?: string; status?: string }
): Promise<AvailabilityEntry[]> {
  const params = new URLSearchParams({ propertyId, startDate, endDate });
  if (filters?.roomTypeId) params.append('roomTypeId', filters.roomTypeId);
  if (filters?.roomId) params.append('roomId', filters.roomId);
  if (filters?.status) params.append('status', filters.status);

  const response = await fetch(`${BASE_PATH}/availability?${params}`);
  if (!response.ok) throw new Error('Failed to fetch availability');
  const { data } = await response.json();
  return data;
}

export async function createOrUpdateAvailability(propertyId: string, availabilities: any[]): Promise<AvailabilityEntry[]> {
  const response = await fetch(`${BASE_PATH}/availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId, availabilities }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error('API Error Response:', { status: response.status, body: errorBody });
    throw new Error(errorBody.details || 'Failed to create/update availability');
  }
  const { data } = await response.json();
  return data;
}

export async function updateAvailability(availabilityId: string, updates: Partial<AvailabilityEntry>): Promise<AvailabilityEntry> {
  const response = await fetch(`${BASE_PATH}/availability`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ availabilityId, ...updates }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error('API Error Response:', { status: response.status, body: errorBody });
    throw new Error(errorBody.error || errorBody.details || 'Failed to update availability');
  }
  const { data } = await response.json();
  return data;
}

export async function deleteAvailability(availabilityIds: string[]): Promise<void> {
  const response = await fetch(`${BASE_PATH}/availability`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ availabilityIds }),
  });
  if (!response.ok) throw new Error('Failed to delete availability');
}

// Restrictions
export async function fetchRestrictions(
  propertyId: string,
  filters?: { type?: string; status?: string }
): Promise<Restriction[]> {
  const params = new URLSearchParams({ propertyId });
  if (filters?.type) params.append('type', filters.type);
  if (filters?.status) params.append('status', filters.status);

  const response = await fetch(`${BASE_PATH}/restrictions?${params}`);
  if (!response.ok) throw new Error('Failed to fetch restrictions');
  const { data } = await response.json();
  return data;
}

export async function createRestriction(propertyId: string, restriction: Partial<Restriction>): Promise<Restriction> {
  const response = await fetch(`${BASE_PATH}/restrictions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId, ...restriction }),
  });
  if (!response.ok) throw new Error('Failed to create restriction');
  const { data } = await response.json();
  return data;
}

export async function updateRestriction(restrictionId: string, updates: Partial<Restriction>): Promise<Restriction> {
  const response = await fetch(`${BASE_PATH}/restrictions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restrictionId, ...updates }),
  });
  if (!response.ok) throw new Error('Failed to update restriction');
  const { data } = await response.json();
  return data;
}

export async function deleteRestrictions(restrictionIds: string[]): Promise<void> {
  const response = await fetch(`${BASE_PATH}/restrictions`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restrictionIds }),
  });
  if (!response.ok) throw new Error('Failed to delete restrictions');
}

// Occupancy Restrictions
export async function fetchOccupancyRestrictions(
  propertyId: string,
  startDate: string,
  endDate: string,
  filters?: { roomTypeId?: string; roomId?: string }
): Promise<OccupancyRestriction[]> {
  const params = new URLSearchParams({ propertyId, startDate, endDate });
  if (filters?.roomTypeId) params.append('roomTypeId', filters.roomTypeId);
  if (filters?.roomId) params.append('roomId', filters.roomId);

  const response = await fetch(`${BASE_PATH}/occupancy?${params}`);
  if (!response.ok) throw new Error('Failed to fetch occupancy restrictions');
  const { data } = await response.json();
  return data;
}

export async function createOrUpdateOccupancyRestrictions(propertyId: string, occupancyData: any[]): Promise<OccupancyRestriction[]> {
  const response = await fetch(`${BASE_PATH}/occupancy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId, occupancyData }),
  });
  if (!response.ok) throw new Error('Failed to create/update occupancy restrictions');
  const { data } = await response.json();
  return data;
}

export async function deleteOccupancyRestrictions(occupancyIds: string[]): Promise<void> {
  const response = await fetch(`${BASE_PATH}/occupancy`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ occupancyIds }),
  });
  if (!response.ok) throw new Error('Failed to delete occupancy restrictions');
}

// Recurring Patterns
export async function fetchRecurringPatterns(propertyId: string, filters?: { type?: string; status?: string }): Promise<RecurringPattern[]> {
  const params = new URLSearchParams({ propertyId });
  if (filters?.type) params.append('type', filters.type);
  if (filters?.status) params.append('status', filters.status);

  const response = await fetch(`${BASE_PATH}/patterns?${params}`);
  if (!response.ok) throw new Error('Failed to fetch recurring patterns');
  const { data } = await response.json();
  return data;
}

export async function createRecurringPattern(propertyId: string, pattern: Partial<RecurringPattern>): Promise<RecurringPattern> {
  const response = await fetch(`${BASE_PATH}/patterns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId, ...pattern }),
  });
  if (!response.ok) throw new Error('Failed to create recurring pattern');
  const { data } = await response.json();
  return data;
}

export async function updateRecurringPattern(patternId: string, updates: Partial<RecurringPattern>): Promise<RecurringPattern> {
  const response = await fetch(`${BASE_PATH}/patterns`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patternId, ...updates }),
  });
  if (!response.ok) throw new Error('Failed to update recurring pattern');
  const { data } = await response.json();
  return data;
}

export async function deleteRecurringPatterns(patternIds: string[]): Promise<void> {
  const response = await fetch(`${BASE_PATH}/patterns`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patternIds }),
  });
  if (!response.ok) throw new Error('Failed to delete recurring patterns');
}

// Seasons
export async function fetchSeasons(propertyId: string, status?: string): Promise<Season[]> {
  const params = new URLSearchParams({ propertyId });
  if (status) params.append('status', status);

  const response = await fetch(`${BASE_PATH}/seasons?${params}`);
  if (!response.ok) throw new Error('Failed to fetch seasons');
  const { data } = await response.json();
  return data;
}

export async function createSeason(propertyId: string, season: Partial<Season>): Promise<Season> {
  const response = await fetch(`${BASE_PATH}/seasons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId, ...season }),
  });
  if (!response.ok) throw new Error('Failed to create season');
  const { data } = await response.json();
  return data;
}

export async function updateSeason(seasonId: string, updates: Partial<Season>): Promise<Season> {
  const response = await fetch(`${BASE_PATH}/seasons`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seasonId, ...updates }),
  });
  if (!response.ok) throw new Error('Failed to update season');
  const { data } = await response.json();
  return data;
}

export async function deleteSeasons(seasonIds: string[]): Promise<void> {
  const response = await fetch(`${BASE_PATH}/seasons`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seasonIds }),
  });
  if (!response.ok) throw new Error('Failed to delete seasons');
}

// Audit Log
export async function fetchAuditLogs(
  propertyId: string,
  filters?: { tableName?: string; action?: string; limit?: number }
): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams({ propertyId });
  if (filters?.tableName) params.append('tableName', filters.tableName);
  if (filters?.action) params.append('action', filters.action);
  if (filters?.limit) params.append('limit', filters.limit.toString());

  const response = await fetch(`${BASE_PATH}/audit-log?${params}`);
  if (!response.ok) throw new Error('Failed to fetch audit logs');
  const { data } = await response.json();
  return data;
}

export async function fetchRecordAuditHistory(propertyId: string, recordId: string): Promise<AuditLogEntry[]> {
  const response = await fetch(`${BASE_PATH}/audit-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId, recordId }),
  });
  if (!response.ok) throw new Error('Failed to fetch record audit history');
  const { data } = await response.json();
  return data;
}

// Bulk Operations
export async function bulkOperation(
  propertyId: string,
  operation: string,
  data: Record<string, any>
): Promise<any> {
  const response = await fetch(`${BASE_PATH}/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId, operation, data }),
  });
  if (!response.ok) throw new Error(`Failed to execute bulk operation: ${operation}`);
  return response.json();
}

// Convenience functions for common operations
export async function fillCalendar(
  propertyId: string,
  startDate: string,
  endDate: string,
  status: string,
  options?: { minNights?: number; maxNights?: number; roomTypeId?: string; roomId?: string }
): Promise<AvailabilityEntry[]> {
  const { message, data } = await bulkOperation(propertyId, 'fill-calendar', {
    startDate,
    endDate,
    status,
    ...options,
  });
  return data;
}

export async function applyPattern(
  propertyId: string,
  patternId: string,
  startDate: string,
  endDate: string,
  options?: { roomTypeId?: string; roomId?: string }
): Promise<AvailabilityEntry[]> {
  const { message, data } = await bulkOperation(propertyId, 'apply-pattern', {
    patternId,
    startDate,
    endDate,
    ...options,
  });
  return data;
}

export async function copyAvailabilityPeriod(
  propertyId: string,
  sourceStartDate: string,
  sourceEndDate: string,
  targetStartDate: string,
  options?: { roomTypeId?: string; roomId?: string }
): Promise<AvailabilityEntry[]> {
  const { message, data } = await bulkOperation(propertyId, 'copy-availability', {
    sourceStartDate,
    sourceEndDate,
    targetStartDate,
    ...options,
  });
  return data;
}

export async function copyRatesPeriod(
  propertyId: string,
  ratePlanId: string,
  sourceStartDate: string,
  sourceEndDate: string,
  targetStartDate: string,
  options?: { roomTypeId?: string; roomId?: string }
): Promise<DailyRate[]> {
  const { message, data } = await bulkOperation(propertyId, 'copy-rates', {
    ratePlanId,
    sourceStartDate,
    sourceEndDate,
    targetStartDate,
    ...options,
  });
  return data;
}

export async function applySeason(
  propertyId: string,
  seasonId: string,
  ratePlanId: string
): Promise<DailyRate[]> {
  const { message, data } = await bulkOperation(propertyId, 'apply-seasonal', {
    seasonId,
    ratePlanId,
  });
  return data;
}
