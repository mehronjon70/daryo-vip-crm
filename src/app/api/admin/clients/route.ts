import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = body.password;

    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Неверный пароль" },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Не настроены ключи Supabase на сервере" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, phone, status, level, vip_id, total_items, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Load clients error:", error);

      return NextResponse.json(
        { error: "Ошибка загрузки клиентов" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clients: data || [],
    });
  } catch (error) {
    console.log("Admin clients API error:", error);

    return NextResponse.json(
      { error: "Ошибка запроса" },
      { status: 500 }
    );
  }
}