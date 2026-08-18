/** Split a KSA plate into letters + digits for display (TSR | 2345). */
export function splitPlateParts(plate: string | null | undefined): { letters: string; digits: string } {
  const raw = (plate ?? "").toUpperCase().trim();
  const compact = raw.replace(/[^A-Z0-9]/g, "");
  const paired =
    compact.match(/^(\d{3,4})([A-Z]{1,4})$/) || compact.match(/^([A-Z]{1,4})(\d{3,4})$/);
  if (paired) {
    const a = paired[1];
    const b = paired[2];
    if (/\d/.test(a)) return { digits: a, letters: b };
    return { letters: a, digits: b };
  }
  return {
    letters: raw.replace(/[^A-Z]/g, ""),
    digits: raw.replace(/[^0-9]/g, ""),
  };
}
