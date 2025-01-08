import { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import { Context, SessionFlavor } from "grammy";

// Define the shape of our session.
export interface MySessionData {}

export type MyContext = Context &
  SessionFlavor<MySessionData> &
  ConversationFlavor;

export type MyConversation = Conversation<MyContext>;
