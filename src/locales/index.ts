// Bundled English resources and native Intl formatting; no network lookup is required.
import common from "./en-CA/common.json";
import app from "./en-CA/app.json";
import map from "./en-CA/map.json";
import tools from "./en-CA/tools.json";
import recordings from "./en-CA/recordings.json";
import errors from "./en-CA/errors.json";

export const locale = "en-CA";
export const messages = { common, app, map, tools, recordings, errors };
const dateTimeFormatter = new Intl.DateTimeFormat(locale, {
  dateStyle: "medium",
  timeStyle: "medium",
});
const pluralRules = new Intl.PluralRules(locale);
const listFormatter = new Intl.ListFormat(locale, {
  style: "short",
  type: "unit",
});

export function formatMessage(
  template: string,
  values: Record<string, string | number>,
) {
  // Insert values as plain text; React escapes the result instead of interpreting HTML.
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder,
  );
}
export function formatNumber(value: number, fractionDigits = 0) {
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
export const formatDateTime = (timestamp: number) =>
  dateTimeFormatter.format(timestamp);
export const formatList = (values: string[]) => listFormatter.format(values);
export const formatPercent = (value: number) =>
  new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
export function formatCount(
  forms: { one: string; other: string },
  count: number,
) {
  const template =
    pluralRules.select(count) === "one" ? forms.one : forms.other;
  return formatMessage(template, { count: formatNumber(count) });
}
