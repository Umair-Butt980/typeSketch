import { NextResponse } from "next/server";
import { connectToDatabase } from "@/server/db";
import { DocumentModel, VersionModel } from "@/server/models";
import { serialise } from "../serialise";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  if (!(await connectToDatabase())) {
    return NextResponse.json({ backend: "none" }, { status: 503 });
  }

  const { id } = await params;
  const document = await DocumentModel.findById(id).lean().catch(() => null);

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json({ backend: "mongodb", document: serialise(document) });
}

export async function DELETE(_request: Request, { params }: Context) {
  if (!(await connectToDatabase())) {
    return NextResponse.json({ backend: "none" }, { status: 503 });
  }

  const { id } = await params;
  await DocumentModel.findByIdAndDelete(id).catch(() => null);
  // History goes with the document; leaving it would orphan rows forever.
  await VersionModel.deleteMany({ documentId: id }).catch(() => null);

  return NextResponse.json({ ok: true });
}
