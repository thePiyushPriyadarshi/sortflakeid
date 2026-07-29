import {
  SEQUENCE_MASK,
  SORTID_EPOCH,
  TIMESTAMP_SHIFT,
  WORKER_ID_MASK,
  WORKER_ID_SHIFT,
} from "./constants";

import { InvalidSortIdError } from "./errors";
import type { DecodedSortId } from "./types";

/**
 * Decodes a SortID into its individual components.
 *
 * @param id SortID as a decimal string
 * @param epoch Custom epoch (defaults to SORTID_EPOCH)
 */
export function decode(id: string, epoch = SORTID_EPOCH): DecodedSortId {
  let value: bigint;

  try {
    value = BigInt(id);
  } catch {
    throw new InvalidSortIdError(id);
  }

  if (value < 0n) {
    throw new InvalidSortIdError(id);
  }

  const sequence = value & SEQUENCE_MASK;

  const workerId = (value >> WORKER_ID_SHIFT) & WORKER_ID_MASK;

  const timestamp = (value >> TIMESTAMP_SHIFT) + BigInt(epoch);

  return {
    id,
    timestamp: Number(timestamp),
    date: new Date(Number(timestamp)),
    workerId: Number(workerId),
    sequence: Number(sequence),
  };
}

export function timestamp(id: string, epoch = SORTID_EPOCH): number {
  return decode(id, epoch).timestamp;
}

export function date(id: string, epoch = SORTID_EPOCH): Date {
  return decode(id, epoch).date;
}

export function workerId(id: string): number {
  return decode(id).workerId;
}

export function sequence(id: string): number {
  return decode(id).sequence;
}

export function isValid(id: string): boolean {
  try {
    decode(id);
    return true;
  } catch {
    return false;
  }
}
