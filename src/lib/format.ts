/**
 * Format number, only show decimal places when there is a fractional part
 * @param value The number to format
 * @param maxDecimals Maximum decimal places (default 2)
 * @returns Formatted string
 */
export function formatAmount(value: number, maxDecimals: number = 2): string {
  // Coerce to a finite number (DB NUMERIC arrives as a string from node-postgres)
  const num = typeof value === 'number' && Number.isFinite(value)
    ? value
    : parseFloat(String(value ?? ''));
  if (!Number.isFinite(num)) return '0';

  // If it's an integer, return the integer part directly
  if (Number.isInteger(num)) {
    return num.toString();
  }
  
  // Has decimal part, keep specified digits and remove trailing zeros
  const fixed = num.toFixed(maxDecimals);
  return parseFloat(fixed).toString();
}

/**
 * Format instance name for display with "Kitchen" suffix
 * Avoids duplication if the name already ends with "kitchen" (case-insensitive)
 * @param instanceName The instance name to format
 * @returns Formatted instance name with Kitchen suffix if needed
 */
export function formatInstanceName(instanceName: string | null | undefined): string {
  if (!instanceName) return 'Unknown Kitchen';
  
  const trimmed = instanceName.trim();
  const lowerName = trimmed.toLowerCase();
  
  // Check if name already ends with "kitchen"
  if (lowerName.endsWith('kitchen')) {
    return trimmed;
  }
  
  return `${trimmed}'s Kitchen`;
}
