import {
  LayoutDashboard,
  Building2,
  MapPin,
  Waves,
  Shapes,
  Handshake,
  FileSignature,
  Link2,
  Users,
  Network,
  BadgeCheck,
  UsersRound,
  Clock3,
  CalendarOff,
  ShieldCheck,
  Boxes,
  FolderTree,
  Armchair,
  Wrench,
  ArrowLeftRight,
  Package,
  Tags,
  Truck,
  Warehouse,
  BarChart3,
  Receipt,
  ClipboardCheck,
  Hammer,
  ClipboardList,
  Gauge,
  FolderKanban,
  UserCheck,
  History,
  Settings,
  KeyRound,
  SlidersHorizontal,
  CalendarDays,
  CalendarRange,
  Repeat,
  LayoutGrid,
  AlertTriangle,
  MessageSquareWarning,
  Megaphone,
  Timer,
  ShieldAlert,
  Bell,
  BellRing,
  Server,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import type { Kind } from '@facilityos/shared';

export type Page = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Generic record page: one or more record kinds shown as tabs. */
  kinds?: Kind[];
  /** Fixed asset-class filter for asset sub-registers. */
  assetClasses?: string[];
  /** Custom screen rendered by App. */
  screen?:
    | 'overview'
    | 'balances'
    | 'movements'
    | 'transfers'
    | 'roles'
    | 'access'
    | 'company'
    | 'taskDashboard'
    | 'tasks'
    | 'taskAssignments'
    | 'approvals'
    | 'taskHistory'
    | 'calendar'
    | 'recurring'
    | 'staffWorkload'
    | 'groupedWorkload'
    | 'maintenanceDashboard'
    | 'pmPlans'
    | 'maintenanceCalendar'
    | 'workOrders'
    | 'assetHistory'
    | 'reportedIssues'
    | 'complaints'
    | 'escalations'
    | 'slaMonitor'
    | 'notificationCenter'
    | 'notificationSettings'
    | 'schedulerMonitor';
  /** Not yet available: shown with a phase label. */
  phase?: number;
  description?: string;
};
export type Group = { id: string; label: string; pages: Page[] };

export const groups: Group[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    pages: [
      { id: '', label: 'Overview', icon: LayoutDashboard, screen: 'overview' },
    ],
  },
  {
    id: 'property',
    label: 'Property',
    pages: [
      { id: 'sites', label: 'Sites', icon: Building2, kinds: ['sites'] },
      {
        id: 'locations',
        label: 'Locations',
        icon: MapPin,
        kinds: ['locations'],
      },
      {
        id: 'facilities',
        label: 'Facilities',
        icon: Waves,
        kinds: ['facilities'],
      },
      {
        id: 'facility-types',
        label: 'Facility types',
        icon: Shapes,
        kinds: ['facilityTypes'],
      },
    ],
  },
  {
    id: 'commercial',
    label: 'Clients & contracts',
    pages: [
      { id: 'clients', label: 'Clients', icon: Handshake, kinds: ['clients'] },
      {
        id: 'contracts',
        label: 'Contracts',
        icon: FileSignature,
        kinds: ['contracts'],
      },
      {
        id: 'allocations',
        label: 'Contract allocations',
        icon: Link2,
        kinds: ['contractAllocations'],
      },
    ],
  },
  {
    id: 'people',
    label: 'People & teams',
    pages: [
      {
        id: 'employees',
        label: 'Employees',
        icon: Users,
        kinds: ['employees', 'siteAssignments'],
      },
      {
        id: 'departments',
        label: 'Departments',
        icon: Network,
        kinds: ['departments'],
      },
      {
        id: 'designations',
        label: 'Designations',
        icon: BadgeCheck,
        kinds: ['designations'],
      },
      {
        id: 'teams',
        label: 'Teams',
        icon: UsersRound,
        kinds: ['teams', 'teamMembers'],
      },
      {
        id: 'shifts',
        label: 'Shifts',
        icon: Clock3,
        kinds: ['shifts', 'shiftAssignments'],
      },
      {
        id: 'leave',
        label: 'Leave & holidays',
        icon: CalendarOff,
        kinds: ['leaveRecords', 'holidays'],
      },
      {
        id: 'roles',
        label: 'Roles & permissions',
        icon: ShieldCheck,
        screen: 'roles',
      },
    ],
  },
  {
    id: 'assets',
    label: 'Assets',
    pages: [
      { id: 'assets', label: 'Asset register', icon: Boxes, kinds: ['assets'] },
      {
        id: 'asset-categories',
        label: 'Categories',
        icon: FolderTree,
        kinds: ['assetCategories'],
      },
      {
        id: 'furniture',
        label: 'Furniture & fixtures',
        icon: Armchair,
        kinds: ['assets'],
        assetClasses: ['Furniture', 'Fixture'],
      },
      {
        id: 'equipment',
        label: 'Equipment',
        icon: Wrench,
        kinds: ['assets'],
        assetClasses: ['Equipment', 'Tool', 'IT equipment', 'Vehicle'],
      },
      {
        id: 'asset-transfers',
        label: 'Asset transfers',
        icon: ArrowLeftRight,
        screen: 'transfers',
      },
    ],
  },
  {
    id: 'inventory',
    label: 'Materials & inventory',
    pages: [
      {
        id: 'materials',
        label: 'Materials',
        icon: Package,
        kinds: ['materials'],
      },
      {
        id: 'material-categories',
        label: 'Material categories',
        icon: Tags,
        kinds: ['materialCategories'],
      },
      {
        id: 'suppliers',
        label: 'Suppliers',
        icon: Truck,
        kinds: ['suppliers'],
      },
      { id: 'stores', label: 'Stores', icon: Warehouse, kinds: ['stores'] },
      {
        id: 'stock',
        label: 'Stock balance',
        icon: BarChart3,
        screen: 'balances',
      },
      {
        id: 'stock-transactions',
        label: 'Stock transactions',
        icon: Receipt,
        screen: 'movements',
      },
    ],
  },
  {
    id: 'tasks',
    label: 'Task management',
    pages: [
      {
        id: 'task-dashboard',
        label: 'Task dashboard',
        icon: Gauge,
        screen: 'taskDashboard',
      },
      {
        id: 'task-calendar',
        label: 'Task calendar',
        icon: CalendarDays,
        screen: 'calendar',
      },
      {
        id: 'tasks',
        label: 'Task register',
        icon: ClipboardCheck,
        screen: 'tasks',
      },
      {
        id: 'recurring-tasks',
        label: 'Recurring tasks',
        icon: Repeat,
        screen: 'recurring',
      },
      {
        id: 'staff-workload',
        label: 'Staff workload',
        icon: Users,
        screen: 'staffWorkload',
      },
      {
        id: 'site-team-view',
        label: 'Site & team view',
        icon: LayoutGrid,
        screen: 'groupedWorkload',
      },
      {
        id: 'task-assignments',
        label: 'Task assignments',
        icon: UserCheck,
        screen: 'taskAssignments',
      },
      {
        id: 'approvals',
        label: 'Pending approvals',
        icon: BadgeCheck,
        screen: 'approvals',
      },
      {
        id: 'task-history',
        label: 'Task history',
        icon: History,
        screen: 'taskHistory',
      },
      {
        id: 'task-categories',
        label: 'Task categories',
        icon: FolderKanban,
        kinds: ['taskCategories'],
      },
      {
        id: 'task-templates',
        label: 'Task templates',
        icon: ClipboardList,
        kinds: ['taskTemplates'],
      },
    ],
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    pages: [
      {
        id: 'maintenance',
        label: 'Maintenance dashboard',
        icon: Hammer,
        screen: 'maintenanceDashboard',
      },
      {
        id: 'pm-plans',
        label: 'Preventive plans',
        icon: CalendarRange,
        screen: 'pmPlans',
      },
      {
        id: 'maintenance-calendar',
        label: 'Maintenance calendar',
        icon: CalendarDays,
        screen: 'maintenanceCalendar',
      },
      {
        id: 'work-orders',
        label: 'Work orders',
        icon: Wrench,
        screen: 'workOrders',
      },
      {
        id: 'asset-history',
        label: 'Asset maintenance history',
        icon: ScrollText,
        screen: 'assetHistory',
      },
    ],
  },
  {
    id: 'issues',
    label: 'Issues & escalations',
    pages: [
      {
        id: 'reported-issues',
        label: 'Reported issues',
        icon: AlertTriangle,
        screen: 'reportedIssues',
      },
      {
        id: 'complaints',
        label: 'Complaints',
        icon: MessageSquareWarning,
        screen: 'complaints',
      },
      {
        id: 'escalations',
        label: 'Escalations',
        icon: Megaphone,
        screen: 'escalations',
      },
      {
        id: 'sla',
        label: 'SLA monitoring',
        icon: ShieldAlert,
        screen: 'slaMonitor',
      },
      {
        id: 'sla-policies',
        label: 'SLA policies',
        icon: Timer,
        kinds: ['slaPolicies'],
      },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    pages: [
      {
        id: 'notifications',
        label: 'Notification centre',
        icon: Bell,
        screen: 'notificationCenter',
      },
      {
        id: 'notification-settings',
        label: 'Notification settings',
        icon: BellRing,
        screen: 'notificationSettings',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    pages: [
      {
        id: 'company',
        label: 'Company settings',
        icon: Settings,
        screen: 'company',
      },
      { id: 'access', label: 'User access', icon: KeyRound, screen: 'access' },
      {
        id: 'scheduler',
        label: 'Scheduler monitor',
        icon: Server,
        screen: 'schedulerMonitor',
      },
      {
        id: 'system',
        label: 'System settings',
        icon: SlidersHorizontal,
        phase: 7,
      },
    ],
  },
];
export const pages = groups.flatMap((g) =>
  g.pages.map((p) => ({ ...p, group: g })),
);
export function pageForPath(path: string) {
  const id = path.replace(/^\/+/, '').split('/')[0];
  return pages.find((p) => p.id === id);
}
/** Where users manage each record kind. */
export function pathForKind(kind: Kind) {
  const p = pages.find((x) => x.kinds?.includes(kind) && !x.assetClasses);
  return '/' + (p?.id ?? '');
}
