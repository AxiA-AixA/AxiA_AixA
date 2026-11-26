"use client";

import { useEffect, useRef, useState } from "react";

const LINK = /https?:\/\/[^\s"'<>]+/g;

// Adding references to a project: files, pasted screenshots, links, drag and drop anywhere on the page.
//   addFiles(files), addLinks(text)
//   uploading  how many are on their way;  error  the last problem, in words;  dragging  a drag is over the page
// onRefs(refs) receives the project's new reference list; before() runs first (send pending edits),
// after() once done (read the library again). `linkInput` is the link field: pasting there is left alone.
export function useAddReferences(id, { onRefs, before, after, linkInput }) {
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  async function addFiles(files) {
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    if (!images.length) { setError("Only image files can be added (JPG, PNG, WebP, GIF)."); return; }
    setError("");
    await before();
    setUploading((n) => n + images.length);
    const errors = [];
    for (const f of images) {
      try {
        const res = await fetch(`/api/projects/${id}/add?name=${encodeURIComponent(f.name || "pasted image")}`, { method: "POST", headers: { "content-type": f.type }, body: f });
        const d = await res.json();
        if (d.refs) onRefs(d.refs);
        errors.push(...(d.errors ?? []).map((e) => e.error), ...(d.error ? [d.error] : []));
      } catch { errors.push("Upload failed. Check that AxiA is still running."); }
      setUploading((n) => n - 1);
    }
    await after();
    if (errors.length) setError(errors[0]);
  }

  // Returns true if every link was added.
  async function addLinks(text) {
    const urls = [...new Set(text.match(LINK) ?? [])];
    if (!urls.length) { setError("Paste a link that starts with http."); return false; }
    setError("");
    await before();
    setUploading((n) => n + urls.length);
    let ok = false;
    try {
      const res = await fetch(`/api/projects/${id}/add`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ urls }) });
      const d = await res.json();
      if (d.refs) onRefs(d.refs);
      const err = d.error ?? d.errors?.[0]?.error;
      if (err) setError(d.errors?.length > 1 ? `${d.errors.length} links didn't work. ${err}` : err);
      ok = !err;
    } catch { setError("Couldn't add the link. Check that AxiA is still running."); }
    setUploading((n) => n - urls.length);
    await after();
    return ok;
  }

  // ⌘V anywhere: images go in as files; links go in when you're not typing in another field.
  // Drop anywhere: files or links. The handlers read the latest functions through a ref.
  const latest = useRef({ addFiles, addLinks });
  latest.current = { addFiles, addLinks };
  useEffect(() => {
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) { e.preventDefault(); latest.current.addFiles(files); return; }
      const el = document.activeElement;
      const inField = /INPUT|TEXTAREA/.test(el?.tagName ?? "") && el !== linkInput.current;
      const text = e.clipboardData?.getData("text") ?? "";
      if (!inField && /https?:\/\//.test(text)) { e.preventDefault(); latest.current.addLinks(text); }
    };
    const onOver = (e) => {
      if ([...(e.dataTransfer?.types ?? [])].some((t) => t === "Files" || t === "text/uri-list")) { e.preventDefault(); setDragging(true); }
    };
    const onLeave = (e) => { if (!e.relatedTarget) setDragging(false); };
    const onDrop = (e) => {
      e.preventDefault(); setDragging(false);
      if (e.dataTransfer.files.length) latest.current.addFiles(e.dataTransfer.files);
      else { const u = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text"); if (u) latest.current.addLinks(u); }
    };
    const events = { paste: onPaste, dragover: onOver, dragleave: onLeave, drop: onDrop };
    for (const [type, fn] of Object.entries(events)) addEventListener(type, fn);
    return () => { for (const [type, fn] of Object.entries(events)) removeEventListener(type, fn); };
  }, [linkInput]);

  return { addFiles, addLinks, uploading, error, setError, dragging };
}
