import type { Values } from './operations';
export const OCCUPANCY_LIMIT = 12;
export type OccupancySlot = {
  allocationId: string;
  startDate: string;
  endDate: string;
  allocationType: string;
};
export function allocationSlot(id: string, v: Values): OccupancySlot {
  return {
    allocationId: id,
    startDate: v.startDate,
    endDate: v.effectiveEndDate || v.endDate,
    allocationType: v.allocationType,
  };
}
export function conflicts(a: OccupancySlot, b: OccupancySlot) {
  return (
    a.startDate <= b.endDate &&
    b.startDate <= a.endDate &&
    (a.allocationType === 'exclusive_occupancy' ||
      b.allocationType === 'exclusive_occupancy')
  );
}
export function reserveSlot(slots: OccupancySlot[], slot: OccupancySlot) {
  const i = slots.findIndex((x) => x.allocationId === slot.allocationId);
  if (i < 0 && slots.length >= OCCUPANCY_LIMIT)
    throw Error(
      'This space/year has reached its 12-allocation limit. Contact the administrator for a reviewed capacity upgrade.',
    );
  if (
    slots.some(
      (x) => x.allocationId !== slot.allocationId && conflicts(x, slot),
    )
  )
    throw Error('This space already has an overlapping occupancy allocation.');
  if (i >= 0) {
    const previous = slots[i];
    if (
      slot.startDate !== previous.startDate ||
      slot.endDate > previous.endDate ||
      slot.allocationType !== previous.allocationType
    )
      throw Error('Reserved occupancy can only be shortened by termination.');
    return [...slots.filter((_, n) => n !== i), slot];
  }
  return [...slots, slot];
}
