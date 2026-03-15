import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
      } else if (value !== null && typeof value === 'object') {
        cleaned[key] = cleanFirestoreData(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}
