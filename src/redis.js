import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: process.env.REDIS_PORT || 6379,
});

redis.on("connect", () => {
  console.log("Connected to Redis");
});

redis.on("error", (err) => {
  console.error("Redis error:", err);
});

// redis.on("error", (err) => console.error("Redis error:", err));
// redis.on("connect", () => console.log("Redis connected"));

// await redis.connect();

export default redis;
