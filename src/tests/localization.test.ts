/// <reference types="vite/client" />
// Guards extracted interface copy and checks variable messages against the English locale.
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatMessage,
  formatNumber,
  formatPercent,
  messages,
} from "../locales";

const components = import.meta.glob<string>("../**/*.tsx", {
  eager: true,
  query: "?raw",
  import: "default",
});

describe("localized interface", () => {
  it("keeps visible JSX text and accessibility labels in resources", () => {
    const inlineText: string[] = [];
    for (const [path, content] of Object.entries(components)) {
      const source = ts.createSourceFile(
        path,
        content,
        ts.ScriptTarget.Latest,
        true,
      );
      function visit(node: ts.Node) {
        if (ts.isJsxText(node) && node.text.trim())
          inlineText.push(`${path}: ${node.text.trim()}`);
        if (
          ts.isJsxAttribute(node) &&
          [
            "aria-label",
            "aria-description",
            "alt",
            "title",
            "placeholder",
          ].includes(node.name.getText(source)) &&
          node.initializer &&
          ts.isStringLiteral(node.initializer)
        )
          inlineText.push(`${path}: ${node.initializer.text}`);
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(inlineText).toEqual([]);
  });

  it("formats counts, decimals and percentages consistently", () => {
    expect(formatCount(messages.recordings.readings, 0)).toBe("0 readings");
    expect(formatCount(messages.recordings.readings, 1)).toBe("1 reading");
    expect(formatCount(messages.recordings.arrivals, 2)).toBe("2 arrivals");
    expect(formatNumber(2.345, 2)).toBe("2.35");
    expect(formatNumber(1244, 1)).toBe("1244.0");
    expect(formatPercent(95)).toBe("95.0%");
  });

  it("inserts complete messages without recursively interpreting their values", () => {
    expect(
      formatMessage(messages.tools.calibration.selectedCoordinate, {
        x: "1.0",
        y: "2.0",
      }),
    ).toBe("Image coordinate: x 1.0, y 2.0");
    expect(
      formatMessage("{value} / {value}", { value: "<b>{other}</b>" }),
    ).toBe("<b>{other}</b> / <b>{other}</b>");
  });
});
