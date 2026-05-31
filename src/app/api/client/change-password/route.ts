import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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

function normalizePhone(phone: string) {
  return phone
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const rawPhone = String(body.phone || "").trim();
    const oldPassword = String(body.oldPassword || "").trim();
    const newPassword = String(body.newPassword || "").trim();

    const phone = normalizePhone(rawPhone);

    if (!phone) {
      return NextResponse.json(
        { error: "Номер клиента не найден" },
        { status: 400 }
      );
    }

    if (!oldPassword) {
      return NextResponse.json(
        { error: "Введите старый пароль" },
        { status: 400 }
      );
    }

    if (!newPassword) {
      return NextResponse.json(
        { error: "Введите новый пароль" },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: "Новый пароль должен быть минимум 4 символа" },
        { status: 400 }
      );
    }

    if (oldPassword === newPassword) {
      return NextResponse.json(
        { error: "Новый пароль должен отличаться от старого" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, phone, status, access_code_hash")
      .eq("phone", phone)
      .maybeSingle();

    if (clientError) {
      console.log("Change password find client error:", clientError);

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

    if (client.status === "pending") {
      return NextResponse.json(
        { error: "Ваш аккаунт ещё не подтверждён" },
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

    const oldPasswordHash = hashPassword(phone, oldPassword);

    if (client.access_code_hash !== oldPasswordHash) {
      return NextResponse.json(
        { error: "Старый пароль указан неверно" },
        { status: 401 }
      );
    }

    const newPasswordHash = hashPassword(phone, newPassword);

    const { error: updateError } = await supabaseAdmin
      .from("clients")
      .update({
        access_code_hash: newPasswordHash,
      })
      .eq("id", client.id);

    if (updateError) {
      console.log("Change password update error:", updateError);

      return NextResponse.json(
        { error: "Не получилось изменить пароль" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Пароль успешно изменён",
    });
  } catch (error) {
    console.log("Change password server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера при смене пароля" },
      { status: 500 }
    );
  }
}