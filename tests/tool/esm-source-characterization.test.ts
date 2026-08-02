import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { resolveFromRoot } from "../helpers/paths";

type Characterization = {
  crewFlightStats: {
    rosterRows: unknown[][];
    parsedNames: string[];
  };
  textJoiner: {
    input: string;
    separator: string;
    items: string[];
    text: string;
  };
  pdfStamp: {
    range: string;
    pageCount: number;
    pages: number[];
  };
};

const characterization = JSON.parse(
  fs.readFileSync(resolveFromRoot("tests", "fixtures", "esm-migration", "core-characterization.json"), "utf8")
) as Characterization;

describe("ESM source characterization", () => {
  it("imports crew flight parsing directly from source", async () => {
    const source = await import("../../src/tool/app/crew-flight-stats/logic");
    expect(source.parseRosterRows(characterization.crewFlightStats.rosterRows))
      .toEqual(characterization.crewFlightStats.parsedNames);
  });

  it("imports text joining directly from source", async () => {
    const source = await import("../../src/tool/app/text-joiner/logic");
    expect(source.join(characterization.textJoiner.input, characterization.textJoiner.separator))
      .toEqual({
        items: characterization.textJoiner.items,
        text: characterization.textJoiner.text
      });
  });

  it("imports PDF stamp page parsing directly from source", async () => {
    const source = await import("../../src/tool/app/pdf-stamp/logic");
    expect(source.parsePageRange(characterization.pdfStamp.range, characterization.pdfStamp.pageCount))
      .toEqual(characterization.pdfStamp.pages);
  });
});
