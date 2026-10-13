"use client";

import { useCallback, useEffect, useState } from "react";
import TurnstileCaptcha from "./TurnstileCaptcha";

type CallbackInfo = {
  title: string;
  reward: string;
};

type CallbackResponse = {
  error?: string;
  task?: CallbackInfo;
  minimumWaitSeconds?: number;
  reward?: string;
  balance?: string;
};

export default function TaskCallback({ token }: { token: string }) {
  const [task, setTask] = useState<CallbackInfo | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [captchaToken, setCaptchaToken] = useState("");
  const [sliderValue, setSliderValue] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [completed, setCompleted] = useState<{ reward: string; balance: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function inspect() {
      try {
        const response = await fetch("/api/tasks/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "inspect", token }),
          cache: "no-store",
        });
        const result: CallbackResponse = await response.json();
        if (!response.ok) {
          if (!cancelled) setInvalid(response.status === 410);
          if (!cancelled && response.status !== 410) {
            setError(result.error ?? "Không thể kiểm tra phiên nhiệm vụ.");
          }
          return;
        }
        if (!result.task) throw new Error("Phản hồi callback thiếu thông tin nhiệm vụ.");
        if (!cancelled) {
          setTask(result.task);
          setRemaining(result.minimumWaitSeconds ?? 0);
        }
      } catch (inspectError) {
        if (!cancelled) setError(inspectError instanceof Error ? inspectError.message : "Không thể kiểm tra callback.");
      }
    }
    void inspect();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  const onCaptchaToken = useCallback((value: string) => {
    setCaptchaToken(value);
    setError("");
  }, []);
  const onCaptchaError = useCallback((message: string) => setError(message), []);
  const onCaptchaExpired = useCallback(() => setCaptchaToken(""), []);

  async function claim() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/tasks/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "claim",
          token,
          captchaToken,
          sliderCompleted: sliderValue === 100,
        }),
        cache: "no-store",
      });
      const result: CallbackResponse = await response.json();
      if (response.status === 410) {
        setInvalid(true);
        return;
      }
      if (!response.ok) {
        if (response.status === 425) setRemaining(result.minimumWaitSeconds ?? 1);
        throw new Error(result.error ?? "Không thể xác nhận nhiệm vụ.");
      }
      if (!result.reward || !result.balance) throw new Error("Phản hồi hoàn thành không đầy đủ.");
      setCompleted({ reward: result.reward, balance: result.balance });
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Không thể xác nhận nhiệm vụ.");
    } finally {
      setBusy(false);
    }
  }

  if (invalid) {
    return <main className="callback-page"><section className="callback-card callback-invalid" role="alert">
      <span className="callback-symbol">!</span><p className="eyebrow">MAYMAY · CALLBACK</p>
      <h1>Invalid token!</h1>
      <p>Token không hợp lệ hoặc phiên nhiệm vụ đã hết hạn. Mỗi phiên chỉ có hiệu lực trong 30 phút.</p>
    </section></main>;
  }

  if (completed) {
    return <main className="callback-page"><section className="callback-card callback-success">
      <span className="callback-symbol">✓</span><p className="eyebrow">MAYMAY · HOÀN TẤT</p>
      <h1>Nhiệm vụ hoàn thành</h1>
      <p>Phần thưởng <b>+{new Intl.NumberFormat("vi-VN").format(Number(completed.reward))}đ</b> đã được ghi vào tài khoản.</p>
      <small>Số dư mới: {new Intl.NumberFormat("vi-VN").format(Number(completed.balance))}đ</small>
    </section></main>;
  }

  return <main className="callback-page"><section className="callback-card">
    <span className="brand-mark">m</span>
    <p className="eyebrow">MAYMAY · XÁC NHẬN NHIỆM VỤ</p>
    <h1>{task ? "Xác nhận hoàn thành" : "Đang kiểm tra phiên"}</h1>
    {task && <div className="callback-task"><b>{task.title}</b><span>Phần thưởng: {new Intl.NumberFormat("vi-VN").format(Number(task.reward))}đ</span></div>}
    {remaining > 0 && <p className="callback-wait">Vui lòng đợi {remaining} giây để đủ thời gian tối thiểu của nhiệm vụ.</p>}
    {task && <TurnstileCaptcha
      action="task_callback"
      onToken={onCaptchaToken}
      onError={onCaptchaError}
      onExpired={onCaptchaExpired}
    />}
    {task && <label className={`slider-demo ${sliderValue === 100 ? "complete" : ""}`}>
      <span className="slider-hint">{sliderValue === 100 ? "Đã xác nhận" : "Kéo thanh trượt sang phải để xác nhận"}</span>
      <input
        aria-label="Kéo thanh trượt sang phải để xác nhận"
        type="range"
        min="0"
        max="100"
        value={sliderValue}
        onChange={(event) => setSliderValue(Number(event.target.value))}
      />
    </label>}
    {error && <p className="admin-form-message error" role="alert">{error}</p>}
    {task && <button className="primary-button callback-submit" type="button" disabled={!captchaToken || sliderValue !== 100 || busy || remaining > 0} onClick={() => void claim()}>
      {busy ? "Đang xác minh…" : remaining > 0 ? `Đợi ${remaining} giây` : "Xác nhận & nhận thưởng"}
    </button>}
    <p className="callback-footnote">Token được ràng buộc với IP khi bắt đầu và hết hạn sau 30 phút.</p>
  </section></main>;
}
