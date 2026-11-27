import { redirect } from "next/navigation";

// Lab now sits under the About page.
export default function Lab() {
  redirect("/how#lab");
}
