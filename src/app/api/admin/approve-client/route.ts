import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase env is missing");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function generateVipId() {
  const randomNumber = Math.floor(Math.random() * 9999) + 1;
  return `VIP ID - ${randomNumber}`;
}

async function generateUniqueVipId(supabaseAdmin: any) {
  for (let i = 0; i < 30; i++) {
    const vipId = generateVipId();

    const { data: existingClient, error } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("vip_id", vipId)
      .maybeSingle();

    if (error) {
      console.log("VIP ID check error:", error);
      continue;
    }

    if (!existingClient) {
      return vipId;
    }
  }

  return generateVipId();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const adminPassword = String(body.password || "").trim();
    const clientId = String(body.clientId || "").trim();

    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Неверный пароль админа" },
        { status: 401 }
      );
    }

    if (!clientId) {
      return NextResponse.json(
        { error: "Не указан клиент" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();

    const { data: client, error: findError } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, phone, status, vip_id, level, total_items")
      .eq("id", clientId)
      .maybeSingle();

    if (findError) {
      console.log("Find client before approve error:", findError);

      return NextResponse.json(
        { error: "Ошибка поиска клиента" },
        { status: 500 }
      );
    }

    if (!client) {
      return NextResponse.json(
        { error: "Клиент не найден" },
        { status: 404 }
      );
    }

    if (client.status === "approved") {
      return NextResponse.json({
        success: true,
        message: "Клиент уже подтверждён",
        client,
      });
    }

    if (client.status === "blocked") {
      return NextResponse.json(
        {
          error:
            "Этот аккаунт выключен. Сначала включите клиента через управление.",
        },
        { status: 403 }
      );
    }

    const vipId = client.vip_id || (await generateUniqueVipId(supabaseAdmin));

    const { data: approvedClient, error: approveError } = await supabaseAdmin
      .from("clients")
      .update({
        status: "approved",
        vip_id: vipId,
        level: client.level || "start",
        total_items: client.total_items || 0,
        approved_at: new Date().toISOString(),
      })
      .eq("id", clientId)
      .select(
        "id, full_name, phone, status, vip_id, level, total_items, created_at, approved_at"
      )
      .single();

    if (approveError) {
      console.log("Approve client error:", approveError);

      return NextResponse.json(
        { error: "Не получилось подтвердить клиента" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Клиент подтверждён. VIP ID: ${approvedClient.vip_id}`,
      client: approvedClient,
    });
  } catch (error) {
    console.log("Approve client server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера при подтверждении клиента" },
      { status: 500 }
    );
  }
}