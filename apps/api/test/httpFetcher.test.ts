// Feature IDs: SOURCES.SAFE_FETCH
import { describe, expect, it, vi } from "vitest";
import {
  RestrictedSourceFetcher,
  SourceFetchFailure,
  isPublicAddress,
  type ResolvedAddress,
  type SourceRequestProfile,
  type SourceTransport,
  type TransportResponse,
} from "../src/modules/sources/httpFetcher.js";
import { SATURN_JSON_REQUEST_PROFILE } from "../src/modules/sources/providers/saturn/requestProfile.js";

const source = {
  id: "test-treatment",
  name: "Synthetic treatment feed",
  kind: "treatment",
  enabled: true,
  locations: [{ hostname: "public.example.org", pathPrefixes: ["/api/plans"] }],
  review: {
    decision: "approved",
    reviewedBy: "fixture-reviewer",
    reviewedAt: "2026-11-01T00:00:00.000Z",
    evidenceUrl: "https://example.org/permission",
    permissionBasis: "Synthetic permit for isolated tests only",
  },
  parserVersion: "fixture-v1",
  fetchPolicy: {
    timeoutMs: 1000,
    maxResponseBytes: 100,
    minIntervalMs: 1000,
    maxRedirects: 1,
    maxRetries: 1,
    allowedContentTypes: ["application/json"],
  },
} as const;
const request = {
  url: "https://public.example.org/api/plans",
  method: "POST" as const,
  body: "{}",
};
const publicAddress: ResolvedAddress = { address: "8.8.8.8", family: 4 };
const ok = (): TransportResponse => ({
  status: 200,
  headers: { "content-type": "application/json; charset=utf-8" },
  bytes: Buffer.from('{"content":[]}'),
});
function withStub(
  transport: SourceTransport,
  resolver = vi.fn(async () => [publicAddress]),
  now = () => 1000,
  requestProfiles: readonly SourceRequestProfile[] = [],
) {
  return {
    fetcher: new RestrictedSourceFetcher({
      resolver,
      transport,
      now,
      sleep: async () => {},
      requestProfiles,
    }),
    resolver,
  };
}

describe("restricted source fetcher", () => {
  it("retrieves approved source bytes without resolving a URL from client input", async () => {
    const transport = vi.fn(async () => ok());
    const { fetcher, resolver } = withStub(transport);
    await expect(fetcher.fetch(source, request)).resolves.toMatchObject({
      canonicalUrl: request.url,
      contentType: "application/json",
      bytes: Buffer.from('{"content":[]}'),
    });
    expect(resolver).toHaveBeenCalledWith("public.example.org");
    expect(transport).toHaveBeenCalledWith(
      new URL(request.url),
      "POST",
      "{}",
      publicAddress,
      1000,
      100,
      undefined,
      undefined,
    );
  });

  it("fetches a manually configured treatment source without documentary approval", async () => {
    const transport = vi.fn(async () => ok());
    const { fetcher } = withStub(transport);
    await expect(
      fetcher.fetch({ ...source, review: { decision: "configured" } }, request),
    ).resolves.toMatchObject({ canonicalUrl: request.url });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("uses the browser-compatible Saturn JSON profile only on exact approved endpoints", async () => {
    const transport = vi.fn(async () => ok());
    const { fetcher, resolver } = withStub(transport, undefined, undefined, [
      SATURN_JSON_REQUEST_PROFILE,
    ]);
    const saturnSource = {
      ...source,
      id: "treatment-feed",
      locations: [
        {
          hostname: "bee-saturn.ru",
          pathPrefixes: ["/backend/beemaster/query"],
        },
      ],
    };
    const saturnRequest = {
      url: "https://bee-saturn.ru/backend/beemaster/query",
      method: "POST" as const,
      body: "{}",
      requestProfile: "saturn-json" as const,
    };
    await expect(
      fetcher.fetch(saturnSource, saturnRequest),
    ).resolves.toMatchObject({
      canonicalUrl: saturnRequest.url,
    });
    expect(transport).toHaveBeenCalledWith(
      new URL(saturnRequest.url),
      "POST",
      "{}",
      publicAddress,
      1000,
      100,
      undefined,
      SATURN_JSON_REQUEST_PROFILE.headers,
    );
    expect(resolver).toHaveBeenCalledTimes(1);

    const deniedTransport = vi.fn(async () => ok());
    const denied = withStub(deniedTransport);
    await expect(
      denied.fetcher.fetch(source, {
        ...request,
        requestProfile: "saturn-json",
      }),
    ).rejects.toMatchObject({ code: "DESTINATION_DENIED" });
    expect(deniedTransport).not.toHaveBeenCalled();

    await expect(
      fetcher.fetch(source, {
        ...request,
        requestProfile: "saturn-json",
      }),
    ).rejects.toMatchObject({ code: "DESTINATION_DENIED" });
    await expect(
      fetcher.fetch(
        {
          ...saturnSource,
          locations: [
            {
              hostname: "bee-saturn.ru",
              pathPrefixes: ["/backend/beemaster"],
            },
          ],
        },
        {
          ...saturnRequest,
          url: "https://bee-saturn.ru/backend/beemaster/unverified",
        },
      ),
    ).rejects.toMatchObject({ code: "DESTINATION_DENIED" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("refuses unregistered profiles and duplicate profile identities", async () => {
    const transport = vi.fn(async () => ok());
    const { fetcher } = withStub(transport);
    await expect(
      fetcher.fetch(source, { ...request, requestProfile: "unregistered" }),
    ).rejects.toMatchObject({ code: "DESTINATION_DENIED" });
    expect(transport).not.toHaveBeenCalled();
    expect(
      () =>
        new RestrictedSourceFetcher({
          requestProfiles: [
            SATURN_JSON_REQUEST_PROFILE,
            SATURN_JSON_REQUEST_PROFILE,
          ],
        }),
    ).toThrow("Duplicate source request profile ID");
  });

  it("does not reuse an adapter profile after a redirect to another endpoint", async () => {
    const transport = vi.fn(async () => ({
      status: 302,
      headers: {
        location: "https://bee-saturn.ru/backend/beemaster/unverified",
      },
      bytes: Buffer.alloc(0),
    }));
    const { fetcher } = withStub(transport, undefined, undefined, [
      SATURN_JSON_REQUEST_PROFILE,
    ]);
    const saturnSource = {
      ...source,
      id: "treatment-feed",
      locations: [
        { hostname: "bee-saturn.ru", pathPrefixes: ["/backend/beemaster"] },
      ],
    };
    await expect(
      fetcher.fetch(saturnSource, {
        url: "https://bee-saturn.ru/backend/beemaster/query",
        method: "GET",
        requestProfile: "saturn-json",
      }),
    ).rejects.toMatchObject({ code: "DESTINATION_DENIED" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("does not allow configured municipal sources to bypass source approval", async () => {
    const transport = vi.fn(async () => ok());
    const { fetcher } = withStub(transport);
    await expect(
      fetcher.fetch(
        {
          ...source,
          kind: "municipal_notice",
          review: { decision: "configured" },
        },
        request,
      ),
    ).rejects.toMatchObject({ code: "SOURCE_UNAPPROVED" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects unreviewed, disabled and malformed source registrations before DNS", async () => {
    const transport = vi.fn(async () => ok());
    const { fetcher, resolver } = withStub(transport);
    for (const denied of [
      { ...source, review: { decision: "pending" } },
      { ...source, enabled: false },
      { ...source, locations: [] },
    ]) {
      await expect(fetcher.fetch(denied, request)).rejects.toMatchObject({
        code: "SOURCE_UNAPPROVED",
      });
    }
    expect(resolver).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    "https://public.example.org/other",
    "https://public.example.org/api/plans-private",
    "http://public.example.org/api/plans",
    "https://127.0.0.1/api/plans",
    "https://public.example.org/api/plans/%2e%2e/private",
  ])(
    "denies destinations outside an approved HTTPS host/path: %s",
    async (url) => {
      const transport = vi.fn(async () => ok());
      const { fetcher, resolver } = withStub(transport);
      await expect(
        fetcher.fetch(source, { ...request, url }),
      ).rejects.toMatchObject({ code: "DESTINATION_DENIED" });
      expect(resolver).not.toHaveBeenCalled();
    },
  );

  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "100.64.0.1",
    "169.254.169.254",
    "172.17.0.1",
    "192.168.1.1",
    "198.51.100.1",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
  ])("rejects non-public address %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "accepts global address %s",
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );

  it("rejects mixed DNS answers and does not dial any address", async () => {
    const transport = vi.fn(async () => ok());
    const { fetcher } = withStub(
      transport,
      vi.fn(async () => [
        publicAddress,
        { address: "127.0.0.1", family: 4 as const },
      ]),
    );
    await expect(fetcher.fetch(source, request)).rejects.toMatchObject({
      code: "DNS_UNSAFE",
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it("pins the selected DNS result and rejects rebinding to a private IP on retry", async () => {
    const resolver = vi
      .fn()
      .mockResolvedValueOnce([publicAddress])
      .mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }]);
    const transport = vi.fn(async () => ({
      status: 503,
      headers: {},
      bytes: Buffer.alloc(0),
    }));
    const { fetcher } = withStub(transport, resolver);
    await expect(fetcher.fetch(source, request)).rejects.toMatchObject({
      code: "DNS_UNSAFE",
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("follows only an approved redirect, rechecking the new destination", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce({
        status: 307,
        headers: { location: "/api/plans/next" },
        bytes: Buffer.alloc(0),
      })
      .mockResolvedValueOnce(ok());
    const { fetcher } = withStub(transport);
    await expect(fetcher.fetch(source, request)).resolves.toMatchObject({
      canonicalUrl: "https://public.example.org/api/plans/next",
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it.each([
    { status: 307, location: "http://public.example.org/api/plans" },
    { status: 307, location: "https://public.example.org.evil.net/api/plans" },
    { status: 307, location: "https://public.example.org/api/secret" },
  ])(
    "blocks redirected destination $location",
    async ({ status, location }) => {
      const transport = vi.fn(async () => ({
        status,
        headers: { location },
        bytes: Buffer.alloc(0),
      }));
      const { fetcher } = withStub(transport);
      await expect(fetcher.fetch(source, request)).rejects.toMatchObject({
        code: "DESTINATION_DENIED",
      });
      expect(transport).toHaveBeenCalledTimes(1);
    },
  );

  it("disallows POST-to-GET downgrade and excessive redirects", async () => {
    const transport = vi.fn(async () => ({
      status: 302,
      headers: { location: "/api/plans/next" },
      bytes: Buffer.alloc(0),
    }));
    const { fetcher } = withStub(transport);
    await expect(fetcher.fetch(source, request)).rejects.toMatchObject({
      code: "BAD_REDIRECT",
    });
  });

  it.each([
    {
      reply: { ...ok(), bytes: Buffer.alloc(101) },
      expected: "BODY_TOO_LARGE",
    },
    {
      reply: { ...ok(), headers: { "content-type": "text/html" } },
      expected: "MIME_DENIED",
    },
    {
      reply: {
        ...ok(),
        headers: {
          "content-type": "application/json",
          "content-encoding": "gzip",
        },
      },
      expected: "ENCODING_DENIED",
    },
    {
      reply: {
        ...ok(),
        headers: {
          "content-type": "application/json",
          "content-length": "1000",
        },
      },
      expected: "BODY_TOO_LARGE",
    },
  ])(
    "rejects unsafe response with code $expected",
    async ({ reply, expected }) => {
      const { fetcher } = withStub(async () => reply);
      await expect(fetcher.fetch(source, request)).rejects.toMatchObject({
        code: expected,
      });
    },
  );

  it("retries a transient 503 only within configured bounds", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce({
        status: 503,
        headers: { "retry-after": "1" },
        bytes: Buffer.alloc(0),
      })
      .mockResolvedValueOnce(ok());
    const { fetcher } = withStub(transport);
    await expect(fetcher.fetch(source, request)).resolves.toMatchObject({
      contentType: "application/json",
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("fails closed on cancelled, timed out, and exhausted requests", async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = vi.fn(async () => {
      throw new SourceFetchFailure("TIMEOUT");
    });
    const { fetcher } = withStub(transport);
    await expect(
      fetcher.fetch(source, request, controller.signal),
    ).rejects.toMatchObject({ code: "CANCELLED" });
    expect(transport).not.toHaveBeenCalled();
    const { fetcher: retrying } = withStub(transport);
    await expect(retrying.fetch(source, request)).rejects.toMatchObject({
      code: "TIMEOUT",
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("enforces the per-source request interval after a completed fetch", async () => {
    const transport = vi.fn(async () => ok());
    const { fetcher } = withStub(transport);
    await fetcher.fetch(source, request);
    await expect(fetcher.fetch(source, request)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("limits simultaneous fetches and releases capacity after completion", async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((done) => {
      release = done;
    });
    const transport = vi.fn(async () => {
      await pending;
      return ok();
    });
    const { fetcher } = withStub(transport);
    const alternate = (id: string) => ({ ...source, id });
    const first = fetcher.fetch(alternate("first-provider"), request);
    const second = fetcher.fetch(alternate("second-provider"), request);
    await expect(
      fetcher.fetch(alternate("third-provider"), request),
    ).rejects.toMatchObject({ code: "BUSY" });
    release?.();
    await Promise.all([first, second]);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("refuses caller-supplied body for GET and oversized POST bodies", async () => {
    const { fetcher } = withStub(async () => ok());
    await expect(
      fetcher.fetch(source, { ...request, method: "GET", body: "{}" }),
    ).rejects.toMatchObject({ code: "DESTINATION_DENIED" });
    await expect(
      fetcher.fetch(source, { ...request, body: "x".repeat(16_385) }),
    ).rejects.toMatchObject({ code: "DESTINATION_DENIED" });
  });
});
