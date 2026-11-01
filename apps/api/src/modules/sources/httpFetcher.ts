// Feature IDs: SOURCES.SAFE_FETCH, SOURCES.PROVIDER_CONFIGURATION
import { lookup as dnsLookup } from "node:dns/promises";
import https, { type RequestOptions } from "node:https";
import { BlockList, isIP } from "node:net";
import type { IncomingHttpHeaders } from "node:http";
import { evaluateSourceDestination } from "./destinationPolicy.js";
import { approvedSourceSchema, type ApprovedSource } from "./contracts.js";
import type { ProviderRequest } from "./providerConfiguration.js";

export type ResolvedAddress = { address: string; family: 4 | 6 };
export type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;
export type TransportResponse = {
  status: number;
  headers: IncomingHttpHeaders;
  bytes: Buffer;
};
export type SourceTransport = (
  url: URL,
  method: "GET" | "POST",
  body: string | undefined,
  pinned: ResolvedAddress,
  timeoutMs: number,
  maxBytes: number,
  signal?: AbortSignal,
) => Promise<TransportResponse>;

export type FetchedSourceResponse = {
  canonicalUrl: string;
  contentType: string;
  bytes: Buffer;
};

export type FetchFailureCode =
  | "SOURCE_UNAPPROVED" | "DESTINATION_DENIED" | "DNS_UNSAFE" | "NETWORK_FAILURE"
  | "TIMEOUT" | "CANCELLED" | "BODY_TOO_LARGE" | "MIME_DENIED"
  | "ENCODING_DENIED" | "BAD_REDIRECT" | "UPSTREAM_STATUS" | "BUSY" | "RATE_LIMITED";

export class SourceFetchFailure extends Error {
  constructor(readonly code: FetchFailureCode) {
    super(code);
    this.name = "SourceFetchFailure";
  }
}

const deniedIPv4 = new BlockList();
for (const [subnet, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) deniedIPv4.addSubnet(subnet, bits, "ipv4");

const globalIPv6 = new BlockList();
globalIPv6.addSubnet("2000::", 3, "ipv6");
const deniedIPv6 = new BlockList();
for (const [subnet, bits] of [
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16],
] as const) deniedIPv6.addSubnet(subnet, bits, "ipv6");

/** Deny special-use and non-global networks, including IPv4-mapped IPv6 addresses. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !deniedIPv4.check(address, "ipv4");
  return family === 6 && globalIPv6.check(address, "ipv6")
    && !deniedIPv6.check(address, "ipv6");
}

export const resolvePublicAddresses: AddressResolver = async (hostname) => {
  const addresses = await dnsLookup(hostname, { all: true, verbatim: true });
  return addresses.map(({ address, family }) => ({ address, family: family as 4 | 6 }));
};

/** Native TLS transport: direct connections only, with the validated DNS answer pinned. */
export const directHttpsTransport: SourceTransport = (
  url, method, body, pinned, timeoutMs, maxBytes, signal,
) => new Promise((resolve, reject) => {
  const headers: Record<string, string> = {
    Accept: "application/json, text/html, text/plain, application/pdf",
    "Accept-Encoding": "identity",
    "User-Agent": "MelliAtlas-SourceFetcher/1.0",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = String(Buffer.byteLength(body));
  }
  const options: RequestOptions = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method,
    headers,
    servername: url.hostname,
    rejectUnauthorized: true,
    agent: false,
    maxHeaderSize: 16_384,
    family: pinned.family,
    lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family),
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  const finish = (failure?: SourceFetchFailure, response?: TransportResponse) => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    if (failure) reject(failure);
    else if (response) resolve(response);
  };
  const onAbort = () => {
    finish(new SourceFetchFailure("CANCELLED"));
    req.destroy();
  };
  const req = https.request(options, (res) => {
    const actual = res.socket.remoteAddress;
    if (!actual || actual !== pinned.address || !isPublicAddress(actual)) {
      finish(new SourceFetchFailure("DNS_UNSAFE"));
      req.destroy();
      return;
    }
    const status = res.statusCode ?? 0;
    if ([301, 302, 303, 307, 308].includes(status)) {
      res.destroy();
      finish(undefined, { status, headers: res.headers, bytes: Buffer.alloc(0) });
      return;
    }
    const declared = Number(res.headers["content-length"]);
    if (res.headers["content-length"] !== undefined &&
        (!Number.isSafeInteger(declared) || declared < 0 || declared > maxBytes)) {
      finish(new SourceFetchFailure("BODY_TOO_LARGE"));
      req.destroy();
      return;
    }
    const chunks: Buffer[] = [];
    let received = 0;
    res.on("data", (chunk: Buffer) => {
      received += chunk.length;
      if (received > maxBytes) {
        finish(new SourceFetchFailure("BODY_TOO_LARGE"));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    res.on("end", () => finish(undefined, {
      status, headers: res.headers, bytes: Buffer.concat(chunks),
    }));
    res.on("error", () => finish(new SourceFetchFailure("NETWORK_FAILURE")));
  });
  req.on("error", (error: Error) => finish(error instanceof SourceFetchFailure
    ? error : new SourceFetchFailure("NETWORK_FAILURE")));
  timer = setTimeout(() => {
    finish(new SourceFetchFailure("TIMEOUT"));
    req.destroy();
  }, timeoutMs);
  timer.unref?.();
  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  if (!req.destroyed) req.end(body);
});

function resolveWithDeadline<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new SourceFetchFailure("TIMEOUT")), milliseconds);
    work.then((value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error); });
  });
}

export type FetcherDependencies = {
  resolver?: AddressResolver;
  transport?: SourceTransport;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

/** An explicit, reviewed source is mandatory; this class has no scheduler or public route. */
export class RestrictedSourceFetcher {
  private readonly lastStarted = new Map<string, number>();
  private active = 0;
  private readonly resolver: AddressResolver;
  private readonly transport: SourceTransport;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(dependencies: FetcherDependencies = {}) {
    this.resolver = dependencies.resolver ?? resolvePublicAddresses;
    this.transport = dependencies.transport ?? directHttpsTransport;
    this.now = dependencies.now ?? Date.now;
    this.sleep = dependencies.sleep ?? ((ms) => new Promise((done) => setTimeout(done, ms)));
  }

  async fetch(sourceInput: unknown, request: ProviderRequest, signal?: AbortSignal): Promise<FetchedSourceResponse> {
    const parsed = approvedSourceSchema.safeParse(sourceInput);
    if (!parsed.success) throw new SourceFetchFailure("SOURCE_UNAPPROVED");
    const source: ApprovedSource = parsed.data;
    if (!source.enabled) throw new SourceFetchFailure("SOURCE_UNAPPROVED");
    if (this.active >= 2) throw new SourceFetchFailure("BUSY");
    const previous = this.lastStarted.get(source.id);
    if (previous !== undefined && this.now() - previous < source.fetchPolicy.minIntervalMs) {
      throw new SourceFetchFailure("RATE_LIMITED");
    }
    if ((request.method !== "GET" && request.method !== "POST") ||
        (request.method === "GET" && request.body !== undefined) ||
        (request.body !== undefined && Buffer.byteLength(request.body) > 16_384) ||
        typeof request.url !== "string") {
      throw new SourceFetchFailure("DESTINATION_DENIED");
    }
    this.active += 1;
    this.lastStarted.set(source.id, this.now());
    try {
      return await this.fetchWithPolicy(source, request, signal);
    } finally {
      this.active -= 1;
    }
  }

  private async fetchWithPolicy(source: ApprovedSource, request: ProviderRequest, signal?: AbortSignal): Promise<FetchedSourceResponse> {
    let url = request.url;
    for (let redirects = 0; ; redirects += 1) {
      if (signal?.aborted) throw new SourceFetchFailure("CANCELLED");
      const allowed = evaluateSourceDestination(source, url);
      if (!allowed.allowed) throw new SourceFetchFailure("DESTINATION_DENIED");
      const destination = new URL(allowed.canonicalUrl);
      let response: TransportResponse | undefined;
      for (let attempt = 0; attempt <= source.fetchPolicy.maxRetries; attempt += 1) {
        if (signal?.aborted) throw new SourceFetchFailure("CANCELLED");
        let answers: ResolvedAddress[];
        try {
          answers = await resolveWithDeadline(
            this.resolver(destination.hostname), source.fetchPolicy.timeoutMs,
          );
        } catch (error) {
          throw error instanceof SourceFetchFailure ? error : new SourceFetchFailure("NETWORK_FAILURE");
        }
        if (!answers.length || answers.some((item) =>
          ![4, 6].includes(item.family) || isIP(item.address) !== item.family || !isPublicAddress(item.address))) {
          throw new SourceFetchFailure("DNS_UNSAFE");
        }
        try {
          response = await this.transport(
            destination, request.method, request.body, answers[0],
            source.fetchPolicy.timeoutMs, source.fetchPolicy.maxResponseBytes, signal,
          );
        } catch (error) {
          if (error instanceof SourceFetchFailure && ["TIMEOUT", "NETWORK_FAILURE"].includes(error.code)
              && attempt < source.fetchPolicy.maxRetries) {
            await this.sleep(100 * (attempt + 1));
            continue;
          }
          throw error instanceof SourceFetchFailure ? error : new SourceFetchFailure("NETWORK_FAILURE");
        }
        if (![429, 503].includes(response.status) || attempt === source.fetchPolicy.maxRetries) break;
        const retryValue = response.headers["retry-after"];
        const seconds = typeof retryValue === "string" && /^\d+$/.test(retryValue) ? Number(retryValue) : 0;
        await this.sleep(Math.min(1000, Math.max(100 * (attempt + 1), seconds * 1000)));
      }
      if (!response) throw new SourceFetchFailure("NETWORK_FAILURE");
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirects >= source.fetchPolicy.maxRedirects ||
            (request.method === "POST" && response.status !== 307 && response.status !== 308)) {
          throw new SourceFetchFailure("BAD_REDIRECT");
        }
        const location = response.headers.location;
        if (typeof location !== "string" || location.length > 2048) throw new SourceFetchFailure("BAD_REDIRECT");
        try {
          url = new URL(location, destination).toString();
        } catch {
          throw new SourceFetchFailure("BAD_REDIRECT");
        }
        continue;
      }
      if (response.status !== 200) throw new SourceFetchFailure("UPSTREAM_STATUS");
      if (response.bytes.length > source.fetchPolicy.maxResponseBytes) throw new SourceFetchFailure("BODY_TOO_LARGE");
      const encoding = response.headers["content-encoding"];
      if (encoding !== undefined && encoding !== "identity") throw new SourceFetchFailure("ENCODING_DENIED");
      const declared = response.headers["content-length"];
      if (declared !== undefined && (typeof declared !== "string" ||
          !/^\d+$/.test(declared) || Number(declared) > source.fetchPolicy.maxResponseBytes)) {
        throw new SourceFetchFailure("BODY_TOO_LARGE");
      }
      const mimeValue = response.headers["content-type"];
      const mime = typeof mimeValue === "string" ? mimeValue.split(";", 1)[0].trim().toLowerCase() : "";
      if (!source.fetchPolicy.allowedContentTypes.includes(mime as never)) throw new SourceFetchFailure("MIME_DENIED");
      return { canonicalUrl: destination.toString(), contentType: mime, bytes: response.bytes };
    }
  }
}
