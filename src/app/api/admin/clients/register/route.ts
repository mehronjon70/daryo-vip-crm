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

    const fullName = String(body.fullName || "").trim();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "").trim();

    if (!fullName) {
      return NextResponse.json({ error: "Введите имя" }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json(
        { error: "Введите номер телефона" },
        { status: 400 }
      );
    }

    if (!password || password.length < 4) {
      return NextResponse.json(
        { error: "Пароль должен быть минимум 4 символа" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();

    const { data: existingClient, error: existingError } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, phone, status")
      .eq("phone", phone)
      .maybeSingle();

    if (existingError) {
      console.log("Check existing client error:", existingError);

      return NextResponse.json(
        { error: "Ошибка проверки номера телефона" },
        { status: 500 }
      );
    }

    if (existingClient) {
      if (existingClient.status === "pending") {
        return NextResponse.json(
          {
            error:
              "Этот номер уже зарегистрирован и ожидает подтверждения администратора.",
          },
          { status: 409 }
        );
      }

      if (existingClient.status === "approved") {
        return NextResponse.json(
          {
            error:
              "Этот номер уже зарегистрирован. Войдите через страницу входа.",
          },
          { status: 409 }
        );
      }

      if (existingClient.status === "blocked") {
        return NextResponse.json(
          {
            error: "Этот аккаунт выключен. Обратитесь к администратору.",
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: "Этот номер уже зарегистрирован" },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(phone, password);

    const { data: client, error: insertError } = await supabaseAdmin
      .from("clients")
      .insert({
        full_name: fullName,
        phone,
        status: "pending",
        level: "start",
        total_items: 0,
        access_code_hash: passwordHash,
      })
      .select(
        "id, full_name, phone, status, vip_id, level, total_items, created_at"
      )
      .single();

    if (insertError) {
      console.log("Register client error:", insertError);

      return NextResponse.json(
        { error: "Не получилось зарегистрироваться" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Регистрация отправлена. Ожидайте подтверждения администратора.",
      client,
    });
  } catch (error) {
    console.log("Client register server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера при регистрации" },
      { status: 500 }
    );
  }
}