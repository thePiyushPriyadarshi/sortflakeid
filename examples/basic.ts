import {
  SortFlakeId,
  decode,
  timestamp,
  date,
  workerId,
  sequence,
  isValid,
} from "sortflakeid";

const generator = new SortFlakeId({
  workerId: 1,
});

const id = generator.next();

console.log("Generated ID:", id);

console.log("\nDecoded:");
console.log(decode(id));

console.log("\nHelpers:");
console.log("Timestamp :", timestamp(id));
console.log("Date      :", date(id));
console.log("Worker ID :", workerId(id));
console.log("Sequence  :", sequence(id));
console.log("Valid     :", isValid(id));

generator.destroy();