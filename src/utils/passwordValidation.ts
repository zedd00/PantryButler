/**
 * Password Validation Utilities
 * Enforces strong password policy
 */

import zxcvbn from 'zxcvbn';

// Common passwords to block
const COMMON_PASSWORDS = [
  'password', 'password123', '123456', '12345678', 'qwerty', 'abc123',
  'monkey', 'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou',
  'master', 'sunshine', 'ashley', 'bailey', 'shadow', 'superman',
  'qazwsx', 'michael', 'football', 'welcome', 'jesus', 'ninja',
  'mustang', 'password1', 'admin', 'root', 'test', 'user',
  '1234', '12345', '123456789', '1234567890', 'admin123'
];

export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  blockCommonPasswords: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
  score: number; // 0-4
  suggestions: string[];
}

export type TranslateFn = (key: string, opts?: Record<string, unknown>) => string;

const passthroughTranslate: TranslateFn = (key) => key;

// Default password requirements
export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  blockCommonPasswords: true,
};

/**
 * Validate password against requirements
 * @param password - Password to validate
 * @param requirements - Password requirements (optional, uses defaults)
 * @returns Validation result with errors and suggestions
 */
export function validatePassword(
  password: string,
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS,
  translate: TranslateFn = passthroughTranslate
): PasswordValidationResult {
  const errors: string[] = [];
  
  // Check minimum length
  if (password.length < requirements.minLength) {
    errors.push(translate('auth:passwordTooShort', { minLength: requirements.minLength }));
  }
  
  // Check uppercase
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push(translate('auth:passwordMissingUppercase'));
  }
  
  // Check lowercase
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push(translate('auth:passwordMissingLowercase'));
  }
  
  // Check numbers
  if (requirements.requireNumbers && !/[0-9]/.test(password)) {
    errors.push(translate('auth:passwordMissingNumber'));
  }
  
  // Check special characters
  if (requirements.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push(translate('auth:passwordMissingSpecial'));
  }
  
  // Check common passwords
  if (requirements.blockCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.includes(lowerPassword)) {
      errors.push(translate('auth:passwordTooCommon'));
    }
  }
  
  // Use zxcvbn for strength analysis
  const result = zxcvbn(password);
  
  // Map zxcvbn score (0-4) to strength label
  const strengthLabels: Array<'weak' | 'fair' | 'good' | 'strong' | 'very-strong'> = [
    'weak',
    'fair',
    'good',
    'strong',
    'very-strong'
  ];
  
  return {
    isValid: errors.length === 0 && result.score >= 2, // Require at least "good" strength
    errors,
    strength: strengthLabels[result.score],
    score: result.score,
    suggestions: result.feedback.suggestions || [],
  };
}

/**
 * Get password strength label
 * @param score - Password strength score (0-4)
 * @returns Human-readable strength label
 */
export function getPasswordStrengthLabel(score: number, translate: TranslateFn = passthroughTranslate): string {
  const labels = [
    'auth:passwordStrength.veryWeak',
    'auth:passwordStrength.weak',
    'auth:passwordStrength.fair',
    'auth:passwordStrength.strong',
    'auth:passwordStrength.veryStrong'
  ];
  return translate(labels[Math.max(0, Math.min(4, score))]);
}

/**
 * Get password strength color
 * @param score - Password strength score (0-4)
 * @returns Tailwind color class
 */
export function getPasswordStrengthColor(score: number): string {
  const colors = [
    'text-red-600',
    'text-orange-600',
    'text-yellow-600',
    'text-green-600',
    'text-emerald-600'
  ];
  return colors[Math.max(0, Math.min(4, score))];
}

/**
 * Get password strength progress percentage
 * @param score - Password strength score (0-4)
 * @returns Percentage (0-100)
 */
export function getPasswordStrengthProgress(score: number): number {
  return (score / 4) * 100;
}

/**
 * Get list of unmet requirements
 * @param password - Password to check
 * @returns Array of requirement descriptions that are not met
 */
export function getUnmetRequirements(password: string, translate: TranslateFn = passthroughTranslate): string[] {
  const requirements = [];
  
  if (password.length < DEFAULT_PASSWORD_REQUIREMENTS.minLength) {
    requirements.push(translate('auth:passwordStrength.minLength', { minLength: DEFAULT_PASSWORD_REQUIREMENTS.minLength }));
  }
  
  if (!/[A-Z]/.test(password)) {
    requirements.push(translate('auth:passwordStrength.uppercase'));
  }
  
  if (!/[a-z]/.test(password)) {
    requirements.push(translate('auth:passwordStrength.lowercase'));
  }
  
  if (!/[0-9]/.test(password)) {
    requirements.push(translate('auth:passwordStrength.number'));
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    requirements.push(translate('auth:passwordStrength.special'));
  }
  
  return requirements;
}

/**
 * Get list of met requirements
 * @param password - Password to check
 * @returns Array of requirement descriptions that are met
 */
export function getMetRequirements(password: string, translate: TranslateFn = passthroughTranslate): string[] {
  const requirements = [];
  
  if (password.length >= DEFAULT_PASSWORD_REQUIREMENTS.minLength) {
    requirements.push(translate('auth:passwordStrength.minLength', { minLength: DEFAULT_PASSWORD_REQUIREMENTS.minLength }));
  }
  
  if (/[A-Z]/.test(password)) {
    requirements.push(translate('auth:passwordStrength.uppercase'));
  }
  
  if (/[a-z]/.test(password)) {
    requirements.push(translate('auth:passwordStrength.lowercase'));
  }
  
  if (/[0-9]/.test(password)) {
    requirements.push(translate('auth:passwordStrength.number'));
  }
  
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    requirements.push(translate('auth:passwordStrength.special'));
  }
  
  return requirements;
}
