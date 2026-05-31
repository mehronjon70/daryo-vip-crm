"use client";

import { useState } from "react";

type Client = {
  id: string;
  full_name: string;
  phone: string;
  status: string;
  level: string;
  level_label?: string;
  vip_id: string | null;
  total_items: number;
  created_at: string;
  approved_at?: string | null;
};

type Ticket = {
  id: string;
  client_id?: string;
  order_id?: string | null;
  track_number: string;
  problem_type: string;
  message: string;
  status: string;
  admin_comment: string | null;
  created_at: string;
  updated_at?: string;
  clients?: {
    full_name: string;
    phone: string;
    vip_id: string | null;
  } | null;
};

type Order = {
  id: string;
  client_id?: string;
  track_code: string;
  status: string;
  created_at: string;
  updated_at?: string;
  clients?: {
    full_name: string;
    phone: string;
    vip_id: string | null;
  } | null;
};

type ControlledClientData = {
  client: Client;
  orders: Order[];
  tickets: Ticket[];
};

type AnalyticsData = {
  stats: {
    totalClients: number;
    pendingClients: number;
    approvedClients: number;
    blockedClients: number;
    totalOrders: number;
    problemOrders: number;
    totalTickets: number;
    newTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
  };
  topClients: Client[];
  allClients: Client[];
  pendingClients: Client[];
  orders: Order[];
  tickets: {
    all: Ticket[];
    newAndInProgress: Ticket[];
    resolved: Ticket[];
  };
};

type AdminTab =
  | "pending"
  | "top"
  | "clients"
  | "control"
  | "activeTickets"
  | "orders";

type ClientStatusFilter = "all" | "pending" | "approved" | "blocked";
type ClientsInnerTab = "all" | "search";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>("pending");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  const [clientsInnerTab, setClientsInnerTab] =
    useState<ClientsInnerTab>("all");

  const [clientSearch, setClientSearch] = useState("");
  const [clientStatusFilter, setClientStatusFilter] =
    useState<ClientStatusFilter>("all");

  const [controlPhone, setControlPhone] = useState("");
  const [controlledClient, setControlledClient] =
    useState<ControlledClientData | null>(null);

  const [clientControlLoading, setClientControlLoading] = useState(false);
  const [newClientPassword, setNewClientPassword] = useState("");

  const [ticketReplies, setTicketReplies] = useState<Record<string, string>>(
    {}
  );

  const [ticketLoadingId, setTicketLoadingId] = useState("");
  const [clientLoadingId, setClientLoadingId] = useState("");
  const [trackLoadingId, setTrackLoadingId] = useState("");
  const [deletingTicketId, setDeletingTicketId] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadAnalytics(adminPassword: string) {
    const response = await fetch("/api/admin/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: adminPassword }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Ошибка загрузки аналитики");
    }

    setAnalytics(result);

    const replies: Record<string, string> = {};
    for (const ticket of result.tickets?.all || []) {
      replies[ticket.id] = ticket.admin_comment || "";
    }

    setTicketReplies(replies);
  }

  async function loadAll(adminPassword: string) {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await loadAnalytics(adminPassword);
      setIsUnlocked(true);
    } catch (error) {
      console.log(error);
      setAnalytics(null);
      setIsUnlocked(false);
      setError(
        error instanceof Error ? error.message : "Ошибка соединения с сервером"
      );
    } finally {
      setLoading(false);
    }
  }

  function handleLogin() {
    if (!password.trim()) {
      setError("Введите пароль админа");
      return;
    }

    loadAll(password.trim());
  }

  async function approveClient(clientId: string) {
    setClientLoadingId(clientId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/approve-client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: password.trim(),
          clientId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не получилось подтвердить клиента");
        return;
      }

      setSuccess(result.message || "Клиент подтверждён и VIP ID выдан");
      await loadAll(password.trim());
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения при подтверждении клиента");
    } finally {
      setClientLoadingId("");
    }
  }

  async function updateTicketStatus(
    ticketId: string,
    status: string,
    requireReply = false
  ) {
    const adminComment = ticketReplies[ticketId] || "";

    if (requireReply && !adminComment.trim()) {
      setError("Напишите ответ клиенту перед закрытием заявки");
      return;
    }

    setTicketLoadingId(ticketId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: password.trim(),
          action: "update",
          ticketId,
          status,
          adminComment,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не получилось обновить заявку");
        return;
      }

      setSuccess("Заявка обновлена");
      await loadAnalytics(password.trim());

      if (controlledClient?.client.phone) {
        await findClientByPhone(controlledClient.client.phone, false);
      }
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения при обновлении заявки");
    } finally {
      setTicketLoadingId("");
    }
  }

  async function deleteAdminTicket(ticketId: string) {
    const confirmed = window.confirm("Удалить эту заявку?");

    if (!confirmed) return;

    setDeletingTicketId(ticketId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: password.trim(),
          action: "delete",
          ticketId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не получилось удалить заявку");
        return;
      }

      setSuccess("Заявка удалена");
      await loadAnalytics(password.trim());

      if (controlledClient?.client.phone) {
        await findClientByPhone(controlledClient.client.phone, false);
      }
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения при удалении заявки");
    } finally {
      setDeletingTicketId("");
    }
  }

  async function deleteTrack(orderId: string, clientPhone?: string) {
    const confirmed = window.confirm(
      "Удалить этот трек? Он исчезнет у клиента и в админке."
    );

    if (!confirmed) return;

    setTrackLoadingId(orderId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: password.trim(),
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
      await loadAnalytics(password.trim());

      if (clientPhone || controlledClient?.client.phone) {
        await findClientByPhone(
          clientPhone || controlledClient?.client.phone,
          false
        );
      }
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения при удалении трека");
    } finally {
      setTrackLoadingId("");
    }
  }

  async function findClientByPhone(phoneValue?: string, showSuccess = true) {
    const finalPhone = String(phoneValue || controlPhone).trim();

    if (!finalPhone) {
      setError("Введите номер клиента");
      return;
    }

    setClientControlLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/client-control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: password.trim(),
          action: "find_by_phone",
          phone: finalPhone,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setControlledClient(null);
        setError(result.error || "Клиент не найден");
        return;
      }

      setControlledClient({
        client: result.client,
        orders: result.orders || [],
        tickets: result.tickets || [],
      });

      setControlPhone(finalPhone);
      setActiveTab("control");

      if (showSuccess) {
        setSuccess("Клиент найден");
      }
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения при поиске клиента");
    } finally {
      setClientControlLoading(false);
    }
  }

  async function resetClientPassword() {
    if (!controlledClient) {
      setError("Сначала найдите клиента");
      return;
    }

    if (!newClientPassword.trim()) {
      setError("Введите новый пароль клиента");
      return;
    }

    if (newClientPassword.trim().length < 4) {
      setError("Пароль должен быть минимум 4 символа");
      return;
    }

    setClientControlLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/client-control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: password.trim(),
          action: "reset_password",
          clientId: controlledClient.client.id,
          newPassword: newClientPassword.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не получилось сбросить пароль");
        return;
      }

      setSuccess("Пароль клиента обновлён");
      setNewClientPassword("");
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения при сбросе пароля");
    } finally {
      setClientControlLoading(false);
    }
  }

  async function blockClient() {
    if (!controlledClient) return;

    setClientControlLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/client-control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: password.trim(),
          action: "block_client",
          clientId: controlledClient.client.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не получилось выключить аккаунт");
        return;
      }

      setSuccess("Аккаунт клиента выключен");
      await findClientByPhone(controlledClient.client.phone, false);
      await loadAnalytics(password.trim());
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения при выключении аккаунта");
    } finally {
      setClientControlLoading(false);
    }
  }

  async function unblockClient() {
    if (!controlledClient) return;

    setClientControlLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/client-control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: password.trim(),
          action: "unblock_client",
          clientId: controlledClient.client.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не получилось включить аккаунт");
        return;
      }

      setSuccess("Аккаунт клиента включён");
      await findClientByPhone(controlledClient.client.phone, false);
      await loadAnalytics(password.trim());
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения при включении аккаунта");
    } finally {
      setClientControlLoading(false);
    }
  }

  async function deleteClient() {
    if (!controlledClient) return;

    const confirmed = window.confirm(
      `Удалить аккаунт клиента ${controlledClient.client.full_name}? Это удалит его треки и заявки.`
    );

    if (!confirmed) return;

    setClientControlLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/client-control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: password.trim(),
          action: "delete_client",
          clientId: controlledClient.client.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не получилось удалить аккаунт");
        return;
      }

      setSuccess("Аккаунт клиента удалён");
      setControlledClient(null);
      setControlPhone("");
      await loadAnalytics(password.trim());
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения при удалении аккаунта");
    } finally {
      setClientControlLoading(false);
    }
  }

  function translateTicketStatus(status: string) {
    if (status === "new") return "Новая";
    if (status === "in_progress") return "В работе";
    if (status === "resolved") return "Решена";
    return status;
  }

  function translateClientStatus(status: string) {
    if (status === "pending") return "Ожидает";
    if (status === "approved") return "Подтверждён";
    if (status === "blocked") return "Выключен";
    return status;
  }

  function translateLevel(level: string) {
    if (level === "bronze") return "Bronze";
    if (level === "silver") return "Silver";
    if (level === "gold") return "Gold";
    if (level === "diamond") return "Diamond";
    return "Start";
  }

  function formatDate(value: string) {
    if (!value) return "";

    return new Date(value).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function clientStatusClass(status: string) {
    if (status === "approved") {
      return "daryo-status-success rounded-full px-3 py-1 text-xs font-bold";
    }

    if (status === "blocked") {
      return "daryo-status-danger rounded-full px-3 py-1 text-xs font-bold";
    }

    return "daryo-status-warning rounded-full px-3 py-1 text-xs font-bold";
  }

  function tabClass(tab: AdminTab) {
    const base =
      "min-h-[92px] rounded-3xl px-3 py-3 text-center text-xs font-black transition-all duration-300 active:scale-[0.96]";

    if (activeTab === tab) {
      return `${base} bg-gradient-to-br from-blue-700 via-blue-500 to-cyan-300 text-white shadow-xl shadow-blue-500/30 scale-[1.02]`;
    }

    return `${base} border border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]`;
  }

  function innerClientTabClass(tab: ClientsInnerTab) {
    if (clientsInnerTab === tab) {
      return "rounded-2xl bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-300 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition active:scale-[0.98]";
    }

    return "rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-slate-300 transition active:scale-[0.98]";
  }

  const stats = analytics?.stats;
  const pendingClients = analytics?.pendingClients || [];
  const topClients = analytics?.topClients || [];
  const allClients = analytics?.allClients || [];
  const allOrders = analytics?.orders || [];
  const newAndInProgressTickets = analytics?.tickets?.newAndInProgress || [];

  const filteredClients = allClients.filter((client) => {
    const search = clientSearch.trim().toLowerCase();

    const matchesSearch =
      !search ||
      client.full_name?.toLowerCase().includes(search) ||
      client.phone?.toLowerCase().includes(search) ||
      client.vip_id?.toLowerCase().includes(search);

    const matchesStatus =
      clientStatusFilter === "all" || client.status === clientStatusFilter;

    return matchesSearch && matchesStatus;
  });

  const visibleClients =
    clientsInnerTab === "all" ? allClients : filteredClients;

  return (
    <main className="daryo-page text-white">
      <section className="daryo-container">
        <div className="daryo-fade-up mb-7">
          <a
            href="/"
            className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-300 transition active:scale-95"
          >
            ← Назад
          </a>

          <div className="mt-6">
            <span className="daryo-badge">🛠 Admin Logistics CRM</span>

            <h1 className="mt-4 text-4xl font-black tracking-tight">
              Админ-панель
            </h1>

            <p className="daryo-muted mt-2 text-sm leading-6">
              Управление клиентами, треками, заявками, паролями и аккаунтами.
            </p>
          </div>
        </div>

        {!isUnlocked && (
          <div className="daryo-card daryo-fade-up p-5">
            <div className="daryo-glass-blue mb-5 p-4">
              <p className="text-sm font-black text-blue-100">
                Защищённый вход
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Введите админ-пароль, чтобы открыть панель управления.
              </p>
            </div>

            {error && (
              <div className="daryo-status-danger mb-5 rounded-2xl p-4 text-sm font-bold">
                {error}
              </div>
            )}

            <div className="mb-5">
              <label className="mb-2 block text-sm font-bold text-slate-300">
                Пароль админа
              </label>

              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="Введите пароль"
                  className="daryo-input pr-14"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-sm transition hover:bg-white/[0.12]"
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="daryo-button daryo-pulse w-full disabled:opacity-60"
            >
              {loading ? "Проверка..." : "Войти в админ-панель"}
            </button>
          </div>
        )}

        {isUnlocked && (
          <div className="daryo-fade-up">
            {error && (
              <div className="daryo-status-danger mb-5 rounded-2xl p-4 text-sm font-bold">
                {error}
              </div>
            )}

            {success && (
              <div className="daryo-status-success mb-5 rounded-2xl p-4 text-sm font-bold">
                {success}
              </div>
            )}

            <div className="daryo-card mb-5 p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <span className="daryo-badge">📊 Analytics</span>
                  <h2 className="mt-3 text-xl font-black">Общая аналитика</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Главные цифры всегда перед глазами.
                  </p>
                </div>

                <button
                  onClick={() => loadAll(password.trim())}
                  className="rounded-2xl border border-blue-300/20 bg-blue-500/10 px-4 py-3 text-xs font-black text-blue-100 transition active:scale-[0.97]"
                >
                  Обновить
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="daryo-card-soft p-4">
                  <p className="text-xs text-slate-400">Всего клиентов</p>
                  <p className="mt-1 text-3xl font-black">
                    {stats?.totalClients || 0}
                  </p>
                </div>

                <div className="daryo-status-warning rounded-3xl p-4">
                  <p className="text-xs">На подтверждение</p>
                  <p className="mt-1 text-3xl font-black">
                    {stats?.pendingClients || 0}
                  </p>
                </div>

                <div className="daryo-glass-blue p-4">
                  <p className="text-xs text-cyan-100">Всего треков</p>
                  <p className="mt-1 text-3xl font-black text-white">
                    {stats?.totalOrders || 0}
                  </p>
                </div>

                <div className="daryo-card-soft p-4">
                  <p className="text-xs text-blue-100">Новые заявки</p>
                  <p className="mt-1 text-3xl font-black text-blue-100">
                    {stats?.newTickets || 0}
                  </p>
                </div>

                <div className="daryo-status-success rounded-3xl p-4">
                  <p className="text-xs">Подтверждённые</p>
                  <p className="mt-1 text-3xl font-black">
                    {stats?.approvedClients || 0}
                  </p>
                </div>

                <div className="daryo-status-danger rounded-3xl p-4">
                  <p className="text-xs">Выключены</p>
                  <p className="mt-1 text-3xl font-black">
                    {stats?.blockedClients || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="sticky top-2 z-20 mb-5 rounded-[30px] border border-white/10 bg-slate-950/80 p-3 shadow-2xl shadow-blue-950/40 backdrop-blur-2xl">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-white">
                    Разделы админки
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Нажмите на нужный блок
                  </p>
                </div>

                <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-100">
                  CRM
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setActiveTab("pending")}
                  className={tabClass("pending")}
                >
                  <span className="block text-lg">⏳</span>
                  <span className="mt-1 block">Подтверждение</span>
                  <span className="mt-1 block text-[11px] opacity-70">
                    {pendingClients.length} клиентов
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("top")}
                  className={tabClass("top")}
                >
                  <span className="block text-lg">🏆</span>
                  <span className="mt-1 block">Топ 5</span>
                  <span className="mt-1 block text-[11px] opacity-70">
                    уровень и треки
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("clients")}
                  className={tabClass("clients")}
                >
                  <span className="block text-lg">👥</span>
                  <span className="mt-1 block">Клиенты</span>
                  <span className="mt-1 block text-[11px] opacity-70">
                    {allClients.length} всего
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("control")}
                  className={tabClass("control")}
                >
                  <span className="block text-lg">🔎</span>
                  <span className="mt-1 block">Управление</span>
                  <span className="mt-1 block text-[11px] opacity-70">
                    поиск клиента
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("activeTickets")}
                  className={tabClass("activeTickets")}
                >
                  <span className="block text-lg">💬</span>
                  <span className="mt-1 block">Новые заявки</span>
                  <span className="mt-1 block text-[11px] opacity-70">
                    {newAndInProgressTickets.length} активных
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("orders")}
                  className={tabClass("orders")}
                >
                  <span className="block text-lg">📦</span>
                  <span className="mt-1 block">Все треки</span>
                  <span className="mt-1 block text-[11px] opacity-70">
                    {allOrders.length} треков
                  </span>
                </button>
              </div>
            </div>

            {activeTab === "pending" && (
              <div className="daryo-card p-5">
                <span className="daryo-badge">⏳ Pending clients</span>
                <h2 className="mt-3 text-xl font-black">
                  Клиенты на подтверждение
                </h2>

                <div className="mt-4 grid gap-3">
                  {pendingClients.length === 0 && (
                    <p className="daryo-card-soft p-3 text-sm text-slate-400">
                      Новых клиентов нет.
                    </p>
                  )}

                  {pendingClients.map((client) => (
                    <div key={client.id} className="daryo-card-soft p-4">
                      <p className="text-lg font-black">{client.full_name}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {client.phone}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Регистрация: {formatDate(client.created_at)}
                      </p>

                      <button
                        onClick={() => approveClient(client.id)}
                        disabled={clientLoadingId === client.id}
                        className="daryo-button mt-4 w-full disabled:opacity-60"
                      >
                        {clientLoadingId === client.id
                          ? "Подтверждение..."
                          : "Подтвердить и выдать VIP ID"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "top" && (
              <div className="daryo-card p-5">
                <span className="daryo-badge">🏆 Top clients</span>
                <h2 className="mt-3 text-xl font-black">Топ 5 клиентов</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Клиенты, которые добавили больше всего треков.
                </p>

                <div className="mt-4 grid gap-3">
                  {topClients.length === 0 && (
                    <p className="daryo-card-soft p-3 text-sm text-slate-400">
                      Пока нет клиентов.
                    </p>
                  )}

                  {topClients.map((client, index) => (
                    <button
                      key={client.id}
                      onClick={() => findClientByPhone(client.phone)}
                      className="daryo-card-soft p-4 text-left transition active:scale-[0.98]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-cyan-100">#{index + 1}</p>
                          <p className="mt-1 text-lg font-black">
                            {client.full_name}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {client.phone}
                          </p>
                          <p className="mt-1 text-xs text-blue-100">
                            {client.vip_id || "VIP ID нет"}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-2xl font-black">
                            {client.total_items || 0}
                          </p>
                          <p className="text-xs text-slate-400">треков</p>

                          <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2">
                            <p className="text-xs font-black text-cyan-100">
                              {client.level_label ||
                                translateLevel(client.level)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "clients" && (
              <div className="daryo-card p-5">
                <span className="daryo-badge">👥 Clients</span>

                <div className="mt-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">Клиенты</h2>
                    <p className="mt-1 text-xs text-slate-400">
                      Список клиентов и быстрый поиск по номеру, имени или VIP
                      ID.
                    </p>
                  </div>

                  <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-100">
                    {visibleClients.length}/{allClients.length}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setClientsInnerTab("all")}
                    className={innerClientTabClass("all")}
                  >
                    👥 Все клиенты
                  </button>

                  <button
                    onClick={() => setClientsInnerTab("search")}
                    className={innerClientTabClass("search")}
                  >
                    🔎 Поиск / фильтр
                  </button>
                </div>

                {clientsInnerTab === "search" && (
                  <div className="mt-4 grid gap-3 rounded-[28px] border border-white/10 bg-white/[0.04] p-3">
                    <input
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      type="text"
                      placeholder="Поиск: имя, номер или VIP ID"
                      className="daryo-input"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setClientStatusFilter("all")}
                        className={
                          clientStatusFilter === "all"
                            ? "rounded-2xl bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-300 px-3 py-3 text-xs font-black text-white"
                            : "rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 text-xs font-black text-slate-300"
                        }
                      >
                        Все
                      </button>

                      <button
                        onClick={() => setClientStatusFilter("pending")}
                        className={
                          clientStatusFilter === "pending"
                            ? "rounded-2xl bg-gradient-to-r from-yellow-600 to-orange-400 px-3 py-3 text-xs font-black text-white"
                            : "rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 text-xs font-black text-slate-300"
                        }
                      >
                        Ожидают
                      </button>

                      <button
                        onClick={() => setClientStatusFilter("approved")}
                        className={
                          clientStatusFilter === "approved"
                            ? "rounded-2xl bg-gradient-to-r from-emerald-600 to-green-400 px-3 py-3 text-xs font-black text-white"
                            : "rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 text-xs font-black text-slate-300"
                        }
                      >
                        Подтверждённые
                      </button>

                      <button
                        onClick={() => setClientStatusFilter("blocked")}
                        className={
                          clientStatusFilter === "blocked"
                            ? "rounded-2xl bg-gradient-to-r from-red-700 to-red-500 px-3 py-3 text-xs font-black text-white"
                            : "rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 text-xs font-black text-slate-300"
                        }
                      >
                        Выключенные
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 grid gap-3">
                  {visibleClients.length === 0 && (
                    <p className="daryo-card-soft p-3 text-sm text-slate-400">
                      Клиенты не найдены.
                    </p>
                  )}

                  {visibleClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => findClientByPhone(client.phone)}
                      className="daryo-card-soft p-4 text-left transition active:scale-[0.98]"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black">
                            {client.full_name}
                          </p>

                          <p className="mt-1 text-sm text-slate-400">
                            {client.phone}
                          </p>

                          <p className="mt-1 text-xs text-blue-100">
                            {client.vip_id || "VIP ID нет"}
                          </p>
                        </div>

                        <span className={clientStatusClass(client.status)}>
                          {translateClientStatus(client.status)}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-2xl bg-white/[0.04] p-3">
                          <p className="text-xs text-slate-500">Уровень</p>
                          <p className="mt-1 text-sm font-black text-cyan-100">
                            {client.level_label || translateLevel(client.level)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white/[0.04] p-3">
                          <p className="text-xs text-slate-500">Треков</p>
                          <p className="mt-1 text-sm font-black text-white">
                            {client.total_items || 0}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white/[0.04] p-3">
                          <p className="text-xs text-slate-500">Дата</p>
                          <p className="mt-1 text-sm font-black text-white">
                            {formatDate(client.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "control" && (
              <div className="daryo-card p-5">
                <span className="daryo-badge">🔎 Client control</span>
                <h2 className="mt-3 text-xl font-black">Управление клиентом</h2>

                <div className="mt-4 grid gap-3">
                  <input
                    value={controlPhone}
                    onChange={(e) => setControlPhone(e.target.value)}
                    type="tel"
                    placeholder="Введите номер клиента"
                    className="daryo-input"
                  />

                  <button
                    onClick={() => findClientByPhone()}
                    disabled={clientControlLoading}
                    className="daryo-button w-full disabled:opacity-60"
                  >
                    {clientControlLoading ? "Поиск..." : "Найти клиента"}
                  </button>
                </div>

                {controlledClient && (
                  <div className="mt-5 daryo-card-soft p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xl font-black">
                          {controlledClient.client.full_name}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {controlledClient.client.phone}
                        </p>
                        <p className="mt-1 text-sm text-cyan-100">
                          {controlledClient.client.vip_id || "VIP ID ещё нет"}
                        </p>
                      </div>

                      <span
                        className={clientStatusClass(
                          controlledClient.client.status
                        )}
                      >
                        {translateClientStatus(controlledClient.client.status)}
                      </span>
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white/[0.04] p-3">
                        <p className="text-xs text-slate-500">Уровень</p>
                        <p className="font-black">
                          {translateLevel(controlledClient.client.level)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/[0.04] p-3">
                        <p className="text-xs text-slate-500">Треков</p>
                        <p className="font-black">
                          {controlledClient.client.total_items}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/[0.04] p-3">
                        <p className="text-xs text-slate-500">Заявок</p>
                        <p className="font-black">
                          {controlledClient.tickets.length}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/[0.04] p-3">
                        <p className="text-xs text-slate-500">Статус</p>
                        <p className="font-black">
                          {translateClientStatus(controlledClient.client.status)}
                        </p>
                      </div>
                    </div>

                    <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <p className="mb-2 text-sm font-black">Сбросить пароль</p>

                      <input
                        value={newClientPassword}
                        onChange={(e) => setNewClientPassword(e.target.value)}
                        type="text"
                        placeholder="Новый пароль клиента"
                        className="daryo-input mb-3"
                      />

                      <button
                        onClick={resetClientPassword}
                        disabled={clientControlLoading}
                        className="w-full rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 transition active:scale-[0.98] disabled:opacity-60"
                      >
                        Сохранить новый пароль
                      </button>
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-3">
                      {controlledClient.client.status === "blocked" ? (
                        <button
                          onClick={unblockClient}
                          disabled={clientControlLoading}
                          className="rounded-2xl bg-gradient-to-r from-emerald-600 to-green-400 px-4 py-3 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-60"
                        >
                          Включить
                        </button>
                      ) : (
                        <button
                          onClick={blockClient}
                          disabled={clientControlLoading}
                          className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 transition active:scale-[0.98] disabled:opacity-60"
                        >
                          Выключить
                        </button>
                      )}

                      <button
                        onClick={deleteClient}
                        disabled={clientControlLoading}
                        className="rounded-2xl bg-gradient-to-r from-red-700 to-red-500 px-4 py-3 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-60"
                      >
                        Удалить аккаунт
                      </button>
                    </div>

                    <div className="mb-4">
                      <h3 className="mb-3 text-lg font-black">Треки клиента</h3>

                      {controlledClient.orders.length === 0 && (
                        <p className="rounded-2xl bg-white/[0.04] p-3 text-sm text-slate-400">
                          У клиента пока нет треков.
                        </p>
                      )}

                      <div className="grid gap-3">
                        {controlledClient.orders.map((order) => (
                          <div
                            key={order.id}
                            className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                          >
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs text-slate-500">
                                  Трек-код
                                </p>
                                <p className="mt-1 break-all font-black text-white">
                                  {order.track_code}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {formatDate(order.created_at)}
                                </p>
                              </div>

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-500/10">
                                📦
                              </div>
                            </div>

                            <button
                              onClick={() =>
                                deleteTrack(
                                  order.id,
                                  controlledClient.client.phone
                                )
                              }
                              disabled={trackLoadingId === order.id}
                              className="w-full rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 transition active:scale-[0.98] disabled:opacity-60"
                            >
                              {trackLoadingId === order.id
                                ? "Удаление..."
                                : "Удалить трек"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-3 text-lg font-black">Заявки клиента</h3>

                      {controlledClient.tickets.length === 0 && (
                        <p className="rounded-2xl bg-white/[0.04] p-3 text-sm text-slate-400">
                          У клиента пока нет заявок.
                        </p>
                      )}

                      <div className="grid gap-3">
                        {controlledClient.tickets.map((ticket) => (
                          <div
                            key={ticket.id}
                            className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                          >
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs text-slate-500">
                                  Трек-номер
                                </p>
                                <p className="font-black text-white">
                                  {ticket.track_number}
                                </p>
                              </div>

                              <span className="daryo-status-warning rounded-full px-3 py-1 text-xs font-bold">
                                {translateTicketStatus(ticket.status)}
                              </span>
                            </div>

                            <div className="mb-2 rounded-xl bg-white/[0.04] p-3">
                              <p className="text-xs text-slate-500">
                                Тип проблемы
                              </p>
                              <p className="mt-1 text-sm text-white">
                                {ticket.problem_type}
                              </p>
                            </div>

                            <p className="text-sm leading-6 text-slate-300">
                              {ticket.message}
                            </p>

                            <div className="mt-2 rounded-xl bg-blue-500/10 p-3">
                              <p className="text-xs text-blue-200">Ответ</p>
                              <p className="mt-1 text-sm text-white">
                                {ticket.admin_comment ||
                                  "Ответ пока не добавлен"}
                              </p>
                            </div>

                            <button
                              onClick={() => deleteAdminTicket(ticket.id)}
                              disabled={deletingTicketId === ticket.id}
                              className="mt-3 w-full rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 transition active:scale-[0.98] disabled:opacity-60"
                            >
                              {deletingTicketId === ticket.id
                                ? "Удаление..."
                                : "Удалить заявку"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "activeTickets" && (
              <div className="daryo-card p-5">
                <span className="daryo-badge">💬 Active tickets</span>
                <h2 className="mt-3 text-xl font-black">Новые / в работе</h2>

                <div className="mt-4 grid gap-3">
                  {newAndInProgressTickets.length === 0 && (
                    <p className="daryo-card-soft p-3 text-sm text-slate-400">
                      Активных заявок нет.
                    </p>
                  )}

                  {newAndInProgressTickets.map((ticket) => (
                    <div key={ticket.id} className="daryo-card-soft p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold">
                            {ticket.clients?.full_name || "Клиент"}
                          </p>

                          <p className="mt-1 text-sm text-slate-400">
                            {ticket.clients?.phone || "нет номера"}
                          </p>

                          <p className="mt-1 text-sm text-blue-200">
                            {ticket.clients?.vip_id || "VIP ID нет"}
                          </p>
                        </div>

                        <span className="daryo-status-warning rounded-full px-3 py-1 text-xs font-bold">
                          {translateTicketStatus(ticket.status)}
                        </span>
                      </div>

                      <div className="mb-3 rounded-2xl bg-white/[0.04] p-3">
                        <p className="text-xs text-slate-500">Трек-номер</p>
                        <p className="font-bold text-white">
                          {ticket.track_number}
                        </p>
                      </div>

                      <div className="mb-3 rounded-2xl bg-white/[0.04] p-3">
                        <p className="text-xs text-slate-500">Тип проблемы</p>
                        <p className="mt-1 text-sm font-bold text-white">
                          {ticket.problem_type}
                        </p>
                      </div>

                      <div className="mb-3 rounded-2xl bg-white/[0.04] p-3">
                        <p className="text-xs text-slate-500">Описание</p>
                        <p className="mt-1 text-sm leading-6 text-slate-200">
                          {ticket.message}
                        </p>
                      </div>

                      <div className="mb-3">
                        <label className="mb-2 block text-sm font-bold text-slate-300">
                          Ответ клиенту
                        </label>

                        <textarea
                          value={ticketReplies[ticket.id] || ""}
                          onChange={(e) =>
                            setTicketReplies((prev) => ({
                              ...prev,
                              [ticket.id]: e.target.value,
                            }))
                          }
                          placeholder="Напишите ответ клиенту..."
                          rows={3}
                          className="daryo-input resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {ticket.status === "new" && (
                          <button
                            onClick={() =>
                              updateTicketStatus(ticket.id, "in_progress")
                            }
                            disabled={ticketLoadingId === ticket.id}
                            className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-400 px-4 py-3 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-60"
                          >
                            В работу
                          </button>
                        )}

                        <button
                          onClick={() =>
                            updateTicketStatus(ticket.id, "in_progress")
                          }
                          disabled={ticketLoadingId === ticket.id}
                          className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-60"
                        >
                          Сохранить
                        </button>

                        <button
                          onClick={() =>
                            updateTicketStatus(ticket.id, "resolved", true)
                          }
                          disabled={ticketLoadingId === ticket.id}
                          className="col-span-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-400 px-4 py-3 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-60"
                        >
                          Ответить и закрыть
                        </button>

                        <button
                          onClick={() => deleteAdminTicket(ticket.id)}
                          disabled={deletingTicketId === ticket.id}
                          className="col-span-2 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 transition active:scale-[0.98] disabled:opacity-60"
                        >
                          {deletingTicketId === ticket.id
                            ? "Удаление..."
                            : "Удалить заявку"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "orders" && (
              <div className="daryo-card p-5">
                <span className="daryo-badge">📦 All tracks</span>
                <h2 className="mt-3 text-xl font-black">
                  Все добавленные треки
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Здесь можно смотреть и удалять треки клиентов.
                </p>

                <div className="mt-4 grid gap-3">
                  {allOrders.length === 0 && (
                    <p className="daryo-card-soft p-3 text-sm text-slate-400">
                      Треков пока нет.
                    </p>
                  )}

                  {allOrders.map((order) => (
                    <div
                      key={order.id}
                      className="daryo-card-soft p-4 text-left"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-slate-500">Трек-код</p>
                          <p className="mt-1 break-all text-lg font-black text-white">
                            {order.track_code}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(order.created_at)}
                          </p>
                        </div>

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-500/10 text-xl">
                          📦
                        </div>
                      </div>

                      <div className="mb-3 grid grid-cols-2 gap-3">
                        <button
                          onClick={() => {
                            if (order.clients?.phone) {
                              findClientByPhone(order.clients.phone);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }
                          }}
                          className="rounded-2xl bg-white/[0.04] p-3 text-left transition active:scale-[0.98]"
                        >
                          <p className="text-xs text-slate-500">Клиент</p>
                          <p className="mt-1 text-sm font-bold">
                            {order.clients?.full_name || "нет"}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {order.clients?.phone || ""}
                          </p>
                        </button>

                        <div className="rounded-2xl bg-white/[0.04] p-3">
                          <p className="text-xs text-slate-500">VIP ID</p>
                          <p className="mt-1 text-sm font-bold text-cyan-100">
                            {order.clients?.vip_id || "нет"}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          deleteTrack(order.id, order.clients?.phone)
                        }
                        disabled={trackLoadingId === order.id}
                        className="w-full rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 transition active:scale-[0.98] disabled:opacity-60"
                      >
                        {trackLoadingId === order.id
                          ? "Удаление..."
                          : "Удалить трек"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}