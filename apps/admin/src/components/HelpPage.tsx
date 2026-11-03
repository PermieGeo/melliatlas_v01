import {
  helpDocumentSchema,
  type HelpDocument,
  type HelpSection,
} from "@melliatlas/contracts";
import { useEffect, useState } from "react";
import { t, type Key, type Locale } from "../i18n";

type HelpState =
  | { locale: Locale; status: "loading" | "error" }
  | { locale: Locale; status: "ready"; document: HelpDocument };

/** Render safe plain-text content from the separate operator help document. */
function Section({ section }: { section: HelpSection }) {
  return (
    <article className="space-y-3 rounded-xl border border-slate-200 p-4">
      <h4 className="font-semibold">{section.title}</h4>
      {section.paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-sm leading-relaxed text-slate-700">
          {paragraph}
        </p>
      ))}
      {section.steps && (
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
          {section.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      {section.notes?.map((note) => (
        <p
          key={note}
          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950"
        >
          {note}
        </p>
      ))}
    </article>
  );
}

/** Fetch local operator instructions independently of backend source collection. */
export function HelpPage({
  locale,
  onShowImport,
}: {
  locale: Locale;
  onShowImport(): void;
}) {
  const text = (key: Key): string => t(locale, key);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<HelpState>({ locale, status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ locale, status: "loading" });
    const load = async (): Promise<void> => {
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}help/${locale}.json`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Help document unavailable");
        const document = helpDocumentSchema.parse(await response.json());
        if (document.locale !== locale)
          throw new Error("Help document locale mismatch");
        if (!controller.signal.aborted)
          setState({ locale, status: "ready", document });
      } catch {
        if (!controller.signal.aborted) setState({ locale, status: "error" });
      }
    };
    void load();
    return () => controller.abort();
  }, [locale, attempt]);

  const visible =
    state.locale === locale ? state : { locale, status: "loading" as const };
  return (
    <section
      aria-label={text("help")}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 md:p-8"
    >
      {visible.status === "loading" && (
        <p role="status">{text("helpLoading")}</p>
      )}
      {visible.status === "error" && (
        <div className="space-y-3" role="alert">
          <p>{text("helpLoadError")}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
          >
            {text("helpRetry")}
          </button>
        </div>
      )}
      {visible.status === "ready" && (
        <>
          <h3 className="text-xl font-bold">{visible.document.title}</h3>
          <p className="text-sm leading-relaxed text-slate-700">
            {visible.document.intro}
          </p>
          <div className="space-y-4">
            {visible.document.sections.map((section) => (
              <Section key={section.id} section={section} />
            ))}
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-1">
            <Section section={visible.document.example} />
          </div>
          <div className="space-y-2 rounded-xl border border-amber-300 p-4">
            <h3 className="font-semibold">{visible.document.warningsTitle}</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
              {visible.document.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </>
      )}
      <button
        type="button"
        onClick={onShowImport}
        className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white"
      >
        {text("backToImport")}
      </button>
    </section>
  );
}
