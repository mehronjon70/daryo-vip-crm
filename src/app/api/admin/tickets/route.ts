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

const allowedStatuses = ["new", "in_progress", "resolved"];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const adminPassword = String(body.password || "").trim();
    const action = String(body.action || "").trim();
    const ticketId = String(body.ticketId || "").trim();

    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Неверный пароль админа" },
        { status: 401 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: "Не указано действие" },
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

    if (action === "delete") {
      const { data: ticket, error: findError } = await supabaseAdmin
        .from("tickets")
        .select("id, client_id, track_number")
        .eq("id", ticketId)
        .maybeSingle();

      if (findError) {
        console.log("Admin find ticket before delete error:", findError);

        return NextResponse.json(
          { error: "Ошибка поиска заявки" },
          { status: 500 }
        );
      }

      if (!ticket) {
        return NextResponse.json(
          { error: "Заявка не найдена" },
          { status: 404 }
        );
      }

      const { error: deleteError } = await supabaseAdmin
        .from("tickets")
        .delete()
        .eq("id", ticketId);

      if (deleteError) {
        console.log("Admin delete ticket error:", deleteError);

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
    }

    if (action !== "update") {
      return NextResponse.json(
        { error: "Неизвестное действие" },
        { status: 400 }
      );
    }

    const status = String(body.status || "").trim();
    const adminComment = String(body.adminComment || "").trim();

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Неверный статус заявки" },
        { status: 400 }
      );
    }

    if (status === "resolved" && !adminComment) {
      return NextResponse.json(
        { error: "Перед закрытием заявки напишите ответ клиенту" },
        { status: 400 }
      );
    }

    const { data: existingTicket, error: findError } = await supabaseAdmin
      .from("tickets")
      .select("id, client_id, track_number, status")
      .eq("id", ticketId)
      .maybeSingle();

    if (findError) {
      console.log("Find ticket error:", findError);

      return NextResponse.json(
        { error: "Ошибка поиска заявки" },
        { status: 500 }
      );
    }

    if (!existingTicket) {
      return NextResponse.json(
        { error: "Заявка не найдена" },
        { status: 404 }
      );
    }

    const { data: ticket, error: updateError } = await supabaseAdmin
      .from("tickets")
      .update({
        status,
        admin_comment: adminComment || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId)
      .select(
        `
        id,
        client_id,
        order_id,
        track_number,
        problem_type,
        message,
        status,
        admin_comment,
        created_at,
        updated_at,
        clients (
          full_name,
          phone,
          vip_id
        )
      `
      )
      .single();

    if (updateError) {
      console.log("Update ticket error:", updateError);

      return NextResponse.json(
        { error: "Не получилось обновить заявку" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Заявка обновлена",
      ticket,
    });
  } catch (error) {
    console.log("Admin tickets server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера заявок" },
      { status: 500 }
    );
  }
}