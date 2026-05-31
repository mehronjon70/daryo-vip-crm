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

async function refreshClientTotals(supabaseAdmin: any, clientId: string) {
  const { count, error: countError } = await supabaseAdmin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  if (countError) {
    console.log("Refresh client count error:", countError);
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
    console.log("Refresh client level error:", updateError);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const phone = String(body.phone || "").trim();
    const action = String(body.action || "").trim();
    const orderId = String(body.orderId || "").trim();

    if (!phone) {
      return NextResponse.json(
        { error: "Не найден номер клиента" },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: "Не указано действие" },
        { status: 400 }
      );
    }

    if (!orderId) {
      return NextResponse.json(
        { error: "Не указан трек" },
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
      console.log("Find client error:", clientError);

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
        { error: "Ваш аккаунт ещё не подтверждён" },
        { status: 403 }
      );
    }

    const { data: track, error: trackError } = await supabaseAdmin
      .from("orders")
      .select("id, client_id, track_code, status")
      .eq("id", orderId)
      .eq("client_id", client.id)
      .maybeSingle();

    if (trackError) {
      console.log("Find client track error:", trackError);

      return NextResponse.json(
        { error: "Ошибка поиска трека" },
        { status: 500 }
      );
    }

    if (!track) {
      return NextResponse.json(
        { error: "Трек не найден или не принадлежит вам" },
        { status: 404 }
      );
    }

    if (action === "delete_track") {
      await supabaseAdmin.from("tickets").delete().eq("order_id", orderId);

      const { error: deleteError } = await supabaseAdmin
        .from("orders")
        .delete()
        .eq("id", orderId)
        .eq("client_id", client.id);

      if (deleteError) {
        console.log("Client delete track error:", deleteError);

        return NextResponse.json(
          { error: "Не получилось удалить трек" },
          { status: 500 }
        );
      }

      await refreshClientTotals(supabaseAdmin, client.id);

      return NextResponse.json({
        success: true,
        message: "Трек удалён",
        track,
      });
    }

    if (action === "update_track") {
      const newTrackCode = String(body.trackCode || "").trim();

      if (!newTrackCode) {
        return NextResponse.json(
          { error: "Введите новый трек-код" },
          { status: 400 }
        );
      }

      const { data: duplicateTrack, error: duplicateError } =
        await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("client_id", client.id)
          .eq("track_code", newTrackCode)
          .neq("id", orderId)
          .maybeSingle();

      if (duplicateError) {
        console.log("Duplicate track check error:", duplicateError);

        return NextResponse.json(
          { error: "Ошибка проверки трек-кода" },
          { status: 500 }
        );
      }

      if (duplicateTrack) {
        return NextResponse.json(
          { error: "Такой трек уже есть в вашем кабинете" },
          { status: 409 }
        );
      }

      const { data: updatedTrack, error: updateError } = await supabaseAdmin
        .from("orders")
        .update({
          track_code: newTrackCode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("client_id", client.id)
        .select("id, client_id, track_code, status, created_at, updated_at")
        .single();

      if (updateError) {
        console.log("Client update track error:", updateError);

        return NextResponse.json(
          { error: "Не получилось изменить трек" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Трек обновлён",
        track: updatedTrack,
      });
    }

    return NextResponse.json(
      { error: "Неизвестное действие" },
      { status: 400 }
    );
  } catch (error) {
    console.log("Client manage track server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера управления треком" },
      { status: 500 }
    );
  }
}