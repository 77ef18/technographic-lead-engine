export async function GET() {
  return Response.json(
    {
      ok: true,
      service: "technographic-lead-engine",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
