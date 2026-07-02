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
  confirmed: "bg-green-900 text-green-700",
  cancelled: "bg-[#e9eef6] text-[#8b97ab]",
  no_show: "bg-red-900 text-red-700",
};

export default async function BookingsPage() {
  const { bookings, commonAreas, properties, propertiesById, residents } = await getPageData();

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="mt-1">Common Area Bookings</h1>
          <p className="text-[#5b6b85] mt-1">Common-area reservations — gym, pool, and function rooms.</p>
        </div>
        <CreateBookingForm
          commonAreas={commonAreas}
          properties={properties}
          residents={residents}
        />
      </div>

      <div className="lux-card overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[900px]">
        <thead>
          <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#5b6b85] bg-[rgba(176,27,66,0.04)]">
            <th className="px-5 py-3.5 font-medium">Facility</th>
            <th className="px-5 py-3.5 font-medium">Property</th>
            <th className="px-5 py-3.5 font-medium">Resident</th>
            <th className="px-5 py-3.5 font-medium">Date</th>
            <th className="px-5 py-3.5 font-medium">Time</th>
            <th className="px-5 py-3.5 font-medium">Status</th>
            <th className="px-5 py-3.5 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => {
            const area = b.common_areas as { name: string; category: string; property_id: string } | null;
            const resident = b.resident as { full_name: string } | null;
            const start = new Date(b.start_time);
            const end = new Date(b.end_time);
            return (
              <tr key={b.id} className="border-b border-[rgba(176,27,66,0.08)] hover:bg-[#f0f4f9]">
                <td className="px-5 py-3.5">
                  <span className="font-medium">{area?.name ?? "—"}</span>
                  <span className="text-[#8b97ab] text-xs ml-2 capitalize">
                    {area?.category?.replace(/_/g, " ") ?? ""}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-[#5b6b85]">
                  {area?.property_id ? propertiesById.get(area.property_id) ?? "—" : "—"}
                </td>
                <td className="px-5 py-3.5">{resident?.full_name ?? "—"}</td>
                <td className="px-5 py-3.5 text-[#5b6b85]">{start.toLocaleDateString()}</td>
                <td className="px-5 py-3.5 text-[#5b6b85]">
                  {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                  {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[b.status] ?? "bg-[#e9eef6] text-[#5b6b85]"}`}
                  >
                    {b.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {b.status === "confirmed" && <BookingActions bookingId={b.id} />}
                </td>
              </tr>
            );
          })}
          {bookings.length === 0 && (
            <tr>
              <td className="px-5 py-10 text-[#8b97ab] text-center" colSpan={7}>
                No bookings yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      </div>
    </main>
  );
}
