import { NextResponse } from "next/server";
import { connectToDatabase, databaseUrl } from "@/server/db";
import { DocumentModel, VersionModel } from "@/server/models";
import { serialise, type StoredDocument } from "./serialise";

export const dynamic = "force-dynamic";

/**
 * `503` here is not an error condition so much as a fact about the environment:
 * no database is configured or reachable. The client treats it as a signal to
 * use localStorage, so it must be distinguishable from a genuine failure.
 */
function noDatabase() {
  return NextResponse.json(
    {
      backend: "none",
      reason: databaseUrl()
        ? "Could not reach MongoDB at MONGODB_URI"
        : "MONGODB_URI is not set",
      documents: [],
    },
    { status: 503 },
  );
}

export async function GET() {
  if (!(await connectToDatabase())) return noDatabase();

  const documents = await DocumentModel.find({})
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();

  return NextResponse.json({
    backend: "mongodb",
    documents: documents.map(serialise),
  });
}

export async function POST(request: Request) {
  if (!(await connectToDatabase())) return noDatabase();

  const body = (await request.json()) as Partial<StoredDocument>;
  const title = (body.title ?? "Untitled").slice(0, 200);
  const source = body.source ?? "";
  const overrides = body.overrides ?? {};
  const renderMode = body.renderMode === "clean" ? "clean" : "sketch";

  const document = body.id
    ? await DocumentModel.findByIdAndUpdate(
        body.id,
        { title, source, overrides, renderMode },
        { new: true, upsert: false },
      )
    : await DocumentModel.create({ title, source, overrides, renderMode });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  /**
   * History is best-effort. Writing `documents` and `versions` atomically needs
   * a transaction, and transactions need a replica set — a plain local `mongod`
   * has neither. Losing a history entry is a far better outcome than refusing
   * to save the user's work, so the failure is swallowed deliberately.
   */
  try {
    await VersionModel.create({
      documentId: document._id,
      source,
      overrides,
    });
  } catch {
    // Ignored on purpose — see above.
  }

  return NextResponse.json({ backend: "mongodb", document: serialise(document) });
}
