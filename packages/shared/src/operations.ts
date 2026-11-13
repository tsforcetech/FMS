import { z } from 'zod';
import timeZones from './time-zones.json';
export { timeZones };
import { Timestamp } from 'firebase/firestore';
export const kinds = [
  'clients',
  'contracts',
  'sites',
  'locations',
  'facilityTypes',
  'facilities',
] as const;
export type Kind = (typeof kinds)[number];
export type Values = Record<string, string>;
export type FieldSpec = {
  key: string;
  label: string;
  required?: boolean;
  options?: string[];
  reference?: Kind;
  type?: 'email' | 'date' | 'time' | 'textarea';
  max?: number;
};
export const definitions: Record<
  Kind,
  { title: string; singular: string; fields: FieldSpec[] }
> = {
  clients: {
    title: 'Clients',
    singular: 'client',
    fields: [
      {
        key: 'clientType',
        label: 'Client type',
        required: true,
        options: ['Individual', 'Company'],
      },
      { key: 'contactPerson', label: 'Contact person' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'country', label: 'Country' },
      { key: 'vatNumber', label: 'Tax / VAT identifier' },
    ],
  },
  contracts: {
    title: 'Contracts',
    singular: 'contract',
    fields: [
      {
        key: 'clientId',
        label: 'Client',
        required: true,
        reference: 'clients',
      },
      { key: 'startDate', label: 'Start date', required: true, type: 'date' },
      { key: 'endDate', label: 'End date', required: true, type: 'date' },
      {
        key: 'serviceDescription',
        label: 'Services covered',
        type: 'textarea',
      },
    ],
  },
  sites: {
    title: 'Sites',
    singular: 'site',
    fields: [
      {
        key: 'clientId',
        label: 'Client',
        required: true,
        reference: 'clients',
      },
      { key: 'contractId', label: 'Contract', reference: 'contracts' },
      {
        key: 'propertyType',
        label: 'Property type',
        required: true,
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
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'country', label: 'Country' },
      { key: 'city', label: 'City' },
      {
        key: 'timeZone',
        label: 'Time zone',
        required: true,
        options: timeZones,
      },
      { key: 'workingDays', label: 'Working days' },
      { key: 'opensAt', label: 'Opening time', type: 'time' },
      { key: 'closesAt', label: 'Closing time', type: 'time' },
      { key: 'contactPerson', label: 'Contact person' },
      { key: 'phone', label: 'Contact phone' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  locations: {
    title: 'Locations',
    singular: 'location',
    fields: [
      { key: 'siteId', label: 'Site', required: true, reference: 'sites' },
      { key: 'parentId', label: 'Parent location', reference: 'locations' },
      {
        key: 'locationType',
        label: 'Location type',
        required: true,
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
      { key: 'floorNumber', label: 'Floor number' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  facilityTypes: {
    title: 'Facility types',
    singular: 'facility type',
    fields: [{ key: 'description', label: 'Description', type: 'textarea' }],
  },
  facilities: {
    title: 'Facilities',
    singular: 'facility',
    fields: [
      { key: 'siteId', label: 'Site', required: true, reference: 'sites' },
      {
        key: 'locationId',
        label: 'Location',
        required: true,
        reference: 'locations',
      },
      {
        key: 'typeId',
        label: 'Facility type',
        required: true,
        reference: 'facilityTypes',
      },
      {
        key: 'condition',
        label: 'Condition',
        required: true,
        options: ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'],
      },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
};
export function statuses(kind: Kind) {
  return kind === 'facilities'
    ? ['active', 'under_maintenance', 'out_of_service', 'archived']
    : kind === 'contracts'
      ? ['draft', 'active', 'expired', 'archived']
      : ['active', 'archived'];
}
export function fieldsFor(kind: Kind): FieldSpec[] {
  return [
    {
      key: 'code',
      label: kind === 'contracts' ? 'Contract reference' : 'Code',
      required: true,
      max: 40,
    },
    { key: 'name', label: 'Name', required: true, max: 120 },
    ...definitions[kind].fields,
    { key: 'notes', label: 'Notes', type: 'textarea' },
    { key: 'status', label: 'Status', required: true, options: statuses(kind) },
  ];
}
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
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
        (x) =>
          /^\d{4}-\d{2}-\d{2}$/.test(x) &&
          !isNaN(Date.parse(x)) &&
          new Date(x).toISOString().slice(0, 10) === x,
        'Enter a valid date',
      );
    if (f.type === 'time')
      v = s.refine(
        (x) => !x || /^([01]\d|2[0-3]):[0-5]\d$/.test(x),
        'Enter a valid time',
      );
    shape[f.key] = v;
  }
  shape.code = z
    .string()
    .regex(
      /^[A-Z0-9][A-Z0-9_-]{0,39}$/,
      'Use uppercase letters, numbers, - or _',
    );
  if (kind === 'sites') {
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
            x
              .split(',')
              .every((d) =>
                ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(d),
              )),
        'Select valid working days',
      );
  }
  return z
    .object(shape)
    .strict()
    .superRefine((v, ctx) => {
      if (kind === 'contracts' && v.endDate < v.startDate)
        ctx.addIssue({
          code: 'custom',
          path: ['endDate'],
          message: 'End date must follow start date',
        });
    });
}
export type Operation = {
  id: string;
  companyId: string;
  schemaVersion: 1;
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
    ...values
  } = raw;
  const metadata = z
    .object({
      companyId: identifier,
      schemaVersion: z.literal(1),
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
  return { id, ...metadata, values: inputSchema(kind).parse(values) };
}
export function referencePaths(kind: Kind, v: Values): string[] {
  if (v.status === 'archived') return [];
  return definitions[kind].fields
    .filter(
      (f) =>
        f.reference &&
        v[f.key] &&
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
        ? 'active'
        : f.key === 'timeZone'
          ? 'Asia/Dubai'
          : f.options?.[0] || '',
    ]),
  );
}

// Public domain contracts for future modules. Form values are kept separately from metadata.
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
    clientId: string;
    contractId: string;
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
