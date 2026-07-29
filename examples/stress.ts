import { SortIdGenerator, decode } from "sortid";

const WORKERS = 8;
const IDS_PER_WORKER = 250_000;

const generators = Array.from(
  { length: WORKERS },
  (_, i) => new SortIdGenerator({ workerId: i }),
);

const globalIds = new Set<string>();
const workerStats = new Map<number, number>();
const msStats = new Map<number, number>();

console.time("Benchmark");

await Promise.all(
  generators.map(async (generator, workerId) => {
    for (let i = 0; i < IDS_PER_WORKER; i++) {
      const id = generator.next();

      if (globalIds.has(id)) {
        throw new Error(`Duplicate ID detected: ${id}`);
      }

      globalIds.add(id);

      workerStats.set(workerId, (workerStats.get(workerId) ?? 0) + 1);

      const ts = decode(id).timestamp;

      msStats.set(ts, (msStats.get(ts) ?? 0) + 1);
    }
  }),
);

console.timeEnd("Benchmark");

generators.forEach((g) => g.destroy());

const total = WORKERS * IDS_PER_WORKER;

console.log(`
========================================================
            SortID Multi Worker Benchmark
========================================================

Workers               : ${WORKERS}
IDs / Worker          : ${IDS_PER_WORKER.toLocaleString()}
Total IDs             : ${total.toLocaleString()}
Unique IDs            : ${globalIds.size.toLocaleString()}
Duplicate IDs         : ${total - globalIds.size}

========================================================
`);

console.log("Worker Distribution");
console.log("-------------------");

for (const [worker, count] of workerStats) {
  console.log(
    `Worker ${worker.toString().padStart(2)} : ${count.toLocaleString()} IDs`,
  );
}

const values = [...msStats.values()];

console.log("\nSequence Statistics");
console.log("-------------------");
console.log(`Milliseconds Used : ${msStats.size}`);
console.log(`Peak IDs / ms     : ${Math.max(...values)}`);
console.log(`Average IDs / ms  : ${(total / msStats.size).toFixed(2)}`);
console.log(`Minimum IDs / ms  : ${Math.min(...values)}`);

console.log("\nTop 10 busiest milliseconds");
console.log("---------------------------");

[...msStats.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([ts, count]) => {
    console.log(
      `${new Date(ts).toISOString()} -> ${count.toLocaleString()} IDs`,
    );
  });
