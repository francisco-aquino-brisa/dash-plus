/** A filter choice whose label and value differ, with an optional second line. */
export interface FilterOption {
  value: string;
  label: string;
  /** Rendered under the label — the node's responsável, in the city filters. */
  hint?: string;
}

export const optionValue = (o: string | FilterOption) => (typeof o === "string" ? o : o.value);
export const optionLabel = (o: string | FilterOption) => (typeof o === "string" ? o : o.label);
