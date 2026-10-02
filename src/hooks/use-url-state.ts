import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * useState that lives in the URL's query string, for list filters: opening a
 * row and pressing Back returns to the same search, tab and page, and the
 * address can be shared. The default is left out of the URL; updates replace
 * the history entry rather than adding one per keystroke.
 */
export function useUrlState<T extends string | number>(key: string, fallback: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const value = (raw === null ? fallback : typeof fallback === "number" ? (Number(raw) as T) : (raw as T));
  const set = useCallback((v: T | ((prev: T) => T)) => {
    setParams((prev) => {
      const cur = prev.get(key);
      const old = (cur === null ? fallback : typeof fallback === "number" ? Number(cur) : cur) as T;
      const nextVal = typeof v === "function" ? (v as (p: T) => T)(old) : v;
      const next = new URLSearchParams(prev);
      if (nextVal === fallback || nextVal === "" || nextVal === undefined || nextVal === null) next.delete(key);
      else next.set(key, String(nextVal));
      return next;
    }, { replace: true });
  }, [key, fallback, setParams]);
  return [value, set];
}
