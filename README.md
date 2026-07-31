# Sortflake Id

**Sortable, unique IDs — like UUID, but time-ordered.**

`sortflakeid` generates 64-bit Snowflake-style IDs: unique across any number
of machines, with no central coordinator on the hot path, and — unlike
a plain UUID — naturally sortable by creation time. The core generator
has zero runtime dependencies. An optional Redis-backed allocator is
included for safely running multiple instances (e.g. behind an
autoscaler) without manually assigning IDs per machine.

```bash
npm install sortid
```

## Why not just use `crypto.randomUUID()`?

You can, and for a lot of apps that's the right call. Reach for `sortid`
when you specifically want:

- **Sort order for free** — `id2 > id1` whenever `id2` was generated
  after `id1`. No separate `created_at` index needed just to answer
  "show me the newest rows."
- **Index-friendly inserts** — sequential-ish IDs append to the end of a
  database B-tree index instead of scattering across it the way random
  UUIDs do, which matters at high write volume.
- **A compact integer** — fits in a 64-bit `bigint` column, about half
  the storage of a 128-bit UUID.

The trade-off: every ID-generating process needs a unique `workerId`
(0–1023). `WorkerIdAllocator` handles that automatically so you don't
have to.

## Quick start — single instance

```ts
import { SortFlakeId } from "sortflakeid";

const generator = new SortFlakeId({
  workerId: 1,           // 0–1023, unique per running instance
  epoch: 1704067200000,  // custom epoch, ms since Unix epoch
});

const id = generator.nextId();
console.log(id); // "7123456789012345600"

console.log(generator.decode(id));
// { timestamp: 1721000000000, workerId: 1, sequence: 0 }
```

That's the whole core API. No server, no config files — just Node
built-ins.

## Multiple instances — no manual worker ID assignment

If you're running more than one instance, especially behind an
autoscaler where replicas come and go on their own, hardcoding a
`workerId` per instance breaks down: nobody's around to assign the next
replica a number. `WorkerIdAllocator` solves this by leasing a worker ID
from a shared Redis pool at startup — deploy the *same* code to every
instance, and each one gets a different ID automatically.

```bash
npm install ioredis   # only needed if you use WorkerIdAllocator
```

```ts
import { SortFlakeId, WorkerIdAllocator } from "sortflakeid";

const allocator = new WorkerIdAllocator({
  redisUrl: process.env.REDIS_URL!,
});

const workerId = await allocator.acquire();
const generator = new SortFlakeId({ workerId, epoch: 1704067200000 });

// ... use generator.nextId() for the lifetime of the process ...

// Release the lease immediately on a clean shutdown, instead of
// waiting for it to expire.
process.on("SIGTERM", async () => {
  await allocator.release();
  process.exit(0);
});
```

`ioredis` is a **peer dependency**, loaded lazily the moment you
construct a `WorkerIdAllocator`. If you never use it, you never need it
installed.

### How a free worker ID is found

`acquire()` runs a single atomic Lua script in Redis that scans
`0..maxWorkerId` and claims the first unclaimed (or lease-expired) slot.
Redis executes Lua scripts atomically, so two instances booting at the
same instant can never claim the same ID — there's no client-side retry
loop, and it's one round trip regardless of pool size.

### What happens if an instance crashes

Every acquired lease carries a TTL. While an instance is alive, a
background heartbeat renews that TTL every `heartbeatIntervalMs`. If the
instance crashes, the heartbeat simply stops — nothing has to detect the
crash. The lease's TTL counts down on its own and Redis deletes the key
automatically once it expires, freeing the slot for the next instance
that asks.

| Shutdown type | How the ID frees up | Delay |
|---|---|---|
| Graceful (`SIGTERM`/`SIGINT`) → `allocator.release()` | Explicit delete | Immediate |
| Crash / unclean death | Redis TTL expiry | Up to `leaseTtlMs` (default 30s) |

## Built-in protection against duplicate IDs

Two easy mistakes can silently cause colliding IDs, so `sortid` blocks
both of them outright rather than leaving them as footguns:

**Two generators, same `workerId`.** Each `SortFlakeId` keeps its
own private sequence counter. Two instances sharing a `workerId` can
each independently compute the same `(timestamp, workerId, sequence)`
combination — an actual collision. Constructing a second generator for
a `workerId` that's already active in the process throws
`DuplicateWorkerIdError`.

**More than one generator per process.** The correct pattern is one
`SortFlakeId`, constructed once, reused everywhere in your app.
By default, constructing a second one — even with a *different*
`workerId` — throws `MultipleGeneratorInstancesError`, since this is
almost always an accidental `new SortFlakeId(...)` instead of
reusing the existing instance. Pass `allowMultipleInstances: true` if
you have a deliberate reason to run more than one.

The same idea applies to `WorkerIdAllocator`: calling `.acquire()` a
second time on the same instance throws `AlreadyAcquiredError`, and
acquiring from a second allocator in the same process throws
`MultipleLeaseError` unless you opt in with `allowMultiplePerProcess: true`.
This matters because each extra lease consumes a slot from your worker
ID pool for what's logically one machine.

```ts
const genA = new SortFlakeId({ workerId: 5, epoch: EPOCH });
new SortFlakeId({ workerId: 5, epoch: EPOCH }); // throws DuplicateWorkerIdError
new SortFlakeId({ workerId: 6, epoch: EPOCH }); // throws MultipleGeneratorInstancesError

genA.destroy(); // releases its slot — e.g. for test teardown
new SortFlakeId({ workerId: 6, epoch: EPOCH }); // now fine
```

## API reference

### `new SortFlakeId(options)`

| Option | Type | Description |
|---|---|---|
| `workerId` | `number` | 0–1023, unique across concurrently running instances |
| `epoch` | `number` | Custom epoch in ms since Unix epoch |
| `allowMultipleInstances` | `boolean` | Opt out of the one-instance-per-process rule. Default `false`. |

- `.nextId(): string` — the next unique ID (a string, since JS numbers
  can't safely represent all 64-bit integers)
- `.decode(id: string)` — `{ timestamp, workerId, sequence }` for a given ID
- `.destroy(): void` — releases this instance's `workerId` and singleton slot
- Throws `ClockRollbackError` if the system clock moves backwards
- Throws `DuplicateWorkerIdError` / `MultipleGeneratorInstancesError` as described above

### `new WorkerIdAllocator(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `redisUrl` | `string` | — | Redis connection string |
| `maxWorkerId` | `number` | `1023` | Size of the worker ID pool |
| `leaseTtlMs` | `number` | `30000` | Lease lifetime before it expires unrenewed |
| `heartbeatIntervalMs` | `number` | `10000` | How often a live instance renews its lease |
| `allowMultiplePerProcess` | `boolean` | `false` | Opt out of the one-lease-per-process rule |

- `.acquire(): Promise<number>` — leases and returns a free worker ID
- `.release(): Promise<void>` — releases the lease and closes the Redis connection
- Throws `WorkerIdAllocationError` if the pool is fully leased
- Throws `AlreadyAcquiredError` / `MultipleLeaseError` as described above

## License

MIT
