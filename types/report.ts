/**
 * A built-in sample report loaded from `03_Sample_Data/`.
 *
 * The report text itself is never stored in source; it is read from the
 * existing product artifact files at build time.
 */
export type SampleReport = {
  /** Stable slug used for selection state. */
  id: string;
  /** Short selector label, e.g. "Clean". */
  label: string;
  /** Source file name inside `03_Sample_Data/`. */
  fileName: string;
  /** First Markdown heading of the report body. */
  title: string;
  /** `company` value from the file's YAML frontmatter. */
  company: string;
  /** `scenario` value from the file's YAML frontmatter. */
  scenario: string;
  /** Report body with frontmatter removed. */
  content: string;
};
