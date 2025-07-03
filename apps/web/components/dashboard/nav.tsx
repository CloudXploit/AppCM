'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/ui/icons';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NavItem {
  title: string;
  href: string;
  icon: keyof typeof Icons;
  badge?: number;
}

const navItems: NavItem[] = [
  {
    title: 'Overview',
    href: '/dashboard',
    icon: 'dashboard',
  },
  {
    title: 'Systems',
    href: '/dashboard/systems',
    icon: 'server',
  },
  {
    title: 'Diagnostics',
    href: '/dashboard/diagnostics',
    icon: 'activity',
  },
  {
    title: 'Findings',
    href: '/dashboard/findings',
    icon: 'alertTriangle',
  },
  {
    title: 'Remediation',
    href: '/dashboard/remediation',
    icon: 'wrench',
  },
  {
    title: 'Reports',
    href: '/dashboard/reports',
    icon: 'fileText',
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: 'settings',
  },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col border-r bg-gray-50/40 dark:bg-gray-900/40 w-16 lg:w-64">
      <div className="flex h-[60px] items-center border-b px-4 lg:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <Icons.logo className="h-6 w-6" />
          <span className="hidden lg:inline-block">CM Diagnostics</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <TooltipProvider delayDuration={0}>
          <ul className="grid gap-1 px-2">
            {navItems.map((item) => {
              const Icon = Icons[item.icon];
              const isActive = pathname === item.href || 
                (item.href !== '/dashboard' && pathname.startsWith(item.href));
              
              return (
                <li key={item.href}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          'hover:bg-gray-100 dark:hover:bg-gray-800',
                          isActive
                            ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50'
                            : 'text-gray-600 dark:text-gray-400'
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="hidden lg:inline-block">{item.title}</span>
                        {item.badge && (
                          <span className="ml-auto hidden lg:inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-100 px-1.5 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="lg:hidden">
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </TooltipProvider>
      </div>
      <div className="border-t p-2">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/dashboard/help"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  'hover:bg-gray-100 dark:hover:bg-gray-800',
                  'text-gray-600 dark:text-gray-400'
                )}
              >
                <Icons.help className="h-4 w-4 flex-shrink-0" />
                <span className="hidden lg:inline-block">Help & Support</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="lg:hidden">
              Help & Support
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </nav>
  );
}