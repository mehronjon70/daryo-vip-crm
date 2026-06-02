import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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

function hashPassword(phone: string, password: string) {
  const secret =
    process.env.ACCESS_CODE_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "daryo-secret";

  return crypto
    .createHash("sha256")
    .update(`${phone}:${password}:${secret}`)
    .digest("hex");
}

function normalizePhone(phone: string) {
  return phone
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "");
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

async function refreshClientPurchaseStats(supabaseAdmin: any, clientId: string) {
  const { data: confirmedOrders, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select("amount")
    .eq("client_id", clientId)
    .eq("is_confirmed", true);

  if (ordersError) {
    console.log("Client control refresh purchase stats error:", ordersError);

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
    console.log("Client control update purchase stats error:", updateError);
  }

  return {
    totalPurchaseAmount,
    confirmedOrdersCount,
    averageCheck,
    level,
    levelLabel: getLevelLabel(level),
  };
}

async function getClientFullData(supabaseAdmin: any, clientId: string) {
  const purchaseStats = await refreshClientPurchaseStats(
    supabaseAdmin,
    clientId
  );

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select(
      "id, full_name, phone, status, vip_id, level, total_items, total_purchase_amount, confirmed_orders_count, average_check, created_at, approved_at"
    )
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) {
    throw new Error("Ошибка загрузки клиента");
  }

  if (!client) {
    throw new Error("Клиент не найден");
  }

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select(
      "id, client_id, track_code, status, amount, is_confirmed, confirmed_at, created_at, updated_at"
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (ordersError) {
    throw new Error("Ошибка загрузки треков клиента");
  }

  const { data: tickets, error: ticketsError } = await supabaseAdmin
    .from("tickets")
    .select(
      "id, client_id, order_id, track_number, problem_type, message, status, admin_comment, created_at, updated_at"
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (ticketsError) {
    throw new Error("Ошибка загрузки заявок клиента");
  }

  return {
    client: {
      ...client,
      level: purchaseStats.level,
      level_label: purchaseStats.levelLabel,
      total_items: purchaseStats.confirmedOrdersCount,
      total_purchase_amount: purchaseStats.totalPurchaseAmount,
      confirmed_orders_count: purchaseStats.confirmedOrdersCount,
      average_check: purchaseStats.averageCheck,
    },
    orders: (orders || []).map((order: any) => ({
      ...order,
      amount: Number(order.amount || 0),
      is_confirmed: Boolean(order.is_confirmed),
    })),
    tickets: tickets || [],
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const adminPassword = String(body.password || "").trim();
    const action = String(body.action || "").trim();

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

    const supabaseAdmin = createSupabaseAdmin();

    if (action === "find_by_phone") {
      const rawPhone = String(body.phone || "").trim();
      const phone = normalizePhone(rawPhone);

      if (!phone) {
        return NextResponse.json(
          { error: "Введите номер клиента" },
          { status: 400 }
        );
      }

      const { data: client, error: findError } = await supabaseAdmin
        .from("clients")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      if (findError) {
        console.log("Client control find error:", findError);

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

      const fullData = await getClientFullData(supabaseAdmin, client.id);

      return NextResponse.json({
        success: true,
        ...fullData,
      });
    }

    if (action === "reset_password") {
      const clientId = String(body.clientId || "").trim();
      const newPassword = String(body.newPassword || "").trim();

      if (!clientId) {
        return NextResponse.json(
          { error: "Не указан клиент" },
          { status: 400 }
        );
      }

      if (!newPassword) {
        return NextResponse.json(
          { error: "Введите новый пароль" },
          { status: 400 }
        );
      }

      if (newPassword.length < 4) {
        return NextResponse.json(
          { error: "Пароль должен быть минимум 4 символа" },
          { status: 400 }
        );
      }

      const { data: client, error: findError } = await supabaseAdmin
        .from("clients")
        .select("id, phone")
        .eq("id", clientId)
        .maybeSingle();

      if (findError) {
        console.log("Find client for reset password error:", findError);

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

      const newHash = hashPassword(client.phone, newPassword);

      const { error: updateError } = await supabaseAdmin
        .from("clients")
        .update({
          access_code_hash: newHash,
        })
        .eq("id", clientId);

      if (updateError) {
        console.log("Reset client password error:", updateError);

        return NextResponse.json(
          { error: "Не получилось обновить пароль" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Пароль клиента обновлён",
      });
    }

    if (action === "block_client") {
      const clientId = String(body.clientId || "").trim();

      if (!clientId) {
        return NextResponse.json(
          { error: "Не указан клиент" },
          { status: 400 }
        );
      }

      const { data: client, error: updateError } = await supabaseAdmin
        .from("clients")
        .update({
          status: "blocked",
        })
        .eq("id", clientId)
        .select(
          "id, full_name, phone, status, vip_id, level, total_items, total_purchase_amount, confirmed_orders_count, average_check, created_at, approved_at"
        )
        .single();

      if (updateError) {
        console.log("Block client error:", updateError);

        return NextResponse.json(
          { error: "Не получилось выключить аккаунт" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Аккаунт клиента выключен",
        client: {
          ...client,
          level_label: getLevelLabel(client.level),
        },
      });
    }

    if (action === "unblock_client") {
      const clientId = String(body.clientId || "").trim();

      if (!clientId) {
        return NextResponse.json(
          { error: "Не указан клиент" },
          { status: 400 }
        );
      }

      const { data: clientBefore, error: findError } = await supabaseAdmin
        .from("clients")
        .select("id, vip_id")
        .eq("id", clientId)
        .maybeSingle();

      if (findError) {
        console.log("Find client before unblock error:", findError);

        return NextResponse.json(
          { error: "Ошибка поиска клиента" },
          { status: 500 }
        );
      }

      if (!clientBefore) {
        return NextResponse.json(
          { error: "Клиент не найден" },
          { status: 404 }
        );
      }

      const { data: client, error: updateError } = await supabaseAdmin
        .from("clients")
        .update({
          status: clientBefore.vip_id ? "approved" : "pending",
        })
        .eq("id", clientId)
        .select(
          "id, full_name, phone, status, vip_id, level, total_items, total_purchase_amount, confirmed_orders_count, average_check, created_at, approved_at"
        )
        .single();

      if (updateError) {
        console.log("Unblock client error:", updateError);

        return NextResponse.json(
          { error: "Не получилось включить аккаунт" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Аккаунт клиента включён",
        client: {
          ...client,
          level_label: getLevelLabel(client.level),
        },
      });
    }

    if (action === "delete_client") {
      const clientId = String(body.clientId || "").trim();

      if (!clientId) {
        return NextResponse.json(
          { error: "Не указан клиент" },
          { status: 400 }
        );
      }

      const { data: client, error: findError } = await supabaseAdmin
        .from("clients")
        .select("id, full_name, phone")
        .eq("id", clientId)
        .maybeSingle();

      if (findError) {
        console.log("Find client before delete error:", findError);

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

      await supabaseAdmin.from("tickets").delete().eq("client_id", clientId);
      await supabaseAdmin.from("orders").delete().eq("client_id", clientId);

      const { error: deleteClientError } = await supabaseAdmin
        .from("clients")
        .delete()
        .eq("id", clientId);

      if (deleteClientError) {
        console.log("Delete client error:", deleteClientError);

        return NextResponse.json(
          { error: "Не получилось удалить клиента" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Клиент и все его данные удалены",
        deletedClient: client,
      });
    }

    return NextResponse.json(
      { error: "Неизвестное действие" },
      { status: 400 }
    );
  } catch (error) {
    console.log("Client control server error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ошибка сервера управления клиентом",
      },
      { status: 500 }
    );
  }
}