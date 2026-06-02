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

async function refreshAllClientPurchaseStats(supabaseAdmin: any) {
  const { data: clients, error: clientsError } = await supabaseAdmin
    .from("clients")
    .select("id");

  if (clientsError) {
    console.log("Analytics refresh clients error:", clientsError);
    return;
  }

  for (const client of clients || []) {
    const { data: confirmedOrders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("amount")
      .eq("client_id", client.id)
      .eq("is_confirmed", true);

    if (ordersError) {
      console.log("Analytics refresh orders error:", ordersError);
      continue;
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
      .eq("id", client.id);

    if (updateError) {
      console.log("Analytics refresh update client error:", updateError);
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const adminPassword = String(body.password || "").trim();

    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Неверный пароль админа" },
        { status: 401 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();

    await refreshAllClientPurchaseStats(supabaseAdmin);

    const { data: allClientsRaw, error: allClientsError } = await supabaseAdmin
      .from("clients")
      .select(
        "id, full_name, phone, status, vip_id, level, total_items, total_purchase_amount, confirmed_orders_count, average_check, created_at, approved_at"
      )
      .order("created_at", { ascending: false });

    if (allClientsError) {
      console.log("Analytics clients error:", allClientsError);

      return NextResponse.json(
        { error: "Ошибка загрузки клиентов" },
        { status: 500 }
      );
    }

    const { data: ordersRaw, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        client_id,
        track_code,
        status,
        amount,
        is_confirmed,
        confirmed_at,
        created_at,
        updated_at,
        clients (
          full_name,
          phone,
          vip_id
        )
      `
      )
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.log("Analytics orders error:", ordersError);

      return NextResponse.json(
        { error: "Ошибка загрузки треков" },
        { status: 500 }
      );
    }

    const { data: ticketsRaw, error: ticketsError } = await supabaseAdmin
      .from("tickets")
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
      .order("created_at", { ascending: false });

    if (ticketsError) {
      console.log("Analytics tickets error:", ticketsError);

      return NextResponse.json(
        { error: "Ошибка загрузки заявок" },
        { status: 500 }
      );
    }

    const allClients = (allClientsRaw || []).map((client: any) => ({
      ...client,
      level_label: getLevelLabel(client.level),
      total_purchase_amount: Number(client.total_purchase_amount || 0),
      confirmed_orders_count: Number(client.confirmed_orders_count || 0),
      average_check: Number(client.average_check || 0),
    }));

    const orders = (ordersRaw || []).map((order: any) => ({
      ...order,
      amount: Number(order.amount || 0),
      is_confirmed: Boolean(order.is_confirmed),
    }));

    const tickets = ticketsRaw || [];

    const pendingClients = allClients.filter(
      (client: any) => client.status === "pending"
    );

    const approvedClients = allClients.filter(
      (client: any) => client.status === "approved"
    );

    const blockedClients = allClients.filter(
      (client: any) => client.status === "blocked"
    );

    const topClients = [...allClients]
      .filter((client: any) => client.status === "approved")
      .sort((a: any, b: any) => {
        return (
          Number(b.total_purchase_amount || 0) -
          Number(a.total_purchase_amount || 0)
        );
      })
      .slice(0, 5);

    const confirmedOrders = orders.filter((order: any) => order.is_confirmed);
    const pendingOrders = orders.filter((order: any) => !order.is_confirmed);

    const totalPurchaseAmount = confirmedOrders.reduce(
      (sum: number, order: any) => sum + Number(order.amount || 0),
      0
    );

    const averageOrderCheck =
      confirmedOrders.length > 0
        ? Math.round((totalPurchaseAmount / confirmedOrders.length) * 100) / 100
        : 0;

    const newTickets = tickets.filter((ticket: any) => ticket.status === "new");

    const inProgressTickets = tickets.filter(
      (ticket: any) => ticket.status === "in_progress"
    );

    const resolvedTickets = tickets.filter(
      (ticket: any) => ticket.status === "resolved"
    );

    return NextResponse.json({
      success: true,
      stats: {
        totalClients: allClients.length,
        pendingClients: pendingClients.length,
        approvedClients: approvedClients.length,
        blockedClients: blockedClients.length,

        totalOrders: orders.length,
        confirmedOrders: confirmedOrders.length,
        pendingOrders: pendingOrders.length,

        totalPurchaseAmount,
        averageOrderCheck,

        problemOrders: tickets.length,
        totalTickets: tickets.length,
        newTickets: newTickets.length,
        inProgressTickets: inProgressTickets.length,
        resolvedTickets: resolvedTickets.length,
      },
      topClients,
      allClients,
      pendingClients,
      orders,
      tickets: {
        all: tickets,
        newAndInProgress: [...newTickets, ...inProgressTickets],
        resolved: resolvedTickets,
      },
    });
  } catch (error) {
    console.log("Analytics server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера аналитики" },
      { status: 500 }
    );
  }
}