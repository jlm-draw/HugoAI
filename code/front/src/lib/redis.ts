import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:37488");

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export { redis };
