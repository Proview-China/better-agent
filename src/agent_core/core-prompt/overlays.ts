import type {
  CoreOverlayIndexEntryV1,
  CoreOverlayIndexV1,
} from "./types.js";

function renderOverlayEntries(
  heading: string,
  entries: CoreOverlayIndexEntryV1[] | undefined,
): string | undefined {
  if (!entries || entries.length === 0) {
    return undefined;
  }
  return [
    `${heading}:`,
    ...entries.map((entry) => [
      `- id: ${entry.id}`,
      `  label: ${entry.label}`,
      `  summary: ${entry.summary}`,
      entry.bodyRef ? `  body_ref: ${entry.bodyRef}` : undefined,
    ].filter((line): line is string => Boolean(line)).join("\n")),
  ].join("\n");
}

export function renderCoreOverlayIndexBodyV1(input: CoreOverlayIndexV1): string {
  const sections = [
    `schema_version: ${input.schemaVersion}`,
    renderOverlayEntries("capability_families", input.capabilityFamilies),
    renderOverlayEntries("skills", input.skills),
    renderOverlayEntries("memories", input.memories),
  ].filter((section): section is string => Boolean(section));

  return sections.join("\n");
}

export function renderCoreOverlayIndexV1(input: CoreOverlayIndexV1): string {
  return [
    "<core_overlay_index>",
    ...renderCoreOverlayIndexBodyV1(input)
      .split("\n")
      .map((line) => `  ${line}`),
    "</core_overlay_index>",
  ].join("\n");
}
