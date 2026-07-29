import { SORTID_EPOCH } from "./constants";

export interface SortIdOptions {
  workerId: number;
  epoch?: number; // custom epoch
}

export interface DecodedSortId {
  id: string;
  timestamp: number;
  date: Date;
  workerId: number;
  sequence: number;
}

export interface RedisWorkerIdAllocatorOptions {
  redisUrl: string;
  maxWorkerId?: number;
  leaseTtlMs?: number;
  heartbeatIntervalMs?: number;
  namespace?: string;
}

export interface WorkerLeaseInfo {
  workerId: number;
  instanceId: string;
  hostname: string;
  pid: number;
  version: string;
  startedAt: number;
}

export const DEFAULT_OPTIONS = {
  epoch: SORTID_EPOCH,
} satisfies Required<Pick<SortIdOptions, "epoch">>;
