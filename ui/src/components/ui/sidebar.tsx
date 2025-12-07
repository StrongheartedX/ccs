import * as React from 'react';
import { cn } from '@/lib/utils';

const SidebarContext = React.createContext<{ open: boolean; toggleOpen: () => void } | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true);
  const toggleOpen = () => setOpen(!open);

  return (
    <SidebarContext.Provider value={{ open, toggleOpen }}>
      <div className="flex h-screen w-full">{children}</div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({ children }: { children: React.ReactNode }) {
  const context = React.useContext(SidebarContext);
  if (!context) return null;

  return (
    <aside className={cn('flex flex-col border-r bg-sidebar w-64 transition-all', !context.open && 'w-0 overflow-hidden')}>
      {children}
    </aside>
  );
}

export function SidebarHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-4 py-3', className)}>{children}</div>;
}

export function SidebarContent({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto py-2">{children}</div>;
}

export function SidebarMenu({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-1 px-2">{children}</ul>;
}

export function SidebarMenuItem({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>;
}

interface SidebarMenuButtonProps {
  children: React.ReactNode;
  isActive?: boolean;
  asChild?: boolean;
}

export function SidebarMenuButton({ children, isActive, asChild }: SidebarMenuButtonProps) {
  const className = cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
    isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
  );

  if (asChild) {
    return <div className={className}>{children}</div>;
  }

  return <button className={className}>{children}</button>;
}

export function SidebarTrigger() {
  const context = React.useContext(SidebarContext);
  if (!context) return null;

  return (
    <button onClick={context.toggleOpen} className="p-2 hover:bg-accent rounded">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="3" x2="21" y1="6" y2="6" />
        <line x1="3" x2="21" y1="12" y2="12" />
        <line x1="3" x2="21" y1="18" y2="18" />
      </svg>
    </button>
  );
}
