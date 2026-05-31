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

function getLevelLabel(level: string) {
  if (level === "bronze") return "Bronze";
  if (level === "silver") return "Silver";
  if (level === "gold") return "Gold";
  if (level === "diamond") return "Diamond";
  return "Start";
}

function calculateLevel(totalTracks: number) {
  if (totalTracks >= 100) return "diamond";
  if (totalTracks >= 50) return "gold";
  if (totalTracks >= 30) return "silver";
  if (totalTracks >= 10) return "bronze";
  return "start";
}

function getLevelInfo(totalTracks: number) {
  if (totalTracks >= 100) {
    return {
      currentLevel: "Diamond",
      nextLevel: "Максимальный уровень",
      current: totalTracks,
      target: 100,
      remaining: 0,
      progress: 100,
    };
  }

  if (totalTracks >= 50) {
    return {
      currentLevel: "Gold",
      nextLevel: "Diamond",
      current: totalTracks,
      target: 100,
      remaining: 100 - totalTracks,
      progress: Math.min(Math.round((totalTracks / 100) * 100), 100),
    };
  }

  if (totalTracks >= 30) {
    return {
      currentLevel: "Silver",
      nextLevel: "Gold",
      current: totalTracks,
      target: 50,
      remaining: 50 - totalTracks,
      progress: Math.min(Math.round((totalTracks / 50) * 100), 100),
    };
  }

  if (totalTracks >= 10) {
    return {
      currentLevel: "Bronze",
      nextLevel: "Silver",
      current: totalTracks,
      target: 30,
      remaining: 30 - totalTracks,
      progress: Math.min(Math.round((totalTracks / 30) * 100), 100),
    };
  }

  return {
    currentLevel: "Start",
    nextLevel: "Bronze",
    current: totalTracks,
    target: 10,
    remaining: 10 - totalTracks,
    progress: Math.min(Math.round((totalTracks / 10) * 100), 100),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = String(body.phone || "").trim();

    if (!phone) {
      return NextResponse.json(
        { error: "Номер клиента не найден" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select(
        "id, full_name, phone, status, vip_id, level, total_items, created_at, approved_at"
      )
      .eq("phone", phone)
      .maybeSingle();

    if (clientError) {
      console.log("Client me find error:", clientError);

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

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id, client_id, track_code, status, created_at, updated_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.log("Client me orders error:", ordersError);

      return NextResponse.json(
        { error: "Не получилось загрузить треки клиента" },
        { status: 500 }
      );
    }

    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .select(
        "id, client_id, order_id, track_number, problem_type, message, status, admin_comment, created_at, updated_at"
      )
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });

    if (ticketsError) {
      console.log("Client me tickets error:", ticketsError);

      return NextResponse.json(
        { error: "Не получилось загрузить заявки клиента" },
        { status: 500 }
      );
    }

    const safeOrders = orders || [];
    const safeTickets = tickets || [];

    const totalTracks = safeOrders.length;
    const correctLevel = calculateLevel(totalTracks);

    let finalClient = {
      ...client,
      total_items: totalTracks,
      level: correctLevel,
      level_label: getLevelLabel(correctLevel),
    };

    if (client.total_items !== totalTracks || client.level !== correctLevel) {
      const { data: updatedClient, error: updateClientError } =
        await supabaseAdmin
          .from("clients")
          .update({
            total_items: totalTracks,
            level: correctLevel,
          })
          .eq("id", client.id)
          .select(
            "id, full_name, phone, status, vip_id, level, total_items, created_at, approved_at"
          )
          .single();

      if (!updateClientError && updatedClient) {
        finalClient = {
          ...updatedClient,
          level_label: getLevelLabel(updatedClient.level),
        };
      }

      if (updateClientError) {
        console.log("Client me update level error:", updateClientError);
      }
    }

    return NextResponse.json({
      success: true,
      client: finalClient,
      orders: safeOrders,
      tickets: safeTickets,
      levelInfo: getLevelInfo(totalTracks),
    });
  } catch (error) {
    console.log("Client me server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера личного кабинета" },
      { status: 500 }
    );
  }
}