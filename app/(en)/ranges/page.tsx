import type { Metadata } from "next";
import { RangesIndexPage } from "@/components/RangePages/RangesIndexPage";
import { rangesIndexMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = rangesIndexMetadata("en");

export default function RangesIndex() {
  return <RangesIndexPage locale="en" />;
}
