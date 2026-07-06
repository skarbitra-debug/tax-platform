// @tax/core — бизнес-логика без UI: рефералка, анкета, воронка, комиссии.
// Единый API-контракт (план §1): остальные зоны импортируют РОВНО эти имена.
// M2 добавит сюда движок статусов и расчёт распределения комиссий.

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
