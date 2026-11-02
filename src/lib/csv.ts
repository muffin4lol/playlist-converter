import Papa from "papaparse";
import { trackSchema } from "./validation";
export function importCsv(text: string) {
  const p = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (p.errors.length) throw new Error("Invalid CSV");
  if (p.data.length > 1000) throw new Error("CSV limit is 1,000 tracks");
  return p.data.map((r, i) =>
    trackSchema.parse({
      id: r.id || `csv-${i}`,
      title: r.title,
      artist: r.artist,
      duration: Number(r.duration || 0),
      isrc: r.isrc || undefined,
      explicit:
        r.explicit === "true" ? true : r.explicit === "false" ? false : null,
      selected: true,
    }),
  );
}
export function exportCsv(rows: Record<string, unknown>[]) {
  return Papa.unparse(
    rows.map((r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [
          k,
          typeof v === "string" && /^(?:\s*[=+@-]|[\t\r])/.test(v)
            ? `'${v}`
            : v,
        ]),
      ),
    ),
  );
}
