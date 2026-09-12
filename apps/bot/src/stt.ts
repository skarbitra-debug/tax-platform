export interface SpeechToText {
  transcribe(oggBytes: Uint8Array): Promise<string>;
}

/** Compatible inert adapter: no audio decoding, model loading or network. */
export function createStt(): SpeechToText {
  return {
    async transcribe(_oggBytes: Uint8Array): Promise<string> {
      throw new Error("LEGACY_BOT_DISABLED");
    },
  };
}

export function isSttConfigured(): boolean {
  return false;
}
