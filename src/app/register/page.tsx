"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleRegister() {
    setError("");
    setSuccess("");

    if (!fullName.trim()) {
      setError("Введите имя клиента");
      return;
    }

    if (!phone.trim()) {
      setError("Введите номер телефона");
      return;
    }

    if (!password.trim()) {
      setError("Придумайте пароль");
      return;
    }

    if (password.trim().length < 4) {
      setError("Пароль должен быть минимум 4 символа");
      return;
    }

    if (password.trim() !== repeatPassword.trim()) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/client/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          password: password.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не получилось зарегистрироваться");
        return;
      }

      setSuccess(
        "Регистрация отправлена. Ожидайте подтверждения администратора. После подтверждения вы сможете войти в личный кабинет."
      );

      setFullName("");
      setPhone("");
      setPassword("");
      setRepeatPassword("");
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
            <span className="daryo-badge">🚚 Daryo VIP</span>

            <h1 className="mt-4 text-4xl font-black tracking-tight">
              Регистрация
            </h1>

            <p className="daryo-muted mt-3 text-sm leading-6">
              Создайте заявку на подключение к Daryo VIP. После подтверждения
              администратором вы получите свой VIP ID и сможете войти в личный
              кабинет.
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
                  Заявка клиента
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Введите имя, номер телефона и пароль. Аккаунт будет активен
                  только после подтверждения админом.
                </p>
              </div>
            </div>
          </div>

          {success && (
            <div className="daryo-status-success mb-5 rounded-2xl p-4 text-sm font-bold leading-6">
              {success}

              <div className="mt-4 grid gap-3">
                <a href="/login" className="daryo-button block text-center">
                  Перейти ко входу
                </a>

                <a href="/" className="daryo-button-secondary block text-center">
                  На главную
                </a>
              </div>
            </div>
          )}

          {error && (
            <div className="daryo-status-danger mb-5 rounded-2xl p-4 text-sm font-bold">
              {error}
            </div>
          )}

          {!success && (
            <>
              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-300">
                    Имя клиента
                  </label>

                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    type="text"
                    placeholder="Введите ваше имя"
                    className="daryo-input"
                  />
                </div>

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

                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="Придумайте пароль"
                    className="daryo-input"
                  />

                  <p className="mt-2 text-xs text-slate-500">
                    Минимум 4 символа. Этот пароль будет нужен для входа.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-300">
                    Повторите пароль
                  </label>

                  <input
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                    type="password"
                    placeholder="Повторите пароль"
                    className="daryo-input"
                  />
                </div>
              </div>

              <button
                onClick={handleRegister}
                disabled={loading}
                className="daryo-button daryo-pulse mt-5 w-full disabled:opacity-60"
              >
                {loading ? "Отправка..." : "Отправить на подтверждение"}
              </button>

              <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-black text-white">
                  Что будет дальше?
                </p>

                <div className="mt-3 grid gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-sm">
                      1
                    </div>
                    <p className="text-xs leading-5 text-slate-400">
                      Вы отправляете заявку на регистрацию.
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-sm">
                      2
                    </div>
                    <p className="text-xs leading-5 text-slate-400">
                      Администратор проверяет и подтверждает ваш номер.
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-sm">
                      3
                    </div>
                    <p className="text-xs leading-5 text-slate-400">
                      После подтверждения вы получите VIP ID и сможете добавлять
                      треки для повышения уровня.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 text-center">
                <p className="text-xs text-slate-500">Уже есть аккаунт?</p>

                <a
                  href="/login"
                  className="mt-2 inline-flex rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-sm font-black text-cyan-100 transition active:scale-95"
                >
                  Войти в кабинет
                </a>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}