import { spawn } from "node:child_process";
import { env } from "./env";

/**
 * Распознавание речи (§4.7) — self-hosted Whisper через Transformers.js
 * (@xenova/transformers, ONNX). Никаких внешних облаков: модель работает на
 * вашем сервере, голос его не покидает. Компиляции C++ нет (onnxruntime —
 * prebuilt), поэтому запускается и на Windows-dev, и в Docker.
 *
 * Пайплайн: Telegram voice (OGG/Opus) --ffmpeg--> 16кГц mono f32 PCM
 *           --whisper--> русский текст.
 * ffmpeg должен быть установлен (в проде — в bot-образе; локально — в PATH).
 */
export interface SpeechToText {
  transcribe(oggBytes: Uint8Array): Promise<string>;
}

const MODEL_MAP: Record<string, string> = {
  tiny: "Xenova/whisper-tiny",
  base: "Xenova/whisper-base",
  small: "Xenova/whisper-small",
  medium: "Xenova/whisper-medium",
};

/** OGG/Opus → Float32Array (16кГц, моно) через ffmpeg из stdin в stdout. */
function decodeOggToPcm(oggBytes: Uint8Array): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-ar", "16000", // 16 кГц — вход Whisper
      "-ac", "1", // моно
      "-f", "f32le", // сырой float32 little-endian
      "pipe:1",
    ]);
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    ff.stdout.on("data", (c: Buffer) => chunks.push(c));
    ff.stderr.on("data", (c: Buffer) => errChunks.push(c));
    ff.on("error", (e) =>
      reject(new Error(`ffmpeg не запущен (установлен ли он в PATH?): ${e.message}`)),
    );
    ff.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg завершился с кодом ${code}: ${Buffer.concat(errChunks)}`));
      }
      const buf = Buffer.concat(chunks);
      // Buffer → Float32Array (копия с корректным выравниванием)
      resolve(new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
    });
    ff.stdin.on("error", () => {}); // EPIPE, если ffmpeg закрылся раньше — игнор
    ff.stdin.write(Buffer.from(oggBytes));
    ff.stdin.end();
  });
}

// Пайплайн Whisper тяжёлый (грузит модель) — держим синглтон, инициализируем лениво
type TranscribeFn = (
  audio: Float32Array,
  opts: Record<string, unknown>,
) => Promise<{ text: string } | { text: string }[]>;
let pipelinePromise: Promise<TranscribeFn> | null = null;

async function getPipeline(): Promise<TranscribeFn> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      // Динамический импорт: ESM-only пакет, грузим только когда STT реально нужен
      const { pipeline } = await import("@xenova/transformers");
      const model = MODEL_MAP[env.WHISPER_MODEL] ?? MODEL_MAP.small!;
      console.log(`[stt] загружаю Whisper (${model})…`);
      const asr = await pipeline("automatic-speech-recognition", model);
      console.log("[stt] Whisper готов");
      return asr as unknown as TranscribeFn;
    })();
  }
  return pipelinePromise;
}

class WhisperStt implements SpeechToText {
  async transcribe(oggBytes: Uint8Array): Promise<string> {
    const audio = await decodeOggToPcm(oggBytes);
    const asr = await getPipeline();
    const out = await asr(audio, { language: "russian", task: "transcribe" });
    const text = Array.isArray(out) ? out.map((o) => o.text).join(" ") : out.text;
    return text.trim();
  }
}

export function createStt(): SpeechToText {
  return new WhisperStt();
}

/** Whisper реализован → голосовой ассистент активен (нужны ещё ffmpeg + ANTHROPIC_API_KEY) */
export function isSttConfigured(): boolean {
  return true;
}
