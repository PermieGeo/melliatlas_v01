import { CircleHelp } from "lucide-react";
import type { ReactElement } from "react";
import { t, type Key, type Locale } from "../i18n";

type FieldHelpProps = {
  locale: Locale;
  subject: Key;
  message: Key;
  align?: "start" | "end";
};

/** Render a keyboard-accessible, click-to-toggle explanation beside a field. */
export function FieldHelp({
  locale,
  subject,
  message,
  align = "start",
}: FieldHelpProps): ReactElement {
  const accessibleLabel = t(locale, "helpFor").replace(
    "{field}",
    t(locale, subject),
  );
  return (
    <details className="group relative inline-block align-middle">
      <summary
        role="button"
        aria-label={accessibleLabel}
        className="inline-flex size-6 list-none items-center justify-center rounded-full text-slate-500 outline-offset-2 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-emerald-700 [&::-webkit-details-marker]:hidden"
      >
        <CircleHelp aria-hidden="true" size={16} />
      </summary>
      <div
        role="note"
        className={`fixed inset-x-4 bottom-4 z-30 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-relaxed text-slate-700 shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:mt-1 sm:w-64 ${align === "start" ? "sm:left-0" : "sm:right-0"}`}
      >
        {t(locale, message)}
      </div>
    </details>
  );
}
