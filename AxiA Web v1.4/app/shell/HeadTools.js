"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// A page's own tools (search, map/grid, upload…), shown in the header row after the three places,
// so the fixed menu and what changes per page share one line and the page keeps the window.
export default function HeadTools({ children }) {
  const [slot, setSlot] = useState(null);
  useEffect(() => setSlot(document.getElementById("head-tools")), []);
  return slot ? createPortal(children, slot) : null;
}
