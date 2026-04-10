import {
  getEmployeeEmailSet,
  isPortalAdminByEmail,
  validateDelegationParticipants,
} from "@/lib/delegations/participants";
import { createServerSupabaseClient, getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const dataClient = await getDataClient();
  const [employeeEmails, profile] = await Promise.all([
    getEmployeeEmailSet(dataClient),
    dataClient.from("users_profile").select("email").eq("id", user.id).maybeSingle(),
  ]);
  if (!isPortalAdminByEmail(profile?.data?.email, employeeEmails)) {
    return NextResponse.json({ message: "Delegation is only available to admin users" }, { status: 403 });
  }
  const { data: delegations } = await supabase
    .from("delegations")
    .select("id, delegator_user_id, delegatee_user_id, from_date, to_date, notes, created_at")
    .or(`delegator_user_id.eq.${user.id},delegatee_user_id.eq.${user.id}`)
    .order("from_date", { ascending: false });
  const userIds = [...new Set((delegations ?? []).flatMap((d) => [d.delegator_user_id, d.delegatee_user_id]))];
  const { data: profiles } = await supabase.from("users_profile").select("id, email, full_name").in("id", userIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const list = (delegations ?? []).map((d) => ({
    ...d,
    delegator: profileMap.get(d.delegator_user_id) ?? { id: d.delegator_user_id, email: "", full_name: "" },
    delegatee: profileMap.get(d.delegatee_user_id) ?? { id: d.delegatee_user_id, email: "", full_name: "" },
  }));
  return NextResponse.json({ delegations: list });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const delegatee_user_id = body.delegatee_user_id;
  const from_date = body.from_date;
  const to_date = body.to_date;
  const notes = body.notes ?? null;
  if (!delegatee_user_id || !from_date || !to_date) {
    return NextResponse.json({ message: "delegatee_user_id, from_date, and to_date are required" }, { status: 400 });
  }
  if (delegatee_user_id === user.id) {
    return NextResponse.json({ message: "You cannot delegate to yourself" }, { status: 400 });
  }
  const dataClient = await getDataClient();
  const [employeeEmails, delegatorRes, delegateeRes] = await Promise.all([
    getEmployeeEmailSet(dataClient),
    dataClient.from("users_profile").select("email, is_super_user").eq("id", user.id).maybeSingle(),
    dataClient.from("users_profile").select("email, is_super_user").eq("id", delegatee_user_id).maybeSingle(),
  ]);
  if (!delegateeRes.data) {
    return NextResponse.json({ message: "Delegatee not found" }, { status: 400 });
  }
  const check = validateDelegationParticipants({
    delegatorEmail: delegatorRes.data?.email,
    delegatorIsSuper: delegatorRes.data?.is_super_user ?? false,
    delegateeEmail: delegateeRes.data.email,
    delegateeIsSuper: delegateeRes.data.is_super_user ?? false,
    employeeEmails,
  });
  if (!check.ok) return NextResponse.json({ message: check.message }, { status: check.status });
  const { data, error } = await supabase
    .from("delegations")
    .insert({
      delegator_user_id: user.id,
      delegatee_user_id,
      from_date,
      to_date,
      notes,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ id: data.id });
}
