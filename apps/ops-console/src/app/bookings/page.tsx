import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import CreateBookingForm from "./CreateBookingForm";
import BookingActions from "./BookingActions";

type BookingRow = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
  common_areas: { name: string; category: string; property_id: string } | null;
  resident: { full_name: string } | null;
};

type CommonArea = { id: string; name: string; category: string; property_id: string };
type Property = { id: string; name: string };
type Resident = { id: string; full_name: string };

async function getPageData() {
  const supabase = await createClient();
  const [{ data: bookings }, { data: commonAreas }, { data: properties }, { data: residents }] =
    await Promise.all([
      supabase
        .from("common_area_bookings")
        .select(
          "id, start_time, end_time, status, created_at, common_areas(name, category, property_id), resident:user_profiles!common_area_bookings_resident_id_fkey(full_name)"
        )
        .order("start_time", { ascending: false })
        .limit(100),
      supabase.from("common_areas").select("id, name, category, property_id").order("name"),
      supabase.from("properties").select("id, name").order("name"),
      supabase.from("user_profiles").select("id, full_name").eq("role", "resident").order("full_name"),
    ]);

  const propertiesById = new Map((properties ?? []).map((p) => [p.id, p.name]));

  return {
    bookings: (bookings ?? []) as unknown as BookingRow[],
    commonAreas: (commonAreas ?? []) as CommonArea[],
    properties: (properties ?? []) as Property[],
    propertiesById,
    residents: (residents ?? []) as Resident[],
  };
}

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-green-900 text-green-300",
  cancelled: "bg-[#213052] text-[#6b6454]",
  no_show: "bg-red-900 text-red-300",
};

export default async function BookingsPage() {
  const { bookings, commonAreas, properties, propertiesById, residents } = await getPageData();

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-extrabold mt-1">Common Area Bookings</h1>
        </div>
        <CreateBookingForm
          commonAreas={commonAreas}
          properties={properties}
          residents={residents}
        />
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
            <th className="py-2 font-medium">Facility</th>
            <th className="py-2 font-medium">Property</th>
            <th className="py-2 font-medium">Resident</th>
            <th className="py-2 font-medium">Date</th>
            <th className="py-2 font-medium">Time</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => {
            const area = b.common_areas as { name: string; category: string; property_id: string } | null;
            const resident = b.resident as { full_name: string } | null;
            const start = new Date(b.start_time);
            const end = new Date(b.end_time);
            return (
              <tr key={b.id} className="border-b border-[rgba(184,144,47,0.08)] hover:bg-[#213052]">
                <td className="py-2">
                  <span className="font-medium">{area?.name ?? "—"}</span>
                  <span className="text-[#6b6454] text-xs ml-2 capitalize">
                    {area?.category?.replace(/_/g, " ") ?? ""}
                  </span>
                </td>
                <td className="py-2 text-[#a0977e]">
                  {area?.property_id ? propertiesById.get(area.property_id) ?? "—" : "—"}
                </td>
                <td className="py-2">{resident?.full_name ?? "—"}</td>
                <td className="py-2 text-[#a0977e]">{start.toLocaleDateString()}</td>
                <td className="py-2 text-[#a0977e]">
                  {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                  {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="py-2">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[b.status] ?? "bg-[#213052] text-[#a0977e]"}`}
                  >
                    {b.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="py-2">
                  {b.status === "confirmed" && <BookingActions bookingId={b.id} />}
                </td>
              </tr>
            );
          })}
          {bookings.length === 0 && (
            <tr>
              <td className="py-4 text-[#6b6454]" colSpan={7}>
                No bookings yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
