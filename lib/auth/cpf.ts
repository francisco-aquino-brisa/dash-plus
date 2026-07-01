/**
 * CPF validation and formatting.
 *
 * The Brisanet SSO expects the CPF WITH punctuation (e.g. "055.212.333-41"),
 * so `maskCpf` is used both in the UI and before calling the SSO.
 */

/** Strip everything that is not a digit. */
export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

/** Apply the progressive mask 000.000.000-00 as the user types. */
export function maskCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);

  let out = digits.slice(0, 3);
  if (digits.length > 3) out += "." + digits.slice(3, 6);
  if (digits.length > 6) out += "." + digits.slice(6, 9);
  if (digits.length > 9) out += "-" + digits.slice(9, 11);
  return out;
}

/**
 * Validate a CPF (11 digits + check digits).
 * Accepts a string with or without punctuation.
 */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;

  // Reject repeated sequences (e.g. 111.111.111-11), which pass the check-digit
  // math but are not valid CPFs.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcCheckDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += parseInt(cpf[i], 10) * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcCheckDigit(9);
  const d2 = calcCheckDigit(10);

  return d1 === parseInt(cpf[9], 10) && d2 === parseInt(cpf[10], 10);
}
