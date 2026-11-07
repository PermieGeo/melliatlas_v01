// Feature IDs: SOURCES.SAFE_FETCH, SOURCES.DOCUMENT_HISTORY
import type { SourceRequestProfile } from "../../httpFetcher.js";
import {
  SATURN_DISTRICT_URL,
  SATURN_SOURCE_ID,
  SATURN_VIEWPORT_URL,
} from "./sourceProfile.js";

export const SATURN_JSON_PROFILE_ID = "saturn-json";

/** The only Saturn requests allowed to carry first-party JSON request headers. */
export const SATURN_JSON_REQUEST_PROFILE: SourceRequestProfile = {
  id: SATURN_JSON_PROFILE_ID,
  sourceId: SATURN_SOURCE_ID,
  allowedUrls: [SATURN_VIEWPORT_URL, SATURN_DISTRICT_URL],
  headers: {
    accept: "application/json, text/plain, */*",
    acceptLanguage: "ru-RU,ru;q=0.9,en;q=0.5",
    origin: "https://bee-saturn.ru",
    referer: "https://bee-saturn.ru/",
    contentType: "application/json;charset=UTF-8",
  },
};
