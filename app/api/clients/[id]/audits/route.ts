import { z } from "zod";
import {
  checkOrigin,
  licenseAccess,
  licenseResponse,
  mustAuthenticate,
  LicenseError,
} from "@/lib/license";
import {
  createAudit,
  getAudit,
  mutateAudit,
  ownedClient,
} from "@/lib/audit-service";
import { isAdministrator } from "@/lib/roles";
import { db } from "@/lib/db";
function auditError(error: unknown) {
  if (error instanceof LicenseError || error instanceof z.ZodError)
    return licenseResponse(error);
  console.error("Audit operation failed", error);
  return Response.json(
    { error: "Audit service unavailable. Please retry." },
    { status: 503 },
  );
}
type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export async function GET(request: Request, { params }: Context) {
  try {
    const session = await mustAuthenticate(request);
    const failure = await licenseAccess(session);
    if (failure) return failure;
    const { id } = await params;
    const query = new URL(request.url).searchParams;
    if (query.get("people") === "1") {
      await ownedClient(id, session);
      if (!isAdministrator(session.user.role))
        return Response.json(
          { error: "Administrator access required" },
          { status: 403 },
        );
      const people = await db()
        .collection("user")
        .find(
          {
            role: { $in: ["admin", "super_admin", "manager"] },
            banned: { $ne: true },
          },
          { projection: { name: 1, email: 1 } },
        )
        .limit(100)
        .toArray();
      return Response.json({
        people: people.map((p) => ({
          id: String(p._id),
          name: p.name || p.email,
        })),
      });
    }
    return Response.json(
      await getAudit(id, query.get("auditId") || undefined, session),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return auditError(error);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const session = await mustAuthenticate(request);
    const failure = await licenseAccess(session);
    if (failure) return failure;
    const { id } = await params;
    const input = z
      .object({ year: z.string() })
      .strict()
      .parse(await request.json());
    return Response.json(await createAudit(id, input.year, session));
  } catch (error) {
    return auditError(error);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const session = await mustAuthenticate(request);
    const failure = await licenseAccess(session);
    if (failure) return failure;
    const { id } = await params;
    const { auditId, revision, ...command } = await request.json();
    z.string()
      .regex(/^[a-f\d]{24}$/)
      .parse(auditId);
    return Response.json(
      await mutateAudit(id, auditId, revision, command, session),
    );
  } catch (error) {
    return auditError(error);
  }
}
