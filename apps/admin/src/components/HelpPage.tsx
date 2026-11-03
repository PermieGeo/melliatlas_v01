import { t, type Key, type Locale } from "../i18n";

const steps: Array<{ title: Key; body: Key }> = [
  { title: "helpAdminMapTitle", body: "helpAdminMapBody" },
  { title: "helpAdminReviewTitle", body: "helpAdminReviewBody" },
  { title: "helpAdminConfigTitle", body: "helpAdminConfigBody" },
  { title: "helpAdminDistrictTitle", body: "helpAdminDistrictBody" },
];

/** Operator guidance describes the implemented workflow separately from planned features. */
export function HelpPage({
  locale,
  onShowImport,
}: {
  locale: Locale;
  onShowImport(): void;
}) {
  const text = (key: Key): string => t(locale, key);
  return (
    <section
      aria-label={text("help")}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 md:p-8"
    >
      <h3 className="text-xl font-bold">{text("helpAdminTitle")}</h3>
      <p className="text-sm text-slate-700">{text("helpAdminIntro")}</p>
      <ol className="grid gap-4 lg:grid-cols-2">
        {steps.map(({ title, body }, index) => (
          <li key={title} className="rounded-xl border border-slate-200 p-4">
            <h4 className="font-semibold">
              {index + 1}. {text(title)}
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {text(body)}
            </p>
          </li>
        ))}
      </ol>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <h4 className="font-semibold">{text("helpAdminExampleTitle")}</h4>
        <p className="mt-2">{text("helpAdminExampleBody")}</p>
      </div>
      <p className="text-sm text-slate-700">{text("helpAdminSecurity")}</p>
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
