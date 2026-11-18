import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import Home from "./page";

describe("home page on the server", () => {
  it("puts the heading and the introduction in the HTML, below the solver's outline", () => {
    const html = renderToString(<Home />);
    expect(html).toMatch(/<h1[^>]*>Free GTO poker solver: preflop ranges, ICM and postflop<\/h1>/);
    expect(html).toContain("push/fold Nash ranges");
    expect(html).toContain('href="/about"');
    expect(html.indexOf("<header")).toBeLessThan(html.indexOf("<h1"));
  });
});
