import { z } from "zod";
import { cachedAsync } from "@/lib/cache";

/** Fetches a static TopoJSON file once per URL (retried after a failure). */
export const loadTopology = cachedAsync(async (url: string): Promise<unknown> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Échec du chargement de la carte (HTTP ${res.status})`);
  return res.json();
});

const namedGeometries = z.object({
  type: z.literal("GeometryCollection"),
  geometries: z.array(z.object({ properties: z.object({ name: z.string().min(1) }).loose() }).loose()),
});

/** Schema for a topology whose listed objects are named geometry collections. */
export function topologySchema<const K extends string>(objectNames: readonly K[]) {
  return z.object({
    type: z.literal("Topology"),
    arcs: z.array(z.unknown()),
    objects: z.object(
      Object.fromEntries(objectNames.map((name) => [name, namedGeometries])) as Record<K, typeof namedGeometries>,
    ),
  });
}
