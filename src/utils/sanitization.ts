/**
 * Input Sanitization Utilities
 * Protects against XSS attacks by sanitizing user inputs
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize text input by removing all HTML tags and dangerous patterns
 * @param input - The text to sanitize
 * @returns Sanitized text safe for storage and display
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';
  
  // Remove all HTML tags and dangerous patterns
  const sanitized = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true, // Keep text content
  });
  
  // Additional cleanup for dangerous patterns
  return sanitized
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
    .replace(/<script/gi, '') // Extra script tag protection
    .replace(/<\/script>/gi, '')
    .trim();
}

// Log-scrubbing for the client side: redact `pb_`-prefixed API tokens and JWT
// (jwt.storage) values from anything we send to console, so a token embedded in
// an error message or stack trace can never reach the devtools/console stream.
const LOG_SECRET_PATTERNS: RegExp[] = [
  /pb_[A-Za-z0-9_-]{40,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
];

export function scrubLog(value: unknown): unknown {
  if (typeof value === 'string') {
    let out = value;
    for (const re of LOG_SECRET_PATTERNS) {
      out = out.replace(re, (match) => (match.startsWith('pb_') ? 'pb_[REDACTED]' : '[REDACTED]'));
    }
    return out;
  }
  if (value instanceof Error) return `${value.name}: ${scrubLog(value.message)}`;
  return value;
}

// eslint-disable-next-line no-console
export const safeConsole = {
  error: (...args: unknown[]) => console.error(...args.map(scrubLog)),
};
