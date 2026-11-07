// Feature IDs: SOURCES.SAFE_FETCH
import { lookup as dnsLookup } from "node:dns/promises";
import https, { type RequestOptions } from "node:https";
import { BlockList, isIP } from "node:net";
import type { IncomingHttpHeaders } from "node:http";
import {
  buildSourceRequestHeaders,
  type SourceHeaderMetadata,
} from "./sourceHttpHeaders.js";
import { SourceFetchFailure } from "./sourceFetchFailure.js";

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
  metadata?: SourceHeaderMetadata,
) => Promise<TransportResponse>;

const deniedIPv4 = new BlockList();
for (const [subnet, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  deniedIPv4.addSubnet(subnet, bits, "ipv4");

const globalIPv6 = new BlockList();
globalIPv6.addSubnet("2000::", 3, "ipv6");
const deniedIPv6 = new BlockList();
for (const [subnet, bits] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
] as const)
  deniedIPv6.addSubnet(subnet, bits, "ipv6");

/** Deny special-use and non-global networks, including IPv4-mapped IPv6 addresses. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !deniedIPv4.check(address, "ipv4");
  return (
    family === 6 &&
    globalIPv6.check(address, "ipv6") &&
    !deniedIPv6.check(address, "ipv6")
  );
}

export const resolvePublicAddresses: AddressResolver = async (hostname) => {
  const addresses = await dnsLookup(hostname, { all: true, verbatim: true });
  return addresses.map(({ address, family }) => ({
    address,
    family: family as 4 | 6,
  }));
};

/** Native TLS transport: direct connections only, with the validated DNS answer pinned. */
export const directHttpsTransport: SourceTransport = (
  url,
  method,
  body,
  pinned,
  timeoutMs,
  maxBytes,
  signal,
  metadata,
) =>
  new Promise((resolve, reject) => {
    const headers = buildSourceRequestHeaders(method, body, metadata);
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
      lookup: (_host, _options, callback) =>
        callback(null, pinned.address, pinned.family),
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const finish = (
      failure?: SourceFetchFailure,
      response?: TransportResponse,
    ) => {
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
        finish(undefined, {
          status,
          headers: res.headers,
          bytes: Buffer.alloc(0),
        });
        return;
      }
      const declared = Number(res.headers["content-length"]);
      if (
        res.headers["content-length"] !== undefined &&
        (!Number.isSafeInteger(declared) || declared < 0 || declared > maxBytes)
      ) {
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
      res.on("end", () =>
        finish(undefined, {
          status,
          headers: res.headers,
          bytes: Buffer.concat(chunks),
        }),
      );
      res.on("error", () => finish(new SourceFetchFailure("NETWORK_FAILURE")));
    });
    req.on("error", (error: Error) =>
      finish(
        error instanceof SourceFetchFailure
          ? error
          : new SourceFetchFailure("NETWORK_FAILURE"),
      ),
    );
    timer = setTimeout(() => {
      finish(new SourceFetchFailure("TIMEOUT"));
      req.destroy();
    }, timeoutMs);
    timer.unref?.();
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
    if (!req.destroyed) req.end(body);
  });
