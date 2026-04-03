import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const userClient = await createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  return NextResponse.json(
    { message: "Final status can only be processed by Project Manager in the Employee Portal." },
    { status: 403 }
  );
}
