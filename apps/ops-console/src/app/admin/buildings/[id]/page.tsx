import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import BuildingLocations from "./BuildingLocations";

async function getBuilding(id: string) {
  const supabase = await createClient();
  const [{ data: building }, { data: units }, { data: areas }] = await Promise.all([
    supabase.from("properties").select("id, name, address").eq("id", id).single(),
    supabase.from("units").select("id, label, floor, bedrooms").eq("property_id", id).order("label"),
    supabase.from("common_areas").select("id, name, category, floor").eq("property_id", id).order("name"),
  ]);
  return {
    building: building as { id: string; name: string; address: string | null } | null,
    units: (units ?? []) as { id: string; label: string; floor: string | null; bedrooms: number | null }[],
    areas: (areas ?? []) as { id: string; name: string; category: string; floor: string | null }[],
  };
}

export default async function BuildingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { building, units, areas } = await getBuilding(id);

  if (!building) {
    return <main className="p-6 sm:p-8 max-w-5xl mx-auto"><p className="text-[#8b97ab]">Building not found.</p></main>;
  }

  return (
    <main className="p-6 sm:p-8 max-w-5xl mx-auto">
      <Link href="/admin/buildings" className="text-sm text-[#5b6b85] hover:text-[#b01b42]">← Buildings</Link>
      <p className="eyebrow mt-2">Portfolio</p>
      <h1 className="mt-0.5">{building.name}</h1>
      <p className="text-[#5b6b85] mt-1 mb-6">
        {building.address ?? "Manage this building's apartments and common areas — add or remove any."}
      </p>

      <BuildingLocations buildingId={building.id} initialUnits={units} initialAreas={areas} />
    </main>
  );
}
