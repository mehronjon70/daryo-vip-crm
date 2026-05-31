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

function normalizePhone(phone: string) {
  return phone
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "");
}

async function refreshClientTotals(supabaseAdmin: any, clientId: string) {
  const { count, error: countError } = await supabaseAdmin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  if (countError) {
    console.log("Client control refresh count error:", countError);
    return;
  }

  const totalTracks = count || 0;
  const newLevel = calculateLevel(totalTracks);

  const { error: updateError } = await supabaseAdmin
    .from("clients")
    .update({
      total_items: totalTracks,
      level: newLevel,
    })
    .eq("id", clientId);

  if (updateError) {
    console.log("Client control refresh level error:", updateError);
  }
}

async function getClientFullData(supabaseAdmin: any, clientId: string) {
  await refreshClientTotals(supabaseAdmin, clientId);

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select(
      "id, full_name, phone, status, vip_id, level, total_items, created_at, approved_at"
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
    .select("id, client_id, track_code, status, created_at, updated_at")
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
      level_label: getLevelLabel(client.level),
    },
    orders: orders || [],
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
          "id, full_name, phone, status, vip_id, level, total_items, created_at, approved_at"
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
          "id, full_name, phone, status, vip_id, level, total_items, created_at, approved_at"
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
      { error: error instanceof Error ? error.message : "Ошибка сервера управления клиентом" },
      { status: 500 }
    );
  }
}