import { db } from "@/db";
import * as schema from "@/db/schema-postgres";
import { and, eq } from "drizzle-orm";
import { toDataDTO, type DataDTO } from "./dto";

export const DEFAULT_SCOPE = "krx-all";
export const SECURITY_PUBLICATION_KEY = `security_latest/${DEFAULT_SCOPE}`;
export const COMPANY_PUBLICATION_KEY = `company_marketcap/${DEFAULT_SCOPE}`;
export const securityRankPublicationKey = (metric: schema.MetricType, scopeKey = DEFAULT_SCOPE) =>
  `security_rank/${scopeKey}/${metric}`;

export type PublicationRow = typeof schema.resultPublication.$inferSelect;
export type PublicationDTO = DataDTO<PublicationRow>;
export type ReadDatabase = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function readSnapshot<Result>(read: (tx: ReadDatabase) => Promise<Result>): Promise<Result> {
  return db.transaction(read, { isolationLevel: "repeatable read", accessMode: "read only" });
}

const headersBySnapshot = new WeakMap<ReadDatabase, Map<string, Promise<PublicationRow | null>>>();

export function readPublication(tx: ReadDatabase, publicationKey: string): Promise<PublicationRow | null> {
  let headers = headersBySnapshot.get(tx);
  if (!headers) { headers = new Map(); headersBySnapshot.set(tx, headers); }
  let header = headers.get(publicationKey);
  if (!header) {
    header = tx.query.resultPublication.findFirst({ where: eq(schema.resultPublication.publicationKey, publicationKey) })
      .then(row => row ?? null);
    headers.set(publicationKey, header);
  }
  return header;
}

export function isCurrentResult(
  row: { publicationKey: string | null; resultRevision: bigint | string | null; calculationId: string | null },
  publication: PublicationRow | null,
): boolean {
  return publication !== null && row.publicationKey === publication.publicationKey
    && row.resultRevision != null && String(row.resultRevision) === String(publication.revision)
    && row.calculationId === publication.calculationId;
}

export function currentRankResultFilter(publication: PublicationRow) {
  return and(
    eq(schema.securityRank.publicationKey, publication.publicationKey),
    eq(schema.securityRank.resultRevision, publication.revision),
    eq(schema.securityRank.calculationId, publication.calculationId),
    eq(schema.securityRank.scopeKey, publication.scopeKey),
    eq(schema.securityRank.metricType, publication.metricType!),
    eq(schema.securityRank.rankDate, publication.asOf),
  );
}

export function currentRankFilter(publication: PublicationRow) {
  return and(currentRankResultFilter(publication), eq(schema.securityRank.rankingState, "included"));
}

export function publicationState(publication: PublicationRow | null, expectedRevision?: string | null) {
  return {
    state: publication ? "published" as const : "unpublished" as const,
    publication: publication ? toDataDTO(publication) : null,
    revisionChanged: expectedRevision != null && (!publication || String(publication.revision) !== expectedRevision),
  };
}
