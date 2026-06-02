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

async function refreshClientPurchaseStats(supabaseAdmin: any, clientId: string) {
  const { data: confirmedOrders, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select("amount")
    .eq("client_id", clientId)
    .eq("is_confirmed", true);

  if (ordersError) {
    console.log("Refresh purchase stats orders error:", ordersError);

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

  const newLevel = calculateLevelByAmount(totalPurchaseAmount);

  const { error: updateError } = await supabaseAdmin
    .from("clients")
    .update({
      total_items: confirmedOrdersCount,
      level: newLevel,
      total_purchase_amount: totalPurchaseAmount,
      confirmed_orders_count: confirmedOrdersCount,
      average_check: averageCheck,
    })
    .eq("id", clientId);

  if (updateError) {
    console.log("Refresh purchase stats update client error:", updateError);
  }

  return {
    totalPurchaseAmount,
    confirmedOrdersCount,
    averageCheck,
    level: newLevel,
    levelLabel: getLevelLabel(newLevel),
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

    if (action === "confirm_amount") {
      const orderId = String(body.orderId || "").trim();
      const amount = Number(body.amount || 0);

      if (!orderId) {
        return NextResponse.json(
          { error: "Не указан трек" },
          { status: 400 }
        );
      }

      if (!amount || amount <= 0) {
        return NextResponse.json(
          { error: "Введите сумму покупки больше 0" },
          { status: 400 }
        );
      }

      const { data: track, error: findError } = await supabaseAdmin
        .from("orders")
        .select("id, client_id, track_code")
        .eq("id", orderId)
        .maybeSingle();

      if (findError) {
        console.log("Admin find track before confirm error:", findError);

        return NextResponse.json(
          { error: "Ошибка поиска трека" },
          { status: 500 }
        );
      }

      if (!track) {
        return NextResponse.json(
          { error: "Трек не найден" },
          { status: 404 }
        );
      }

      const { data: updatedTrack, error: updateError } = await supabaseAdmin
        .from("orders")
        .update({
          amount,
          is_confirmed: true,
          confirmed_at: new Date().toISOString(),
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .select(
          "id, client_id, track_code, status, amount, is_confirmed, confirmed_at, created_at, updated_at"
        )
        .single();

      if (updateError) {
        console.log("Admin confirm amount error:", updateError);

        return NextResponse.json(
          { error: "Не получилось подтвердить сумму" },
          { status: 500 }
        );
      }

      const clientStats = await refreshClientPurchaseStats(
        supabaseAdmin,
        track.client_id
      );

      return NextResponse.json({
        success: true,
        message: "Сумма покупки подтверждена",
        track: updatedTrack,
        clientStats,
      });
    }

    if (action === "delete_track") {
      const orderId = String(body.orderId || "").trim();

      if (!orderId) {
        return NextResponse.json(
          { error: "Не указан трек" },
          { status: 400 }
        );
      }

      const { data: track, error: findError } = await supabaseAdmin
        .from("orders")
        .select("id, client_id, track_code")
        .eq("id", orderId)
        .maybeSingle();

      if (findError) {
        console.log("Admin find track before delete error:", findError);

        return NextResponse.json(
          { error: "Ошибка поиска трека" },
          { status: 500 }
        );
      }

      if (!track) {
        return NextResponse.json(
          { error: "Трек не найден" },
          { status: 404 }
        );
      }

      await supabaseAdmin.from("tickets").delete().eq("order_id", orderId);

      const { error: deleteError } = await supabaseAdmin
        .from("orders")
        .delete()
        .eq("id", orderId);

      if (deleteError) {
        console.log("Admin delete track error:", deleteError);

        return NextResponse.json(
          { error: "Не получилось удалить трек" },
          { status: 500 }
        );
      }

      const clientStats = await refreshClientPurchaseStats(
        supabaseAdmin,
        track.client_id
      );

      return NextResponse.json({
        success: true,
        message: "Трек удалён",
        deletedTrack: track,
        clientStats,
      });
    }

    return NextResponse.json(
      { error: "Неизвестное действие" },
      { status: 400 }
    );
  } catch (error) {
    console.log("Admin orders server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера треков" },
      { status: 500 }
    );
  }
}