import { z } from 'zod';
import timeZones from './time-zones.json';
export { timeZones };
import { Timestamp } from 'firebase/firestore';
import { unitOptions } from './inventory';

/** Phase 1 property/commercial records. Their persisted shape is unchanged. */
export const phase1Kinds = [
  'clients',
  'contracts',
  'sites',
  'contractAllocations',
  'locations',
  'facilityTypes',
  'facilities',
] as const;
/**
 * Phase 2 people, asset and inventory masters. Every record attaches to physical
 * company/site/location IDs and never to a transient client or contract.
 */
export const phase2Kinds = [
  'departments',
  'designations',
  'employees',
  'teams',
  'teamMembers',
  'siteAssignments',
  'shifts',
  'shiftAssignments',
  'holidays',
  'leaveRecords',
  'assetCategories',
  'suppliers',
  'assets',
  'materialCategories',
  'materials',
  'stores',
] as const;
export const kinds = [...phase1Kinds, ...phase2Kinds] as const;
export type Kind = (typeof kinds)[number];
export type Phase2Kind = (typeof phase2Kinds)[number];
export function isPhase2(kind: string): kind is Phase2Kind {
  return (phase2Kinds as readonly string[]).includes(kind);
}
export type Values = Record<string, string>;
export type FieldType =
  | 'email'
  | 'date'
  | 'time'
  | 'textarea'
  | 'integer'
  | 'decimal'
  | 'money'
  | 'uid';
export type FieldSpec = {
  key: string;
  label: string;
  required?: boolean;
  options?: string[];
  reference?: Kind;
  type?: FieldType;
  max?: number;
  /** Form group heading. */
  section?: string;
  /** Short helper text shown under the input. */
  help?: string;
  /**
   * Phase 2 only: false marks an informational link that is validated by the
   * transaction but does not protect the target from archive.
   */
  counted?: boolean;
  /** Reference picker only lists top-level records (two-level hierarchies). */
  rootOnly?: boolean;
  /** Reference picker is limited to records whose `siteId` equals this field. */
  scopedBy?: string;
  /** Value cannot change after creation. */
  immutable?: boolean;
  /** Inclusive numeric bounds for integer fields. */
  minValue?: number;
  maxValue?: number;
};
export type Definition = {
  title: string;
  singular: string;
  description: string;
  fields: FieldSpec[];
  /** Columns shown after code/name in tables. */
  columns: string[];
  /** Records whose code and name are generated from their links. */
  autoCode?: string;
};
const conditions = ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'];
const days = 'Mon,Tue,Wed,Thu,Fri,Sat,Sun'.split(',');
export const weekDays = days;
export const definitions: Record<Kind, Definition> = {
  clients: {
    title: 'Clients',
    singular: 'client',
    description:
      'Organisations and individuals your company serves. Clients connect to sites only through contract allocations.',
    columns: ['clientType', 'contactPerson', 'phone'],
    fields: [
      {
        key: 'clientType',
        label: 'Client type',
        required: true,
        options: ['Individual', 'Company'],
        section: 'General',
      },
      { key: 'contactPerson', label: 'Contact person', section: 'Contact' },
      { key: 'phone', label: 'Phone', section: 'Contact' },
      { key: 'email', label: 'Email', type: 'email', section: 'Contact' },
      {
        key: 'address',
        label: 'Address',
        type: 'textarea',
        section: 'Contact',
      },
      { key: 'country', label: 'Country', section: 'Contact' },
      { key: 'vatNumber', label: 'Tax / VAT identifier', section: 'Contact' },
    ],
  },
  contracts: {
    title: 'Contracts',
    singular: 'contract',
    description:
      'Commercial agreements with a client. Allocations link a contract to the sites or spaces it covers.',
    columns: ['clientId', 'startDate', 'endDate'],
    fields: [
      {
        key: 'clientId',
        label: 'Client',
        required: true,
        reference: 'clients',
        section: 'General',
      },
      {
        key: 'startDate',
        label: 'Start date',
        required: true,
        type: 'date',
        section: 'Term',
      },
      {
        key: 'endDate',
        label: 'End date',
        required: true,
        type: 'date',
        section: 'Term',
      },
      {
        key: 'serviceDescription',
        label: 'Services covered',
        type: 'textarea',
        section: 'Term',
      },
    ],
  },
  sites: {
    title: 'Sites',
    singular: 'site',
    description:
      'Physical properties your company manages. Sites exist independently of clients and contracts.',
    columns: ['propertyType', 'city', 'timeZone'],
    fields: [
      {
        key: 'propertyType',
        label: 'Property type',
        required: true,
        section: 'General',
        options: [
          'Residential tower',
          'Commercial building',
          'Villa',
          'Warehouse',
          'Hotel',
          'Shopping mall',
          'School',
          'Hospital',
          'Factory',
          'Office',
          'Outdoor property',
          'Other',
        ],
      },
      {
        key: 'address',
        label: 'Address',
        type: 'textarea',
        section: 'Address',
      },
      { key: 'country', label: 'Country', section: 'Address' },
      { key: 'city', label: 'City', section: 'Address' },
      {
        key: 'timeZone',
        label: 'Time zone',
        required: true,
        options: timeZones,
        section: 'Working hours',
      },
      { key: 'workingDays', label: 'Working days', section: 'Working hours' },
      {
        key: 'opensAt',
        label: 'Opening time',
        type: 'time',
        section: 'Working hours',
      },
      {
        key: 'closesAt',
        label: 'Closing time',
        type: 'time',
        section: 'Working hours',
      },
      { key: 'contactPerson', label: 'Contact person', section: 'Contact' },
      { key: 'phone', label: 'Contact phone', section: 'Contact' },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        section: 'Contact',
      },
    ],
  },
  locations: {
    title: 'Locations',
    singular: 'location',
    description:
      'Buildings, floors, rooms and outdoor areas inside a site, arranged as a flexible tree.',
    columns: ['siteId', 'locationType', 'floorNumber'],
    fields: [
      {
        key: 'siteId',
        label: 'Site',
        required: true,
        reference: 'sites',
        section: 'Placement',
      },
      {
        key: 'parentId',
        label: 'Parent location',
        reference: 'locations',
        scopedBy: 'siteId',
        section: 'Placement',
        help: 'Leave empty for a top-level location in the site.',
      },
      {
        key: 'locationType',
        label: 'Location type',
        required: true,
        section: 'General',
        options: [
          'Building',
          'Floor',
          'Zone',
          'Room',
          'Corridor',
          'Parking',
          'Outdoor area',
          'Common area',
          'Custom',
        ],
      },
      { key: 'floorNumber', label: 'Floor number', section: 'General' },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        section: 'General',
      },
    ],
  },
  contractAllocations: {
    title: 'Contract allocations',
    singular: 'allocation',
    description:
      'Connect a contract to an existing site or space. The client is always taken from the contract.',
    columns: ['contractId', 'siteId', 'allocationType', 'startDate', 'endDate'],
    fields: [
      {
        key: 'contractId',
        label: 'Contract',
        required: true,
        reference: 'contracts',
        section: 'Allocation',
      },
      {
        key: 'siteId',
        label: 'Site',
        required: true,
        reference: 'sites',
        section: 'Allocation',
      },
      {
        key: 'locationId',
        label: 'Space (empty for whole-site service)',
        reference: 'locations',
        scopedBy: 'siteId',
        section: 'Allocation',
      },
      {
        key: 'allocationType',
        label: 'Allocation type',
        required: true,
        section: 'Allocation',
        options: [
          'service_coverage',
          'exclusive_occupancy',
          'shared_occupancy',
        ],
      },
      {
        key: 'startDate',
        label: 'Start date',
        required: true,
        type: 'date',
        section: 'Dates',
      },
      {
        key: 'endDate',
        label: 'End date',
        required: true,
        type: 'date',
        section: 'Dates',
      },
      {
        key: 'effectiveEndDate',
        label: 'Effective termination date',
        type: 'date',
        section: 'Dates',
      },
    ],
  },
  facilityTypes: {
    title: 'Facility types',
    singular: 'facility type',
    description: 'Company-defined categories such as pools, kitchens or lifts.',
    columns: ['description'],
    fields: [
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        section: 'General',
      },
    ],
  },
  facilities: {
    title: 'Facilities',
    singular: 'facility',
    description:
      'Serviceable areas and installations at a physical location, with condition history.',
    columns: ['siteId', 'locationId', 'typeId', 'condition'],
    fields: [
      {
        key: 'siteId',
        label: 'Site',
        required: true,
        reference: 'sites',
        section: 'Placement',
      },
      {
        key: 'locationId',
        label: 'Location',
        required: true,
        reference: 'locations',
        scopedBy: 'siteId',
        section: 'Placement',
      },
      {
        key: 'typeId',
        label: 'Facility type',
        required: true,
        reference: 'facilityTypes',
        section: 'General',
      },
      {
        key: 'condition',
        label: 'Condition',
        required: true,
        options: conditions,
        section: 'General',
      },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        section: 'General',
      },
    ],
  },
  // ---------------------------------------------------------------- Phase 2
  departments: {
    title: 'Departments',
    singular: 'department',
    description:
      'Organisational units. Leave the site empty for a company-wide department. Hierarchy supports one parent level.',
    columns: ['parentId', 'siteId', 'managerId'],
    fields: [
      {
        key: 'parentId',
        label: 'Parent department',
        reference: 'departments',
        rootOnly: true,
        section: 'Structure',
        help: 'Optional. Only top-level departments can be parents.',
      },
      {
        key: 'siteId',
        label: 'Site',
        reference: 'sites',
        section: 'Structure',
        help: 'Leave empty for a company-wide department.',
      },
      {
        key: 'managerId',
        label: 'Department manager',
        reference: 'employees',
        counted: false,
        section: 'Structure',
      },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        section: 'Structure',
      },
    ],
  },
  designations: {
    title: 'Designations',
    singular: 'designation',
    description:
      'Job titles. A designation describes a job; it never grants application access.',
    columns: ['departmentId', 'grade'],
    fields: [
      {
        key: 'departmentId',
        label: 'Department',
        reference: 'departments',
        section: 'General',
      },
      { key: 'grade', label: 'Grade / level', section: 'General' },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        section: 'General',
      },
    ],
  },
  employees: {
    title: 'Employees',
    singular: 'employee',
    description:
      'Employee records are separate from login accounts. Linking a login grants no access; roles are provisioned by the trusted operator.',
    columns: ['designationId', 'departmentId', 'primarySiteId', 'phone'],
    fields: [
      {
        key: 'email',
        label: 'Work email',
        type: 'email',
        section: 'Contact',
      },
      { key: 'phone', label: 'Phone', section: 'Contact' },
      {
        key: 'joiningDate',
        label: 'Joining date',
        type: 'date',
        required: true,
        section: 'Employment',
      },
      {
        key: 'employmentType',
        label: 'Employment type',
        required: true,
        options: ['Full-time', 'Part-time', 'Contract', 'Temporary'],
        section: 'Employment',
      },
      {
        key: 'departmentId',
        label: 'Department',
        required: true,
        reference: 'departments',
        section: 'Organisation',
      },
      {
        key: 'designationId',
        label: 'Designation',
        required: true,
        reference: 'designations',
        section: 'Organisation',
      },
      {
        key: 'supervisorId',
        label: 'Supervisor',
        reference: 'employees',
        counted: false,
        section: 'Organisation',
      },
      {
        key: 'primarySiteId',
        label: 'Primary site',
        reference: 'sites',
        counted: false,
        section: 'Organisation',
        help: 'Additional sites, teams and shifts are assigned from the employee page.',
      },
      {
        key: 'linkedUid',
        label: 'Login account UID',
        type: 'uid',
        section: 'Login account',
        help: 'Optional association with an existing sign-in account. It does not grant any role or access.',
      },
    ],
  },
  teams: {
    title: 'Teams',
    singular: 'team',
    description: 'Working teams with a leader, department and home site.',
    columns: ['departmentId', 'siteId', 'leaderId'],
    fields: [
      {
        key: 'departmentId',
        label: 'Department',
        reference: 'departments',
        section: 'General',
      },
      {
        key: 'siteId',
        label: 'Home site',
        reference: 'sites',
        counted: false,
        section: 'General',
      },
      {
        key: 'leaderId',
        label: 'Team leader',
        reference: 'employees',
        counted: false,
        section: 'General',
      },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        section: 'General',
      },
    ],
  },
  teamMembers: {
    title: 'Team memberships',
    singular: 'team membership',
    description:
      'Effective-dated team membership. End a membership instead of deleting it so history is kept.',
    autoCode: 'TM',
    columns: ['teamId', 'employeeId', 'memberRole', 'startDate', 'endDate'],
    fields: [
      {
        key: 'teamId',
        label: 'Team',
        required: true,
        reference: 'teams',
        immutable: true,
        section: 'Membership',
      },
      {
        key: 'employeeId',
        label: 'Employee',
        required: true,
        reference: 'employees',
        immutable: true,
        section: 'Membership',
      },
      {
        key: 'memberRole',
        label: 'Role in team',
        required: true,
        options: ['Member', 'Deputy lead', 'Lead'],
        section: 'Membership',
      },
      {
        key: 'startDate',
        label: 'Start date',
        required: true,
        type: 'date',
        section: 'Dates',
      },
      { key: 'endDate', label: 'End date', type: 'date', section: 'Dates' },
    ],
  },
  siteAssignments: {
    title: 'Site assignments',
    singular: 'site assignment',
    description: 'Effective-dated assignment of an employee to a site.',
    autoCode: 'SA',
    columns: ['employeeId', 'siteId', 'assignmentRole', 'startDate', 'endDate'],
    fields: [
      {
        key: 'employeeId',
        label: 'Employee',
        required: true,
        reference: 'employees',
        immutable: true,
        section: 'Assignment',
      },
      {
        key: 'siteId',
        label: 'Site',
        required: true,
        reference: 'sites',
        immutable: true,
        section: 'Assignment',
      },
      {
        key: 'assignmentRole',
        label: 'Assignment role',
        required: true,
        options: ['Assigned staff', 'Site supervisor', 'Relief cover'],
        section: 'Assignment',
      },
      {
        key: 'startDate',
        label: 'Start date',
        required: true,
        type: 'date',
        section: 'Dates',
      },
      { key: 'endDate', label: 'End date', type: 'date', section: 'Dates' },
    ],
  },
  shifts: {
    title: 'Shifts',
    singular: 'shift',
    description:
      'Working-time patterns in the site time zone. An end time earlier than the start time is an overnight shift.',
    columns: ['siteId', 'startTime', 'endTime', 'workingDays'],
    fields: [
      {
        key: 'siteId',
        label: 'Site',
        required: true,
        reference: 'sites',
        immutable: true,
        section: 'General',
        help: 'Shift times use this site’s time zone.',
      },
      {
        key: 'startTime',
        label: 'Start time',
        required: true,
        type: 'time',
        section: 'Schedule',
      },
      {
        key: 'endTime',
        label: 'End time',
        required: true,
        type: 'time',
        section: 'Schedule',
      },
      {
        key: 'breakMinutes',
        label: 'Break (minutes)',
        type: 'integer',
        minValue: 0,
        maxValue: 600,
        section: 'Schedule',
      },
      { key: 'workingDays', label: 'Working days', section: 'Schedule' },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        section: 'General',
      },
    ],
  },
  shiftAssignments: {
    title: 'Shift assignments',
    singular: 'shift assignment',
    description: 'Effective-dated shift rota for an employee.',
    autoCode: 'SH',
    columns: ['employeeId', 'shiftId', 'startDate', 'endDate'],
    fields: [
      {
        key: 'employeeId',
        label: 'Employee',
        required: true,
        reference: 'employees',
        immutable: true,
        section: 'Assignment',
      },
      {
        key: 'shiftId',
        label: 'Shift',
        required: true,
        reference: 'shifts',
        immutable: true,
        section: 'Assignment',
      },
      {
        key: 'startDate',
        label: 'Effective from',
        required: true,
        type: 'date',
        section: 'Dates',
      },
      {
        key: 'endDate',
        label: 'Effective until',
        type: 'date',
        section: 'Dates',
      },
    ],
  },
  holidays: {
    title: 'Holidays',
    singular: 'holiday',
    description:
      'Public and company holidays. Leave the site empty for a company-wide holiday.',
    columns: ['holidayDate', 'siteId'],
    fields: [
      {
        key: 'holidayDate',
        label: 'Date',
        required: true,
        type: 'date',
        section: 'General',
      },
      {
        key: 'siteId',
        label: 'Site',
        reference: 'sites',
        counted: false,
        section: 'General',
        help: 'Leave empty to apply to all sites.',
      },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        section: 'General',
      },
    ],
  },
  leaveRecords: {
    title: 'Leave records',
    singular: 'leave record',
    description:
      'Planned and approved absence. Recorded by administrators; staff self-service arrives with the staff app.',
    autoCode: 'LV',
    columns: ['employeeId', 'leaveType', 'startDate', 'endDate'],
    fields: [
      {
        key: 'employeeId',
        label: 'Employee',
        required: true,
        reference: 'employees',
        counted: false,
        immutable: true,
        section: 'Leave',
      },
      {
        key: 'leaveType',
        label: 'Leave type',
        required: true,
        options: ['Annual', 'Sick', 'Unpaid', 'Emergency', 'Parental', 'Other'],
        section: 'Leave',
      },
      {
        key: 'startDate',
        label: 'First day',
        required: true,
        type: 'date',
        section: 'Dates',
      },
      {
        key: 'endDate',
        label: 'Last day',
        required: true,
        type: 'date',
        section: 'Dates',
      },
      { key: 'reason', label: 'Reason', type: 'textarea', section: 'Leave' },
    ],
  },
  assetCategories: {
    title: 'Asset categories',
    singular: 'asset category',
    description: 'Categories and one level of subcategories for assets.',
    columns: ['parentId', 'assetClass'],
    fields: [
      {
        key: 'parentId',
        label: 'Parent category',
        reference: 'assetCategories',
        rootOnly: true,
        section: 'General',
        help: 'Optional. Choose a top-level category to create a subcategory.',
      },
      {
        key: 'assetClass',
        label: 'Default asset class',
        required: true,
        options: [
          'Equipment',
          'Furniture',
          'Fixture',
          'Tool',
          'IT equipment',
          'Vehicle',
          'Other',
        ],
        section: 'General',
      },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        section: 'General',
      },
    ],
  },
  suppliers: {
    title: 'Suppliers',
    singular: 'supplier',
    description: 'Vendors for assets, materials and services.',
    columns: ['supplierType', 'contactPerson', 'phone'],
    fields: [
      {
        key: 'supplierType',
        label: 'Supplies',
        required: true,
        options: ['Assets', 'Materials', 'Assets and materials', 'Services'],
        section: 'General',
      },
      { key: 'contactPerson', label: 'Contact person', section: 'Contact' },
      { key: 'phone', label: 'Phone', section: 'Contact' },
      { key: 'email', label: 'Email', type: 'email', section: 'Contact' },
      {
        key: 'address',
        label: 'Address',
        type: 'textarea',
        section: 'Contact',
      },
      { key: 'country', label: 'Country', section: 'Contact' },
      { key: 'vatNumber', label: 'Tax / VAT identifier', section: 'Contact' },
    ],
  },
  assets: {
    title: 'Asset register',
    singular: 'asset',
    description:
      'Individually tracked equipment, tools, furniture and fixtures, plus non-serialised furniture batches. Assets belong to physical locations, never to a client.',
    columns: ['assetTag', 'assetClass', 'locationId', 'condition'],
    fields: [
      {
        key: 'assetTag',
        label: 'External / legacy tag',
        max: 40,
        section: 'Identification',
        help: 'Optional manufacturer or previous tag. The asset code is the permanent, unique label used for QR codes.',
      },
      {
        key: 'assetClass',
        label: 'Asset class',
        required: true,
        options: [
          'Equipment',
          'Furniture',
          'Fixture',
          'Tool',
          'IT equipment',
          'Vehicle',
          'Other',
        ],
        section: 'Identification',
      },
      {
        key: 'categoryId',
        label: 'Category',
        required: true,
        reference: 'assetCategories',
        section: 'Identification',
      },
      {
        key: 'trackingMode',
        label: 'Tracking',
        required: true,
        options: ['individual', 'batch'],
        immutable: true,
        section: 'Identification',
        help: 'Batch tracking is for identical, non-serialised items such as chairs.',
      },
      {
        key: 'quantity',
        label: 'Quantity',
        required: true,
        type: 'integer',
        minValue: 1,
        maxValue: 100000,
        section: 'Identification',
      },
      {
        key: 'serialNumber',
        label: 'Serial number',
        section: 'Identification',
      },
      { key: 'brand', label: 'Brand', section: 'Identification' },
      { key: 'model', label: 'Model', section: 'Identification' },
      {
        key: 'siteId',
        label: 'Site',
        required: true,
        reference: 'sites',
        counted: false,
        section: 'Location',
      },
      {
        key: 'locationId',
        label: 'Location',
        required: true,
        reference: 'locations',
        scopedBy: 'siteId',
        section: 'Location',
        help: 'After creation, use Transfer to move the asset.',
      },
      {
        key: 'facilityId',
        label: 'Related facility',
        reference: 'facilities',
        counted: false,
        scopedBy: 'siteId',
        section: 'Location',
      },
      {
        key: 'condition',
        label: 'Condition',
        required: true,
        options: conditions,
        section: 'Condition',
      },
      {
        key: 'custodianId',
        label: 'Custodian',
        reference: 'employees',
        counted: false,
        section: 'Responsibility',
      },
      {
        key: 'departmentId',
        label: 'Responsible department',
        reference: 'departments',
        counted: false,
        section: 'Responsibility',
      },
      {
        key: 'supplierId',
        label: 'Supplier',
        reference: 'suppliers',
        counted: false,
        section: 'Purchase & warranty',
      },
      {
        key: 'purchaseDate',
        label: 'Purchase date',
        type: 'date',
        section: 'Purchase & warranty',
      },
      {
        key: 'purchaseCost',
        label: 'Purchase cost',
        type: 'money',
        section: 'Purchase & warranty',
        help: 'In the company’s accounting currency.',
      },
      {
        key: 'warrantyEndDate',
        label: 'Warranty end date',
        type: 'date',
        section: 'Purchase & warranty',
      },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        section: 'Identification',
      },
    ],
  },
  materialCategories: {
    title: 'Material categories',
    singular: 'material category',
    description: 'Groups of consumable materials.',
    columns: ['description'],
    fields: [
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        section: 'General',
      },
    ],
  },
  materials: {
    title: 'Materials',
    singular: 'material',
    description:
      'Consumables measured in exact units. Stock changes only through posted transactions.',
    columns: ['categoryId', 'unit', 'reorderLevel'],
    fields: [
      {
        key: 'categoryId',
        label: 'Category',
        required: true,
        reference: 'materialCategories',
        section: 'General',
      },
      {
        key: 'unit',
        label: 'Unit of measure',
        required: true,
        options: unitOptions,
        immutable: true,
        section: 'Stock control',
        help: 'Cannot change after creation, so recorded quantities stay exact.',
      },
      {
        key: 'reorderLevel',
        label: 'Reorder level',
        type: 'decimal',
        section: 'Stock control',
        help: 'Balances at or below this level are flagged for reorder.',
      },
      {
        key: 'preferredSupplierId',
        label: 'Preferred supplier',
        reference: 'suppliers',
        counted: false,
        section: 'Stock control',
      },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        section: 'General',
      },
    ],
  },
  stores: {
    title: 'Stores',
    singular: 'store',
    description: 'Stock locations at a physical site.',
    columns: ['siteId', 'locationId', 'storeKeeperId'],
    fields: [
      {
        key: 'siteId',
        label: 'Site',
        required: true,
        reference: 'sites',
        immutable: true,
        section: 'Placement',
      },
      {
        key: 'locationId',
        label: 'Location',
        reference: 'locations',
        scopedBy: 'siteId',
        section: 'Placement',
      },
      {
        key: 'storeKeeperId',
        label: 'Store keeper',
        reference: 'employees',
        counted: false,
        section: 'Placement',
      },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        section: 'Placement',
      },
    ],
  },
};
/** Assignment-style records release their references when they end. */
export const assignmentKinds = [
  'teamMembers',
  'siteAssignments',
  'shiftAssignments',
] as const;
export function isAssignment(kind: string) {
  return (assignmentKinds as readonly string[]).includes(kind);
}
export function statuses(kind: Kind) {
  if (kind === 'contractAllocations')
    return ['draft', 'active', 'terminated', 'expired', 'archived'];
  if (kind === 'facilities')
    return ['active', 'under_maintenance', 'out_of_service', 'archived'];
  if (kind === 'contracts') return ['draft', 'active', 'expired', 'archived'];
  if (kind === 'employees')
    return [
      'active',
      'probation',
      'suspended',
      'resigned',
      'terminated',
      'archived',
    ];
  if (isAssignment(kind)) return ['active', 'ended', 'archived'];
  if (kind === 'leaveRecords')
    return ['planned', 'approved', 'taken', 'cancelled', 'archived'];
  if (kind === 'assets')
    return [
      'in_service',
      'in_storage',
      'under_maintenance',
      'out_of_service',
      'disposed',
      'archived',
    ];
  return ['active', 'archived'];
}
/** Statuses in which a record no longer holds its references. */
export function releasedStatuses(kind: Kind) {
  return kind === 'contractAllocations'
    ? ['terminated', 'expired', 'archived']
    : isAssignment(kind)
      ? ['ended', 'archived']
      : ['archived'];
}
export function initialStatus(kind: Kind) {
  return statuses(kind)[0];
}
export function fieldsFor(kind: Kind): FieldSpec[] {
  return [
    {
      key: 'code',
      label:
        kind === 'contracts'
          ? 'Contract reference'
          : kind === 'employees'
            ? 'Employee ID'
            : kind === 'assets'
              ? 'Asset code'
              : 'Code',
      required: true,
      max: 40,
      section: 'General',
    },
    {
      key: 'name',
      label: kind === 'employees' ? 'Full name' : 'Name',
      required: true,
      max: 120,
      section: 'General',
    },
    ...definitions[kind].fields,
    { key: 'notes', label: 'Notes', type: 'textarea', section: 'Notes' },
    {
      key: 'status',
      label: kind === 'employees' ? 'Employment status' : 'Status',
      required: true,
      options: statuses(kind),
      section: 'General',
    },
  ];
}
/** Phase 2 references that maintain archive-protection counters. */
export function countedReferences(kind: Kind) {
  return definitions[kind].fields.filter(
    (f) => f.reference && f.counted !== false,
  );
}
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const patterns = {
  code: /^[A-Z0-9][A-Z0-9_-]{0,39}$/,
  integer: /^(0|[1-9][0-9]{0,6})$/,
  decimal: /^(0|[1-9][0-9]{0,8})(\.[0-9]{1,3})?$/,
  money: /^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$/,
  uid: /^[A-Za-z0-9]{1,128}$/,
  time: /^([01]\d|2[0-3]):[0-5]\d$/,
};
export function validDate(x: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(x) &&
    !isNaN(Date.parse(x)) &&
    new Date(x).toISOString().slice(0, 10) === x
  );
}
export function inputSchema(kind: Kind) {
  const shape: Record<string, z.ZodType<string>> = {};
  for (const f of fieldsFor(kind)) {
    let s = z.string().max(f.max || (f.type === 'textarea' ? 2000 : 200));
    if (f.required) s = s.min(1, 'Required');
    let v: z.ZodType<string> = s;
    if (f.options)
      v = s.refine((x) => f.options!.includes(x), 'Choose a valid option');
    if (f.reference)
      v = s.refine(
        (x) => !x || identifier.safeParse(x).success,
        'Select a valid record',
      );
    if (f.type === 'email')
      v = s.refine(
        (x) => !x || z.email().safeParse(x).success,
        'Enter a valid email',
      );
    if (f.type === 'date')
      v = s.refine(
        (x) => (!f.required && x === '') || validDate(x),
        'Enter a valid date',
      );
    if (f.type === 'time')
      v = s.refine((x) => !x || patterns.time.test(x), 'Enter a valid time');
    if (f.type === 'integer')
      v = s.refine(
        (x) =>
          (!f.required && x === '') ||
          (patterns.integer.test(x) &&
            Number(x) >= (f.minValue ?? 0) &&
            Number(x) <= (f.maxValue ?? 9999999)),
        `Enter a whole number from ${f.minValue ?? 0} to ${f.maxValue ?? 9999999}`,
      );
    if (f.type === 'decimal')
      v = s.refine(
        (x) => !x || patterns.decimal.test(x),
        'Enter a number with up to 3 decimals',
      );
    if (f.type === 'money')
      v = s.refine(
        (x) => !x || patterns.money.test(x),
        'Enter an amount such as 1250.00',
      );
    if (f.type === 'uid')
      v = s.refine(
        (x) => !x || patterns.uid.test(x),
        'Enter the account UID (letters and numbers only)',
      );
    shape[f.key] = v;
  }
  shape.code = z
    .string()
    .regex(patterns.code, 'Use uppercase letters, numbers, - or _');
  if (kind === 'sites' || kind === 'shifts') {
    if (kind === 'sites')
      shape.timeZone = z
        .string()
        .refine(
          (x) => timeZones.includes(x),
          'Choose a supported IANA time zone',
        );
    shape.workingDays = z
      .string()
      .refine(
        (x) =>
          !x ||
          (x.split(',').length <= 7 &&
            x.split(',').every((d) => days.includes(d))),
        'Select valid working days',
      );
  }
  return z
    .object(shape)
    .strict()
    .superRefine((v, ctx) => {
      const error = (key: string, message: string) =>
        ctx.addIssue({ code: 'custom', path: [key], message });
      if (kind === 'contractAllocations') {
        if (v.allocationType !== 'service_coverage') {
          if (!v.locationId)
            error('locationId', 'Choose a space for occupancy');
          if (v.startDate.slice(0, 4) !== v.endDate.slice(0, 4))
            error(
              'endDate',
              'Occupancy must fit one calendar year. Split multi-year contracts into annual allocations.',
            );
        }
        if (
          v.status === 'terminated' &&
          (!v.effectiveEndDate ||
            v.effectiveEndDate < v.startDate ||
            v.effectiveEndDate > v.endDate)
        )
          error(
            'effectiveEndDate',
            'Choose a date within the allocation interval',
          );
        if (
          !['terminated', 'archived'].includes(v.status) &&
          v.effectiveEndDate
        )
          error(
            'effectiveEndDate',
            'Only termination uses an effective end date',
          );
      }
      if (
        ['contracts', 'contractAllocations', 'leaveRecords'].includes(kind) &&
        v.endDate < v.startDate
      )
        error('endDate', 'End date must follow start date');
      if (isAssignment(kind)) {
        if (v.endDate && v.endDate < v.startDate)
          error('endDate', 'End date must follow start date');
        if (v.status === 'ended' && !v.endDate)
          error('endDate', 'Enter the date this assignment ended');
      }
      if (kind === 'shifts' && v.startTime === v.endTime)
        error('endTime', 'End time must differ from start time');
      if (kind === 'assets') {
        if (v.trackingMode === 'individual' && v.quantity !== '1')
          error('quantity', 'Individually tracked assets have quantity 1');
        if (v.trackingMode === 'batch' && v.serialNumber)
          error(
            'serialNumber',
            'Batches are not serialised. Track serialised items individually.',
          );
        if (
          v.purchaseDate &&
          v.warrantyEndDate &&
          v.warrantyEndDate < v.purchaseDate
        )
          error('warrantyEndDate', 'Warranty must end after purchase');
      }
    });
}
export type Operation = {
  id: string;
  companyId: string;
  schemaVersion: 1 | 2;
  legacyLinks?: { clientId: string; contractId: string };
  clientIdSnapshot?: string;
  /** Assets: the transfer that last moved the asset ('' if never moved). */
  lastTransferId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
  revision: number;
  refCount: number;
  witnessKind: string;
  witnessId: string;
  values: Values;
};
export function parseOperation(
  kind: Kind,
  id: string,
  raw: Record<string, unknown>,
): Operation {
  const {
    companyId,
    schemaVersion,
    createdAt,
    updatedAt,
    createdBy,
    updatedBy,
    revision,
    refCount,
    witnessKind,
    witnessId,
    clientIdSnapshot,
    lastTransferId,
    ...storedValues
  } = raw;
  const legacyLinks =
    kind === 'sites' && schemaVersion === 1
      ? {
          clientId: String(storedValues.clientId || ''),
          contractId: String(storedValues.contractId || ''),
        }
      : undefined;
  const values = { ...storedValues };
  if (kind === 'sites') {
    delete values.clientId;
    delete values.contractId;
  }
  const metadata = z
    .object({
      companyId: identifier,
      schemaVersion: z.union([z.literal(1), z.literal(2)]),
      createdAt: z.custom<Timestamp>((x) => x instanceof Timestamp),
      updatedAt: z.custom<Timestamp>((x) => x instanceof Timestamp),
      createdBy: z.string(),
      updatedBy: z.string(),
      revision: z.number().int().positive(),
      refCount: z.number().int().nonnegative(),
      witnessKind: z.string(),
      witnessId: z.string(),
    })
    .parse({
      companyId,
      schemaVersion,
      createdAt,
      updatedAt,
      createdBy,
      updatedBy,
      revision,
      refCount,
      witnessKind,
      witnessId,
    });
  return {
    id,
    ...metadata,
    legacyLinks,
    ...(kind === 'contractAllocations'
      ? {
          clientIdSnapshot: z
            .string()
            .regex(/^[a-zA-Z0-9_-]{1,128}$/)
            .parse(clientIdSnapshot),
        }
      : {}),
    ...(kind === 'assets'
      ? {
          lastTransferId: z
            .string()
            .regex(/^[a-zA-Z0-9_-]{0,128}$/)
            .parse(lastTransferId),
        }
      : {}),
    values: inputSchema(kind).parse(values),
  };
}
/** True while the record holds its outgoing references. */
export function holdsReferences(kind: Kind, v: Values) {
  return !releasedStatuses(kind).includes(v.status);
}
export function referencePaths(kind: Kind, v: Values): string[] {
  if (!holdsReferences(kind, v)) return [];
  return definitions[kind].fields
    .filter(
      (f) =>
        f.reference &&
        f.counted !== false &&
        v[f.key] &&
        !(
          kind === 'contractAllocations' &&
          f.key === 'siteId' &&
          v.locationId
        ) &&
        !(kind === 'facilities' && f.key === 'siteId') &&
        !(kind === 'locations' && f.key === 'siteId' && v.parentId),
    )
    .map((f) => `${f.reference}/${v[f.key]}`);
}
export function defaultValues(kind: Kind): Values {
  return Object.fromEntries(
    fieldsFor(kind).map((f) => [
      f.key,
      f.key === 'status'
        ? initialStatus(kind)
        : f.key === 'timeZone'
          ? 'Asia/Dubai'
          : f.key === 'quantity'
            ? '1'
            : f.options && f.required
              ? f.options[0]
              : '',
    ]),
  );
}

// Public domain contracts. Form values are kept separately from metadata.
type CommonValues = {
  code: string;
  name: string;
  notes: string;
  status: string;
};
export type Client = Operation & {
  values: CommonValues & {
    clientType: 'Individual' | 'Company';
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    country: string;
    vatNumber: string;
  };
};
export type Contract = Operation & {
  values: CommonValues & {
    clientId: string;
    startDate: string;
    endDate: string;
    serviceDescription: string;
  };
};
export type Site = Operation & {
  values: CommonValues & {
    propertyType: string;
    address: string;
    country: string;
    city: string;
    timeZone: string;
    workingDays: string;
    opensAt: string;
    closesAt: string;
    contactPerson: string;
    phone: string;
    description: string;
  };
};
export type Location = Operation & {
  values: CommonValues & {
    siteId: string;
    parentId: string;
    locationType: string;
    floorNumber: string;
    description: string;
  };
};
export type FacilityType = Operation & {
  values: CommonValues & { description: string };
};
export type Facility = Operation & {
  values: CommonValues & {
    siteId: string;
    locationId: string;
    typeId: string;
    condition: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
    description: string;
  };
};
