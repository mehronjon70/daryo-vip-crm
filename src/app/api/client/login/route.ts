import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function hashPassword(phone: string, password: string) {
  const secret =
    process.env.ACCESS_CODE_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "daryo-secret";

  return crypto
    .createHash("sha256")
    .update(`${phone}:${password}:${secret}`)
    .digest("hex");
}

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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const phone = String(body.phone || "").trim();
    const password = String(body.password || "").trim();

    if (!phone) {
      return NextResponse.json(
        { error: "Введите номер телефона" },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: "Введите пароль" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select(
        "id, full_name, phone, status, vip_id, level, total_items, access_code_hash, created_at"
      )
      .eq("phone", phone)
      .maybeSingle();

    if (clientError) {
      console.log("Client login find error:", clientError);

      return NextResponse.json(
        { error: "Ошибка поиска клиента" },
        { status: 500 }
      );
    }

    if (!client) {
      return NextResponse.json(
        { error: "Клиент с таким номером не найден" },
        { status: 404 }
      );
    }

    const passwordHash = hashPassword(phone, password);

    if (client.access_code_hash !== passwordHash) {
      return NextResponse.json(
        { error: "Неверный номер телефона или пароль" },
        { status: 401 }
      );
    }

    if (client.status === "pending") {
      return NextResponse.json(
        { error: "Ваша регистрация ещё ожидает подтверждения администратора" },
        { status: 403 }
      );
    }

    if (client.status === "blocked") {
      return NextResponse.json(
        { error: "Ваш аккаунт выключен. Обратитесь к администратору" },
        { status: 403 }
      );
    }

    if (client.status !== "approved") {
      return NextResponse.json(
        { error: "Ваш аккаунт ещё не подтверждён" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Вход выполнен",
      client: {
        id: client.id,
        full_name: client.full_name,
        phone: client.phone,
        status: client.status,
        vip_id: client.vip_id,
        level: client.level,
        total_items: client.total_items,
        created_at: client.created_at,
      },
    });
  } catch (error) {
    console.log("Client login server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера при входе" },
      { status: 500 }
    );
  }
}