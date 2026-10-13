"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileWidgetId = string;

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "dark";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => TurnstileWidgetId;
  remove: (widgetId: TurnstileWidgetId) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type Props = {
  action?: string;
  onToken: (token: string) => void;
  onError: (message: string) => void;
  onExpired: () => void;
};

const scriptId = "cloudflare-turnstile-script";

export default function TurnstileCaptcha({
  action = "task_claim",
  onToken,
  onError,
  onExpired,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const [loadError, setLoadError] = useState("");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) {
      setLoadError("Thiếu NEXT_PUBLIC_TURNSTILE_SITE_KEY trong cấu hình Railway.");
      return;
    }

    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || !containerRef.current || widgetIdRef.current) return;
      if (!window.turnstile) {
        setLoadError("Cloudflare không khởi tạo được captcha. Hãy tải lại trang.");
        onError("Cloudflare không khởi tạo được captcha.");
        return;
      }

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme: "dark",
          callback: onToken,
          "expired-callback": onExpired,
          "error-callback": () => onError("Không thể tải captcha. Hãy thử tải lại trang."),
        });
      } catch {
        setLoadError("Không thể khởi tạo captcha. Hãy tải lại trang.");
      }
    };

    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (window.turnstile) {
      renderWidget();
    } else if (script) {
      script.addEventListener("load", renderWidget);
      script.addEventListener("error", handleScriptError);
    } else {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderWidget);
      script.addEventListener("error", handleScriptError);
      document.head.appendChild(script);
    }

    function handleScriptError() {
      setLoadError("Không tải được captcha từ Cloudflare. Kiểm tra kết nối rồi thử lại.");
      onError("Không tải được captcha từ Cloudflare.");
    }

    return () => {
      cancelled = true;
      script?.removeEventListener("load", renderWidget);
      script?.removeEventListener("error", handleScriptError);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, action, onToken, onError, onExpired]);

  return (
    <div className="turnstile-wrap">
      <div ref={containerRef} />
      {loadError && <p className="captcha-error" role="alert">{loadError}</p>}
    </div>
  );
}
