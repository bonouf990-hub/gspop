import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import CreateStaffForm from "./CreateStaffForm";
import EditSalary from "./EditSalary";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  tenant_admin: "Full access across all properties, billing, and team management.",
  property_manager: "Manages assigned buildings: work orders, approvals, staff, budgets.",
  supervisor: "Reviews and rates technician work, escalates issues, approves within limit.",
  technician: "Field staff. Sees only assigned jobs. GPS check-in/out required.",
  security: "Sees the gate/visitor queue for assigned buildings only. Check-in/out/decline visitors.",
  call_center: "Logs resident complaints on their behalf. No financial or staff access.",
  vendor: "External contractor. Sees only their assigned work orders.",
};

export default async function TeamManagementPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const { data: callerProfile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userData.user?.id ?? "")
    .single();

  const isAdmin = callerProfile && ["tenant_admin", "property_manager"].includes(callerProfile.role);

  if (!isAdmin) {
    return (
      <main className="p-8">
        <p className="text-[#8b97ab]">You don&apos;t have access to Team Management.</p>
      </main>
    );
  }

  const [{ data: staff }, { data: properties }, { data: assignments }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id, full_name, role, trade, department, job_title, phone, reports_to_id, monthly_salary, hourly_rate")
      .order("role"),
    supabase.from("properties").select("id, name"),
    supabase.from("property_assignments").select("user_id, property_id"),
  ]);

  const staffById = new Map((staff ?? []).map((s) => [s.id, s]));
  const propertiesById = new Map((properties ?? []).map((p) => [p.id, p.name]));
  const propertiesByUser = new Map<string, string[]>();
  (assignments ?? []).forEach((a) => {
    const list = propertiesByUser.get(a.user_id) ?? [];
    list.push(propertiesById.get(a.property_id) ?? "—");
    propertiesByUser.set(a.user_id, list);
  });

  const managers = (staff ?? []).filter((s) =>
    ["tenant_admin", "property_manager", "supervisor"].includes(s.role)
  );

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="mt-1">Team Management</h1>
          <p className="text-[#5b6b85] mt-1">
            Create staff logins, assign roles, reporting lines, and which buildings they cover.
          </p>
        </div>
        <CreateStaffForm
          managers={(managers ?? []).map((m) => ({ id: m.id, full_name: m.full_name }))}
          properties={(properties ?? []).map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>

      <details className="mb-6 lux-card p-4">
        <summary className="cursor-pointer font-medium text-sm text-[#d9647f]">Role reference — who can do what</summary>
        <table className="w-full text-sm mt-3 border-collapse">
          <tbody>
            {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
              <tr key={role} className="border-b border-[rgba(176,27,66,0.08)]">
                <td className="py-2 pr-4 font-medium capitalize whitespace-nowrap">{role.replace(/_/g, " ")}</td>
                <td className="py-2 text-[#5b6b85]">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <div className="lux-card overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[1000px]">
        <thead>
          <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#5b6b85] bg-[rgba(176,27,66,0.04)]">
            <th className="px-5 py-3.5">Name</th>
            <th className="px-5 py-3.5">Role</th>
            <th className="px-5 py-3.5">Trade</th>
            <th className="px-5 py-3.5">Phone</th>
            <th className="px-5 py-3.5">Monthly Salary</th>
            <th className="px-5 py-3.5">Hourly Rate</th>
            <th className="px-5 py-3.5">Reports To</th>
            <th className="px-5 py-3.5">Buildings</th>
            <th className="px-5 py-3.5"></th>
          </tr>
        </thead>
        <tbody>
          {(staff ?? []).map((s) => (
            <tr key={s.id} className="border-b border-[rgba(176,27,66,0.08)]">
              <td className="px-5 py-3.5">{s.full_name}</td>
              <td className="px-5 py-3.5 capitalize">{s.role.replace(/_/g, " ")}</td>
              <td className="px-5 py-3.5 text-[#5b6b85] capitalize">{s.trade ?? "—"}</td>
              <td className="px-5 py-3.5 text-[#5b6b85]">{s.phone ?? "—"}</td>
              <td className="px-5 py-3.5 text-[#d9647f]">
                {s.monthly_salary ? `AED ${Number(s.monthly_salary).toLocaleString()}` : "—"}
              </td>
              <td className="px-5 py-3.5 text-[#d9647f]">
                {s.hourly_rate ? `AED ${Number(s.hourly_rate).toLocaleString()}` : "—"}
              </td>
              <td className="px-5 py-3.5 text-[#5b6b85]">
                {s.reports_to_id ? staffById.get(s.reports_to_id)?.full_name ?? "—" : "—"}
              </td>
              <td className="px-5 py-3.5 text-[#5b6b85]">{(propertiesByUser.get(s.id) ?? []).join(", ") || "All"}</td>
              <td className="px-5 py-3.5">
                <EditSalary
                  userId={s.id}
                  currentSalary={s.monthly_salary ? Number(s.monthly_salary) : null}
                  currentHourlyRate={s.hourly_rate ? Number(s.hourly_rate) : null}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      </div>
    </main>
  );
}
