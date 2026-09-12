"use server";

export type LeadFormState = {
  ok: boolean;
  fieldErrors?: Record<string, string[]>;
  formError?: string;
};

/** Legacy intake remains disabled even for direct calls from an old page. */
export async function submitApplication(
  _prev: LeadFormState,
  _formData: FormData,
): Promise<LeadFormState> {
  return { ok: false, formError: "Приём заявок временно недоступен." };
}
