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

function calculateLevelByAmount(totalAmount: number) {
  if (totalAmount >= 6500) return "diamond";
  if (totalAmount >= 5000) return "platinum";
  if (totalAmount >= 3500) return "gold";
  if (totalAmount >= 2000) return "silver";
  if (totalAmount >= 500) return "bronze";
  return "start";
}

function getLevelLabel(level: string) {
  if (level === "bronze") return "Bronze";
  if (level === "silver") return "Silver";
  if (level === "gold") return "Gold";
  if (level === "platinum") return "Platinum";
  if (level === "diamond") return "Diamond";
  return "Start";
}

function getLevelInfo(totalAmount: number) {
  if (totalAmount >= 6500) {
    return {
      currentLevel: "Diamond",
      nextLevel: "Максимальный уровень",
      current: totalAmount,
      target: 6500,
      remaining: 0,
      progress: 100,
    };
  }

  if (totalAmount >= 5000) {
    return {
      currentLevel: "Platinum",
      nextLevel: "Diamond",
      current: totalAmount,
      target: 6500,
      remaining: 6500 - totalAmount,
      progress: Math.min(Math.round((totalAmount / 6500) * 100), 100),
    };
  }

  if (totalAmount >= 3500) {
    return {
      currentLevel: "Gold",
      nextLevel: "Platinum",
      current: totalAmount,
      target: 5000,
      remaining: 5000 - totalAmount,
      progress: Math.min(Math.round((totalAmount / 5000) * 100), 100),
    };
  }

  if (totalAmount >= 2000) {
    return {
      currentLevel: "Silver",
      nextLevel: "Gold",
      current: totalAmount,
      target: 3500,
      remaining: 3500 - totalAmount,
      progress: Math.min(Math.round((totalAmount / 3500) * 100), 100),
    };
  }

  if (totalAmount >= 500) {
    return {
      currentLevel: "Bronze",
      nextLevel: "Silver",
      current: totalAmount,
      target: 2000,
      remaining: 2000 - totalAmount,
      progress: Math.min(Math.round((totalAmount / 2000) * 100), 100),
    };
  }

  return {
    currentLevel: "Start",
    nextLevel: "Bronze",
    current: totalAmount,
    target: 500,
    remaining: 500 - totalAmount,
    progress: Math.min(Math.round((totalAmount / 500) * 100), 100),
  };
}

async function refreshClientPurchaseStats(supabaseAdmin: any, clientId: string) {
  const { data: confirmedOrders, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select("amount")
    .eq("client_id", clientId)
    .eq("is_confirmed", true);

  if (ordersError) {
    console.log("Client me refresh purchase stats error:", ordersError);

    return {
      totalPurchaseAmount: 0,
      confirmedOrdersCount: 0,
      averageCheck: 0,
      level: "start",
      levelLabel: "Start",
    };
  }

  const safeOrders = confirmedOrders || [];

  const totalPurchaseAmount = safeOrders.reduce((sum: number, order: any) => {
    return sum + Number(order.amount || 0);
  }, 0);

  const confirmedOrdersCount = safeOrders.length;

  const averageCheck =
    confirmedOrdersCount > 0
      ? Math.round((totalPurchaseAmount / confirmedOrdersCount) * 100) / 100
      : 0;

  const level = calculateLevelByAmount(totalPurchaseAmount);

  const { error: updateError } = await supabaseAdmin
    .from("clients")
    .update({
      total_items: confirmedOrdersCount,
      level,
      total_purchase_amount: totalPurchaseAmount,
      confirmed_orders_count: confirmedOrdersCount,
      average_check: averageCheck,
    })
    .eq("id", clientId);

  if (updateError) {
    console.log("Client me update purchase stats error:", updateError);
  }

  return {
    totalPurchaseAmount,
    confirmedOrdersCount,
    averageCheck,
    level,
    levelLabel: getLevelLabel(level),
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
        "id, full_name, phone, status, vip_id, level, total_items, total_purchase_amount, confirmed_orders_count, average_check, created_at, approved_at"
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
      .select(
        "id, client_id, track_code, status, amount, is_confirmed, confirmed_at, created_at, updated_at"
      )
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

    const purchaseStats = await refreshClientPurchaseStats(
      supabaseAdmin,
      client.id
    );

    const finalClient = {
      ...client,
      level: purchaseStats.level,
      level_label: purchaseStats.levelLabel,
      total_items: purchaseStats.confirmedOrdersCount,
      total_purchase_amount: purchaseStats.totalPurchaseAmount,
      confirmed_orders_count: purchaseStats.confirmedOrdersCount,
      average_check: purchaseStats.averageCheck,
    };

    return NextResponse.json({
      success: true,
      client: finalClient,
      orders: safeOrders,
      tickets: safeTickets,
      levelInfo: getLevelInfo(purchaseStats.totalPurchaseAmount),
      purchaseStats,
    });
  } catch (error) {
    console.log("Client me server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера личного кабинета" },
      { status: 500 }
    );
  }
}