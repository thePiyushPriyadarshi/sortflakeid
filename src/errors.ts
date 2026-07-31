/**
 * Base class for all SortID errors.
 */
export abstract class SortIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;

    // Preserve instanceof checks when targeting ES5/CommonJS.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when two generators in the same process use the same worker ID.
 *
 * Every generator maintains its own sequence counter. Running two
 * generators with the same worker ID will eventually produce duplicate
 * IDs, so SortID prevents this.
 */
export class DuplicateWorkerIdError extends SortIdError {
  constructor(workerId: number) {
    super(
      `Worker ID ${workerId} is already in use by another SortFlakeId ` +
        `in this process.\n\n` +
        `Each generator maintains its own sequence counter, so creating ` +
        `multiple generators with the same worker ID would eventually ` +
        `produce duplicate IDs.\n\n` +
        `Reuse the existing generator or call destroy() before creating ` +
        `another one with the same worker ID.`,
    );
  }
}

/**
 * Thrown when the system clock moves backwards.
 */
export class ClockRollbackError extends SortIdError {
  constructor(diffMs: number) {
    super(
      `System clock moved backwards by ${diffMs} ms.\n\n` +
        `SortID refuses to generate IDs because doing so could produce ` +
        `duplicate IDs.`,
    );
  }
}

/**
 * Thrown when a generator is used after destroy().
 */
export class GeneratorDestroyedError extends SortIdError {
  constructor(workerId: number) {
    super(
      `SortFlakeId(workerId=${workerId}) has already been destroyed.\n\n` +
        `Create a new generator before requesting more IDs.`,
    );
  }
}

/**
 * Thrown when workerId is outside the supported range.
 */
export class InvalidWorkerIdError extends SortIdError {
  constructor(workerId: number, maxWorkerId: number) {
    super(
      `Invalid worker ID ${workerId}.\n\n` +
        `workerId must be between 0 and ${maxWorkerId}.`,
    );
  }
}

/**
 * Thrown when a decoded ID is malformed.
 */
export class InvalidSortIdError extends SortIdError {
  constructor(id: string) {
    super(
      `"${id}" is not a valid SortID.\n\n` +
        `Expected an unsigned 64-bit integer represented as a decimal string.`,
    );
  }
}

/**
 * Base class for Redis worker allocator errors.
 */
export abstract class WorkerAllocatorError extends SortIdError {}

/**
 * No worker IDs are currently available.
 */
export class WorkerIdPoolExhaustedError extends WorkerAllocatorError {
  constructor(maxWorkerId: number) {
    super(
      `No free worker IDs are available.\n\n` +
        `The entire worker ID pool (0-${maxWorkerId}) is currently leased.\n` +
        `Increase the worker ID size or wait for an existing lease to expire.`,
    );
  }
}

/**
 * acquire() called twice.
 */
export class AlreadyAcquiredError extends WorkerAllocatorError {
  constructor() {
    super(
      `acquire() has already been called on this allocator.\n\n` +
        `Reuse the acquired worker ID or call release() first.`,
    );
  }
}

/**
 * release() called before acquire().
 */
export class NotAcquiredError extends WorkerAllocatorError {
  constructor() {
    super(
      `release() was called before acquire().\n\n` +
        `There is no active worker ID lease to release.`,
    );
  }
}

/**
 * ioredis isn't installed.
 */
export class RedisPackageMissingError extends WorkerAllocatorError {
  constructor() {
    super(
      `RedisWorkerIdAllocator requires the optional dependency "ioredis".\n\n` +
        `Install it with:\n\nnpm install ioredis`,
    );
  }
}

/**
 * Another machine already owns the requested worker ID.
 */
export class WorkerIdAlreadyLeasedError extends WorkerAllocatorError {
  constructor(workerId: number, owner?: string) {
    super(
      owner
        ? `Worker ID ${workerId} is already leased by ${owner}.`
        : `Worker ID ${workerId} is already leased by another instance.`,
    );
  }
}
