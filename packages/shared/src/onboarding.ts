/**
 * Phase 8 company onboarding: the guided setup steps (with stable help
 * identifiers that Phase 9 documentation and Phase 10 tours will attach to)
 * and the industry starter packs. Packs only create reviewable master data and
 * DRAFT checklist templates; they never publish templates or create schedules,
 * so no live tasks are generated without an administrator's decision.
 */
import type { AnswerType as QuestionType } from './tasks';

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  /** Stable identifier for help articles and guided tours (Phases 9–10). */
  helpId: string;
  /** Admin route where the work is done. */
  route: string;
  optional?: boolean;
};
export const onboardingSteps: OnboardingStep[] = [
  {
    id: 'company',
    title: 'Company information',
    description: 'Name, contact details and time zone.',
    helpId: 'setup.company',
    route: '/company',
  },
  {
    id: 'branding',
    title: 'Logo & preferences',
    description: 'Logo, colours, currency and report header/footer.',
    helpId: 'setup.branding',
    route: '/onboarding?step=branding',
  },
  {
    id: 'site',
    title: 'First site',
    description:
      'Your first building or premises (no client or contract needed).',
    helpId: 'setup.site',
    route: '/sites',
  },
  {
    id: 'locations',
    title: 'Buildings, floors & rooms',
    description: 'Floors, rooms and common areas inside the site.',
    helpId: 'setup.locations',
    route: '/locations',
  },
  {
    id: 'departments',
    title: 'Departments',
    description: 'Teams such as Housekeeping or MEP.',
    helpId: 'setup.departments',
    route: '/departments',
  },
  {
    id: 'employees',
    title: 'Employees',
    description: 'Add people one by one or import them from Excel.',
    helpId: 'setup.employees',
    route: '/employees',
  },
  {
    id: 'roles',
    title: 'Roles & permissions',
    description: 'Review what each role can do.',
    helpId: 'setup.roles',
    route: '/roles',
    optional: true,
  },
  {
    id: 'assets',
    title: 'Assets & facilities',
    description: 'Furniture, equipment and facilities to look after.',
    helpId: 'setup.assets',
    route: '/assets',
  },
  {
    id: 'templates',
    title: 'Task templates',
    description:
      'Install a starter pack or build checklists, then publish them.',
    helpId: 'setup.templates',
    route: '/task-templates',
  },
  {
    id: 'schedules',
    title: 'Recurring schedules',
    description: 'Decide which checklists run automatically and when.',
    helpId: 'setup.schedules',
    route: '/recurring-tasks',
  },
  {
    id: 'staff',
    title: 'Staff access',
    description: 'Invite staff and link their logins to employees.',
    helpId: 'setup.staff',
    route: '/staff-access',
  },
  {
    id: 'review',
    title: 'Review & activate',
    description: 'Check the summary and mark setup complete.',
    helpId: 'setup.review',
    route: '/onboarding?step=review',
  },
];
export type SetupFacts = Partial<Record<string, number | boolean>>;
/** A step is done when its records exist, or when the admin marked it done. */
export function stepDone(
  id: string,
  facts: SetupFacts,
  marked: Record<string, boolean> = {},
) {
  if (marked[id]) return true;
  switch (id) {
    case 'company':
      return !!facts.companyComplete;
    case 'branding':
      return !!facts.branding;
    case 'site':
      return Number(facts.sites || 0) > 0;
    case 'locations':
      return Number(facts.locations || 0) > 0;
    case 'departments':
      return Number(facts.departments || 0) > 0;
    case 'employees':
      return Number(facts.employees || 0) > 0;
    case 'assets':
      return Number(facts.assets || 0) + Number(facts.facilities || 0) > 0;
    case 'templates':
      return Number(facts.taskTemplates || 0) > 0;
    case 'schedules':
      return Number(facts.recurringSchedules || 0) > 0;
    case 'staff':
      return Number(facts.staffLinks || 0) > 0;
    default:
      return false;
  }
}
export function setupProgress(
  facts: SetupFacts,
  marked: Record<string, boolean> = {},
) {
  const required = onboardingSteps.filter(
    (s) => !s.optional && s.id !== 'review',
  );
  const done = required.filter((s) => stepDone(s.id, facts, marked)).length;
  return {
    percent: Math.round((done / required.length) * 100),
    done,
    total: required.length,
    outstanding: required.filter((s) => !stepDone(s.id, facts, marked)),
  };
}

/* ============================================================ starter packs */
export type PackTemplate = {
  code: string;
  name: string;
  category: string;
  /** Suggested recurrence, shown to the admin — not scheduled automatically. */
  recurrence: string;
  questions: { label: string; type: QuestionType }[];
};
export type StarterPack = {
  id: string;
  name: string;
  description: string;
  departments: { code: string; name: string }[];
  designations: { code: string; name: string; department: string }[];
  categories: { code: string; name: string }[];
  templates: PackTemplate[];
  slaSuggestions: string[];
};
const pf = (label: string) => ({ label, type: 'pass_fail' as QuestionType });
const yn = (label: string) => ({ label, type: 'yes_no' as QuestionType });
const tx = (label: string) => ({ label, type: 'text' as QuestionType });
const common = {
  departments: [
    { code: 'HK', name: 'Housekeeping' },
    { code: 'MEP', name: 'MEP / Technical' },
    { code: 'SEC', name: 'Security' },
  ],
  designations: [
    { code: 'CLEANER', name: 'Cleaner', department: 'HK' },
    { code: 'HK-SUP', name: 'Housekeeping Supervisor', department: 'HK' },
    { code: 'TECH', name: 'Technician', department: 'MEP' },
    { code: 'GUARD', name: 'Security Guard', department: 'SEC' },
  ],
  categories: [
    { code: 'CLEAN', name: 'Cleaning' },
    { code: 'MAINT', name: 'Maintenance' },
    { code: 'SAFETY', name: 'Safety' },
    { code: 'SECURITY', name: 'Security' },
  ],
};
const T = {
  commonArea: {
    code: 'COMMON-CLEAN',
    name: 'Common area cleaning',
    category: 'CLEAN',
    recurrence: 'Daily, twice (morning and afternoon)',
    questions: [
      pf('Floors clean and dry'),
      pf('Bins emptied'),
      pf('Glass and surfaces wiped'),
      tx('Remarks'),
    ],
  },
  washroom: {
    code: 'WASHROOM',
    name: 'Washroom inspection',
    category: 'CLEAN',
    recurrence: 'Every 2 hours during opening hours',
    questions: [
      pf('Toilets and basins clean'),
      yn('Soap and tissue refilled'),
      pf('No leaks or odours'),
      tx('Remarks'),
    ],
  },
  ac: {
    code: 'AC-INSPECT',
    name: 'AC inspection',
    category: 'MAINT',
    recurrence: 'Monthly per unit',
    questions: [
      pf('Cooling normal'),
      pf('Filter clean'),
      pf('No water leak'),
      tx('Faults found'),
    ],
  },
  fire: {
    code: 'FIRE-CHECK',
    name: 'Fire safety check',
    category: 'SAFETY',
    recurrence: 'Weekly',
    questions: [
      pf('Extinguishers present and in date'),
      pf('Exit routes clear'),
      pf('Alarm panel normal'),
      tx('Remarks'),
    ],
  },
  generator: {
    code: 'GEN-CHECK',
    name: 'Generator check',
    category: 'MAINT',
    recurrence: 'Weekly',
    questions: [
      pf('Fuel level adequate'),
      pf('Test run completed'),
      pf('No leaks'),
      tx('Readings / remarks'),
    ],
  },
  pump: {
    code: 'PUMP-CHECK',
    name: 'Water pump inspection',
    category: 'MAINT',
    recurrence: 'Weekly',
    questions: [
      pf('Pump running normally'),
      pf('Pressure normal'),
      pf('No leaks or noise'),
    ],
  },
  patrol: {
    code: 'SEC-PATROL',
    name: 'Security patrol',
    category: 'SECURITY',
    recurrence: 'Every 2 hours, 24/7',
    questions: [
      yn('All doors secured'),
      yn('Unusual activity observed'),
      tx('Notes'),
    ],
  },
  waste: {
    code: 'WASTE',
    name: 'Waste management',
    category: 'CLEAN',
    recurrence: 'Daily',
    questions: [
      pf('Waste collected and segregated'),
      pf('Bin area clean'),
      yn('Collection by contractor done'),
    ],
  },
  reception: {
    code: 'RECEPTION',
    name: 'Reception inspection',
    category: 'CLEAN',
    recurrence: 'Daily before opening',
    questions: [
      pf('Reception tidy'),
      pf('Lighting working'),
      yn('Visitor log available'),
    ],
  },
  room: {
    code: 'ROOM-CLEAN',
    name: 'Office / room cleaning',
    category: 'CLEAN',
    recurrence: 'Daily (weekdays)',
    questions: [
      pf('Desks and chairs clean'),
      pf('Floor vacuumed/mopped'),
      pf('Bins emptied'),
    ],
  },
  housekeeping: {
    code: 'GUEST-ROOM',
    name: 'Guest room housekeeping',
    category: 'CLEAN',
    recurrence: 'Daily per occupied room',
    questions: [
      pf('Bed made, linen changed'),
      pf('Bathroom cleaned'),
      yn('Amenities restocked'),
      tx('Damage or lost items'),
    ],
  },
  dock: {
    code: 'DOCK-CHECK',
    name: 'Loading dock inspection',
    category: 'SAFETY',
    recurrence: 'Daily',
    questions: [
      pf('Dock area clear'),
      pf('Dock levellers working'),
      pf('Racking undamaged'),
    ],
  },
  storeFront: {
    code: 'STOREFRONT',
    name: 'Store front & signage',
    category: 'CLEAN',
    recurrence: 'Daily before opening',
    questions: [pf('Entrance clean'), pf('Signage lit'), pf('Displays tidy')],
  },
} satisfies Record<string, PackTemplate>;
const sla = [
  'Critical: respond in 1 hour, resolve in 4 hours',
  'High: respond in 4 hours, resolve in 1 day',
  'Medium: respond in 1 day, resolve in 3 days',
  'Low: respond in 2 days, resolve in 7 days',
];
export const starterPacks: StarterPack[] = [
  {
    id: 'business_center',
    name: 'Business centre',
    description:
      'Serviced offices with shared pantry, meeting rooms and common areas.',
    ...common,
    templates: [
      T.commonArea,
      T.ac,
      T.fire,
      T.washroom,
      T.generator,
      T.pump,
      T.patrol,
      T.waste,
      T.reception,
      T.room,
    ],
    slaSuggestions: sla,
  },
  {
    id: 'commercial',
    name: 'Commercial building',
    description: 'Multi-tenant offices and retail podiums.',
    ...common,
    templates: [
      T.commonArea,
      T.ac,
      T.fire,
      T.washroom,
      T.generator,
      T.pump,
      T.patrol,
      T.waste,
    ],
    slaSuggestions: sla,
  },
  {
    id: 'residential',
    name: 'Residential building',
    description: 'Apartments with common facilities.',
    ...common,
    templates: [T.commonArea, T.fire, T.pump, T.patrol, T.waste, T.generator],
    slaSuggestions: sla,
  },
  {
    id: 'hotel',
    name: 'Hotel',
    description: 'Guest rooms, public areas and back-of-house.',
    ...common,
    templates: [
      T.housekeeping,
      T.commonArea,
      T.washroom,
      T.ac,
      T.fire,
      T.generator,
      T.patrol,
      T.waste,
    ],
    slaSuggestions: sla,
  },
  {
    id: 'warehouse',
    name: 'Warehouse',
    description: 'Storage, docks and racking.',
    ...common,
    templates: [T.dock, T.fire, T.generator, T.patrol, T.waste, T.commonArea],
    slaSuggestions: sla,
  },
  {
    id: 'retail',
    name: 'Retail facility',
    description: 'Shops and malls.',
    ...common,
    templates: [
      T.storeFront,
      T.commonArea,
      T.washroom,
      T.ac,
      T.fire,
      T.patrol,
      T.waste,
    ],
    slaSuggestions: sla,
  },
  {
    id: 'corporate',
    name: 'Corporate office',
    description: 'Single-occupier offices.',
    ...common,
    templates: [
      T.room,
      T.commonArea,
      T.washroom,
      T.ac,
      T.fire,
      T.reception,
      T.waste,
    ],
    slaSuggestions: sla,
  },
];
