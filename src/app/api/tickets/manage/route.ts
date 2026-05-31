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
    const phone = normalizePhone(rawPhone);
    const action = String(body.action || "").trim();
    const ticketId = String(body.ticketId || "").trim();

    if (!phone) {
      return NextResponse.json(
        { error: "Номер клиента не найден" },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: "Не указано действие" },
        { status: 400 }
      );
    }

    if (action !== "delete_ticket") {
      return NextResponse.json(
        { error: "Неизвестное действие" },
        { status: 400 }
      );
    }

    if (!ticketId) {
      return NextResponse.json(
        { error: "Не указана заявка" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, phone, status")
      .eq("phone", phone)
      .maybeSingle();

    if (clientError) {
      console.log("Client ticket delete find client error:", clientError);

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

    if (client.status !== "approved") {
      return NextResponse.json(
        { error: "Ваш аккаунт не активен" },
        { status: 403 }
      );
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select("id, client_id, track_number")
      .eq("id", ticketId)
      .eq("client_id", client.id)
      .maybeSingle();

    if (ticketError) {
      console.log("Client ticket delete find ticket error:", ticketError);

      return NextResponse.json(
        { error: "Ошибка поиска заявки" },
        { status: 500 }
      );
    }

    if (!ticket) {
      return NextResponse.json(
        { error: "Заявка не найдена или не принадлежит вам" },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("tickets")
      .delete()
      .eq("id", ticketId)
      .eq("client_id", client.id);

    if (deleteError) {
      console.log("Client ticket delete error:", deleteError);

      return NextResponse.json(
        { error: "Не получилось удалить заявку" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Заявка удалена",
      deletedTicket: ticket,
    });
  } catch (error) {
    console.log("Client ticket manage server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера управления заявкой" },
      { status: 500 }
    );
  }
}