import Redis from "ioredis";
import { Bot } from "grammy";
import { Pool } from "pg";
import { ChatClient } from "./chat_client";

export class MessageCache {
  private redis: Redis;
  private pool: Pool;
  private readonly CHECK_INTERVAL = 2000;
  private readonly MESSAGE_THRESHOLD = 5;
  private activePolls: Map<number, NodeJS.Timeout> = new Map();

  constructor(private bot: Bot<any>) {
    this.redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err);
    });

    this.initializeExistingPolls();
  }

  private async initializeExistingPolls() {
    console.log("initializing existing polls");
    const client = await this.pool.connect();
    try {
      console.log("querying chat_status");
      const result = await client.query(
        `SELECT chat_id FROM chat_status 
             WHERE pending_message_count > 0`
      );

      console.log("initializing existing polls", result.rows);
      for (const row of result.rows) {
        console.log("starting polling for chat", row);
        await this.startPollingForChat(row.chat_id);
      }
      console.log("initialized existing polls");
    } catch (error) {
      console.error("Error initializing existing polls:", error);
    } finally {
      client.release();
    }
  }

  async add(chatId: number, message: string) {
    const now = Math.floor(Date.now() / 1000);

    const client = await this.pool.connect();
    try {
      console.log("adding message to cache", chatId, message);
      await this.redis.rpush(`chat:${chatId}`, message);
      await client.query(
        `INSERT INTO chat_status (chat_id, last_message_at, pending_message_count)
         VALUES ($1, $2, 1)
         ON CONFLICT (chat_id) DO UPDATE SET 
           last_message_at = $2,
           pending_message_count = chat_status.pending_message_count + 1,
           updated_at = CURRENT_TIMESTAMP`,
        [chatId, now]
      );
    } finally {
      client.release();
    }

    await this.startPollingForChat(chatId);
  }

  private async processChat(
    client: any,
    row: { chat_id: number; pending_message_count: number }
  ) {
    const chatId = row.chat_id;
    const key = `chat:${chatId}`;
    const count = row.pending_message_count;
    let messages = await this.redis.lpop(key, count);
    await client.query(
      `UPDATE chat_status
       SET pending_message_count = GREATEST(0, pending_message_count - $1),
           updated_at = CURRENT_TIMESTAMP
       WHERE chat_id = $2`,
      [count, chatId]
    );

    if (messages) {
      messages = Array.isArray(messages) ? messages : [messages];
      messages = messages.filter(
        (message): message is string => message !== null
      );
      if (messages.length > 0) {
        const chatClient = new ChatClient();
        const reply = await chatClient.chat(chatId, messages);
        if (reply && reply.length > 0) {
          await this.bot.api.sendMessage(chatId, reply);
        }
      }
    }
  }

  private async startPollingForChat(chatId: number) {
    if (this.activePolls.has(chatId)) {
      return;
    }

    console.log("starting polling for chat", chatId);
    const interval = setInterval(async () => {
      const client = await this.pool.connect();
      try {
        const threshold =
          Math.floor(Date.now() / 1000) - this.MESSAGE_THRESHOLD;
        const result = await client.query(
          `SELECT chat_id, pending_message_count 
           FROM chat_status 
           WHERE chat_id = $1 
             AND pending_message_count > 0
             AND (pending_message_count > 5 OR last_message_at < $2)`,
          [chatId, threshold]
        );

        if (result.rows.length > 0) {
          await this.processChat(client, result.rows[0]);
        }
      } finally {
        client.release();
      }
    }, this.CHECK_INTERVAL);

    this.activePolls.set(chatId, interval);
    console.log("started polling for chat", chatId);
  }

  async cleanup() {
    console.log("cleaning up");
    for (const interval of this.activePolls.values()) {
      clearInterval(interval);
    }
    this.activePolls.clear();

    await this.redis.quit();
    await this.pool.end();
  }
}
