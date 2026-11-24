import { redirect } from "next/navigation";

// The standalone pod-maker is retired; the Sign Up board generates pods. Old /pods links land there.
export default function PodsPage() {
  redirect("/board");
}
