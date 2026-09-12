/** Legacy PII handoff is disabled, including direct/replayed calls. */
export async function sendHandoffToChannel(_dealId: string): Promise<boolean> {
  return false;
}
