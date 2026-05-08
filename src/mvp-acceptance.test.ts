import { describe, expect, it } from "vitest";
import readmeText from "../README.md?raw";

describe("mvp acceptance", () => {
  it("documents required v1 scope and no-export constraint", () => {
    const readme = readmeText.toLowerCase();

    expect(readme).toContain("single file input");
    expect(readme).toContain("30-second");
    expect(readme).toContain("energy");
    expect(readme).toContain("bpm");
    expect(readme).toContain("key");
    expect(readme).toContain("confidence-aware");
    expect(readme).toContain("no export in v1");
  });
});
