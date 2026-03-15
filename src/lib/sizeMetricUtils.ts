/**
 * Utility functions for handling size metrics (ft², m², sqm)
 */

export type SizeMetric = 'sqft' | 'sqm' | 'hectare';

export function getSizeMetricUnit(metric: SizeMetric): string {
  switch (metric) {
    case 'sqft':
      return 'ft²';
    case 'sqm':
      return 'm²';
    case 'hectare':
      return 'ha';
    default:
      return 'ft²';
  }
}

export function getSizeMetricLabel(metric: SizeMetric): string {
  switch (metric) {
    case 'sqft':
      return 'Square Feet (ft²)';
    case 'sqm':
      return 'Square Meters (m²)';
    case 'hectare':
      return 'Hectares (ha)';
    default:
      return 'Square Feet (ft²)';
  }
}

export function convertSize(value: number, from: SizeMetric, to: SizeMetric): number {
  if (from === to) return value;

  // Convert to base unit (ft²)
  let baseFt2 = value;
  if (from === 'm2' || from === 'sqm') {
    baseFt2 = value * 10.764; // 1 m² = 10.764 ft²
  }

  // Convert from base unit to target
  if (to === 'm2' || to === 'sqm') {
    return baseFt2 / 10.764;
  }

  return baseFt2;
}
