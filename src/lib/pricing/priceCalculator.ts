/**
 * Price Calculation Engine
 * 
 * Philosophy: Store base rates and adjustment rules, calculate prices dynamically
 * 
 * Flow:
 * 1. Check if override exists for date+plan → use it ✅
 * 2. Otherwise, calculate: baseRate + adjustment
 * 3. Never store final prices (except overrides)
 */

export type AdjustmentType = 'none' | 'fixed' | 'percentage';

export interface RatePlanRule {
  id: string;
  name: string;
  adjustment_type: AdjustmentType;
  adjustment_value: number;  // Amount to add (fixed) or percentage (percentage)
  is_derived_from_base: boolean;
  nightly_rate?: number;  // Fallback if not derived from base
}

export interface BaseRate {
  id: string;
  room_type_id: string;
  base_price: number;
  start_date: string;  // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD (NULL = open-ended)
  is_active: boolean;
}

export interface RatePlanOverride {
  id: string;
  rate_plan_id: string;
  date: string;  // YYYY-MM-DD
  override_price: number;
  reason?: string;
}

// =====================================================
// MAIN CALCULATION FUNCTION
// =====================================================

/**
 * Calculate the price for a specific rate plan on a specific date
 * 
 * @param date - YYYY-MM-DD format
 * @param baseRate - The base rate for this room on this date
 * @param ratePlan - The rate plan with adjustment rules
 * @param override - Optional override for this specific date+plan
 * @returns The calculated price
 */
export function calculatePrice(
  date: string,
  baseRate: BaseRate | null,
  ratePlan: RatePlanRule,
  override?: RatePlanOverride | null
): number {
  // ✅ STEP 1: Check for override
  if (override && override.date === date) {
    console.log(
      `[PriceCalc] Using override for ${date}: €${override.override_price}`,
      override.reason ? `(${override.reason})` : ''
    );
    return override.override_price;
  }

  // ✅ STEP 2: If plan is NOT derived from base, use its nightly_rate
  if (!ratePlan.is_derived_from_base && ratePlan.nightly_rate) {
    console.log(
      `[PriceCalc] Using non-derived rate for plan "${ratePlan.name}": €${ratePlan.nightly_rate}`
    );
    return ratePlan.nightly_rate;
  }

  // ✅ STEP 3: Calculate from base rate + adjustment
  if (!baseRate) {
    console.warn(`[PriceCalc] No base rate found for date ${date}, falling back to plan nightly_rate`);
    return ratePlan.nightly_rate || 0;
  }

  const base = baseRate.base_price;
  let calculatedPrice = base;

  if (ratePlan.adjustment_type === 'none') {
    calculatedPrice = base;
  } else if (ratePlan.adjustment_type === 'fixed') {
    calculatedPrice = base + ratePlan.adjustment_value;
  } else if (ratePlan.adjustment_type === 'percentage') {
    const percentageAmount = (base * ratePlan.adjustment_value) / 100;
    calculatedPrice = base + percentageAmount;
  }

  console.log(
    `[PriceCalc] Calculated price for "${ratePlan.name}" on ${date}:`,
    `Base: €${base} + ${ratePlan.adjustment_type}(${ratePlan.adjustment_value}) = €${calculatedPrice}`
  );

  return calculatedPrice;
}

// =====================================================
// HELPER: Get base rate for a specific date
// =====================================================

/**
 * Find the active base rate that applies to a specific date
 */
export function getBaseRateForDate(
  date: string,
  baseRates: BaseRate[]
): BaseRate | null {
  // Sort by start_date descending (most recent first)
  const sorted = [...baseRates].sort((a, b) => {
    return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
  });

  for (const rate of sorted) {
    if (!rate.is_active) continue;

    const dateObj = new Date(date);
    const startObj = new Date(rate.start_date);
    const endObj = rate.end_date ? new Date(rate.end_date) : null;

    // Check if date is within range
    if (dateObj >= startObj && (!endObj || dateObj <= endObj)) {
      return rate;
    }
  }

  return null;
}

// =====================================================
// HELPER: Batch calculate prices for date range
// =====================================================

export interface PriceForDate {
  date: string;
  price: number;
  baseRate: number;
  adjustment: number;
  adjustmentType: AdjustmentType;
  isOverride: boolean;
}

/**
 * Calculate prices for a date range for a specific rate plan
 */
export function calculatePricesForDateRange(
  startDate: string,
  endDate: string,
  ratePlan: RatePlanRule,
  baseRates: BaseRate[],
  overrides: RatePlanOverride[] = []
): PriceForDate[] {
  const prices: PriceForDate[] = [];
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    const dateStr = current.toISOString().split('T')[0];
    const baseRate = getBaseRateForDate(dateStr, baseRates);
    const override = overrides.find(o => o.date === dateStr && o.rate_plan_id === ratePlan.id);
    
    const price = calculatePrice(dateStr, baseRate, ratePlan, override);
    
    prices.push({
      date: dateStr,
      price,
      baseRate: baseRate?.base_price || 0,
      adjustment: ratePlan.adjustment_value,
      adjustmentType: ratePlan.adjustment_type,
      isOverride: !!override,
    });
  }

  return prices;
}

// =====================================================
// HELPER: Show price breakdown for transparency
// =====================================================

export function getPriceBreakdown(
  date: string,
  baseRate: BaseRate | null,
  ratePlan: RatePlanRule,
  override?: RatePlanOverride | null
): {
  breakdown: string;
  finalPrice: number;
} {
  if (override) {
    return {
      breakdown: `Override: €${override.override_price}`,
      finalPrice: override.override_price,
    };
  }

  if (!ratePlan.is_derived_from_base && ratePlan.nightly_rate) {
    return {
      breakdown: `Fixed Rate: €${ratePlan.nightly_rate}`,
      finalPrice: ratePlan.nightly_rate,
    };
  }

  if (!baseRate) {
    return {
      breakdown: `Fallback: €${ratePlan.nightly_rate || 0}`,
      finalPrice: ratePlan.nightly_rate || 0,
    };
  }

  const base = baseRate.base_price;
  let breakdown = `Base: €${base}`;
  let adjustment = 0;

  if (ratePlan.adjustment_type === 'fixed') {
    adjustment = ratePlan.adjustment_value;
    breakdown += ` + Fixed €${adjustment}`;
  } else if (ratePlan.adjustment_type === 'percentage') {
    adjustment = (base * ratePlan.adjustment_value) / 100;
    breakdown += ` + ${ratePlan.adjustment_value}% (€${adjustment})`;
  }

  const finalPrice = base + adjustment;
  return {
    breakdown: `${breakdown} = €${finalPrice}`,
    finalPrice,
  };
}

// =====================================================
// TYPE GUARDS
// =====================================================

export function isValidAdjustmentType(value: any): value is AdjustmentType {
  return ['none', 'fixed', 'percentage'].includes(value);
}

export function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}
