// Feature IDs: SOURCES.DOCUMENT_HISTORY
import type { SourceRequestProfile } from "./httpFetcher.js";

/** A named provider exposes only trusted request profiles for its own source identity. */
export interface SourceProvider {
  readonly sourceId: string;
  readonly requestProfiles: readonly SourceRequestProfile[];
}

/** Translate a bounded source-independent selection into validated provider pages. */
export interface ViewportIndexProvider<
  Selection,
  Query,
  Page,
> extends SourceProvider {
  firstPage(selection: Selection): Query;
  pageAt(firstPage: Query, pageNumber: number): Query;
  parsePage(payload: unknown, request: Query): Page;
}

/** Decode a provider's directory without inferring administrative boundaries. */
export interface DistrictDirectoryProvider<District> extends SourceProvider {
  parseDirectory(payload: unknown): readonly District[];
}
