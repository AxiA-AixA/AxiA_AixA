"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Header link that marks the page you're on (shown black instead of grey).
// `current` overrides the check, e.g. Projects stays marked inside a project.
export default function NavLink({ current, ...props }) {
  const path = usePathname();
  const on = current ?? path === props.href;
  return <Link {...props} aria-current={on ? "page" : undefined} />;
}
