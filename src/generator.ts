import {
  MAX_SEQUENCE,
  MAX_WORKER_ID,
  SEQUENCE_MASK,
  SORTID_EPOCH,
  TIMESTAMP_SHIFT,
  WORKER_ID_MASK,
  WORKER_ID_SHIFT,
} from "./constants";

import {
  ClockRollbackError,
  DuplicateWorkerIdError,
  GeneratorDestroyedError,
  InvalidWorkerIdError,
} from "./errors";

import type { DecodedSortId, SortIdOptions } from "./types";

/**
 * Tracks active worker IDs inside the current process.
 *
 * Two generators using the same worker ID maintain independent sequence
 * counters and would eventually generate duplicate IDs.
 */
const activeWorkerIds = new Set<number>();

export class SortIdGenerator {
  private readonly workerId: bigint;
  private readonly workerIdNumber: number;
  private readonly epoch: number;

  private sequence = 0n;
  private lastTimestamp = -1;

  private destroyed = false;

  constructor(options: SortIdOptions) {
    if (
      !Number.isInteger(options.workerId) ||
      options.workerId < 0 ||
      options.workerId > MAX_WORKER_ID
    ) {
      throw new InvalidWorkerIdError(options.workerId, MAX_WORKER_ID);
    }

    if (activeWorkerIds.has(options.workerId)) {
      throw new DuplicateWorkerIdError(options.workerId);
    }

    activeWorkerIds.add(options.workerId);

    this.workerIdNumber = options.workerId;
    this.workerId = BigInt(options.workerId);
    this.epoch = options.epoch ?? SORTID_EPOCH;
  }

  next(): string {
    return this.nextBigInt().toString();
  }

  /**
   * Generates the next SortID as BigInt.
   */
  nextBigInt(): bigint {
    if (this.destroyed) {
      throw new GeneratorDestroyedError(this.workerIdNumber);
    }

    let timestamp = Date.now();

    if (timestamp < this.lastTimestamp) {
      throw new ClockRollbackError(this.lastTimestamp - timestamp);
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & BigInt(MAX_SEQUENCE);

      if (this.sequence === 0n) {
        timestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    return (
      (BigInt(timestamp - this.epoch) << TIMESTAMP_SHIFT) |
      (this.workerId << WORKER_ID_SHIFT) |
      this.sequence
    );
  }

  destroy(): void {
    if (this.destroyed) return;

    activeWorkerIds.delete(this.workerIdNumber);
    this.destroyed = true;
  }

  getWorkerId(): number {
    return this.workerIdNumber;
  }

  getEpoch(): number {
    return this.epoch;
  }

  static decode(id: string, epoch = SORTID_EPOCH): DecodedSortId {
    const value = BigInt(id);

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

  static timestamp(id: string, epoch = SORTID_EPOCH): number {
    return this.decode(id, epoch).timestamp;
  }

  static workerId(id: string): number {
    return this.decode(id).workerId;
  }

  static sequence(id: string): number {
    return this.decode(id).sequence;
  }

  private waitNextMillis(lastTimestamp: number): number {
    let timestamp = Date.now();

    while (timestamp <= lastTimestamp) {
      timestamp = Date.now();
    }

    return timestamp;
  }
}
