import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Task } from '@admin/management/tasksStore';
import { scopeTasks } from '@admin/management/staffStore';
import { useStaff } from '../App';
import { useT } from '../i18n';
import { Empty, ErrorBox, Loading, TaskCard, friendlyError } from './common';

/** Supervisor queue: submissions in my sites awaiting review (own work cannot be approved). */
export function Approvals() {
  const staff = useStaff();
  const { t } = useT();
  const [rows, setRows] = useState<Task[]>(),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    scopeTasks(
      staff.context.services.db,
      staff.companyId,
      staff,
      'awaiting_approval',
    )
      .then((r) => live && setRows(r))
      .catch((e) => live && setError(friendlyError(e, t)));
    return () => {
      live = false;
    };
  }, [staff, t]);
  return (
    <div className="s-page">
      <h1 className="s-title">
        <ShieldCheck /> {t('approvals')}
      </h1>
      {error && <ErrorBox error={error} />}
      {!rows && !error && <Loading />}
      {rows && !rows.length && (
        <Empty icon={<ShieldCheck />} title={t('noApprovals')} />
      )}
      <div className="s-list">
        {rows?.map((x) => (
          <TaskCard
            key={x.id}
            task={x}
            context={staff.context}
            tz={staff.timeZone}
          />
        ))}
      </div>
    </div>
  );
}
