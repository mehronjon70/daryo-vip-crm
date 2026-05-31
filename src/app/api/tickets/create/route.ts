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
    const trackNumber = String(body.trackNumber || "").trim();
    const problemType = String(body.problemType || "Другое").trim();
    const message = String(body.message || "").trim();

    const phone = normalizePhone(rawPhone);

    if (!phone) {
      return NextResponse.json(
        { error: "Номер клиента не найден" },
        { status: 400 }
      );
    }

    if (!trackNumber) {
      return NextResponse.json(
        { error: "Введите трек-номер" },
        { status: 400 }
      );
    }

    if (!problemType) {
      return NextResponse.json(
        { error: "Выберите тип проблемы" },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: "Опишите проблему" },
        { status: 400 }
      );
    }

    if (message.length < 3) {
      return NextResponse.json(
        { error: "Описание проблемы слишком короткое" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, phone, status")
      .eq("phone", phone)
      .maybeSingle();

    if (clientError) {
      console.log("Ticket create client find error:", clientError);

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

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .insert({
        client_id: client.id,
        order_id: null,
        track_number: trackNumber,
        problem_type: problemType,
        message,
        status: "new",
        admin_comment: null,
      })
      .select(
        "id, client_id, order_id, track_number, problem_type, message, status, admin_comment, created_at, updated_at"
      )
      .single();

    if (ticketError) {
      console.log("Create ticket error:", ticketError);

      return NextResponse.json(
        { error: "Не получилось отправить заявку" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Заявка отправлена",
      ticket,
    });
  } catch (error) {
    console.log("Create ticket server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера при создании заявки" },
      { status: 500 }
    );
  }
}