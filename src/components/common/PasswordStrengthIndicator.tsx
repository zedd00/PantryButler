/**
 * Password Strength Indicator Component
 * Displays real-time password strength feedback
 */

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  validatePassword,
  getPasswordStrengthLabel,
  getPasswordStrengthColor,
  getPasswordStrengthProgress,
  getMetRequirements,
  getUnmetRequirements,
  type PasswordValidationResult,
} from '@/utils/passwordValidation';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
  className?: string;
}

export function PasswordStrengthIndicator({
  password,
  showRequirements = true,
  className = '',
}: PasswordStrengthIndicatorProps) {
  const { t } = useTranslation(['auth', 'common']);
  const [validation, setValidation] = useState<PasswordValidationResult | null>(null);

  useEffect(() => {
    if (password) {
      const result = validatePassword(password, undefined, t);
      setValidation(result);
    } else {
      setValidation(null);
    }
  }, [password, t]);

  if (!password || !validation) {
    return null;
  }

  const progress = getPasswordStrengthProgress(validation.score);
  const strengthLabel = getPasswordStrengthLabel(validation.score, t);
  const strengthColor = getPasswordStrengthColor(validation.score);
  const metRequirements = getMetRequirements(password, t);
  const unmetRequirements = getUnmetRequirements(password, t);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('auth:passwordStrength.label')}</span>
          <span className={`font-medium ${strengthColor}`}>{strengthLabel}</span>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              validation.score === 0
                ? 'bg-red-600'
                : validation.score === 1
                ? 'bg-orange-600'
                : validation.score === 2
                ? 'bg-yellow-600'
                : validation.score === 3
                ? 'bg-green-600'
                : 'bg-emerald-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t('auth:passwordStrength.requirements')}</p>
          <div className="space-y-1">
            {metRequirements.map((req) => (
              <div key={req} className="flex items-center gap-2 text-sm text-green-600">
                <Check className="h-4 w-4 shrink-0" />
                <span>{req}</span>
              </div>
            ))}
            {unmetRequirements.map((req) => (
              <div key={req} className="flex items-center gap-2 text-sm text-muted-foreground">
                <X className="h-4 w-4 shrink-0" />
                <span>{req}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {validation.suggestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{t('auth:passwordStrength.suggestions')}</p>
          <ul className="list-disc list-inside space-y-1">
            {validation.suggestions.map((suggestion, index) => (
              <li key={index} className="text-sm text-muted-foreground">
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Errors */}
      {validation.errors.length > 0 && (
        <div className="space-y-1">
          {validation.errors.map((error, index) => (
            <p key={index} className="text-sm text-red-600">
              {error}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
