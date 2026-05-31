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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const phone = String(body.phone || "").trim();
    const trackCode = String(body.trackCode || "").trim();

    if (!phone) {
      return NextResponse.json(
        { error: "Введите номер телефона" },
        { status: 400 }
      );
    }

    if (!trackCode) {
      return NextResponse.json(
        { error: "Введите трек-код" },
        { status: 400 }
      );
    }

    if (trackCode.length < 3) {
      return NextResponse.json(
        { error: "Трек-код слишком короткий" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, phone, status")
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
        { error: "Клиент с таким номером не найден" },
        { status: 404 }
      );
    }

    if (client.status === "pending") {
      return NextResponse.json(
        { error: "Ваша регистрация ещё не подтверждена администратором" },
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

    const { data: existingTrack, error: existingTrackError } =
      await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("client_id", client.id)
        .eq("track_code", trackCode)
        .maybeSingle();

    if (existingTrackError) {
      console.log("Check existing track error:", existingTrackError);

      return NextResponse.json(
        { error: "Ошибка проверки трек-кода" },
        { status: 500 }
      );
    }

    if (existingTrack) {
      return NextResponse.json(
        { error: "Этот трек-код уже добавлен" },
        { status: 409 }
      );
    }

    const { data: track, error: trackError } = await supabaseAdmin
      .from("orders")
      .insert({
        client_id: client.id,
        track_code: trackCode,
        status: "added",
      })
      .select("id, client_id, track_code, status, created_at, updated_at")
      .single();

    if (trackError) {
      console.log("Create track error:", trackError);

      return NextResponse.json(
        { error: "Не получилось добавить трек-код" },
        { status: 500 }
      );
    }

    const { count: totalTracks, error: countError } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id);

    if (countError) {
      console.log("Count tracks error:", countError);

      return NextResponse.json({
        success: true,
        message: "Трек добавлен, но уровень не обновился",
        track,
      });
    }

    const safeTotalTracks = totalTracks || 0;
    const newLevel = calculateLevel(safeTotalTracks);

    const { data: updatedClient, error: updateClientError } =
      await supabaseAdmin
        .from("clients")
        .update({
          total_items: safeTotalTracks,
          level: newLevel,
        })
        .eq("id", client.id)
        .select("id, full_name, phone, status, vip_id, level, total_items")
        .single();

    if (updateClientError) {
      console.log("Update client level error:", updateClientError);

      return NextResponse.json({
        success: true,
        message: "Трек добавлен, но уровень клиента не обновился",
        track,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Трек-код успешно добавлен",
      track,
      client: {
        ...updatedClient,
        level_label: getLevelLabel(updatedClient.level),
      },
    });
  } catch (error) {
    console.log("Create track server error:", error);

    return NextResponse.json(
      { error: "Ошибка сервера при добавлении трек-кода" },
      { status: 500 }
    );
  }
}