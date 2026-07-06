import { headers } from "next/headers";

export type RequestMeta = {
  ip: string | null;
  userAgent: string | null;
};

/**
 * ip/userAgent текущего запроса — для юр. следа согласий (Deal.consentIp /
 * consentUserAgent, план §4.4) и ключей rate-limit.
 *
 * Прод стоит за одним Caddy: реальный адрес клиента — ПОСЛЕДНИЙ элемент
 * x-forwarded-for (Caddy дописывает connecting-IP в хвост). Левые элементы
 * клиент может подделать, послав свой x-forwarded-for, — поэтому берём
 * именно хвост, а не голову (иначе спуф ломал бы rate-limit и юр. след).
 * x-real-ip — запасной вариант. Локальный dev без прокси отдаёт null →
 * rate-limit складывает всех в общий ключ, для dev это ок.
 */
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();

  const forwardedFor = h.get("x-forwarded-for");
  const chain = forwardedFor
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ip = chain?.at(-1) || h.get("x-real-ip")?.trim() || null;

  // UA обрезаем: колонка — юр. след, а не свалка для километровых ботовских строк
  const userAgent = h.get("user-agent")?.slice(0, 512) || null;

  return { ip: ip || null, userAgent };
}
