"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Header link that marks the page you're on (shown black instead of grey).
export default function NavLink(props) {
  const current = usePathname() === props.href;
  return <Link {...props} aria-current={current ? "page" : undefined} />;
}
