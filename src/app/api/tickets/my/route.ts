import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "API /api/tickets/my работает",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const phone = String(body.phone || "").trim();

    if (!phone) {
      return NextResponse.json(
        { error: "Введите номер телефона" },
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
      .maybeSingle();

    if (clientError) {
      console.log("CLIENT SEARCH ERROR:", clientError);

      return NextResponse.json(
        { error: clientError.message || "Ошибка поиска клиента" },
        { status: 500 }
      );
    }

    if (!client) {
      return NextResponse.json(
        { error: "Клиент с таким номером не найден" },
        { status: 404 }
      );
    }

    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .select(
        "id, track_number, problem_type, message, status, admin_comment, created_at, updated_at"
      )
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });

    if (ticketsError) {
      console.log("TICKETS LOAD ERROR:", ticketsError);

      return NextResponse.json(
        {
          error:
            ticketsError.message || "Не получилось загрузить заявки клиента",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      client,
      tickets: tickets || [],
    });
  } catch (error) {
    console.log("CLIENT TICKETS SERVER ERROR:", error);

    return NextResponse.json(
      { error: "Ошибка сервера при загрузке заявок" },
      { status: 500 }
    );
  }
}