import { redirect } from "next/navigation";

// Middleware normally redirects "/" based on session; this is a safety fallback.
export default function Home() {
  redirect("/dashboard");
}
