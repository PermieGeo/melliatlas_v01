# Weather Provider Contract

**Owner:** `apps/api/src/modules/weather/`. **Public API:** `OpenMeteoAdapter.inspect(Coordinates): Promise<InspectionResponse>` in `openMeteo.ts`.

- Uses an injectable `RemoteFetcher` and clock; returns source-attributed, validated Open-Meteo forecast-model measurements for WGS84 points.
- The API/core composition can invoke `inspect`; weather owns no database tables and does not inspect Saturn or treatment data.
- Fixed HTTPS destination, bounded timeout and input/output validation are mandatory. Errors become `UpstreamUnavailable`; never invent weather or infer pesticide safety.
- Additional weather providers require their own verified adapters and provenance.
