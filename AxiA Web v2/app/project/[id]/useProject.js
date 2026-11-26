"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLibrary, OFFLINE } from "@/lib/client/library";

const SAVE_AFTER_MS = 400;   // typing in a field saves once, shortly after the last key
const ANSWERS_POLL_MS = 10000;

// A project and the library it draws from.
//   project  the project (null while loading); missing: true if it doesn't exist
//   lib      { online, items }
//   save(patch)    change at once on screen, send to the server shortly after
//   flush()        send pending changes now (before sharing or adding references)
//   setProject     replace the project with what the server returned
//   reloadLib()    read the library again
// Once shared, the client's answers are re-read every 10 s.
export function useProject(id) {
  const [project, setProject] = useState(null);
  const [missing, setMissing] = useState(false);
  const [lib, setLib] = useState({ online: true, items: [] });
  const etag = useRef(null);
  const pending = useRef({});
  const timer = useRef(null);

  const reloadLib = useCallback(() => fetchLibrary(etag.current)
    .then((d) => { if (d) { etag.current = d.etag; setLib(d); } })
    .catch(() => setLib(OFFLINE)), []);

  useEffect(() => {
    fetch(`/api/projects/${id}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setProject).catch(() => setMissing(true));
    reloadLib();
  }, [id, reloadLib]);

  const shared = !!project?.shared;
  useEffect(() => {
    if (!shared) return;
    const t = setInterval(() => {
      fetch(`/api/projects/${id}`).then((r) => r.json())
        .then((d) => setProject((cur) => ({ ...cur, responses: d.responses, shared: d.shared }))).catch(() => {});
    }, ANSWERS_POLL_MS);
    return () => clearInterval(t);
  }, [id, shared]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const body = pending.current;
    pending.current = {};
    if (!Object.keys(body).length) return;
    await fetch(`/api/projects/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  }, [id]);

  const save = useCallback((patch) => {
    setProject((cur) => ({ ...cur, ...patch }));
    Object.assign(pending.current, patch);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_AFTER_MS);
  }, [flush]);

  // Leaving the page sends what is still pending instead of dropping it.
  useEffect(() => () => { flush(); }, [flush]);

  return { project, missing, lib, save, flush, setProject, reloadLib };
}

// Call fn every `ms` while `when` is true.
export function usePolling(fn, ms, when) {
  useEffect(() => {
    if (!when) return;
    const t = setInterval(fn, ms);
    return () => clearInterval(t);
  }, [fn, ms, when]);
}
