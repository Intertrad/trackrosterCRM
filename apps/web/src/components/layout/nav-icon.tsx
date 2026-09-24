import {
  BadgeCheck,
  Building2,
  CalendarCheck2,
  ClipboardList,
  FileSearch,
  LayoutDashboard,
  ListChecks,
  Map as MapIcon,
  MessageCircle,
  Navigation,
  Settings,
  ShieldAlert,
  Upload,
  Users,
} from 'lucide-react';

import type { NavigationIconId } from '@/lib/auth/navigation';

const ICONS = {
  today: CalendarCheck2,
  prospects: Building2,
  map: MapIcon,
  actions: ListChecks,
  routes: Navigation,
  messages: MessageCircle,
  dashboard: LayoutDashboard,
  team: Users,
  assignments: ClipboardList,
  campaigns: Navigation,
  reports: BadgeCheck,
  imports: Upload,
  administration: Settings,
  overrides: ShieldAlert,
  collisions: ShieldAlert,
  audit: FileSearch,
  settings: Settings,
} as const satisfies Record<NavigationIconId, unknown>;

export function NavIcon({ id, className }: { id: NavigationIconId; className?: string }) {
  const Component = ICONS[id];

  return <Component aria-hidden="true" className={className} strokeWidth={1.8} />;
}
