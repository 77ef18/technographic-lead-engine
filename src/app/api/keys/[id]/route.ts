import type { NextRequest } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/admin";
import { dbQuery } from "@/lib/db";
import { jsonError } from "@/lib/http";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request)) {
    return jsonError("Unauthorized.", 401);
  }

  const { id } = await context.params;
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) {
    return jsonError("Invalid API key id.");
  }

  const result = await dbQuery<{ id: string }>(
    `
      UPDATE api_keys
      SET active = FALSE
      WHERE id = $1
      RETURNING id
    `,
    [parsedId.data],
  );

  if (!result.rows[0]) {
    return jsonError("API key not found.", 404);
  }

  return Response.json({ deleted: true, id: result.rows[0].id });
}
