import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';
export const timestampSchema = z.custom<Timestamp>(
  (v) => !!v && typeof (v as Timestamp).toMillis === 'function',
  'Expected Firestore timestamp',
);
export const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
const metadata = {
  schemaVersion: z.literal(1),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  createdBy: z.string().min(1),
  updatedBy: z.string().min(1),
};
export const roleSchema = z.enum([
  'owner',
  'admin',
  'site_manager',
  'department_manager',
  'supervisor',
  'technician',
  'staff',
  'viewer',
  'customer',
]);
export type CompanyRole = z.infer<typeof roleSchema>;
export const companySchema = z
  .object({
    ...metadata,
    contactEmail: z.string().max(200).optional(),
    contactPhone: z.string().max(200).optional(),
    address: z.string().max(2000).optional(),
    country: z.string().max(200).optional(),
    companyId: idSchema,
    name: z.string().min(1).max(120),
    status: z.enum(['active', 'suspended', 'archived']),
    timeZone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, 'Invalid IANA time zone'),
  })
  .strict();
export const memberSchema = z
  .object({
    ...metadata,
    companyId: idSchema,
    uid: z.string().min(1),
    role: roleSchema,
    status: z.enum(['active', 'inactive']),
  })
  .strict();
export const profileSchema = z
  .object({
    ...metadata,
    uid: z.string().min(1),
    displayName: z.string().min(1).max(100),
  })
  .strict();
export const accessSchema = z.object({ companyId: idSchema }).strict();
export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type Company = z.infer<typeof companySchema>;
export type Membership = z.infer<typeof memberSchema>;
export type UserProfile = z.infer<typeof profileSchema>;
export function canOpenAdmin(
  member: Membership | null,
  company: Company | null,
  uid: string,
) {
  return (
    !!member &&
    !!company &&
    member.uid === uid &&
    member.companyId === company.companyId &&
    member.status === 'active' &&
    company.status === 'active' &&
    ['owner', 'admin'].includes(member.role)
  );
}
export function friendlyError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === 'permission-denied' || code === 'firestore/permission-denied')
    return 'Access is no longer available. Contact your company owner or refresh your access.';
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/user-disabled'
  )
    return 'Unable to sign in. Check your email and password or contact your administrator.';
  if (code === 'auth/too-many-requests')
    return 'Too many attempts. Please try again later.';
  if (code === 'unavailable' || code === 'auth/network-request-failed')
    return 'Unable to connect. Check your connection and try again.';
  return 'We could not complete this request. Please retry or contact your administrator.';
}
export interface AttachmentGateway {
  available: boolean;
  upload(file: File, companyId: string): Promise<{ attachmentId: string }>;
}
export interface SchedulerGateway {
  available: boolean;
  requestRun(companyId: string, scheduleId: string): Promise<void>;
}
export const deferredAttachments: AttachmentGateway = {
  available: false,
  async upload() {
    throw new Error('Attachments are deferred until the approved Blaze phase.');
  },
};
export const deferredScheduler: SchedulerGateway = {
  available: false,
  async requestRun() {
    throw new Error('Server scheduling is not enabled in Phase 0.');
  },
};
export * from './future';
export * from './operations';
