/**
 * Atomically acquires a worker ID lease.
 *
 * Returns:
 *  1 -> Lease acquired
 *  0 -> Already leased
 */
export const ACQUIRE_SCRIPT = `
if redis.call("EXISTS", KEYS[1]) == 1 then
    return 0
end

redis.call(
    "SET",
    KEYS[1],
    ARGV[1],
    "PX",
    ARGV[2]
)

return 1
`;

/**
 * Renews an existing lease.
 *
 * Returns:
 * 1 -> renewed
 * 0 -> lease missing
 */
export const HEARTBEAT_SCRIPT = `
if redis.call("GET", KEYS[1]) ~= ARGV[1] then
    return 0
end

redis.call(
    "PEXPIRE",
    KEYS[1],
    ARGV[2]
)

return 1
`;

/**
 * Releases a lease only if we own it.
 *
 * Returns:
 * 1 -> deleted
 * 0 -> ownership mismatch
 */
export const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) ~= ARGV[1] then
    return 0
end

redis.call("DEL", KEYS[1])

return 1
`;