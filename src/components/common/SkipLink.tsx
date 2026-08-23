import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface SkipLinkProps {
  href?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * SkipLink component provides a way for keyboard users to skip repetitive navigation.
 * It's visually hidden until focused, meeting WCAG 2.1 SC 2.4.1 (Bypass Blocks).
 * 
 * Usage: Place at the very beginning of your page/layout, before any other content.
 */
export function SkipLink({ 
  href = '#main-content', 
  children,
  className 
}: SkipLinkProps) {
  const { t } = useTranslation('common');
  return (
    <Link
      to={href}
      className={cn(
        'absolute left-0 top-0 z-[9999] -translate-y-full',
        'bg-primary text-primary-foreground px-4 py-2 rounded-br-md',
        'focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'transition-transform duration-200',
        'font-medium text-sm',
        className
      )}
      onClick={(e) => {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.setAttribute('tabindex', '-1');
          (target as HTMLElement).focus();
          target.removeAttribute('tabindex');
        }
      }}
    >
      {children ?? t('ui.skipToMainContent')}
    </Link>
  );
}
