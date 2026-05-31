"use client";

import { useEffect, useState } from "react";

type Client = {
  id: string;
  full_name: string;
  phone: string;
  status: string;
  vip_id: string | null;
  level: string;
  level_label?: string;
  total_items: number;
};

type Order = {
  id: string;
  track_code: string;
  status: string;
  created_at: string;
  updated_at?: string;
};

type Ticket = {
  id: string;
  track_number: string;
  problem_type: string;
  message: string;
  status: string;
  admin_comment: string | null;
  created_at: string;
  updated_at?: string;
};

type LevelInfo = {
  currentLevel: string;
  nextLevel: string;
  current: number;
  target: number;
  progress: number;
};

type ClientTab = "overview" | "addTrack" | "tickets" | "password";

const levelSteps = [
  {
    key: "start",
    title: "Start",
    required: 0,
    icon: "🚀",
  },
  {
    key: "bronze",
    title: "Bronze",
    required: 10,
    icon: "🥉",
  },
  {
    key: "silver",
    title: "Silver",
    required: 30,
    icon: "🥈",
  },
  {
    key: "gold",
    title: "Gold",
    required: 50,
    icon: "🥇",
  },
  {
    key: "diamond",
    title: "Diamond",
    required: 100,
    icon: "💎",
  },
];

export default function Home() {
  const [phone, setPhone] = useState("");
  const [trackCode, setTrackCode] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [client, setClient] = useState<Client | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);

  const [activeTab, setActiveTab] = useState<ClientTab>("overview");

  const [loading, setLoading] = useState(true);
  const [addingOrder, setAddingOrder] = useState(false);

  const [editingTrackId, setEditingTrackId] = useState("");
  const [editingTrackCode, setEditingTrackCode] = useState("");
  const [trackActionLoadingId, setTrackActionLoadingId] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [trackFormError, setTrackFormError] = useState("");
  const [trackFormSuccess, setTrackFormSuccess] = useState("");

  const storageKey = "daryo_client_phone";

  useEffect(() => {
    const savedPhone = localStorage.getItem(storageKey);

    if (savedPhone) {
      setPhone(savedPhone);
      loadCabinet(savedPhone);
    } else {
      setLoading(false);
    }
  }, []);

  function translateTicketStatus(status: string) {
    if (status === "new") return "Новая";
    if (status === "in_progress") return "В работе";
    if (status === "resolved") return "Решена";
    return status;
  }

  function formatDate(value: string) {
    if (!value) return "";

    return new Date(value).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function getLevelLabel(level?: string) {
    if (level === "bronze") return "Bronze";
    if (level === "silver") return "Silver";
    if (level === "gold") return "Gold";
    if (level === "diamond") return "Diamond";
    return "Start";
  }

  function getNextLevelByTracks(totalTracks: number) {
    if (totalTracks >= 100) {
      return {
        current: "Diamond",
        next: "Максимальный уровень",
        target: 100,
        remaining: 0,
        progress: 100,
      };
    }

    if (totalTracks >= 50) {
      return {
        current: "Gold",
        next: "Diamond",
        target: 100,
        remaining: 100 - totalTracks,
        progress: Math.min(Math.round((totalTracks / 100) * 100), 100),
      };
    }

    if (totalTracks >= 30) {
      return {
        current: "Silver",
        next: "Gold",
        target: 50,
        remaining: 50 - totalTracks,
        progress: Math.min(Math.round((totalTracks / 50) * 100), 100),
      };
    }

    if (totalTracks >= 10) {
      return {
        current: "Bronze",
        next: "Silver",
        target: 30,
        remaining: 30 - totalTracks,
        progress: Math.min(Math.round((totalTracks / 30) * 100), 100),
      };
    }

    return {
      current: "Start",
      next: "Bronze",
      target: 10,
      remaining: 10 - totalTracks,
      progress: Math.min(Math.round((totalTracks / 10) * 100), 100),
    };
  }

  function startEditTrack(order: Order) {
    setEditingTrackId(order.id);
    setEditingTrackCode(order.track_code);
    setError("");
    setSuccess("");
  }

  function cancelEditTrack() {
    setEditingTrackId("");
    setEditingTrackCode("");
  }

  async function updateClientTrack(orderId: string) {
    setError("");
    setSuccess("");

    if (!phone.trim()) {
      setError("Сначала войдите в кабинет");
      return;
    }

    if (!editingTrackCode.trim()) {
      setError("Введите новый трек-код");
      return;
    }

    setTrackActionLoadingId(orderId);

    try {
      const response = await fetch("/api/orders/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone.trim(),
          action: "update_track",
          orderId,
          trackCode: editingTrackCode.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не получилось изменить трек");
        return;
      }

      setSuccess("Трек успешно изменён");
      setEditingTrackId("");
      setEditingTrackCode("");

      await loadCabinet(phone.trim());
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения при изменении трека");
    } finally {
      setTrackActionLoadingId("");
    }
  }

  async function deleteClientTrack(orderId: string) {
    const confirmed = window.confirm(
      "Удалить этот трек? Он исчезнет из вашего кабинета."
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setTrackActionLoadingId(orderId);

    try {
      const response = await fetch("/api/orders/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone.trim(),
          action: "delete_track",
          orderId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не получилось удалить трек");
        return;
      }

      setSuccess("Трек удалён");
      setEditingTrackId("");
      setEditingTrackCode("");

      await loadCabinet(phone.trim());
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения при удалении трека");
    } finally {
      setTrackActionLoadingId("");
    }
  }

  function TrackCard({ order }: { order: Order }) {
    const isEditing = editingTrackId === order.id;

    return (
      <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Трек-код</p>
            <p className="mt-1 break-all text-lg font-black text-white">
              {order.track_code}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Добавлен: {formatDate(order.created_at)}
            </p>
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-500/10 text-xl">
            📦
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-blue-300/10 bg-blue-500/10 p-3">
          <p className="text-xs text-blue-200">+1 очко к уровню</p>
          <p className="mt-1 text-sm leading-6 text-slate-200">
            Этот трек сохранён в вашем кабинете и засчитан в VIP-прогресс.
          </p>
        </div>

        {isEditing ? (
          <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-3">
            <p className="mb-2 text-sm font-black text-cyan-100">
              Изменить трек-код
            </p>

            <input
              value={editingTrackCode}
              onChange={(e) => setEditingTrackCode(e.target.value)}
              type="text"
              placeholder="Новый трек-код"
              className="daryo-input mb-3"
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => updateClientTrack(order.id)}
                disabled={trackActionLoadingId === order.id}
                className="rounded-2xl bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-300 px-4 py-3 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-60"
              >
                {trackActionLoadingId === order.id
                  ? "Сохранение..."
                  : "Сохранить"}
              </button>

              <button
                onClick={cancelEditTrack}
                disabled={trackActionLoadingId === order.id}
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-60"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => startEditTrack(order)}
              disabled={trackActionLoadingId === order.id}
              className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 transition active:scale-[0.98] disabled:opacity-60"
            >
              Изменить
            </button>

            <button
              onClick={() => deleteClientTrack(order.id)}
              disabled={trackActionLoadingId === order.id}
              className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 transition active:scale-[0.98] disabled:opacity-60"
            >
              {trackActionLoadingId === order.id ? "Удаление..." : "Удалить"}
            </button>
          </div>
        )}
      </div>
    );
  }

  function LevelProgressCard() {
    const totalTracks = orders.length;
    const levelData = getNextLevelByTracks(totalTracks);

    return (
      <div className="daryo-card-soft mb-5 p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Ваш уровень</p>
            <h3 className="mt-1 text-3xl font-black text-white">
              {levelData.current}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {levelData.remaining === 0
                ? "Вы достигли максимального уровня. Отличный результат."
                : `Добавьте ещё ${levelData.remaining} треков до уровня ${levelData.next}.`}
            </p>
          </div>

          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-500/10 text-3xl">
            {levelData.current === "Diamond"
              ? "💎"
              : levelData.current === "Gold"
              ? "🥇"
              : levelData.current === "Silver"
              ? "🥈"
              : levelData.current === "Bronze"
              ? "🥉"
              : "🚀"}
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-black text-white">
            Прогресс до {levelData.next}
          </p>

          <span className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-black text-blue-100">
            {totalTracks}/{levelData.target}
          </span>
        </div>

        <div className="h-4 overflow-hidden rounded-full bg-slate-950">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-300 to-white shadow-lg shadow-cyan-400/30 transition-all duration-700"
            style={{ width: `${levelData.progress}%` }}
          />
        </div>

        <button
          onClick={() => setActiveTab("addTrack")}
          className="daryo-button daryo-pulse mt-5 w-full"
        >
          Добавить новый трек
        </button>

        <div className="mt-5 grid gap-3">
          {levelSteps.map((level) => {
            const isReached = totalTracks >= level.required;
            const isCurrent =
              getLevelLabel(client?.level).toLowerCase() === level.key;

            return (
              <div
                key={level.key}
                className={
                  isReached
                    ? "rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-3"
                    : "rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950/40 text-xl">
                      {level.icon}
                    </div>

                    <div>
                      <p className="text-sm font-black text-white">
                        {level.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        от {level.required} треков
                      </p>
                    </div>
                  </div>

                  <span
                    className={
                      isReached
                        ? "rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-black text-cyan-100"
                        : "rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-slate-500"
                    }
                  >
                    {isCurrent ? "Сейчас" : isReached ? "Открыт" : "Закрыт"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  async function loadCabinet(customPhone: string) {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("/api/client/me", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: customPhone,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        localStorage.removeItem(storageKey);
        setClient(null);
        setOrders([]);
        setTickets([]);
        setLevelInfo(null);
        setError(result.error || "Не получилось открыть кабинет");
        return;
      }

      if (result.client?.status !== "approved") {
        localStorage.removeItem(storageKey);
        setClient(null);
        setOrders([]);
        setTickets([]);
        setLevelInfo(null);
        setError("Ваша регистрация ещё не подтверждена администратором.");
        return;
      }

      setClient(result.client);
      setOrders(result.orders || []);
      setTickets(result.tickets || []);
      setLevelInfo(result.levelInfo || null);
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  }

  async function addOrder() {
    setError("");
    setSuccess("");
    setTrackFormError("");
    setTrackFormSuccess("");

    if (!phone.trim()) {
      setTrackFormError("Сначала войдите в кабинет");
      return;
    }

    if (!trackCode.trim()) {
      setTrackFormError("Введите трек-код");
      return;
    }

    setAddingOrder(true);

    try {
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone.trim(),
          trackCode: trackCode.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setTrackFormError(result.error || "Не получилось добавить трек-код");
        return;
      }

      setTrackFormSuccess("Трек-код успешно добавлен");
      setTrackCode("");

      await loadCabinet(phone.trim());
    } catch (error) {
      console.log(error);
      setTrackFormError("Ошибка соединения с сервером");
    } finally {
      setAddingOrder(false);
    }
  }

  async function changePassword() {
    setError("");
    setSuccess("");

    if (!phone.trim()) {
      setError("Сначала войдите в кабинет");
      return;
    }

    if (!oldPassword.trim()) {
      setError("Введите старый пароль");
      return;
    }

    if (!newPassword.trim()) {
      setError("Введите новый пароль");
      return;
    }

    if (newPassword.trim().length < 4) {
      setError("Новый пароль должен быть минимум 4 символа");
      return;
    }

    setChangingPassword(true);

    try {
      const response = await fetch("/api/client/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone.trim(),
          oldPassword: oldPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не получилось сменить пароль");
        return;
      }

      setSuccess("Пароль успешно изменён");
      setOldPassword("");
      setNewPassword("");
      setActiveTab("overview");
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения с сервером");
    } finally {
      setChangingPassword(false);
    }
  }

  function logoutClient() {
    localStorage.removeItem(storageKey);
    setPhone("");
    setTrackCode("");
    setOldPassword("");
    setNewPassword("");
    setClient(null);
    setOrders([]);
    setTickets([]);
    setLevelInfo(null);
    setError("");
    setSuccess("");
    setTrackFormError("");
    setTrackFormSuccess("");
    setActiveTab("overview");
  }

  function tabClass(tab: ClientTab) {
    const base =
      "min-h-[86px] rounded-3xl px-3 py-3 text-center text-xs font-black transition-all duration-300 active:scale-[0.96]";

    if (activeTab === tab) {
      return `${base} bg-gradient-to-br from-blue-700 via-blue-500 to-cyan-300 text-white shadow-xl shadow-blue-500/30 scale-[1.02]`;
    }

    return `${base} border border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]`;
  }

  return (
    <main className="daryo-page text-white">
      <section className="daryo-container">
        <div className="daryo-fade-up mb-7">
          <div className="mb-5 flex items-center justify-between">
            <span className="daryo-badge">🚚 VIP Logistics</span>

            {client && (
              <button
                onClick={logoutClient}
                className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-black text-slate-300 transition active:scale-95"
              >
                Выйти
              </button>
            )}
          </div>

          <h1 className="daryo-title">
            Daryo
            <span className="daryo-gradient-text block">VIP</span>
          </h1>

          <p className="daryo-muted mt-4 text-sm leading-6">
            Личный кабинет для VIP клиентов: треки, заявки, VIP ID и система
            уровней.
          </p>
        </div>

        <div className="daryo-card daryo-fade-up p-5">
          {loading && (
            <div className="daryo-glass-blue p-4 text-sm font-black text-blue-100">
              Загрузка личного кабинета...
            </div>
          )}

          {!loading && !client && (
            <>
              <div className="daryo-glass-blue mb-5 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-500/10 text-2xl">
                    💎
                  </div>

                  <div>
                    <p className="text-lg font-black text-white">
                      Daryo VIP кабинет
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Войдите в кабинет или отправьте заявку на регистрацию.
                      После подтверждения админом вы получите свой VIP ID.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="daryo-status-danger mb-5 rounded-2xl p-4 text-sm font-bold">
                  {error}
                </div>
              )}

              <div className="grid gap-3">
                <a href="/login" className="daryo-button daryo-pulse block">
                  Войти в кабинет
                </a>

                <a href="/register" className="daryo-button-secondary block">
                  Регистрация
                </a>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="daryo-card-soft p-4">
                  <p className="text-2xl">🆔</p>
                  <p className="mt-3 text-sm font-black text-white">VIP ID</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    После подтверждения клиент получает личный номер.
                  </p>
                </div>

                <div className="daryo-card-soft p-4">
                  <p className="text-2xl">📦</p>
                  <p className="mt-3 text-sm font-black text-white">Треки</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Клиент добавляет треки из маркетплейса.
                  </p>
                </div>

                <div className="daryo-card-soft p-4">
                  <p className="text-2xl">⭐</p>
                  <p className="mt-3 text-sm font-black text-white">Уровни</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Каждый трек повышает VIP-прогресс клиента.
                  </p>
                </div>

                <div className="daryo-card-soft p-4">
                  <p className="text-2xl">💬</p>
                  <p className="mt-3 text-sm font-black text-white">Заявки</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Клиент может отправить проблему и получить ответ.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-black text-white">
                  Как работает уровень?
                </p>

                <div className="mt-3 grid gap-2">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-950/35 px-3 py-2">
                    <span className="text-xs text-slate-400">Start</span>
                    <span className="text-xs font-black text-white">
                      0 треков
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-slate-950/35 px-3 py-2">
                    <span className="text-xs text-slate-400">Bronze</span>
                    <span className="text-xs font-black text-white">
                      10 треков
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-slate-950/35 px-3 py-2">
                    <span className="text-xs text-slate-400">Silver</span>
                    <span className="text-xs font-black text-white">
                      30 треков
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-slate-950/35 px-3 py-2">
                    <span className="text-xs text-slate-400">Gold</span>
                    <span className="text-xs font-black text-white">
                      50 треков
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-slate-950/35 px-3 py-2">
                    <span className="text-xs text-slate-400">Diamond</span>
                    <span className="text-xs font-black text-white">
                      100 треков
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {!loading && client && (
            <>
              {success && (
                <div className="daryo-status-success mb-5 rounded-2xl p-4 text-sm font-bold">
                  {success}
                </div>
              )}

              {error && (
                <div className="daryo-status-danger mb-5 rounded-2xl p-4 text-sm font-bold">
                  {error}
                </div>
              )}

              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-400">Добро пожаловать</p>
                  <h2 className="mt-1 text-2xl font-black">
                    {client.full_name}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">{client.phone}</p>
                </div>

                <span className="daryo-badge">{client.vip_id}</span>
              </div>

              <div className="daryo-glass-blue mb-5 p-4">
                <p className="text-xs text-slate-400">Ваш VIP ID</p>
                <p className="mt-1 text-2xl font-black text-white">
                  {client.vip_id}
                </p>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-slate-950/35 p-3">
                    <p className="text-xs text-slate-500">Уровень</p>
                    <p className="mt-1 text-sm font-black text-cyan-100">
                      {getLevelLabel(client.level)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/35 p-3">
                    <p className="text-xs text-slate-500">Треков</p>
                    <p className="mt-1 text-sm font-black text-white">
                      {orders.length}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/35 p-3">
                    <p className="text-xs text-slate-500">Заявок</p>
                    <p className="mt-1 text-sm font-black text-white">
                      {tickets.length}
                    </p>
                  </div>
                </div>
              </div>

              <LevelProgressCard />

              <div className="mb-5 rounded-[30px] border border-white/10 bg-slate-950/65 p-3 backdrop-blur-2xl">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-white">
                      Разделы кабинета
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Нажмите на нужный блок
                    </p>
                  </div>

                  <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-100">
                    VIP
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActiveTab("overview")}
                    className={tabClass("overview")}
                  >
                    <span className="block text-lg">📦</span>
                    <span className="mt-1 block">Мои треки</span>
                    <span className="mt-1 block text-[11px] opacity-70">
                      список треков
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab("addTrack")}
                    className={tabClass("addTrack")}
                  >
                    <span className="block text-lg">➕</span>
                    <span className="mt-1 block">Добавить трек</span>
                    <span className="mt-1 block text-[11px] opacity-70">
                      +1 очко
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab("tickets")}
                    className={tabClass("tickets")}
                  >
                    <span className="block text-lg">💬</span>
                    <span className="mt-1 block">Заявки</span>
                    <span className="mt-1 block text-[11px] opacity-70">
                      {tickets.length} всего
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab("password")}
                    className={tabClass("password")}
                  >
                    <span className="block text-lg">🔐</span>
                    <span className="mt-1 block">Пароль</span>
                    <span className="mt-1 block text-[11px] opacity-70">
                      безопасность
                    </span>
                  </button>
                </div>
              </div>

              {activeTab === "overview" && (
                <div className="daryo-card-soft p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-black">Мои треки</h3>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-300">
                      {orders.length}
                    </span>
                  </div>

                  {orders.length === 0 && (
                    <div className="rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-400">
                      Треков пока нет. Добавьте первый трек-код.
                    </div>
                  )}

                  <div className="grid gap-4">
                    {orders.map((order) => (
                      <TrackCard key={order.id} order={order} />
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "addTrack" && (
                <div className="daryo-card-soft p-4">
                  <h3 className="text-xl font-black">Добавить трек-код</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Вставьте трек-код из маркетплейса. Каждый трек даёт +1 очко
                    к уровню.
                  </p>

                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-bold text-slate-300">
                      Трек-код
                    </label>

                    <input
                      value={trackCode}
                      onChange={(e) => {
                        setTrackCode(e.target.value);
                        setTrackFormError("");
                        setTrackFormSuccess("");
                      }}
                      type="text"
                      placeholder="Введите трек-код из маркетплейса"
                      className="daryo-input"
                    />

                    {trackFormError && (
                      <div className="mt-3 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
                        {trackFormError}
                      </div>
                    )}

                    {trackFormSuccess && (
                      <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100">
                        {trackFormSuccess}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={addOrder}
                    disabled={addingOrder}
                    className="daryo-button daryo-pulse mt-4 w-full disabled:opacity-60"
                  >
                    {addingOrder ? "Добавление..." : "Добавить трек"}
                  </button>
                </div>
              )}

              {activeTab === "tickets" && (
                <div className="daryo-card-soft p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-black">Мои заявки</h3>
                    <a
                      href="/order"
                      className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-100"
                    >
                      Создать
                    </a>
                  </div>

                  {tickets.length === 0 && (
                    <div className="rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-400">
                      Заявок пока нет.
                    </div>
                  )}

                  <div className="grid gap-3">
                    {tickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-slate-500">Трек-номер</p>
                            <p className="mt-1 text-base font-black text-white">
                              {ticket.track_number}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {formatDate(ticket.created_at)}
                            </p>
                          </div>

                          <span
                            className={
                              ticket.status === "resolved"
                                ? "daryo-status-success rounded-full px-3 py-1 text-xs font-bold"
                                : ticket.status === "in_progress"
                                ? "rounded-full border border-blue-300/20 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-100"
                                : "daryo-status-warning rounded-full px-3 py-1 text-xs font-bold"
                            }
                          >
                            {translateTicketStatus(ticket.status)}
                          </span>
                        </div>

                        <div className="mb-3 rounded-2xl bg-white/[0.04] p-3">
                          <p className="text-xs text-slate-500">Проблема</p>
                          <p className="mt-1 text-sm leading-6 text-slate-200">
                            {ticket.message}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-blue-300/10 bg-blue-500/10 p-3">
                          <p className="text-xs text-blue-200">
                            Ответ администратора
                          </p>
                          <p className="mt-1 text-sm leading-6 text-white">
                            {ticket.admin_comment || "Ответ пока не добавлен."}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "password" && (
                <div className="daryo-card-soft p-4">
                  <h3 className="text-xl font-black">Сменить пароль</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Введите старый пароль и новый пароль для входа в кабинет.
                  </p>

                  <div className="mt-5 grid gap-3">
                    <input
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      type="password"
                      placeholder="Старый пароль"
                      className="daryo-input"
                    />

                    <input
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      type="password"
                      placeholder="Новый пароль"
                      className="daryo-input"
                    />

                    <button
                      onClick={changePassword}
                      disabled={changingPassword}
                      className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 transition active:scale-[0.98] disabled:opacity-60"
                    >
                      {changingPassword
                        ? "Сохранение..."
                        : "Сохранить новый пароль"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}