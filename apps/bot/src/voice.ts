import type { Context } from "grammy";

/** Legacy voice commands are disabled even when called outside the entrypoint. */
export async function handleVoice(_ctx: Context): Promise<void> {
  throw new Error("LEGACY_BOT_DISABLED");
}
