import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * What gets stored is the **source text**, never the shapes.
 *
 * Everything visual is derived, so a document is a string plus a small map of
 * manual positions. That is what makes persistence trivial, diffs readable, and
 * version history cheap.
 */

const overridesSchema = new Schema({}, { strict: false, _id: false });

const documentSchema = new Schema(
  {
    title: { type: String, required: true, default: "Untitled" },
    /** Authoritative for structure. */
    source: { type: String, required: true, default: "" },
    /**
     * Presentation only: `{ [nodeId]: { x, y, pinned } }`. Schemaless on
     * purpose — the keys are user-defined node ids, so there is nothing to
     * migrate when the shape evolves.
     */
    overrides: { type: overridesSchema, default: () => ({}) },
    renderMode: { type: String, enum: ["sketch", "clean"], default: "sketch" },
  },
  { timestamps: true },
);

documentSchema.index({ updatedAt: -1 });

const versionSchema = new Schema(
  {
    documentId: { type: Schema.Types.ObjectId, required: true, ref: "Document" },
    source: { type: String, required: true },
    overrides: { type: overridesSchema, default: () => ({}) },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

/** History is read newest-first, per document. */
versionSchema.index({ documentId: 1, createdAt: -1 });

const registryAliasSchema = new Schema(
  {
    teamId: { type: String, required: true, default: "local" },
    alias: { type: String, required: true },
    archetype: { type: String, required: true },
  },
  { timestamps: true },
);

/**
 * Not optional. Without this a team could define the same alias twice and
 * resolution would depend on iteration order — the exact non-determinism the
 * registry-only design exists to prevent, and the one constraint Mongo will not
 * give us for free.
 */
registryAliasSchema.index({ teamId: 1, alias: 1 }, { unique: true });

export type DocumentDoc = InferSchemaType<typeof documentSchema>;
export type VersionDoc = InferSchemaType<typeof versionSchema>;

/** `models.X ??` because hot reload re-evaluates this file with the model already compiled. */
export const DocumentModel: Model<DocumentDoc> =
  (mongoose.models.Document as Model<DocumentDoc>) ??
  mongoose.model<DocumentDoc>("Document", documentSchema);

export const VersionModel: Model<VersionDoc> =
  (mongoose.models.Version as Model<VersionDoc>) ??
  mongoose.model<VersionDoc>("Version", versionSchema);

export const RegistryAliasModel =
  mongoose.models.RegistryAlias ??
  mongoose.model("RegistryAlias", registryAliasSchema);
