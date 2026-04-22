const DOMAIN_REGEX =
  /^(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function normalizeDomain(input: string) {
  const trimmed = input.trim().toLowerCase();
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const withoutPath = withoutProtocol.split("/")[0] ?? "";
  const noWww = withoutPath.replace(/^www\./, "");

  if (!DOMAIN_REGEX.test(noWww)) {
    throw new Error("Invalid domain format.");
  }

  return noWww;
}
