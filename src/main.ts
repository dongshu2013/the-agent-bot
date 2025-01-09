import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

import { conversations } from "@grammyjs/conversations";
import { Bot, session } from "grammy";
import { MyContext } from "./interface";
import { startMarkdown } from "./markdown/start";
import { MessageCache } from "./chat/message_cache";
import { ChatClient } from './chat/chat_client';

export const botToken = process.env.TELEGRAM_BOT_TOKEN || "";

export const bot = new Bot<MyContext>(botToken);

const messageCache = new MessageCache(bot);

bot.use(
  session({
    initial() {
      // return empty object for now
      return {};
    },
  })
);

// Install the conversations plugin.
bot.use(conversations());

// Handle start command
bot.command("about_me", async (ctx) => {
  await ctx.reply(startMarkdown, { parse_mode: "MarkdownV2" });
});

// Handle start command
bot.command("get_report", async (ctx) => {
  if (!ctx.from?.id) {
    await ctx.reply("No user id");
    return;
  }
  const chatClient = new ChatClient();
  const report = await chatClient.getUserPersona(ctx.from?.id);
  await ctx.reply(report);
});

// Any message comes in.
bot.on("message", async (ctx: MyContext) => {
  // Get the chat identifier.
  const chatId = ctx?.msg?.chat.id;
  const text = ctx.message?.text?.trim();
  if (!text || !chatId) {
    console.log("No text or chatId");
    return;
  }
  await messageCache.add(chatId, text);
});

// Setup bot commands
bot.api.setMyCommands([
  { command: "about_me", description: "View rules" },
  { command: "get_report", description: "Get the evaluation report" },
]);

bot.catch((err) => {
  console.error("bot error:", err);
});

// Start bot
bot.start({
  onStart: ({ username }) => console.log(`Listening as ${username}`),
});
