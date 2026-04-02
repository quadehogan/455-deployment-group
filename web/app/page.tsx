import { redirect } from "next/navigation";

// Home URL sends people straight to customer selection (no separate landing page).
export default function Home() {
  redirect("/select-customer");
}
