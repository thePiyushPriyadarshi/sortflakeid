import {
  RedisWorkerIdAllocator,
  SortFlakeId,
} from "sortflakeid";

async function main() {
  const allocator = new RedisWorkerIdAllocator({
    redisUrl: "redis://localhost:6379",
  });

  const workerId = await allocator.acquire();

  console.log("Allocated worker:", workerId);

  const generator = new SortFlakeId({
    workerId,
  });

  for (let i = 0; i < 5; i++) {
    console.log(generator.next());
  }

  generator.destroy();
  await allocator.release();
}

main().catch(console.error);