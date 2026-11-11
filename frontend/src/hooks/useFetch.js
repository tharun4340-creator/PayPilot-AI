import { useCallback, useEffect, useRef, useState } from 'react';

/** Runs an async loader on mount and whenever deps change. Ignores stale responses. */
export default function useFetch(loader, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const counter = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async ({ silent = false } = {}) => {
    counter.current += 1;
    const id = counter.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      if (id === counter.current) setData(result);
    } catch (err) {
      if (id === counter.current) setError(err);
    } finally {
      if (id === counter.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
    return () => {
      counter.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, loading, error, reload: run };
}
