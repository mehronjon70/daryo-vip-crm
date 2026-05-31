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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const adminPassword = String(body.password || "").trim();
    const clientId = String(body.clientId || "").trim();
    const newPassword = String(body.newPassword || "").trim();

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

    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json(
        { error: "Новый пароль должен быть минимум 4 символа" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Не настроено подключение к Supabase" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, phone")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) {
      console.log("Find client for password reset error:", clientError);

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

    const newPasswordHash = hashPassword(client.phone, newPassword);

    const { error: updateError } = await supabaseAdmin
      .from("clients")
      .update({
        access_code_hash: newPasswordHash,
      })
      .eq("id", client.id);

    if (updateError) {
      console.log("Reset client password error:", updateError);

      return NextResponse.json(
        { error: "Не получилось обновить пароль клиента" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Пароль клиента успешно обновлён",
      client: {
        id: client.id,
        full_name: client.full_name,
        phone: client.phone,
      },
    });
  } catch (error) {
    console.log("Reset client password server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера при сбросе пароля" },
      { status: 500 }
    );
  }
}