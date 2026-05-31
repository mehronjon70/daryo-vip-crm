import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const phone = String(body.phone || "").trim();
    const trackNumber = String(body.trackNumber || "").trim();

    if (!phone) {
      return NextResponse.json(
        { error: "Введите номер телефона" },
        { status: 400 }
      );
    }

    if (!trackNumber) {
      return NextResponse.json(
        { error: "Введите трек-номер" },
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
      .select("id, full_name, phone, status, vip_id")
      .eq("phone", phone)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: "Клиент с таким номером не найден" },
        { status: 404 }
      );
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select(
        "id, track_number, problem_type, message, status, admin_comment, created_at, updated_at"
      )
      .eq("client_id", client.id)
      .eq("track_number", trackNumber)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ticketError) {
      console.log("Check ticket error:", ticketError);

      return NextResponse.json(
        { error: "Не получилось проверить заявку" },
        { status: 500 }
      );
    }

    if (!ticket) {
      return NextResponse.json(
        { error: "Заявка с таким трек-номером не найдена" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      client,
      ticket,
    });
  } catch (error) {
    console.log("Check ticket server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера при проверке заявки" },
      { status: 500 }
    );
  }
}