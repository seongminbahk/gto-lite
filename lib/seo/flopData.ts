import raw from "@/data/flopPages.json";
import type { FlopPagesData } from "./flopPages";

/** The solved flops (scripts/build-flop-pages.mts writes the file); server only, read at build time. */
export const FLOP_DATA = raw as unknown as FlopPagesData;
