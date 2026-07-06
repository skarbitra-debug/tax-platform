import { headers } from "next/headers";

export type RequestMeta = {
  ip: string | null;
  userAgent: string | null;
};

/**
 * ip/userAgent текущего запроса — для юр. следа согласий (Deal.consentIp /
 * consentUserAgent, план §4.4) и ключей rate-limit.
 *
 * Прод стоит за Caddy: реальный адрес клиента приезжает первым элементом
 * x-forwarded-for (Caddy перезаписывает заголовок — подделка снаружи не
 * проходит). x-real-ip — запасной вариант. Локальный dev без прокси отдаёт
 * null → rate-limit складывает всех в ключ "unknown", для dev это ок.
 */
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();

  const forwardedFor = h.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;

  // UA обрезаем: колонка — юр. след, а не свалка для километровых ботовских строк
  const userAgent = h.get("user-agent")?.slice(0, 512) || null;

  return { ip: ip || null, userAgent };
}
