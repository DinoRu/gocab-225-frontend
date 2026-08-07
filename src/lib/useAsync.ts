"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "./api";

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[]
): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoFn = useCallback(fn, deps);

  const run = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    memoFn()
      .then((res) => {
        if (active) setData(res);
      })
      .catch((e) => {
        if (active) {
          setError(e instanceof ApiError ? e.detail : "Une erreur est survenue.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [memoFn]);

  useEffect(() => run(), [run]);

  return { data, loading, error, reload: run };
}
