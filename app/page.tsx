import { HomeIntro } from "@/components/HomeIntro";
import { SolverHome } from "@/components/SolverHome";

export default function Home() {
  return (
    <>
      <SolverHome />
      <HomeIntro locale="en" aboutHref="/about" />
    </>
  );
}
