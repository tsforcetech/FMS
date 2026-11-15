import { describe, expect, it } from 'vitest';
import { Vault, memoryKV, memoryKeys } from './vault';
import {
  AccessRevokedError,
  ConflictError,
  OpQueue,
  runSync,
  type Executor,
  type Op,
} from './sync';

const op = (
  id: string,
  taskId: string,
  type: Op['type'] = 'start',
  baseRevision = 1,
) => ({
  id,
  companyId: 'c1',
  uid: 'u1',
  employeeId: 'e1',
  taskId,
  type,
  baseRevision,
  payload: {},
});
describe('encrypted vault', () => {
  it('stores ciphertext only, isolates users and is unreadable after destroy', async () => {
    const kv = memoryKV(),
      keys = memoryKeys();
    const v = new Vault('alice', keys, kv);
    await v.put('tasks', {
      title: 'AC Inspection – Floor 2',
      secret: 'site plan',
    });
    expect(JSON.stringify(kv.dump())).not.toContain('AC Inspection');
    expect(await v.read('tasks')).toEqual({
      title: 'AC Inspection – Floor 2',
      secret: 'site plan',
    });
    const bob = new Vault('bob', keys, kv);
    expect(await bob.read('tasks')).toBeNull();
    // A new process (fresh Vault object) with the same secure key reads the data back.
    expect(await new Vault('alice', keys, kv).read('tasks')).toEqual({
      title: 'AC Inspection – Floor 2',
      secret: 'site plan',
    });
    await v.destroy();
    expect(
      Object.keys(kv.dump()).filter((k) => k.startsWith('fos:alice:')),
    ).toEqual([]);
    expect(await new Vault('alice', keys, kv).read('tasks')).toBeNull();
  });
});
describe('operation queue and sync', () => {
  const setup = () => new OpQueue(new Vault('u1', memoryKeys(), memoryKV()));
  it('persists across restarts, ignores duplicate enqueues and resumes interrupted syncs', async () => {
    const kv = memoryKV(),
      keys = memoryKeys();
    const q1 = new OpQueue(new Vault('u1', keys, kv));
    await q1.add(op('a', 't1'));
    await q1.add(op('a', 't1'));
    await q1.update('a', { status: 'syncing' });
    const q2 = new OpQueue(new Vault('u1', keys, kv)); // app restart
    const list = await q2.list();
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('pending');
  });
  it('applies in order, stops on network loss and retries later', async () => {
    const q = setup();
    await q.add(op('a', 't1', 'start', 1));
    await q.add(op('b', 't1', 'save_progress', 2));
    await q.add(op('c', 't2', 'start', 1));
    let online = false;
    const seen: string[] = [];
    const exec: Executor = {
      revalidate: async () => {},
      apply: async (o) => {
        if (!online && o.id === 'b')
          throw Object.assign(new Error('offline'), { code: 'unavailable' });
        seen.push(o.id);
        return 'applied';
      },
    };
    let r = await runSync(q, exec);
    expect(r).toMatchObject({ applied: 1, offline: true });
    expect((await q.list()).map((o) => o.status)).toEqual([
      'done',
      'pending',
      'pending',
    ]);
    online = true;
    r = await runSync(q, exec);
    expect(r.applied).toBe(2);
    expect(seen).toEqual(['a', 'b', 'c']);
    expect((await q.list()).find((o) => o.id === 'b')?.attempts).toBe(2);
  });
  it('turns a conflict into a review item and holds later changes to the same task', async () => {
    const q = setup();
    await q.add(op('a', 't1', 'submit', 3));
    await q.add(op('b', 't1', 'save_progress', 4));
    await q.add(op('c', 't2', 'start', 1));
    const exec: Executor = {
      revalidate: async () => {},
      apply: async (o) => {
        if (o.id === 'a')
          throw new ConflictError(
            'This task was cancelled by an administrator.',
          );
        return o.id === 'c' ? 'duplicate' : 'applied';
      },
    };
    const r = await runSync(q, exec);
    expect(r).toMatchObject({ conflicts: 2, duplicates: 1, applied: 0 });
    const list = await q.list();
    expect(list.find((o) => o.id === 'a')?.lastError).toContain('cancelled');
    expect(list.find((o) => o.id === 'b')?.status).toBe('conflict');
  });
  it('blocks every queued change when access was revoked', async () => {
    const q = setup();
    await q.add(op('a', 't1'));
    const r = await runSync(q, {
      revalidate: async () => {
        throw new AccessRevokedError('revoked');
      },
      apply: async () => 'applied',
    });
    expect(r.revoked).toBe(true);
    expect((await q.list())[0].status).toBe('blocked');
  });
});
