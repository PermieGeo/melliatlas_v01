import { CircleHelp } from "lucide-react";
import { useEffect, useRef, type ReactElement } from "react";
import { t, type Key, type Locale } from "../i18n";

type FieldHelpProps = {
  locale: Locale;
  subject: Key;
  message: Key;
  align?: "start" | "end";
};

/** Render a dismissible field explanation with outside-click and Escape handling. */
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
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const dismissOutside = (event: MouseEvent | PointerEvent): void => {
      const details = detailsRef.current;
      if (
        details?.open &&
        event.target instanceof Node &&
        !details.contains(event.target)
      ) {
        details.open = false;
      }
    };
    const dismissOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && detailsRef.current?.open) {
        detailsRef.current.open = false;
        summaryRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("click", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("click", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, []);

  return (
    <details
      ref={detailsRef}
      className="group relative inline-block align-middle"
    >
      <summary
        ref={summaryRef}
        role="button"
        tabIndex={0}
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
