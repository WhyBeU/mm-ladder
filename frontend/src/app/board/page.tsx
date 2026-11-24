import { redirect } from "next/navigation";

// The sign-up board moved to /sign-up; keep old /board links (posted to Discord) working.
export default function BoardPage() {
  redirect("/sign-up");
}
