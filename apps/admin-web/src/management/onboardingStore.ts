import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import {
  defaultValues,
  emptyContent,
  newQuestion,
  type Kind,
  type SetupFacts,
  type StarterPack,
} from '@facilityos/shared';
import { saveRecord, UserError } from './store';
import { createDraft, listVersions } from './tasksStore';

/**
 * Phase 8 onboarding data. Progress is derived from the company's real
 * records (so refreshing or working outside the wizard is always reflected)
 * plus steps the admin explicitly marked done. Pack installation is
 * idempotent: every item has a fixed code, and an item whose code already
 * exists is skipped, so a refresh or a second click never duplicates data.
 */
const settings = (db: Firestore, c: string, id: string) =>
  doc(db, 'companies', c, 'settings', id);
export type Onboarding = { steps: Record<string, boolean>; pack: string };
export type BrandingSettings = {
  displayName: string;
  logoDataUrl: string;
  primaryColor: string;
  locale: string;
  currency: string;
  dateFormat: string;
  reportHeader: string;
  reportFooter: string;
};
export const defaultBranding: BrandingSettings = {
  displayName: '',
  logoDataUrl: '',
  primaryColor: '#1D4ED8',
  locale: 'en-GB',
  currency: 'AED',
  dateFormat: 'dd MMM yyyy',
  reportHeader: '',
  reportFooter: '',
};
export async function getOnboarding(
  db: Firestore,
  c: string,
): Promise<Onboarding> {
  const s = await getDoc(settings(db, c, 'onboarding'));
  const d = s.data() || {};
  return { steps: d.steps || {}, pack: d.pack || '' };
}
export async function saveOnboarding(
  db: Firestore,
  c: string,
  uid: string,
  o: Onboarding,
) {
  await setDoc(settings(db, c, 'onboarding'), {
    companyId: c,
    steps: o.steps,
    pack: o.pack,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}
export async function getBrandingSettings(
  db: Firestore,
  c: string,
): Promise<BrandingSettings & { saved: boolean }> {
  const s = await getDoc(settings(db, c, 'branding'));
  return { ...defaultBranding, ...(s.data() || {}), saved: s.exists() };
}
export async function saveBranding(
  db: Firestore,
  c: string,
  uid: string,
  b: BrandingSettings,
) {
  if (b.logoDataUrl && !/^data:image\/(png|jpeg);base64,/.test(b.logoDataUrl))
    throw new UserError('Use a PNG or JPEG logo.');
  if (b.logoDataUrl.length > 60000)
    throw new UserError(
      'The logo is too large. Use an image under about 40 KB.',
    );
  if (!/^#[0-9A-Fa-f]{6}$/.test(b.primaryColor))
    throw new UserError('Choose a colour like #1D4ED8.');
  if (!/^[A-Z]{3}$/.test(b.currency))
    throw new UserError('Use a three-letter currency code, e.g. AED.');
  await setDoc(settings(db, c, 'branding'), {
    companyId: c,
    displayName: b.displayName.slice(0, 120),
    logoDataUrl: b.logoDataUrl,
    primaryColor: b.primaryColor,
    locale: b.locale.slice(0, 20),
    currency: b.currency,
    dateFormat: b.dateFormat.slice(0, 20),
    reportHeader: b.reportHeader.slice(0, 500),
    reportFooter: b.reportFooter.slice(0, 500),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}
/** Real record counts behind the setup progress. */
export async function setupFacts(
  db: Firestore,
  c: string,
  company: { name?: string; timeZone?: string; contactEmail?: string },
): Promise<SetupFacts> {
  const count = async (kind: string, ...w: [string, '==', string][]) => {
    try {
      return (
        await getCountFromServer(
          query(
            collection(db, 'companies', c, kind),
            ...w.map((x) => where(...x)),
          ),
        )
      ).data().count;
    } catch {
      return 0;
    }
  };
  const [
    sites,
    locations,
    departments,
    employees,
    assets,
    facilities,
    taskTemplates,
    recurringSchedules,
    staffLinks,
    branding,
  ] = await Promise.all([
    count('sites'),
    count('locations'),
    count('departments'),
    count('employees'),
    count('assets'),
    count('facilities'),
    count('templateVersions', ['state', '==', 'published']),
    count('recurringSchedules'),
    count('staffLinks'),
    getDoc(settings(db, c, 'branding'))
      .then((s) => s.exists())
      .catch(() => false),
  ]);
  return {
    companyComplete: !!(
      company.name &&
      company.timeZone &&
      company.contactEmail
    ),
    branding,
    sites,
    locations,
    departments,
    employees,
    assets,
    facilities,
    taskTemplates,
    recurringSchedules,
    staffLinks,
  };
}

async function claimId(db: Firestore, c: string, kind: Kind, code: string) {
  const s = await getDoc(
    doc(db, 'companies', c, 'codeClaims', `${kind}_${code}`),
  );
  return s.exists() ? (s.data().recordId as string) : '';
}
/** Creates the record unless its code exists; returns its id either way. */
async function ensure(
  db: Firestore,
  c: string,
  uid: string,
  kind: Kind,
  code: string,
  values: Record<string, string>,
) {
  const existing = await claimId(db, c, kind, code);
  if (existing) return { id: existing, created: false };
  await saveRecord(db, c, uid, kind, {
    ...defaultValues(kind),
    ...values,
    code,
  });
  return { id: await claimId(db, c, kind, code), created: true };
}
export type PackSelection = {
  departments: string[];
  designations: string[];
  categories: string[];
  templates: string[];
};
/**
 * Installs the selected parts of a starter pack. Templates are created with a
 * DRAFT checklist only — an administrator reviews and publishes them, and no
 * schedule is created, so no live tasks appear without a decision.
 */
export async function installPack(
  db: Firestore,
  c: string,
  uid: string,
  pack: StarterPack,
  sel: PackSelection,
  progress: (msg: string) => void,
) {
  const out = { created: 0, skipped: 0 };
  const tally = (r: { created: boolean }) =>
    r.created ? out.created++ : out.skipped++;
  const deps = new Map<string, string>();
  for (const d of pack.departments.filter((x) =>
    sel.departments.includes(x.code),
  )) {
    progress(`Department ${d.name}`);
    const r = await ensure(db, c, uid, 'departments', d.code, { name: d.name });
    deps.set(d.code, r.id);
    tally(r);
  }
  for (const d of pack.designations.filter((x) =>
    sel.designations.includes(x.code),
  )) {
    progress(`Designation ${d.name}`);
    const dep =
      deps.get(d.department) ||
      (await claimId(db, c, 'departments', d.department));
    if (!dep)
      throw new UserError(
        `Install the ${d.department} department before the ${d.name} designation.`,
      );
    tally(
      await ensure(db, c, uid, 'designations', d.code, {
        name: d.name,
        departmentId: dep,
      }),
    );
  }
  const cats = new Map<string, string>();
  for (const k of pack.categories.filter((x) =>
    sel.categories.includes(x.code),
  )) {
    progress(`Category ${k.name}`);
    const r = await ensure(db, c, uid, 'taskCategories', k.code, {
      name: k.name,
    });
    cats.set(k.code, r.id);
    tally(r);
  }
  for (const t of pack.templates.filter((x) =>
    sel.templates.includes(x.code),
  )) {
    progress(`Checklist ${t.name}`);
    const cat =
      cats.get(t.category) ||
      (await claimId(db, c, 'taskCategories', t.category));
    if (!cat)
      throw new UserError(
        `Install the ${t.category} category before the ${t.name} checklist.`,
      );
    const r = await ensure(db, c, uid, 'taskTemplates', t.code, {
      name: t.name,
      categoryId: cat,
      description: `Starter pack: ${pack.name}. Suggested recurrence: ${t.recurrence}. Review before publishing.`,
    });
    tally(r);
    const versions = await listVersions(db, c, r.id);
    if (!versions.length) {
      const content = emptyContent(t.name);
      const questions = t.questions.reduce<ReturnType<typeof newQuestion>[]>(
        (qs, q) => [
          ...qs,
          { ...newQuestion('s1', q.type, qs), label: q.label },
        ],
        [],
      );
      // Approval stays off by default: an approval needs an Accountable (RACI) owner the admin chooses.
      await createDraft(db, c, uid, r.id, {
        ...content,
        instructions: `Suggested recurrence: ${t.recurrence}`,
        approvalRequired: false,
        questions,
      });
    }
  }
  return out;
}
