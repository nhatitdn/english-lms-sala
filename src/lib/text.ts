/** "Nguyễn Đức Thịnh" → "Nguyen Duc Thinh" */
export function removeDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** "Nguyễn Minh Anh" → "minhanh.nguyen" (given names + "." + family name). */
export function suggestUsername(fullName: string): string {
  const parts = removeDiacritics(fullName)
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "hocvien";
  if (parts.length === 1) return parts[0]!;
  const [family, ...rest] = parts;
  const given = rest.slice(-2).join("");
  return `${given}.${family}`.slice(0, 36);
}

/** URL-safe slug from Vietnamese text. */
export function slugify(input: string): string {
  return removeDiacritics(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
