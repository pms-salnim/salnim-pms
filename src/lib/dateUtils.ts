export function toDate(val: any): Date | undefined {
  if (!val) return undefined;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}
