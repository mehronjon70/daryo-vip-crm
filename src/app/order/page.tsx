"use client";

import { useEffect, useState } from "react";

type Ticket = {
  id: string;
  track_number: string;
  problem_type: string;
  message: string;
  status: string;
  admin_comment: string | null;
  created_at: string;
};

export default function OrderPage() {
  const [phone, setPhone] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [trackNumber, setTrackNumber] = useState("");
  const [problemType, setProblemType] = useState("Статус товара не меняется");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingTicketId, setDeletingTicketId] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const storageKey = "daryo_client_phone";

  useEffect(() => {
    const savedPhone = localStorage.getItem(storageKey);

    if (!savedPhone) {
      setError("Сначала войдите в личный кабинет");
      setLoading(false);
      return;
    }

    setPhone(savedPhone);
    loadCabinet(savedPhone);
  }, []);

  function formatDate(value: string) {
    if (!value) return "";

    return new Date(value).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function translateTicketStatus(status: string) {
    if (status === "new") return "Новая";
    if (status === "in_progress") return "В работе";
    if (status === "resolved") return "Решена";
    return status;
  }

  async function loadCabinet(clientPhone: string) {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/client/me", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: clientPhone,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не получилось загрузить данные");
        return;
      }

      setTickets(result.tickets || []);
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  }

  async function createTicket() {
    setError("");
    setSuccess("");

    if (!phone.trim()) {
      setError("Сначала войдите в личный кабинет");
      return;
    }

    if (!trackNumber.trim()) {
      setError("Введите трек-номер");
      return;
    }

    if (!problemType.trim()) {
      setError("Выберите тип проблемы");
      return;
    }

    if (!message.trim()) {
      setError("Опишите проблему");
      return;
    }

    setSending(true);

    try {
      const response = await fetch("/api/tickets/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone.trim(),
          trackNumber: trackNumber.trim(),
          problemType: problemType.trim(),
          message: message.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не получилось отправить заявку");
        return;
      }

      setSuccess("Заявка отправлена. Администратор ответит в личном кабинете.");
      setTrackNumber("");
      setProblemType("Статус товара не меняется");
      setMessage("");

      await loadCabinet(phone.trim());
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения с сервером");
    } finally {
      setSending(false);
    }
  }

  async function deleteTicket(ticketId: string) {
    const confirmed = window.confirm("Удалить эту заявку?");

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeletingTicketId(ticketId);

    try {
      const response = await fetch("/api/tickets/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone.trim(),
          action: "delete_ticket",
          ticketId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не получилось удалить заявку");
        return;
      }

      setSuccess("Заявка удалена");
      await loadCabinet(phone.trim());
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения при удалении заявки");
    } finally {
      setDeletingTicketId("");
    }
  }

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
            <span className="daryo-badge">💬 Daryo VIP</span>

            <h1 className="mt-4 text-4xl font-black tracking-tight">
              Заявка
            </h1>

            <p className="daryo-muted mt-3 text-sm leading-6">
              Здесь можно отправить проблему по любому трек-номеру. Раздел
              простой — для связи с администратором.
            </p>
          </div>
        </div>

        <div className="daryo-card daryo-fade-up p-5">
          {loading && (
            <div className="daryo-glass-blue p-4 text-sm font-black text-blue-100">
              Загрузка...
            </div>
          )}

          {!loading && (
            <>
              {error && (
                <div className="daryo-status-danger mb-5 rounded-2xl p-4 text-sm font-bold leading-6">
                  {error}
                </div>
              )}

              {success && (
                <div className="daryo-status-success mb-5 rounded-2xl p-4 text-sm font-bold leading-6">
                  {success}
                </div>
              )}

              {!phone && (
                <div className="grid gap-3">
                  <a href="/login" className="daryo-button block text-center">
                    Войти в кабинет
                  </a>

                  <a
                    href="/register"
                    className="daryo-button-secondary block text-center"
                  >
                    Регистрация
                  </a>
                </div>
              )}

              {phone && (
                <>
                  <div className="daryo-glass-blue mb-5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-500/10 text-xl">
                        📦
                      </div>

                      <div>
                        <p className="text-sm font-black text-blue-100">
                          Создать заявку
                        </p>

                        <p className="mt-2 text-xs leading-5 text-slate-400">
                          Введите трек-номер, выберите проблему и напишите
                          короткое описание.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-300">
                        Трек-номер
                      </label>

                      <input
                        value={trackNumber}
                        onChange={(e) => setTrackNumber(e.target.value)}
                        type="text"
                        placeholder="Введите трек-номер"
                        className="daryo-input"
                      />

                      <p className="mt-2 text-xs text-slate-500">
                        Можно ввести любой трек, даже если он не добавлен в
                        разделе “Мои треки”.
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-300">
                        Тип проблемы
                      </label>

                      <select
                        value={problemType}
                        onChange={(e) => setProblemType(e.target.value)}
                        className="daryo-input"
                      >
                        <option value="Статус товара не меняется">
                          Статус товара не меняется
                        </option>

                        <option value="Получил не тот товар, который заказал">
                          Получил не тот товар, который заказал
                        </option>

                        <option value="Получил свой товар не полностью">
                          Получил свой товар не полностью
                        </option>

                        <option value="Другое">Другое</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-300">
                        Описание проблемы
                      </label>

                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Кратко опишите проблему..."
                        rows={4}
                        className="daryo-input resize-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={createTicket}
                    disabled={sending}
                    className="daryo-button daryo-pulse mt-5 w-full disabled:opacity-60"
                  >
                    {sending ? "Отправка..." : "Отправить заявку"}
                  </button>

                  <div className="mt-6 daryo-card-soft p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-lg font-black">Мои заявки</h2>

                      <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-300">
                        {tickets.length}
                      </span>
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
                              <p className="text-xs text-slate-500">
                                Трек-номер
                              </p>

                              <p className="mt-1 break-all text-base font-black text-white">
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
                            <p className="text-xs text-slate-500">
                              Тип проблемы
                            </p>

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

                          <div className="mb-3 rounded-2xl border border-blue-300/10 bg-blue-500/10 p-3">
                            <p className="text-xs text-blue-200">
                              Ответ администратора
                            </p>

                            <p className="mt-1 text-sm leading-6 text-white">
                              {ticket.admin_comment ||
                                "Ответ пока не добавлен."}
                            </p>
                          </div>

                          <button
                            onClick={() => deleteTicket(ticket.id)}
                            disabled={deletingTicketId === ticket.id}
                            className="w-full rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 transition active:scale-[0.98] disabled:opacity-60"
                          >
                            {deletingTicketId === ticket.id
                              ? "Удаление..."
                              : "Удалить заявку"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}