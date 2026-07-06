// @tax/core — бизнес-логика без UI: рефералка, анкета, воронка, комиссии, статусы.
// Единый API-контракт (план §1): остальные зоны импортируют РОВНО эти имена.
// M3 добавит сюда разбор голосовых команд.

export {
  REFERRAL_TOKEN_ALPHABET,
  REFERRAL_TOKEN_LENGTH,
  REFERRAL_TOKEN_REGEX,
  generateReferralToken,
} from "./referral/token";

export { normalizeRuPhone } from "./referral/phone";

export { leadFormSchema, type LeadFormInput } from "./referral/lead-form";

export {
  getOrCreateActiveReferralLink,
  deactivateReferralLink,
  resolveReferralLink,
  type ActiveReferralLink,
  type ResolveReferralLinkResult,
} from "./referral/links";

export { createLead, type CreateLeadResult } from "./referral/create-lead";

export { getActiveCommissionConfig, type ActiveCommissionConfig } from "./commission/config";

// --- M2: расчёт распределения комиссий (§2) ---
export {
  computeCommission,
  bankersRoundDiv,
  type CommissionInput,
  type CommissionBreakdown,
  type CommissionBase,
  type ExecutorInput,
} from "./commission/compute";
export { recalcDealCommission, type RecalcResult } from "./commission/persist";

// --- M2: движок статусов сделки (§6, гибрид авто/ручной) ---
export {
  listActiveStatuses,
  changeDealStatus,
  changeDealStatusByCode,
  type ChangeStatusArgs,
  type ChangeStatusResult,
  type StatusChangeMode,
  type ChangeSource,
} from "./status/engine";
