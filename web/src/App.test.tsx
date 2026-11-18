import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("renders the bootstrap page", () => {
    const html = renderToString(<App />);

    expect(html).toContain("ok");
    expect(html).toContain("Fitur bisnis belum diaktifkan");
  });
});
