import type { Metadata } from "next";
import { FlopsIndexPage } from "@/components/FlopPages/FlopsIndexPage";
import { flopsIndexMetadata } from "@/lib/seo/metadata";
import { FLOP_DATA } from "@/lib/seo/flopData";

export const metadata: Metadata = flopsIndexMetadata("ko");

export default function FlopsIndex() {
  return <FlopsIndexPage locale="ko" data={FLOP_DATA} />;
}
