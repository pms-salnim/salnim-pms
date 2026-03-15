/**
 * Firestore utilities
 * Helper functions for Firestore operations
 */

/**
 * Recursively converts undefined values to null in an object
 * Required for Firestore compatibility (Firestore doesn't support undefined)
 * 
 * @param obj - Object to clean
 * @returns Object with undefined replaced by null
 */
export function cleanFirestoreData(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanFirestoreData(item));
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  const cleaned: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (value === undefined) {
        cleaned[key] = null;
      } else if (value !== null && typeof value === 'object' && typeof value.toDate !== 'function' && !Array.isArray(value)) {
        // Recursively clean nested objects, but skip Timestamps (which have toDate method)
        cleaned[key] = cleanFirestoreData(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}
