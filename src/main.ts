import { conversations } from "@grammyjs/conversations";
import { Bot, session } from "grammy";
import { MyContext } from "./interface";
import { startMarkdown } from "./markdown/start";

export const botToken = process.env.TELEGRAM_BOT_TOKEN || "";

export const bot = new Bot<MyContext>(botToken);

// Install the session plugin.
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
// bot.use(createConversation(report));

// Handle start command
bot.command("start", async (ctx) => {
  await ctx.reply(startMarkdown, { parse_mode: "MarkdownV2" });
});

// Any message comes in.
bot.on("message", async (ctx: MyContext) => {
  // Get the chat identifier.
  const chatId = ctx?.msg?.chat.id;
  const text = ctx.message?.text?.trim();
  if (!text || !chatId) {
    return;
  }
});

// Setup bot commands
bot.api.setMyCommands([{ command: "start", description: "View rules" }]);

bot.catch((err) => {
  console.error("bot error:", err);
});

// Start bot
bot.start({
  onStart: ({ username }) => console.log(`Listening as ${username}`),
});
