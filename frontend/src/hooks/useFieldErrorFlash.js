import { useEffect, useRef, useState } from "react";

const DEFAULT_HIGHLIGHT_MS = 2000;

/**
 * Tracks which form field(s) should be briefly highlighted as the source of
 * a validation/API error, then automatically clears after `duration`.
 *
 * Returns:
 *   - errorField: string | string[] | null — whatever was last passed to flash()
 *   - flash(field): call with a field name or array of field names to highlight
 *   - clear(): clear immediately (e.g. on input change)
 *   - isErrored(field): convenience check, works whether flash() was given
 *     a single field or an array of fields
 */
export const useFieldErrorFlash = (duration = DEFAULT_HIGHLIGHT_MS) => {
  const [errorField, setErrorField] = useState(null);
  const timeoutRef = useRef(null);

  const flash = (field) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setErrorField(field);
    timeoutRef.current = setTimeout(() => setErrorField(null), duration);
  };

  const clear = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setErrorField(null);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const isErrored = (field) =>
    Array.isArray(errorField) ? errorField.includes(field) : errorField === field;

  return { errorField, flash, clear, isErrored };
};
