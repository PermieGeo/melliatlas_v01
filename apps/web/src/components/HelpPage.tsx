import {
  helpDocumentSchema,
  type HelpDocument,
  type HelpSection,
} from "@melliatlas/contracts";
import { useEffect, useState } from "react";
import { translate, type Locale, type MessageKey } from "../i18n";

type HelpState =
  | { locale: Locale; status: "loading" | "error" }
  | { locale: Locale; status: "ready"; document: HelpDocument };

/** Display one externally loaded section without interpreting its text as HTML. */
function Section({
  section,
  numbered,
}: {
  section: HelpSection;
  numbered?: boolean;
}) {
  return (
    <article className="space-y-3 rounded-xl border border-slate-200 p-4">
      <h2 className="font-bold">{section.title}</h2>
      {section.paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-sm leading-relaxed text-slate-700">
          {paragraph}
        </p>
      ))}
      {section.steps && (
        <ol
          className={`space-y-2 pl-5 text-sm leading-relaxed text-slate-700 ${numbered ? "list-decimal" : "list-disc"}`}
        >
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

/** Load localized static help on demand; failures never substitute another language. */
export function HelpPage({
  locale,
  onShowMap,
}: {
  locale: Locale;
  onShowMap(): void;
}) {
  const t = (key: MessageKey): string => translate(locale, key);
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
      aria-label={t("help")}
      className="mx-auto max-w-4xl space-y-5 rounded-2xl bg-white p-5 shadow-sm md:p-8"
    >
      {visible.status === "loading" && <p role="status">{t("helpLoading")}</p>}
      {visible.status === "error" && (
        <div className="space-y-3" role="alert">
          <p>{t("helpLoadError")}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
          >
            {t("helpRetry")}
          </button>
        </div>
      )}
      {visible.status === "ready" && (
        <>
          <h1 className="font-display text-2xl font-bold">
            {visible.document.title}
          </h1>
          <p className="text-sm leading-relaxed text-slate-700">
            {visible.document.intro}
          </p>
          <div className="space-y-4">
            {visible.document.sections.map((section) => (
              <Section key={section.id} section={section} numbered />
            ))}
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-1">
            <Section section={visible.document.example} numbered />
          </div>
          <div className="space-y-2 rounded-xl border border-amber-300 p-4">
            <h2 className="font-bold">{visible.document.warningsTitle}</h2>
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
        onClick={onShowMap}
        className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
      >
        {t("backToMap")}
      </button>
    </section>
  );
}
