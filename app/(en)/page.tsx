import type { Metadata } from "next";
import { HomeIntro } from "@/components/HomeIntro";
import { SolverHome } from "@/components/SolverHome";
import { homeMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = homeMetadata("en");

export default function Home() {
  return (
    <>
      <SolverHome />
      <HomeIntro locale="en" />
    </>
  );
}
