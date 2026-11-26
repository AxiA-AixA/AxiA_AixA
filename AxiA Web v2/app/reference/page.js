import { redirect } from "next/navigation";

// Old address: the add-references page is the Library tab now.
export default function Reference() {
  redirect("/library");
}
