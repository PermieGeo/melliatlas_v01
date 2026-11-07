// Feature IDs: SOURCES.SAFE_FETCH
import { describe, expect, it } from "vitest";
import { buildSourceRequestHeaders } from "../src/modules/sources/sourceHttpHeaders.js";
import { SATURN_JSON_REQUEST_PROFILE } from "../src/modules/sources/providers/saturn/requestProfile.js";

describe("Saturn JSON request headers", () => {
  it("uses first-party browser-compatible metadata without credentials", () => {
    const headers = buildSourceRequestHeaders(
      "POST",
      '{"subject":"55"}',
      SATURN_JSON_REQUEST_PROFILE.headers,
    );
    expect(headers).toMatchObject({
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.5",
      Origin: "https://bee-saturn.ru",
      Referer: "https://bee-saturn.ru/",
      "Content-Type": "application/json;charset=UTF-8",
      "Content-Length": String(Buffer.byteLength('{"subject":"55"}')),
      "Accept-Encoding": "identity",
      "User-Agent": "MelliAtlas-SourceFetcher/1.0",
    });
    expect(headers).not.toHaveProperty("Cookie");
    expect(headers).not.toHaveProperty("Authorization");
  });

  it("does not send a browser POST Origin for GET district catalogs", () => {
    const headers = buildSourceRequestHeaders(
      "GET",
      undefined,
      SATURN_JSON_REQUEST_PROFILE.headers,
    );
    expect(headers.Referer).toBe("https://bee-saturn.ru/");
    expect(headers).not.toHaveProperty("Origin");
    expect(headers).not.toHaveProperty("Content-Type");
  });

  it("does not append Saturn-specific metadata to unrelated sources", () => {
    const headers = buildSourceRequestHeaders("POST", "{}", undefined);
    expect(headers).not.toHaveProperty("Origin");
    expect(headers).not.toHaveProperty("Referer");
    expect(headers).not.toHaveProperty("Accept-Language");
  });
});
