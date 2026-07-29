export const SORTID_EPOCH = Date.UTC(2024, 0, 1);

// Bit allocation.
// 1 unused sign bit
// 41 timestamp
// 10 worker id
// 12 sequence

export const TIMESTAMP_BITS = 41n;
export const WORKER_ID_BITS = 10n;
export const SEQUENCE_BITS = 12n;

export const MAX_WORKER_ID = Number((1n << WORKER_ID_BITS) - 1n);
export const MAX_SEQUENCE = Number((1n << SEQUENCE_BITS) - 1n);

export const WORKER_ID_SHIFT = SEQUENCE_BITS;
export const TIMESTAMP_SHIFT = WORKER_ID_BITS + SEQUENCE_BITS;

export const WORKER_ID_MASK = (1n << WORKER_ID_BITS) - 1n;

export const SEQUENCE_MASK = (1n << SEQUENCE_BITS) - 1n;

export const TIMESTAMP_MASK = (1n << TIMESTAMP_BITS) - 1n;
