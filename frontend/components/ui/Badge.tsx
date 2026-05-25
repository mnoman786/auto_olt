import { clsx } from 'clsx';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';
  children: React.ReactNode;
  className?: string;
}

const variantClasses = {
  default: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
  success: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400',
  warning: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-400',
  error: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400',
  info: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400',
  outline: 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-400 bg-transparent',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      variantClasses[variant],
      className
    )}>
      {children}
    </span>
  );
}

export function OLTStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeProps['variant']> = {
    active: 'success',
    configuring: 'info',
    pending: 'warning',
    error: 'error',
    offline: 'default',
  };
  return <Badge variant={map[status] || 'default'}>{status.toUpperCase()}</Badge>;
}

export function ONUStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeProps['variant']> = {
    active: 'success',
    registered: 'info',
    unregistered: 'default',
    offline: 'error',
    provisioning: 'warning',
  };
  return <Badge variant={map[status] || 'default'}>{status.toUpperCase()}</Badge>;
}

export function LogLevelBadge({ level }: { level: string }) {
  const map: Record<string, BadgeProps['variant']> = {
    success: 'success',
    info: 'info',
    warning: 'warning',
    error: 'error',
  };
  return <Badge variant={map[level] || 'default'}>{level.toUpperCase()}</Badge>;
}
