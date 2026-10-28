import { redirect } from "next/navigation";

// Lab is now a tab of the Reference page.
export default function Lab() {
  redirect("/reference?view=lab");
}
