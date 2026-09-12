import { hash, verify } from "@node-rs/argon2";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@tax/db";
import { isForbiddenSeedIdentity } from "@/lib/session-policy";
import { authConfig } from "@/auth.config";

/** Zod-парс входа: email нормализуется в lowercase (контракт §1) */
const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

/**
 * Фиктивный argon2id-хеш (случайного значения) для анти-тайминга: если email
 * не найден, всё равно прогоняем verify той же стоимости, чтобы время ответа
 * не выдавало существование аккаунта (enumeration по таймингу). Считается один
 * раз при старте модуля.
 */
const DUMMY_HASH = hash("timing-equalizer-not-a-real-password");

/**
 * Полный конфиг (Node runtime): Credentials + argon2id + Prisma.
 * Импортируется ТОЛЬКО из server-кода (route handlers, actions, layouts) —
 * middleware сюда не ходит (см. auth.config.ts).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        if (isForbiddenSeedIdentity(email)) return null;

        // realtorProfile подгружается здесь один раз (при логине) —
        // realtorId уезжает в JWT и дальше фильтрует выборки ЛК (план §1)
        const user = await prisma.user.findUnique({
          where: { email },
          include: { realtorProfile: { select: { id: true } } },
        });

        // Анти-тайминг: для несуществующего email прогоняем verify против
        // фиктивного хеша той же стоимости и выходим — время ответа не
        // отличает «нет такого email» от «неверный пароль».
        if (!user) {
          await verify(await DUMMY_HASH, password).catch(() => false);
          return null;
        }

        // argon2id-верификация (контракт §1: не bcrypt)
        const passwordOk = await verify(user.passwordHash, password);
        if (!passwordOk) return null;

        // PENDING/BLOCKED не пускаем уже на входе; живые JWT добивает requireRole()
        if (user.status !== "ACTIVE") return null;

        return {
          id: user.id,
          role: user.role,
          realtorId: user.realtorProfile?.id ?? null,
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
});
