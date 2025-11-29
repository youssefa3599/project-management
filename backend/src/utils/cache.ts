import redis from "./redisClient";

/**
 * Save a value in Redis with TTL
 */
export const setCache = async (key: string, value: any, ttlSeconds = 60) => {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    console.log(`[DEBUG] 💾 Cache set: ${key} (TTL ${ttlSeconds}s)`);
  } catch (err) {
    console.error("[DEBUG] ❌ Error setting cache:", err);
  }
};

/**
 * Retrieve a cached value
 */
export const getCache = async (key: string) => {
  try {
    const data = await redis.get(key);
    if (data) {
      console.log(`[DEBUG] ⚡ Cache hit: ${key}`);
      return JSON.parse(data);
    }
    console.log(`[DEBUG] 🕵️ Cache miss: ${key}`);
    return null;
  } catch (err) {
    console.error("[DEBUG] ❌ Error getting cache:", err);
    return null;
  }
};

/**
 * Clear a specific cache key
 */
export const clearCache = async (key: string) => {
  try {
    await redis.del(key);
    console.log(`[DEBUG] 🗑️ Cleared cache key: ${key}`);
  } catch (err) {
    console.error("[DEBUG] ❌ Error clearing cache:", err);
  }
};

/**
 * Clear all keys that match a pattern (e.g., "projects:USERID:*")
 */
export const clearCacheByPattern = async (pattern: string) => {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
      console.log(`[DEBUG] 🧹 Cleared ${keys.length} keys for pattern: ${pattern}`);
    } else {
      console.log(`[DEBUG] ⚠️ No cache keys matched: ${pattern}`);
    }
  } catch (err) {
    console.error("[DEBUG] ❌ Error clearing cache by pattern:", err);
  }
};
