import { handlers } from "@/auth";

// Единственный route handler Auth.js; все мутации приложения — server actions (план §3)
export const { GET, POST } = handlers;
