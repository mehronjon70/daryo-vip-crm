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

    const { data: clients, error: clientsError } = await supabaseAdmin
      .from("clients")
      .select(
        "id, full_name, phone, status, vip_id, level, total_items, created_at, approved_at"
      )
      .order("created_at", { ascending: false });

    if (clientsError) {
      console.log("Analytics clients error:", clientsError);

      return NextResponse.json(
        { error: "Не получилось загрузить клиентов" },
        { status: 500 }
      );
    }

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        client_id,
        track_code,
        status,
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
        { error: "Не получилось загрузить треки" },
        { status: 500 }
      );
    }

    const { data: tickets, error: ticketsError } = await supabaseAdmin
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
        { error: "Не получилось загрузить заявки" },
        { status: 500 }
      );
    }

    const safeClients = clients || [];
    const safeOrders = orders || [];
    const safeTickets = tickets || [];

    const pendingClients = safeClients.filter(
      (client) => client.status === "pending"
    );

    const approvedClients = safeClients.filter(
      (client) => client.status === "approved"
    );

    const blockedClients = safeClients.filter(
      (client) => client.status === "blocked"
    );

    const topClients = [...safeClients]
      .sort((a, b) => Number(b.total_items || 0) - Number(a.total_items || 0))
      .slice(0, 5)
      .map((client) => ({
        ...client,
        level_label: getLevelLabel(client.level),
      }));

    const allClients = safeClients.map((client) => ({
      ...client,
      level_label: getLevelLabel(client.level),
    }));

    const newTickets = safeTickets.filter((ticket) => ticket.status === "new");

    const inProgressTickets = safeTickets.filter(
      (ticket) => ticket.status === "in_progress"
    );

    const resolvedTickets = safeTickets.filter(
      (ticket) => ticket.status === "resolved"
    );

    const newAndInProgress = safeTickets.filter(
      (ticket) => ticket.status === "new" || ticket.status === "in_progress"
    );

    return NextResponse.json({
      stats: {
        totalClients: safeClients.length,
        pendingClients: pendingClients.length,
        approvedClients: approvedClients.length,
        blockedClients: blockedClients.length,
        totalOrders: safeOrders.length,
        problemOrders: 0,
        totalTickets: safeTickets.length,
        newTickets: newTickets.length,
        inProgressTickets: inProgressTickets.length,
        resolvedTickets: resolvedTickets.length,
      },
      topClients,
      allClients,
      pendingClients,
      orders: safeOrders,
      tickets: {
        all: safeTickets,
        newAndInProgress,
        resolved: resolvedTickets,
      },
    });
  } catch (error) {
    console.log("Admin analytics server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера аналитики" },
      { status: 500 }
    );
  }
}