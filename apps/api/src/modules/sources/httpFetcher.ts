// Feature IDs: SOURCES.SAFE_FETCH, SOURCES.PROVIDER_CONFIGURATION
import { isIP } from "node:net";
import { evaluateSourceDestination } from "./destinationPolicy.js";
import {
  manuallyFetchableSourceSchema,
  type SourceDefinition,
} from "./contracts.js";
import type { ProviderRequest } from "./providerConfiguration.js";
import type { SourceHeaderMetadata } from "./sourceHttpHeaders.js";
import { SourceFetchFailure } from "./sourceFetchFailure.js";
import {
  directHttpsTransport,
  isPublicAddress,
  resolvePublicAddresses,
  type AddressResolver,
  type ResolvedAddress,
  type SourceTransport,
  type TransportResponse,
} from "./sourceTransport.js";

export { SourceFetchFailure } from "./sourceFetchFailure.js";
export type { FetchFailureCode } from "./sourceFetchFailure.js";
export {
  directHttpsTransport,
  isPublicAddress,
  resolvePublicAddresses,
} from "./sourceTransport.js";
export type {
  AddressResolver,
  ResolvedAddress,
  SourceTransport,
  TransportResponse,
} from "./sourceTransport.js";

export type FetchedSourceResponse = {
  canonicalUrl: string;
  contentType: string;
  bytes: Buffer;
};

function resolveWithDeadline<T>(
  work: Promise<T>,
  milliseconds: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new SourceFetchFailure("TIMEOUT")),
      milliseconds,
    );
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export type FetcherDependencies = {
  resolver?: AddressResolver;
  transport?: SourceTransport;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  requestProfiles?: readonly SourceRequestProfile[];
};

/**
 * Trusted adapter-owned request metadata. Both source identity and exact URL
 * must match before a named profile can influence outbound HTTP headers.
 */
export interface SourceRequestProfile {
  readonly id: string;
  readonly sourceId: string;
  readonly allowedUrls: readonly string[];
  readonly headers: SourceHeaderMetadata;
}

/** An explicit, reviewed source is mandatory; this class has no scheduler or public route. */
export class RestrictedSourceFetcher {
  private readonly lastStarted = new Map<string, number>();
  private active = 0;
  private readonly resolver: AddressResolver;
  private readonly transport: SourceTransport;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly requestProfiles: ReadonlyMap<string, SourceRequestProfile>;

  constructor(dependencies: FetcherDependencies = {}) {
    this.resolver = dependencies.resolver ?? resolvePublicAddresses;
    this.transport = dependencies.transport ?? directHttpsTransport;
    this.now = dependencies.now ?? Date.now;
    this.sleep =
      dependencies.sleep ??
      ((ms) => new Promise((done) => setTimeout(done, ms)));
    const requestProfiles = dependencies.requestProfiles ?? [];
    this.requestProfiles = new Map(
      requestProfiles.map((profile) => [profile.id, profile]),
    );
    if (this.requestProfiles.size !== requestProfiles.length) {
      throw new Error("Duplicate source request profile ID");
    }
  }

  async fetch(
    sourceInput: unknown,
    request: ProviderRequest,
    signal?: AbortSignal,
  ): Promise<FetchedSourceResponse> {
    const parsed = manuallyFetchableSourceSchema.safeParse(sourceInput);
    if (!parsed.success) throw new SourceFetchFailure("SOURCE_UNAPPROVED");
    const source: SourceDefinition = parsed.data;
    if (!source.enabled) throw new SourceFetchFailure("SOURCE_UNAPPROVED");
    const profile =
      request.requestProfile === undefined
        ? undefined
        : this.requestProfiles.get(request.requestProfile);
    if (
      (request.method !== "GET" && request.method !== "POST") ||
      (request.method === "GET" && request.body !== undefined) ||
      (request.body !== undefined &&
        Buffer.byteLength(request.body) > 16_384) ||
      typeof request.url !== "string" ||
      (request.requestProfile !== undefined &&
        (!profile ||
          profile.sourceId !== source.id ||
          !profile.allowedUrls.includes(request.url)))
    ) {
      throw new SourceFetchFailure("DESTINATION_DENIED");
    }
    if (this.active >= 2) throw new SourceFetchFailure("BUSY");
    const previous = this.lastStarted.get(source.id);
    if (
      previous !== undefined &&
      this.now() - previous < source.fetchPolicy.minIntervalMs
    ) {
      throw new SourceFetchFailure("RATE_LIMITED");
    }
    this.active += 1;
    this.lastStarted.set(source.id, this.now());
    try {
      return await this.fetchWithPolicy(source, request, signal, profile);
    } finally {
      this.active -= 1;
    }
  }

  private async fetchWithPolicy(
    source: SourceDefinition,
    request: ProviderRequest,
    signal?: AbortSignal,
    profile?: SourceRequestProfile,
  ): Promise<FetchedSourceResponse> {
    let url = request.url;
    for (let redirects = 0; ; redirects += 1) {
      if (signal?.aborted) throw new SourceFetchFailure("CANCELLED");
      if (profile && !profile.allowedUrls.includes(url)) {
        throw new SourceFetchFailure("DESTINATION_DENIED");
      }
      const allowed = evaluateSourceDestination(source, url);
      if (!allowed.allowed) throw new SourceFetchFailure("DESTINATION_DENIED");
      const destination = new URL(allowed.canonicalUrl);
      let response: TransportResponse | undefined;
      for (
        let attempt = 0;
        attempt <= source.fetchPolicy.maxRetries;
        attempt += 1
      ) {
        if (signal?.aborted) throw new SourceFetchFailure("CANCELLED");
        let answers: ResolvedAddress[];
        try {
          answers = await resolveWithDeadline(
            this.resolver(destination.hostname),
            source.fetchPolicy.timeoutMs,
          );
        } catch (error) {
          throw error instanceof SourceFetchFailure
            ? error
            : new SourceFetchFailure("NETWORK_FAILURE");
        }
        if (
          !answers.length ||
          answers.some(
            (item) =>
              ![4, 6].includes(item.family) ||
              isIP(item.address) !== item.family ||
              !isPublicAddress(item.address),
          )
        ) {
          throw new SourceFetchFailure("DNS_UNSAFE");
        }
        try {
          response = await this.transport(
            destination,
            request.method,
            request.body,
            answers[0],
            source.fetchPolicy.timeoutMs,
            source.fetchPolicy.maxResponseBytes,
            signal,
            profile?.headers,
          );
        } catch (error) {
          if (
            error instanceof SourceFetchFailure &&
            ["TIMEOUT", "NETWORK_FAILURE"].includes(error.code) &&
            attempt < source.fetchPolicy.maxRetries
          ) {
            await this.sleep(100 * (attempt + 1));
            continue;
          }
          throw error instanceof SourceFetchFailure
            ? error
            : new SourceFetchFailure("NETWORK_FAILURE");
        }
        if (
          ![429, 503].includes(response.status) ||
          attempt === source.fetchPolicy.maxRetries
        )
          break;
        const retryValue = response.headers["retry-after"];
        const seconds =
          typeof retryValue === "string" && /^\d+$/.test(retryValue)
            ? Number(retryValue)
            : 0;
        await this.sleep(
          Math.min(1000, Math.max(100 * (attempt + 1), seconds * 1000)),
        );
      }
      if (!response) throw new SourceFetchFailure("NETWORK_FAILURE");
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (
          redirects >= source.fetchPolicy.maxRedirects ||
          (request.method === "POST" &&
            response.status !== 307 &&
            response.status !== 308)
        ) {
          throw new SourceFetchFailure("BAD_REDIRECT");
        }
        const location = response.headers.location;
        if (typeof location !== "string" || location.length > 2048)
          throw new SourceFetchFailure("BAD_REDIRECT");
        try {
          url = new URL(location, destination).toString();
        } catch {
          throw new SourceFetchFailure("BAD_REDIRECT");
        }
        continue;
      }
      if (response.status !== 200)
        throw new SourceFetchFailure("UPSTREAM_STATUS");
      if (response.bytes.length > source.fetchPolicy.maxResponseBytes)
        throw new SourceFetchFailure("BODY_TOO_LARGE");
      const encoding = response.headers["content-encoding"];
      if (encoding !== undefined && encoding !== "identity")
        throw new SourceFetchFailure("ENCODING_DENIED");
      const declared = response.headers["content-length"];
      if (
        declared !== undefined &&
        (typeof declared !== "string" ||
          !/^\d+$/.test(declared) ||
          Number(declared) > source.fetchPolicy.maxResponseBytes)
      ) {
        throw new SourceFetchFailure("BODY_TOO_LARGE");
      }
      const mimeValue = response.headers["content-type"];
      const mime =
        typeof mimeValue === "string"
          ? mimeValue.split(";", 1)[0].trim().toLowerCase()
          : "";
      if (!source.fetchPolicy.allowedContentTypes.includes(mime as never))
        throw new SourceFetchFailure("MIME_DENIED");
      return {
        canonicalUrl: destination.toString(),
        contentType: mime,
        bytes: response.bytes,
      };
    }
  }
}
