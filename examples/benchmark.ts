import { performance } from "node:perf_hooks";
import { memoryUsage } from "node:process";
import { SortFlakeId, decode } from "sortflakeid";

const TOTAL = 1_000_000;
const WORKER_ID = 1;

const generator = new SortFlakeId({
  workerId: WORKER_ID,
});

console.log("Warming up...");
for (let i = 0; i < 10000; i++) {
  generator.next();
}

const distribution = new Map<number, number>();
const unique = new Set<string>();

let previous = 0n;
let sequenceOverflowCount = 0;

const heapBefore = memoryUsage().heapUsed / 1024 / 1024;

const start = performance.now();

for (let i = 0; i < TOTAL; i++) {
  const id = generator.next();

  const current = BigInt(id);

  if (current <= previous) {
    throw new Error(`Ordering violation at index ${i}`);
  }

  previous = current;

  unique.add(id);

  const info = decode(id);

  distribution.set(
    info.timestamp,
    (distribution.get(info.timestamp) ?? 0) + 1
  );

  if (info.sequence === 4095) {
    sequenceOverflowCount++;
  }
}

const end = performance.now();

const heapAfter = memoryUsage().heapUsed / 1024 / 1024;

generator.destroy();

const duration = end - start;

const idsPerSecond = TOTAL / (duration / 1000);
const idsPerMillisecond = TOTAL / duration;

const values = [...distribution.values()];

const peak = Math.max(...values);
const min = Math.min(...values);
const avg = TOTAL / distribution.size;

console.log(`
========================================================
                 SortID Benchmark Report
========================================================

Configuration
-------------
Worker ID              : ${WORKER_ID}
Total IDs Requested    : ${TOTAL.toLocaleString()}

Performance
-----------
Generation Time        : ${duration.toFixed(2)} ms
Average Time / ID      : ${(duration / TOTAL).toFixed(8)} ms
IDs / Second           : ${Math.round(idsPerSecond).toLocaleString()}
IDs / Millisecond      : ${idsPerMillisecond.toFixed(2)}

Sequence Statistics
-------------------
Peak IDs / ms          : ${peak}
Average IDs / ms       : ${avg.toFixed(2)}
Minimum IDs / ms       : ${min}
Milliseconds Used      : ${distribution.size}
Sequence Overflows     : ${sequenceOverflowCount}

Ordering
--------
Strictly Monotonic     : ✓ PASS

Uniqueness
----------
Unique IDs             : ${unique.size.toLocaleString()} / ${TOTAL.toLocaleString()}
Duplicate IDs          : ${TOTAL - unique.size}
Result                 : ${unique.size === TOTAL ? "✓ PASS" : "✗ FAIL"}

Memory
------
Heap Before            : ${heapBefore.toFixed(2)} MB
Heap After             : ${heapAfter.toFixed(2)} MB
Heap Increase          : ${(heapAfter - heapBefore).toFixed(2)} MB

Top 10 Busiest Milliseconds
---------------------------`);

[...distribution.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([ts, count], index) => {
    console.log(
      `${String(index + 1).padStart(2, " ")}. ${new Date(ts).toISOString()} -> ${count} IDs`
    );
  });

console.log(`
========================================================
`);
