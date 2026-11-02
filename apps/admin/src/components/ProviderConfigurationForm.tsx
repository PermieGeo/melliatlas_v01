// Feature IDs: SOURCES.PROVIDER_CONFIGURATION, NOTICES.MAP_OVERLAY
import type {
  ProviderConfiguration,
  ProviderConfigurationEdit,
} from "@melliatlas/contracts";
import { useEffect, useState } from "react";
import {
  loadProviderConfiguration,
  saveProviderConfiguration,
} from "../api/client";
import { t, type Locale, type Key } from "../i18n";

export function ProviderConfigurationForm({ locale }: { locale: Locale }) {
  const text = (key: Key) => t(locale, key);
  const [configuration, setConfiguration] =
    useState<ProviderConfiguration | null>(null);
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [method, setMethod] = useState<"GET" | "POST">("POST");
  const [regionParameter, setRegionParameter] = useState("");
  const [regionContainer, setRegionContainer] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [parameters, setParameters] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<"saved" | "error" | null>(null);
  const [errorCode, setErrorCode] = useState("");

  function fill(value: ProviderConfiguration) {
    setConfiguration(value);
    setName(value.providerName);
    setEndpoint(value.endpoint);
    setMethod(value.request.method);
    setRegionParameter(value.request.regionParameter);
    setRegionContainer(value.request.regionContainer ?? "");
    setRegionCode(String(value.request.regionCode));
    setParameters(JSON.stringify(value.request.parameters, null, 2));
  }
  useEffect(() => {
    let active = true;
    loadProviderConfiguration()
      .then((value) => {
        if (active) fill(value);
      })
      .catch((cause) => {
        if (active) {
          setNotice("error");
          setErrorCode(
            cause instanceof Error ? cause.message : "REQUEST_FAILED",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    if (!configuration) return;
    setBusy(true);
    setNotice(null);
    try {
      const edit: ProviderConfigurationEdit = {
        providerName: name,
        endpoint,
        expectedRevision: configuration.revision,
        request: {
          method,
          regionParameter,
          ...(regionContainer.trim()
            ? { regionContainer: regionContainer.trim() }
            : {}),
          regionCode: Number(regionCode),
          parameters: JSON.parse(
            parameters,
          ) as ProviderConfigurationEdit["request"]["parameters"],
        },
      };
      fill(await saveProviderConfiguration(edit));
      setNotice("saved");
    } catch (cause) {
      setNotice("error");
      setErrorCode(cause instanceof Error ? cause.message : "REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  const fields = [
    { key: "sourceName" as const, value: name, setter: setName },
    { key: "endpoint" as const, value: endpoint, setter: setEndpoint },
    {
      key: "regionParameter" as const,
      value: regionParameter,
      setter: setRegionParameter,
    },
    {
      key: "regionContainer" as const,
      value: regionContainer,
      setter: setRegionContainer,
    },
    { key: "regionCode" as const, value: regionCode, setter: setRegionCode },
  ];
  return (
    <section
      aria-label={text("configuration")}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
    >
      <h2 className="text-xl font-bold">{text("provider")}</h2>
      <p className="text-sm text-slate-600">{text("editHint")}</p>
      {!configuration && !notice && <p role="status">{text("loading")}</p>}
      {configuration && (
        <>
          <p className="text-xs text-slate-500">
            {text("revision")}: {configuration.revision}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map(({ key, value, setter }) => (
              <label key={key} className="block text-sm font-medium">
                {text(key)}
                <input
                  aria-label={text(key)}
                  type={key === "regionCode" ? "number" : "text"}
                  value={value}
                  onChange={(event) => setter(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                />
              </label>
            ))}
          </div>
          <label className="block text-sm font-medium">
            {text("method")}
            <select
              aria-label={text("method")}
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as "POST" | "GET")
              }
              className="mt-1 w-full rounded-lg border p-2"
            >
              <option>POST</option>
              <option>GET</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            {text("parameters")}
            <textarea
              aria-label={text("parameters")}
              value={parameters}
              rows={5}
              onChange={(event) => setParameters(event.target.value)}
              className="mt-1 w-full rounded-lg border p-2 font-mono text-sm"
            />
          </label>
          <button
            disabled={busy}
            type="button"
            onClick={() => void save()}
            className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {text("save")}
          </button>
        </>
      )}
      {notice && (
        <p role={notice === "error" ? "alert" : "status"} className="text-sm">
          {text(notice === "error" ? "error" : "saved")}
          {notice === "error" && ` (${errorCode})`}
        </p>
      )}
    </section>
  );
}
