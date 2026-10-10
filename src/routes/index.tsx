import { createFileRoute } from "@tanstack/react-router";
import { OosJavad } from "@/components/oos-javad";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <OosJavad />;
}
