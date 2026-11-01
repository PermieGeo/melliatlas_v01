// Feature IDs: SOURCES.SATURN_CONFIGURATION
import type { SaturnConfiguration, SaturnConfigurationEdit } from "@melliatlas/contracts";
import { useRef, useState } from "react";
import { loadSaturnConfiguration, saveSaturnConfiguration } from "../api/client";

/** Operator-only editor; the bearer token is intentionally kept in component memory. */
export function SaturnSettings() {
  const [token, setToken] = useState("");
  const requestGeneration = useRef(0);
  const [config, setConfig] = useState<SaturnConfiguration | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [method, setMethod] = useState<"GET" | "POST">("POST");
  const [regionParameter, setRegionParameter] = useState("subject");
  const [regionCode, setRegionCode] = useState("55");
  const [parameters, setParameters] = useState("{}");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  function populate(value: SaturnConfiguration) {
    setConfig(value);
    setEndpoint(value.endpoint);
    setMethod(value.request.method);
    setRegionParameter(value.request.regionParameter);
    setRegionCode(String(value.request.regionCode));
    setParameters(JSON.stringify(value.request.parameters, null, 2));
  }

  async function open() {
    const generation = ++requestGeneration.current;
    setPending(true);
    setMessage("");
    try {
      const result = await loadSaturnConfiguration(token);
      if (requestGeneration.current === generation) populate(result);
    } catch (error) {
      if (requestGeneration.current === generation) {
        setConfig(null);
        setMessage(error instanceof Error ? error.message : "Ошибка доступа");
      }
    } finally {
      if (requestGeneration.current === generation) setPending(false);
    }
  }

  async function save() {
    if (!config) return;
    const generation = ++requestGeneration.current;
    setPending(true);
    setMessage("");
    try {
      const values: unknown = JSON.parse(parameters);
      const edit: SaturnConfigurationEdit = {
        endpoint,
        expectedRevision: config.revision,
        request: {
          method,
          regionParameter,
          regionCode: Number(regionCode),
          parameters: values as SaturnConfigurationEdit["request"]["parameters"],
        },
      };
      const result = await saveSaturnConfiguration(token, edit);
      if (requestGeneration.current === generation) {
        populate(result);
        setMessage("Конфигурация сохранена. Загрузка из «Сатурн» остаётся отключённой до проверки доступа.");
      }
    } catch (error) {
      if (requestGeneration.current === generation) setMessage(error instanceof Error ? error.message : "Не удалось сохранить настройки");
    } finally {
      if (requestGeneration.current === generation) setPending(false);
    }
  }

  return (
    <section aria-label="Настройки ФГИС Сатурн" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-display text-lg font-bold">ФГИС «Сатурн» — конфигурация API</h2>
      <p className="text-sm text-slate-600">Настройки сохраняются на сервере. Адрес API пока является кандидатом; автоматический сбор и отображение обработок не включены.</p>
      <label className="block text-sm font-semibold text-slate-800">
        Токен оператора
        <input type="password" autoComplete="off" value={token} onChange={(event) => { requestGeneration.current += 1; setToken(event.target.value); setConfig(null); setPending(false); }} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <button type="button" disabled={pending || !token} onClick={() => void open()} className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50">Открыть настройки</button>
      {config && (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-500">Ревизия: {config.revision} · Доступ: {config.accessDecision} · Автозагрузка: отключена</p>
          <label className="block text-sm font-medium">HTTPS API endpoint
            <input aria-label="Saturn API endpoint" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" />
          </label>
          <label className="block text-sm font-medium">Метод
            <select aria-label="Saturn HTTP method" value={method} onChange={(event) => setMethod(event.target.value as "GET" | "POST")} className="mt-1 block w-full rounded-lg border border-slate-300 p-2">
              <option value="POST">POST</option><option value="GET">GET</option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">Параметр региона
              <input aria-label="Saturn region parameter" value={regionParameter} onChange={(event) => setRegionParameter(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
            </label>
            <label className="block text-sm font-medium">Код региона
              <input aria-label="Saturn region code" type="number" min={1} max={9999} value={regionCode} onChange={(event) => setRegionCode(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
            </label>
          </div>
          <label className="block text-sm font-medium">Дополнительные параметры запроса (JSON object)
            <textarea aria-label="Saturn request parameters" value={parameters} onChange={(event) => setParameters(event.target.value)} rows={4} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" />
          </label>
          <button type="button" disabled={pending} onClick={() => void save()} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm text-white disabled:opacity-50">Сохранить конфигурацию</button>
        </div>
      )}
      {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
    </section>
  );
}
