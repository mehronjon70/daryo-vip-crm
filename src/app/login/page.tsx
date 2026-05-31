"use client";

import { useState } from "react";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const storageKey = "daryo_client_phone";

  async function handleLogin() {
    setError("");
    setSuccess("");

    if (!phone.trim()) {
      setError("Введите номер телефона");
      return;
    }

    if (!password.trim()) {
      setError("Введите пароль");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/client/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone.trim(),
          password: password.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не получилось войти в кабинет");
        return;
      }

      if (result.client?.status === "pending") {
        setError("Ваша регистрация ещё ожидает подтверждения администратора.");
        return;
      }

      if (result.client?.status === "blocked") {
        setError("Ваш аккаунт выключен. Обратитесь к администратору.");
        return;
      }

      if (result.client?.status !== "approved") {
        setError("Ваш аккаунт ещё не подтверждён.");
        return;
      }

      localStorage.setItem(storageKey, phone.trim());

      setSuccess("Вход выполнен. Открываем личный кабинет...");

      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    } catch (error) {
      console.log(error);
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
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
            <span className="daryo-badge">🔐 Daryo VIP</span>

            <h1 className="mt-4 text-4xl font-black tracking-tight">
              Вход в кабинет
            </h1>

            <p className="daryo-muted mt-3 text-sm leading-6">
              Введите номер телефона и пароль, который вы указали при
              регистрации. После входа откроется ваш личный кабинет.
            </p>
          </div>
        </div>

        <div className="daryo-card daryo-fade-up p-5">
          <div className="daryo-glass-blue mb-5 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-500/10 text-xl">
                👤
              </div>

              <div>
                <p className="text-sm font-black text-blue-100">
                  Личный кабинет клиента
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Если ваш номер уже подтверждён администратором, вы сразу
                  попадёте в свой кабинет.
                </p>
              </div>
            </div>
          </div>

          {success && (
            <div className="daryo-status-success mb-5 rounded-2xl p-4 text-sm font-bold leading-6">
              {success}
            </div>
          )}

          {error && (
            <div className="daryo-status-danger mb-5 rounded-2xl p-4 text-sm font-bold leading-6">
              {error}
            </div>
          )}

          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-300">
                Номер телефона
              </label>

              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                placeholder="Введите номер телефона"
                className="daryo-input"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-300">
                Пароль
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
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="daryo-button daryo-pulse mt-5 w-full disabled:opacity-60"
          >
            {loading ? "Вход..." : "Войти в кабинет"}
          </button>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-black text-white">
              Важно
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              Если вы только зарегистрировались, дождитесь подтверждения
              администратора. До подтверждения вход в кабинет будет закрыт.
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            <a href="/register" className="daryo-button-secondary block text-center">
              Создать аккаунт
            </a>

            <a
              href="/"
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-center text-sm font-black text-slate-300 transition active:scale-[0.98]"
            >
              На главную
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}