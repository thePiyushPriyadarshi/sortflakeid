import { randomUUID } from "crypto";
import os from "os";

import { MAX_WORKER_ID } from "./constants";
import {
  AlreadyAcquiredError,
  RedisPackageMissingError,
  WorkerIdPoolExhaustedError,
} from "./errors";
import {
  RedisWorkerIdAllocatorOptions,
  WorkerLeaseInfo,
} from "./types";
import {
  ACQUIRE_SCRIPT,
  HEARTBEAT_SCRIPT,
  RELEASE_SCRIPT,
} from "./redis-scripts";

type Redis = any;

export class RedisWorkerIdAllocator {
  private readonly redisUrl: string;
  private readonly maxWorkerId: number;
  private readonly leaseTtlMs: number;
  private readonly heartbeatIntervalMs: number;
  private readonly namespace: string;

  private redis!: Redis;

  private timer?: NodeJS.Timeout;

  private acquired = false;
  private workerId?: number;

  private readonly leaseInfo: WorkerLeaseInfo;

  constructor(options: RedisWorkerIdAllocatorOptions) {
    this.redisUrl = options.redisUrl;

    this.maxWorkerId =
      options.maxWorkerId ?? MAX_WORKER_ID;

    this.leaseTtlMs =
      options.leaseTtlMs ?? 30_000;

    this.heartbeatIntervalMs =
      options.heartbeatIntervalMs ?? 10_000;

    this.namespace =
      options.namespace ?? "sortflakeid";

    this.leaseInfo = {
      workerId: -1,
      hostname: os.hostname(),
      pid: process.pid,
      instanceId: randomUUID(),
      version: "1.0.0",
      startedAt: Date.now(),
    };
  }

  async acquire(): Promise<number> {
    if (this.acquired) {
      throw new AlreadyAcquiredError();
    }

    const Redis = await this.loadRedis();

    this.redis = new Redis(this.redisUrl);

    for (
      let workerId = 0;
      workerId <= this.maxWorkerId;
      workerId++
    ) {
      const key = this.key(workerId);

      this.leaseInfo.workerId = workerId;

      const ok = await this.redis.eval(
        ACQUIRE_SCRIPT,
        1,
        key,
        JSON.stringify(this.leaseInfo),
        this.leaseTtlMs
      );

      if (ok === 1) {
        this.workerId = workerId;
        this.acquired = true;

        this.startHeartbeat();

        return workerId;
      }
    }

    throw new WorkerIdPoolExhaustedError(
      this.maxWorkerId
    );
  }

  async release(): Promise<void> {
    if (!this.acquired || this.workerId == null) {
      return;
    }

    if (this.timer) {
      clearInterval(this.timer);
    }

    await this.redis.eval(
      RELEASE_SCRIPT,
      1,
      this.key(this.workerId),
      JSON.stringify(this.leaseInfo)
    );

    await this.redis.quit();

    this.acquired = false;
  }

  getWorkerId(): number {
    if (this.workerId == null) {
      throw new Error(
        "No worker ID has been acquired."
      );
    }

    return this.workerId;
  }

  private startHeartbeat() {
    this.timer = setInterval(async () => {
      try {
        await this.redis.eval(
          HEARTBEAT_SCRIPT,
          1,
          this.key(this.workerId!),
          JSON.stringify(this.leaseInfo),
          this.leaseTtlMs
        );
      } catch {
        // Ignore transient Redis failures.
      }
    }, this.heartbeatIntervalMs);
  }

  private key(workerId: number) {
    return `${this.namespace}:worker:${workerId}`;
  }

  private async loadRedis() {
    try {
      return (await import("ioredis")).default;
    } catch {
      throw new RedisPackageMissingError();
    }
  }
}