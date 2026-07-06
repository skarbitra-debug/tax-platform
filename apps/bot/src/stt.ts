/**
 * Абстракция распознавания речи (§4.7). Конкретный движок (Yandex SpeechKit /
 * Whisper self-hosted) выбирается позже (решение отложено) — здесь только
 * интерфейс, чтобы остальной пайплайн голосового ассистента от него не зависел.
 *
 * Реализацию подключаем в createStt(): когда провайдер выбран, добавляем ветку
 * без изменения voice.ts и applyVoiceCommand.
 */
export interface SpeechToText {
  /** oggBytes — голосовое Telegram (OGG/Opus) → расшифрованный русский текст */
  transcribe(oggBytes: Uint8Array): Promise<string>;
}

/** Заглушка до выбора движка: явная ошибка вместо тихого молчания */
class NotConfiguredStt implements SpeechToText {
  async transcribe(): Promise<string> {
    throw new Error(
      "STT-движок не подключён. Выберите Yandex SpeechKit или Whisper и реализуйте createStt().",
    );
  }
}

/**
 * Фабрика STT. Пока возвращает заглушку; при выборе движка добавить ветку
 * (например, по env STT_PROVIDER=yandex|whisper).
 */
export function createStt(): SpeechToText {
  return new NotConfiguredStt();
}

/** Готов ли STT к работе (для приветственного ответа бота) */
export function isSttConfigured(): boolean {
  return false;
}
