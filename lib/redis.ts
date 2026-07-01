import { createClient } from "redis";

let client: ReturnType<typeof createClient> | null = null;

export function getRedisClient() {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on("error", () => undefined);
    client.connect().catch(() => {
      client = null;
    });
  }

  return client;
}
