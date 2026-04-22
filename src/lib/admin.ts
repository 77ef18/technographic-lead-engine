import type { NextRequest } from "next/server";

export function isAdminRequest(request: NextRequest) {
  if (process.env.SKIP_API_KEY_AUTH === "true") {
    return true;
  }

  const token = request.headers.get("x-admin-token");
  return Boolean(token && process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN);
}
