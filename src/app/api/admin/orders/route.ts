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

function calculateLevel(totalTracks: number) {
  if (totalTracks >= 100) return "diamond";
  if (totalTracks >= 50) return "gold";
  if (totalTracks >= 30) return "silver";
  if (totalTracks >= 10) return "bronze";
  return "start";
}

function getLevelLabel(level: string) {
  if (level === "bronze") return "Bronze";
  if (level === "silver") return "Silver";
  if (level === "gold") return "Gold";
  if (level === "diamond") return "Diamond";
  return "Start";
}

async function refreshClientTotals(supabaseAdmin: any, clientId: string) {
  const { count, error: countError } = await supabaseAdmin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  if (countError) {
    console.log("Admin refresh client count error:", countError);

    return {
      totalTracks: 0,
      level: "start",
      levelLabel: "Start",
    };
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
    console.log("Admin refresh client level error:", updateError);
  }

  return {
    totalTracks,
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

      const clientStats = await refreshClientTotals(
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