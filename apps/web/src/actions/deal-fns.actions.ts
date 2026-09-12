"use server";

/** Состояние формы сохранения доступов */
export type FnsSetState = { ok?: boolean; error?: string };

/** Состояние показа доступов: при успехе несёт расшифрованные логин/пароль */
export type FnsRevealState =
  | { status: "idle" }
  | { status: "shown"; login: string; password: string }
  | { status: "error"; message: string };

/** Disabled independently of role, session and submitted fields. */
export async function setFnsAction(
  _prev: FnsSetState,
  _formData: FormData,
): Promise<FnsSetState> {
  return { error: "Работа с доступами ФНС отключена." };
}

export async function revealFnsAction(
  _prev: FnsRevealState,
  _formData: FormData,
): Promise<FnsRevealState> {
  return { status: "error", message: "Работа с доступами ФНС отключена." };
}

export async function clearFnsAction(
  _prev: FnsSetState,
  _formData: FormData,
): Promise<FnsSetState> {
  return { error: "Работа с доступами ФНС отключена." };
}
