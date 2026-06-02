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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const phone = String(body.phone || "").trim();
    const trackCode = String(body.trackCode || "").trim();

    if (!phone) {
      return NextResponse.json(
        { error: "Введите номер телефона" },
        { status: 400 }
      );
    }

    if (!trackCode) {
      return NextResponse.json(
        { error: "Введите трек-код" },
        { status: 400 }
      );
    }

    if (trackCode.length < 3) {
      return NextResponse.json(
        { error: "Трек-код слишком короткий" },
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
      console.log("Find client error:", clientError);

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

    if (client.status === "pending") {
      return NextResponse.json(
        { error: "Ваша регистрация ещё не подтверждена администратором" },
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

    const { data: existingTrack, error: existingTrackError } =
      await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("client_id", client.id)
        .eq("track_code", trackCode)
        .maybeSingle();

    if (existingTrackError) {
      console.log("Check existing track error:", existingTrackError);

      return NextResponse.json(
        { error: "Ошибка проверки трек-кода" },
        { status: 500 }
      );
    }

    if (existingTrack) {
      return NextResponse.json(
        { error: "Этот трек-код уже добавлен" },
        { status: 409 }
      );
    }

    const { data: track, error: trackError } = await supabaseAdmin
      .from("orders")
      .insert({
        client_id: client.id,
        track_code: trackCode,
        status: "pending_review",
        amount: 0,
        is_confirmed: false,
        confirmed_at: null,
      })
      .select(
        "id, client_id, track_code, status, amount, is_confirmed, confirmed_at, created_at, updated_at"
      )
      .single();

    if (trackError) {
      console.log("Create track error:", trackError);

      return NextResponse.json(
        { error: "Не получилось добавить трек-код" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Трек добавлен и ожидает проверки администратора. После подтверждения суммы он засчитается в ваш VIP уровень.",
      track,
    });
  } catch (error) {
    console.log("Create track server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера при добавлении трек-кода" },
      { status: 500 }
    );
  }
}