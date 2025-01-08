import Redis from "ioredis";
import { Bot } from "grammy";
import { Pool } from "pg";
import { ChatClient } from "./chat_client";

export class MessageCache {
  private redis: Redis;
  private pool: Pool;
  private readonly CHECK_INTERVAL = 1000;
  private readonly MESSAGE_THRESHOLD = 2;
  constructor(private bot: Bot<any>) {
    this.redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    this.startPolling();
  }

  async add(chatId: number, message: string) {
    const now = Math.floor(Date.now() / 1000);
    
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO chat_status (chat_id, last_message_at, pending_message_count)
         VALUES ($1, $2, 1)
         ON CONFLICT (chat_id) DO UPDATE SET 
           last_message_at = $2,
           pending_message_count = chat_status.pending_message_count + 1,
           updated_at = CURRENT_TIMESTAMP`,
        [chatId, now]
      );

      await this.redis.rpush(`chat:${chatId}`, message);
    } finally {
      client.release();
    }
  }

  private async processChat(client: any, row: { chat_id: number; pending_message_count: number }) {
    const chatId = row.chat_id;
    const key = `chat:${chatId}`;
    const count = row.pending_message_count;

    let messages = await this.redis.lpop(key, count);
    if (messages) {
      messages = Array.isArray(messages) ? messages : [messages];
      messages = messages.filter((message): message is string => message !== null);
      const chatClient = new ChatClient();
      const reply = await chatClient.chat(chatId, messages);
      await this.bot.api.sendMessage(chatId, reply);
    }
    await client.query(
      `UPDATE chat_status 
       SET pending_message_count = pending_message_count - $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE chat_id = $2`,
      [count, chatId]
    );
  }

  private async startPolling() {
    setInterval(async () => {
      const client = await this.pool.connect();
      try {
        const now = Math.floor(Date.now() / 1000);
        const result = await client.query(
          `SELECT chat_id, pending_message_count 
           FROM chat_status 
           WHERE pending_message_count > 0
           AND last_message_at < $1 - $2`,
          [now, this.MESSAGE_THRESHOLD]
        );

        await Promise.all(result.rows.map(row => this.processChat(client, row)));
      } finally {
        client.release();
      }
    }, this.CHECK_INTERVAL);
  }

  async cleanup() {
    await this.redis.quit();
    await this.pool.end();
  }
}
