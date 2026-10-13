"use client";

import { useCallback, useState } from "react";
import TurnstileCaptcha from "./components/TurnstileCaptcha";

type PageId =
  | "dashboard"
  | "tasks"
  | "wallet"
  | "leaderboard"
  | "checkin"
  | "profile"
  | "verification"
  | "admin";

const navigation: { id: PageId; label: string; icon: string }[] = [
  { id: "dashboard", label: "Tổng quan", icon: "⌂" },
  { id: "tasks", label: "Nhiệm vụ", icon: "▤" },
  { id: "wallet", label: "Ví & rút tiền", icon: "◈" },
  { id: "leaderboard", label: "Xếp hạng", icon: "♜" },
  { id: "checkin", label: "Điểm danh", icon: "✓" },
  { id: "profile", label: "Tài khoản", icon: "○" },
];

const taskSamples = [
  { title: "Khám phá ứng dụng", detail: "Mở liên kết và hoàn thành các bước", reward: "1.500đ", color: "violet" },
  { title: "Trải nghiệm dịch vụ mới", detail: "Thời gian dự kiến · 1 phút", reward: "2.000đ", color: "blue" },
  { title: "Nhiệm vụ hằng ngày", detail: "Có thể tham gia mỗi ngày", reward: "800đ", color: "orange" },
];

const leaderboard = [
  { name: "Minh Anh", id: "••• 4821", amount: "284.500đ", rank: "01", initials: "MA" },
  { name: "Hoàng Nam", id: "••• 1039", amount: "251.000đ", rank: "02", initials: "HN" },
  { name: "Linh Nguyễn", id: "••• 7742", amount: "198.500đ", rank: "03", initials: "LN" },
  { name: "Bạn", id: "••• 1794", amount: "42.800đ", rank: "18", initials: "B" },
];

export default function Home() {
  const [page, setPage] = useState<PageId>("dashboard");
  const [adminFeature, setAdminFeature] = useState("");
  const [notice, setNotice] = useState("");
  const [blockIds, setBlockIds] = useState(["548210763", "791034528"]);
  const [newBlockId, setNewBlockId] = useState("");
  const [claimed, setClaimed] = useState<string[]>([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [selectedTask, setSelectedTask] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("bank");
  const [autoReview, setAutoReview] = useState(false);

  function toast(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  }

  function claimTask(title: string) {
    if (claimed.includes(title)) {
      toast("Bạn đã nhận thưởng nhiệm vụ này trong bản demo.");
      return;
    }
    setSelectedTask(title);
    setPage("verification");
  }

  function completeTask() {
    if (!selectedTask) return;
    setClaimed((current) => [...current, selectedTask]);
    toast("Đã nhận thưởng demo. Đang chuyển về trang nhiệm vụ…");
    window.setTimeout(() => {
      setPage("tasks");
      setSelectedTask("");
    }, 1500);
  }

  function submitWithdrawal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    toast("Đây là giao diện xem trước — yêu cầu chưa được gửi lên máy chủ.");
  }

  function addBlockId(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = newBlockId.trim();
    if (!/^\d{5,20}$/.test(id)) {
      toast("ID Telegram cần gồm 5–20 chữ số.");
      return;
    }
    if (blockIds.includes(id)) {
      toast("ID này đã có trong blocklist.");
      return;
    }
    setBlockIds((ids) => [id, ...ids]);
    setNewBlockId("");
    toast("Đã thêm vào blocklist demo.");
  }

  const title = navigation.find((item) => item.id === page)?.label ?? (page === "verification" ? "Xác minh nhiệm vụ" : "Quản trị");

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage("dashboard"); }}>
          <span className="brand-mark">m</span>
          <span>maymay<span className="brand-dot">.</span><small>TELEGRAM MINI APP</small></span>
        </a>
        <div className="sidebar-label">MENU CHÍNH</div>
        <nav className="side-nav" aria-label="Điều hướng chính">
          {navigation.map((item) => (
            <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
              {item.id === "tasks" && <span className="nav-count">3</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <button className={`nav-item admin-nav ${page === "admin" ? "active" : ""}`} onClick={() => { setPage("admin"); setAdminFeature(""); }}>
          <span className="nav-icon">⚙</span><span>Quản trị</span><span className="demo-tag">DEMO</span>
        </button>
        <div className="sidebar-user">
          <div className="avatar">B</div><div><b>Người dùng</b><small>Telegram ·••1794</small></div><span className="online-dot" />
        </div>
        <div className="sidebar-foot">Giao diện xem trước · Dữ liệu mẫu</div>
      </aside>

      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb">Ứng dụng <span>/</span> <b>{title}</b></div>
          <div className="top-actions"><span className="preview-pill"><i /> BẢN XEM TRƯỚC</span><button className="icon-button" aria-label="Thông báo" onClick={() => toast("Bạn chưa có thông báo mới.")}>♧<i /></button><div className="top-avatar">B</div></div>
        </header>
        <div className="content">
          {page === "dashboard" && <Dashboard setPage={setPage} toast={toast} />}
          {page === "tasks" && <Tasks claimed={claimed} claimTask={claimTask} />}
          {page === "wallet" && <Wallet amount={withdrawAmount} setAmount={setWithdrawAmount} method={withdrawMethod} setMethod={setWithdrawMethod} onSubmit={submitWithdrawal} />}
          {page === "leaderboard" && <Leaderboard />}
          {page === "checkin" && <Checkin checkedIn={checkedIn} onCheckin={() => { setCheckedIn(true); toast("Điểm danh thành công trong bản demo!"); }} />}
          {page === "profile" && <Profile toast={toast} />}
          {page === "verification" && <Verification taskTitle={selectedTask} onComplete={completeTask} onBack={() => setPage("tasks")} />}
          {page === "admin" && <Admin feature={adminFeature} setFeature={setAdminFeature} blockIds={blockIds} newBlockId={newBlockId} setNewBlockId={setNewBlockId} addBlockId={addBlockId} removeBlockId={(id) => { setBlockIds((ids) => ids.filter((item) => item !== id)); toast("Đã gỡ ID khỏi blocklist demo."); }} autoReview={autoReview} setAutoReview={setAutoReview} toast={toast} />}
        </div>
        <footer className="page-footer"><span>© 2026 Maymay Mini App</span><span><i /> Dữ liệu mẫu — chưa kết nối hệ thống thật</span></footer>
      </section>

      <nav className="bottom-nav" aria-label="Điều hướng di động">
        {navigation.slice(0, 5).map((item) => (
          <button key={item.id} className={page === item.id ? "selected" : ""} onClick={() => setPage(item.id)}>
            <span>{item.icon}</span><small>{item.id === "leaderboard" ? "Xếp hạng" : item.id === "dashboard" ? "Trang chủ" : item.id === "wallet" ? "Ví" : item.label}</small>
          </button>
        ))}
      </nav>
      {notice && <div className="toast" role="status"><span>✦</span>{notice}</div>}
    </main>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="heading-description">{description}</p></div>{action}</div>;
}

function Dashboard({ setPage, toast }: { setPage: (page: PageId) => void; toast: (message: string) => void }) {
  return <>
    <PageHeading eyebrow="THỨ BA, 13 THÁNG 10" title={<>Chào bạn, <span className="gradient-text">Maymay!</span> <span className="wave">✦</span></>} description="Sẵn sàng hoàn thành nhiệm vụ và nhận thêm phần thưởng hôm nay chưa?" action={<button className="outline-button" onClick={() => toast("Thông tin Telegram sẽ được kết nối khi tích hợp xác thực.")}>↗ <span>Mở Telegram</span></button>} />
    <section className="hero-card">
      <div className="hero-copy"><span className="hero-kicker"><i /> TỔNG SỐ DƯ CỦA BẠN</span><div className="hero-balance">42.800<span>đ</span></div><div className="hero-caption">Số dư khả dụng <span className="positive">↗ 12,8%</span><span className="muted"> so với tuần trước</span></div><div className="hero-actions"><button className="primary-button" onClick={() => setPage("tasks")}>Làm nhiệm vụ <span>→</span></button><button className="hero-link" onClick={() => setPage("wallet")}>Rút tiền <span>↗</span></button></div></div>
      <div className="hero-art" aria-hidden="true"><div className="orb orb-one" /><div className="orb orb-two" /><div className="coin coin-one">₫</div><div className="coin coin-two">✦</div><div className="hero-stat"><span>THU NHẬP THÁNG NÀY</span><b>+18.500đ</b><small>↗ Đang tăng trưởng</small></div></div>
    </section>
    <div className="stats-grid">
      <StatCard icon="▤" tone="purple" label="Nhiệm vụ hoàn thành" value="24" note="↑ 4 nhiệm vụ tuần này" />
      <StatCard icon="◷" tone="blue" label="Thời gian hoạt động" value="3,5 giờ" note="Tổng thời gian tham gia" />
      <StatCard icon="♜" tone="orange" label="Thứ hạng của bạn" value="#18" note="↑ Tăng 3 bậc tuần này" />
    </div>
    <div className="section-heading"><div><h2>Nhiệm vụ dành cho bạn</h2><p>Hoàn thành nhiệm vụ để tích lũy phần thưởng</p></div><button className="text-button" onClick={() => setPage("tasks")}>Xem tất cả <span>→</span></button></div>
    <div className="task-preview-grid">{taskSamples.slice(0, 2).map((task, i) => <TaskCard key={task.title} task={task} index={i} claimed={false} onClaim={() => setPage("tasks")} />)}</div>
    <div className="lower-grid">
      <section className="panel checkin-panel"><div className="panel-title"><div><h3>Điểm danh hằng ngày</h3><p>Thêm một chút thưởng mỗi ngày</p></div><span className="streak-badge">✦ 4 NGÀY</span></div><div className="week-row">{["T2","T3","T4","T5","T6","T7","CN"].map((day, i) => <div className={`week-day ${i < 4 ? "done" : i === 4 ? "today" : ""}`} key={day}><span>{i < 4 ? "✓" : i === 4 ? "✦" : "·"}</span><small>{day}</small></div>)}</div><button className="primary-button full-button" onClick={() => setPage("checkin")}>Điểm danh ngay <span>→</span></button></section>
      <section className="panel rank-panel"><div className="panel-title"><div><h3>Bảng xếp hạng</h3><p>Những người chăm chỉ tuần này</p></div><button className="dots-button" onClick={() => setPage("leaderboard")}>•••</button></div><div className="mini-rank">{leaderboard.slice(0, 3).map((user) => <div className="mini-rank-row" key={user.rank}><b className={`rank-number rank-${user.rank}`}>{user.rank}</b><span className="mini-avatar">{user.initials}</span><strong>{user.name}</strong><span className="rank-amount">{user.amount}</span></div>)}</div><button className="text-button rank-all" onClick={() => setPage("leaderboard")}>Xem bảng xếp hạng <span>→</span></button></section>
    </div>
  </>;
}

function StatCard({ icon, tone, label, value, note }: { icon: string; tone: string; label: string; value: string; note: string }) {
  return <article className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><span className="stat-label">{label}</span><b className="stat-value">{value}</b><small>{note}</small></article>;
}

function Tasks({ claimed, claimTask }: { claimed: string[]; claimTask: (title: string) => void }) {
  return <>
    <PageHeading eyebrow="KIẾM THƯỞNG" title="Nhiệm vụ" description="Hoàn thành nhiệm vụ để nhận thưởng vào số dư của bạn." action={<span className="task-available"><i /> 3 NHIỆM VỤ MỚI</span>} />
    <div className="task-summary"><div><span>Thưởng đang chờ</span><b>4.300đ</b></div><div><span>Đã hoàn thành hôm nay</span><b>2 <small>/ 5</small></b></div><div><span>Hạn mức ngày</span><b className="limit-track"><i /></b></div></div>
    <div className="filter-row"><button className="filter-chip active">Tất cả <span>3</span></button><button className="filter-chip">Mới nhất</button><button className="filter-chip">Thưởng cao</button><span className="filter-note">Cập nhật vừa xong</span></div>
    <div className="task-list">{taskSamples.map((task, i) => <TaskCard key={task.title} task={task} index={i} claimed={claimed.includes(task.title)} onClaim={() => claimTask(task.title)} />)}</div>
    <div className="info-banner"><span>✦</span><div><b>Lưu ý khi làm nhiệm vụ</b><p>Chỉ nhận thưởng sau khi hệ thống xác minh hoàn thành. Không đóng trang trong quá trình kiểm tra.</p></div></div>
  </>;
}

function Verification({ taskTitle, onComplete, onBack }: { taskTitle: string; onComplete: () => void; onBack: () => void }) {
  const [captchaPassed, setCaptchaPassed] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(0);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [captchaMessage, setCaptchaMessage] = useState("");
  const [verifyingCaptcha, setVerifyingCaptcha] = useState(false);

  const verifyToken = useCallback(async (token: string) => {
    setVerifyingCaptcha(true);
    setCaptchaMessage("");
    try {
      const response = await fetch("/api/captcha/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result: { verified?: boolean; error?: string } = await response.json();
      if (!response.ok || result.verified !== true) {
        setCaptchaPassed(false);
        setCaptchaMessage(result.error ?? "Captcha chưa được xác minh. Vui lòng thử lại.");
        setCaptchaReset((current) => current + 1);
        return;
      }
      setCaptchaPassed(true);
      setSliderPosition(0);
      setCaptchaMessage("Captcha đã được máy chủ xác minh thành công.");
    } catch {
      setCaptchaPassed(false);
      setCaptchaMessage("Không thể kết nối máy chủ để xác minh captcha.");
      setCaptchaReset((current) => current + 1);
    } finally {
      setVerifyingCaptcha(false);
    }
  }, []);

  const handleCaptchaError = useCallback((message: string) => {
    setCaptchaPassed(false);
    setCaptchaMessage(message);
  }, []);

  const handleCaptchaExpired = useCallback(() => {
    setCaptchaPassed(false);
    setCaptchaMessage("Captcha hết hạn. Hãy xác minh lại.");
    setCaptchaReset((current) => current + 1);
  }, []);

  return <>
    <PageHeading eyebrow="HOÀN THÀNH NHIỆM VỤ" title="Xác minh nhiệm vụ" description="Hoàn tất các bước kiểm tra trước khi gửi yêu cầu nhận thưởng." action={<button className="outline-button" onClick={onBack}>← Quay lại nhiệm vụ</button>} />
    <section className="verify-layout">
      <div className="panel verify-panel">
        <div className="verify-step"><span className="step-number">1</span><div><h3>Kiểm tra nhiệm vụ</h3><p>{taskTitle || "Nhiệm vụ demo"} · thời gian hoàn thành được ghi nhận trong phiên mẫu.</p></div><span className="step-state">ĐÃ MỞ</span></div>
        <div className="verify-separator" />
        <div className="verify-step"><span className={`step-number ${captchaPassed ? "complete" : ""}`}>{captchaPassed ? "✓" : "2"}</span><div><h3>Xác nhận bạn không phải robot</h3><p>Cloudflare Turnstile — token được xác minh phía máy chủ.</p><div className="captcha-widget"><TurnstileCaptcha key={captchaReset} onToken={verifyToken} onError={handleCaptchaError} onExpired={handleCaptchaExpired} /></div>{verifyingCaptcha && <p className="captcha-status">Đang xác minh với Cloudflare…</p>}{captchaMessage && <p className={`captcha-status ${captchaPassed ? "success" : "error"}`} role="status">{captchaMessage}</p>}</div></div>
        <div className="verify-separator" />
        <div className="verify-step"><span className={`step-number ${sliderPosition >= 90 ? "complete" : ""}`}>{sliderPosition >= 90 ? "✓" : "3"}</span><div className="verify-step-content"><h3>Hoàn thành thử thách trượt</h3><p>Kéo thanh trượt sang phải để tiếp tục.</p><div className={`slider-demo ${!captchaPassed ? "disabled" : ""}`}><span className="slider-hint">{sliderPosition >= 90 ? "Đã xác minh ✓" : captchaPassed ? "Kéo để xác minh" : verifyingCaptcha ? "Đang kiểm tra captcha…" : "Hoàn tất captcha trước"}</span><input aria-label="Thanh trượt xác minh demo" type="range" min="0" max="100" value={sliderPosition} disabled={!captchaPassed} onChange={(event) => setSliderPosition(Number(event.target.value))} /></div></div></div>
        <div className="verify-actions"><button className="primary-button full-button" disabled={!captchaPassed || sliderPosition < 90 || verifyingCaptcha} onClick={onComplete}>Nhận thưởng <span>→</span></button><small>Captcha thật đã được kiểm tra; xác nhận nhiệm vụ và phần thưởng vẫn là bản demo.</small></div>
      </div>
      <aside className="panel verify-receipt"><span className="receipt-icon">✦</span><p>PHẦN THƯỞNG</p><h2>+{taskSamples.find((task) => task.title === taskTitle)?.reward ?? "1.500đ"}</h2><span className="receipt-divider" /><div><span>Nhiệm vụ</span><b>{taskTitle || "Nhiệm vụ demo"}</b></div><div><span>Trạng thái</span><b className="receipt-pending">Chờ xác minh</b></div><div><span>Thời gian dự kiến</span><b>~30 giây</b></div><div className="receipt-note">Số dư chỉ được cập nhật sau khi máy chủ xác minh thành công.</div></aside>
    </section>
  </>;
}

function TaskCard({ task, index, claimed, onClaim }: { task: (typeof taskSamples)[number]; index: number; claimed: boolean; onClaim: () => void }) {
  return <article className="task-card"><div className={`task-symbol ${task.color}`}>{index === 0 ? "↗" : index === 1 ? "◉" : "✦"}</div><div className="task-info"><div className="task-card-title">{task.title}{index === 0 && <span className="new-label">MỚI</span>}</div><p>{task.detail}</p><div className="task-meta"><span>◷ {index === 1 ? "1 phút" : "30 giây"}</span><span>⌁ Xác minh tự động</span></div></div><div className="task-card-action"><b>+{task.reward}</b><button className={claimed ? "done-button" : "small-primary"} onClick={onClaim}>{claimed ? "Đã nhận ✓" : "Bắt đầu →"}</button></div></article>;
}

function Wallet({ amount, setAmount, method, setMethod, onSubmit }: { amount: string; setAmount: (amount: string) => void; method: string; setMethod: (method: string) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <>
    <PageHeading eyebrow="QUẢN LÝ SỐ DƯ" title="Ví của bạn" description="Theo dõi số dư và các giao dịch gần đây." />
    <section className="wallet-balance"><div><span>SỐ DƯ KHẢ DỤNG</span><b>42.800<span>đ</span></b><small>Tiền thưởng đã xác minh</small></div><div className="wallet-decoration">◈</div></section>
    <div className="wallet-grid"><section className="panel withdraw-panel"><div className="panel-title"><div><h3>Tạo yêu cầu rút tiền</h3><p>Thông tin nhận tiền chỉ dùng cho yêu cầu này.</p></div></div><form onSubmit={onSubmit} className="withdraw-form"><label>Số tiền muốn rút<div className="input-with-suffix"><input required type="number" min="10000" max="42800" step="1000" placeholder="Nhập số tiền" value={amount} onChange={(event) => setAmount(event.target.value)} /><span>VND</span></div></label><div className="form-hint">Tối thiểu 10.000đ · Khả dụng 42.800đ</div><label>Phương thức nhận tiền</label><div className="method-options"><button type="button" className={method === "bank" ? "method-option selected" : "method-option"} onClick={() => setMethod("bank")}><span>▤</span><b>Ngân hàng</b><small>Chuyển khoản</small></button><button type="button" className={method === "ewallet" ? "method-option selected" : "method-option"} onClick={() => setMethod("ewallet")}><span>◈</span><b>Ví điện tử</b><small>Ví hỗ trợ</small></button></div><label>Thông tin tài khoản<input required placeholder={method === "bank" ? "Tên ngân hàng · Số tài khoản · Chủ tài khoản" : "Tên ví · Số điện thoại"} /></label><button className="primary-button full-button" type="submit">Gửi yêu cầu rút tiền <span>→</span></button><p className="form-disclaimer">Giao diện demo — chưa tạo giao dịch thật.</p></form></section><section className="panel history-panel"><div className="panel-title"><div><h3>Lịch sử giao dịch</h3><p>Các hoạt động gần đây của bạn</p></div><button className="dots-button">•••</button></div><Transaction icon="↗" title="Hoàn thành nhiệm vụ" detail="Hôm nay, 10:42" amount="+1.500đ" positive /><Transaction icon="✓" title="Điểm danh hằng ngày" detail="Hôm nay, 08:15" amount="+300đ" positive /><Transaction icon="↗" title="Hoàn thành nhiệm vụ" detail="Hôm qua, 19:24" amount="+2.000đ" positive /><Transaction icon="⇢" title="Rút tiền về ngân hàng" detail="10 Tháng 10, 14:12" amount="−20.000đ" /><button className="text-button transaction-all">Xem tất cả giao dịch →</button></section></div>
  </>;
}

function Transaction({ icon, title, detail, amount, positive = false }: { icon: string; title: string; detail: string; amount: string; positive?: boolean }) {
  return <div className="transaction"><span className={`transaction-icon ${positive ? "income" : ""}`}>{icon}</span><div><b>{title}</b><small>{detail}</small></div><strong className={positive ? "income-text" : ""}>{amount}</strong></div>;
}

function Leaderboard() {
  return <>
    <PageHeading eyebrow="CỘNG ĐỒNG MAYMAY" title="Bảng xếp hạng" description="Vinh danh những thành viên tích cực nhất tuần này." action={<button className="outline-button">Tuần này⌄</button>} />
    <section className="leaderboard-hero"><div className="leaderboard-spark">✦</div><p>TOP THÀNH VIÊN TUẦN NÀY</p><h2>Cùng nhau chinh phục<br />những cột mốc mới</h2><span>Phần thưởng xếp hạng sẽ được cập nhật định kỳ.</span></section>
    <section className="panel leaderboard-panel"><div className="table-head"><span>HẠNG</span><span>THÀNH VIÊN</span><span>TỔNG THƯỞNG</span></div>{leaderboard.map((user) => <div className={`leaderboard-row ${user.name === "Bạn" ? "your-row" : ""}`} key={user.rank}><b className={`rank-number rank-${user.rank}`}>{user.rank}</b><span className="mini-avatar">{user.initials}</span><div className="leader-name"><strong>{user.name} {user.name === "Bạn" && <small>BẠN</small>}</strong><small>Telegram ID {user.id}</small></div><b className="rank-amount">{user.amount}</b></div>)}</section>
  </>;
}

function Checkin({ checkedIn, onCheckin }: { checkedIn: boolean; onCheckin: () => void }) {
  return <>
    <PageHeading eyebrow="THÓI QUEN TỐT, THƯỞNG MỖI NGÀY" title="Điểm danh" description="Quay lại mỗi ngày để duy trì chuỗi và nhận thưởng." />
    <section className="checkin-hero"><span className="streak-icon">✦</span><p>CHUỖI ĐIỂM DANH HIỆN TẠI</p><h2>4 <small>ngày liên tiếp</small></h2><span className="checkin-reward">Hôm nay nhận <b>+300đ</b></span><button className="primary-button checkin-cta" onClick={onCheckin} disabled={checkedIn}>{checkedIn ? "Đã điểm danh hôm nay ✓" : "Điểm danh ngay →"}</button><small className="demo-caption">Thao tác chỉ mô phỏng trong bản xem trước.</small></section>
    <section className="panel calendar-panel"><div className="panel-title"><div><h3>Lịch sử điểm danh</h3><p>Tháng 10, 2026</p></div><div className="calendar-arrows"><button>‹</button><button>›</button></div></div><div className="calendar-grid calendar-labels">{["T2","T3","T4","T5","T6","T7","CN"].map((d) => <span key={d}>{d}</span>)}</div><div className="calendar-grid">{Array.from({ length: 35 }, (_, i) => { const day = i - 2; return <span key={i} className={`calendar-day ${day > 0 && day < 13 ? "checked" : ""} ${day === 13 ? "current" : ""}`}>{day > 0 && day <= 31 ? day : ""}{day > 0 && day < 13 && <i>✓</i>}</span>; })}</div></section>
    <div className="info-banner"><span>✦</span><div><b>Giữ chuỗi để mở thêm mốc thưởng</b><p>Điểm danh liên tục giúp bạn đạt các cột mốc thưởng đặc biệt theo chính sách hệ thống.</p></div></div>
  </>;
}

function Profile({ toast }: { toast: (message: string) => void }) {
  return <>
    <PageHeading eyebrow="THÔNG TIN CÁ NHÂN" title="Tài khoản" description="Thông tin tài khoản Telegram được dùng để nhận diện bạn." />
    <section className="profile-card"><div className="profile-avatar">B</div><div><h2>Người dùng Maymay</h2><p>@telegram_user · Telegram ID 555041794</p><span className="verified-badge">✓ Đã kết nối Telegram (demo)</span></div><button className="outline-button" onClick={() => toast("Tích hợp liên kết Telegram sẽ được làm ở bước backend.")}>↗ Kết nối</button></section>
    <div className="profile-grid"><section className="panel"><div className="panel-title"><div><h3>Thông tin tài khoản</h3><p>Quản lý thông tin liên hệ của bạn</p></div></div><div className="profile-field"><span>Tên hiển thị</span><b>Người dùng Maymay</b></div><div className="profile-field"><span>Telegram ID</span><b>555041794</b></div><div className="profile-field"><span>Số điện thoại</span><b>Chưa xác minh <button className="inline-link" onClick={() => toast("Xác minh sẽ chỉ hoạt động khi kết nối Telegram backend.")}>Xác minh</button></b></div><div className="profile-field"><span>Ngày tham gia</span><b>Tháng 10, 2026</b></div></section><section className="panel"><div className="panel-title"><div><h3>Bảo mật & hỗ trợ</h3><p>Thông tin về phiên của bạn</p></div></div><div className="security-row"><span className="security-symbol">⌁</span><div><b>Phiên đăng nhập</b><small>Telegram Mini App · Thiết bị hiện tại</small></div><span className="session-ip">IP demo</span></div><div className="security-row"><span className="security-symbol">♧</span><div><b>Trung tâm trợ giúp</b><small>Câu hỏi thường gặp và hỗ trợ</small></div><button className="inline-link" onClick={() => toast("Kênh hỗ trợ sẽ được cấu hình sau.")}>Mở →</button></div><button className="danger-outline" onClick={() => toast("Đăng xuất Telegram cần tích hợp phiên xác thực thật.")}>Đăng xuất</button></section></div>
  </>;
}

const adminFeatures = [
  { id: "overview", icon: "▦", title: "Tổng quan", detail: "Số liệu vận hành" },
  { id: "tasks", icon: "▤", title: "Quản lý nhiệm vụ", detail: "Tạo và chỉnh sửa" },
  { id: "auto", icon: "◎", title: "Cài đặt tự duyệt", detail: "Captcha và xác minh" },
  { id: "blocklist", icon: "⊘", title: "Blocklist", detail: "Chặn ID người dùng" },
  { id: "withdrawals", icon: "⇢", title: "Yêu cầu rút tiền", detail: "Duyệt giao dịch" },
  { id: "settings", icon: "⚙", title: "Cài đặt hệ thống", detail: "Cấu hình chung" },
];

function Admin({ feature, setFeature, blockIds, newBlockId, setNewBlockId, addBlockId, removeBlockId, autoReview, setAutoReview, toast }: { feature: string; setFeature: (feature: string) => void; blockIds: string[]; newBlockId: string; setNewBlockId: (id: string) => void; addBlockId: (event: React.FormEvent<HTMLFormElement>) => void; removeBlockId: (id: string) => void; autoReview: boolean; setAutoReview: (value: boolean) => void; toast: (message: string) => void }) {
  const activeTitle = adminFeatures.find((item) => item.id === feature)?.title;
  return <>
    <PageHeading eyebrow="KHU VỰC QUẢN TRỊ · BẢN DEMO" title="Admin panel" description="Chọn từng tính năng để mở khu vực quản lý tương ứng." action={feature ? <button className="outline-button" onClick={() => setFeature("")}>← Tất cả tính năng</button> : undefined} />
    <div className="admin-warning"><span>⚠</span><p><b>Chỉ là giao diện mẫu:</b> phần này chưa có xác thực admin phía máy chủ. Không dùng dữ liệu mẫu để vận hành thật.</p></div>
    {!feature ? <><div className="section-heading admin-section-heading"><div><h2>Chọn tính năng</h2><p>Mỗi nút mở riêng một khu vực quản trị</p></div></div><div className="admin-feature-grid">{adminFeatures.map((item) => <button className="admin-feature-button" key={item.id} onClick={() => setFeature(item.id)}><span className="admin-feature-icon">{item.icon}</span><span><b>{item.title}</b><small>{item.detail}</small></span><span className="feature-arrow">→</span></button>)}</div></> : <section className="panel admin-detail"><div className="panel-title"><div><p className="eyebrow">QUẢN TRỊ MAYMAY</p><h3>{activeTitle}</h3></div></div>
      {feature === "overview" && <div className="stats-grid admin-stats"><StatCard icon="♙" tone="purple" label="Người dùng" value="1.284" note="Dữ liệu minh họa" /><StatCard icon="▤" tone="blue" label="Nhiệm vụ đang chạy" value="12" note="Dữ liệu minh họa" /><StatCard icon="⇢" tone="orange" label="Chờ duyệt rút tiền" value="08" note="Dữ liệu minh họa" /></div>}
      {feature === "tasks" && <><div className="admin-subhead"><p>Danh sách và tạo nhiệm vụ mới.</p><button className="primary-button" onClick={() => toast("Biểu mẫu lưu nhiệm vụ sẽ kết nối API ở bước backend.")}>＋ Tạo nhiệm vụ</button></div><div className="admin-table"><div className="admin-table-head"><span>TÊN NHIỆM VỤ</span><span>THƯỞNG</span><span>TRẠNG THÁI</span><span>HÀNH ĐỘNG</span></div>{taskSamples.map((task) => <div className="admin-table-row" key={task.title}><b>{task.title}</b><span>{task.reward}</span><span className="active-state">● Đang chạy</span><button onClick={() => toast("Chỉnh sửa chưa kết nối backend.")}>•••</button></div>)}</div><div className="task-editor"><h4>Thông tin nhiệm vụ mới</h4><div className="editor-grid"><label>Tên nhiệm vụ<input placeholder="Ví dụ: Trải nghiệm ứng dụng" /></label><label>Mức thưởng (VND)<input type="number" placeholder="1500" /></label><label className="wide-field">URL đích<input type="url" placeholder="https://example.com" /></label><label className="wide-field">GET request của nguồn <span className="optional">Tùy nguồn</span><input placeholder="Bỏ trống nếu nhà cung cấp không yêu cầu" /></label></div><p className="form-hint">API key của nhà cung cấp phải được lưu phía máy chủ, không nhập ở đây.</p></div></>}
      {feature === "auto" && <>
        <div className="admin-subhead"><p>Cấu hình kiểm tra hoàn thành nhiệm vụ.</p></div>
        <div className="setting-row"><div><b>Bật tự duyệt</b><small>Công tắc minh họa — chưa bật quy trình duyệt thưởng thật.</small></div><button className={`toggle ${autoReview ? "on" : ""}`} onClick={() => setAutoReview(!autoReview)} aria-label="Bật hoặc tắt tự duyệt demo"><i /></button></div>
        <div className="setting-row"><div><b>Cloudflare Turnstile</b><small>Widget thật được xác minh ở /api/captcha/verify.</small></div><span className="config-state">CẤU HÌNH RAILWAY</span></div>
        <div className="info-banner"><span>i</span><div><b>Cấu hình khóa qua Railway Variables</b><p>Đặt NEXT_PUBLIC_TURNSTILE_SITE_KEY và TURNSTILE_SECRET_KEY ở Railway rồi redeploy. Không nhập secret tại trình duyệt. Xem hướng dẫn chi tiết trong README.</p></div></div>
        <div className="setting-row"><div><b>Thử thách kéo xác minh</b><small>Chỉ là bước giao diện demo, không thay thế captcha hoặc xác minh máy chủ.</small></div><span className="config-state">DEMO</span></div>
      </>}
      {feature === "blocklist" && <><div className="admin-subhead"><p>Quản lý ID người dùng bị hạn chế.</p><span className="count-badge">{blockIds.length} người dùng</span></div><form className="block-add-form" onSubmit={addBlockId}><label htmlFor="block-id">Telegram ID người dùng</label><div><input id="block-id" inputMode="numeric" pattern="[0-9]{5,20}" placeholder="Nhập Telegram ID" value={newBlockId} onChange={(event) => setNewBlockId(event.target.value)} /><button className="primary-button" type="submit">＋ Thêm vào blocklist</button></div></form><div className="admin-table block-table"><div className="admin-table-head"><span>TELEGRAM ID</span><span>LÝ DO</span><span>NGÀY THÊM</span><span></span></div>{blockIds.map((id, i) => <div className="admin-table-row" key={id}><b>{id}</b><span>{i === 0 ? "Hoạt động bất thường" : "Vi phạm quy định"}</span><span>12/10/2026</span><button className="remove-button" onClick={() => removeBlockId(id)}>Gỡ</button></div>)}</div></>}
      {feature === "withdrawals" && <><div className="admin-subhead"><p>Kiểm tra các yêu cầu đang chờ xử lý.</p><span className="count-badge">2 đang chờ</span></div><div className="admin-table"><div className="admin-table-head"><span>NGƯỜI DÙNG</span><span>SỐ TIỀN</span><span>TRẠNG THÁI</span><span>HÀNH ĐỘNG</span></div>{[["Telegram ••4821","50.000đ"],["Telegram ••1039","25.000đ"]].map(([user, amount]) => <div className="admin-table-row" key={user}><b>{user}</b><span>{amount}</span><span className="pending-state">● Chờ duyệt</span><button className="review-button" onClick={() => toast("Duyệt/từ chối sẽ cần API có phân quyền.")}>Xem</button></div>)}</div></>}
      {feature === "settings" && <><div className="admin-subhead"><p>Cấu hình dùng chung cho ứng dụng (bản xem trước).</p></div><div className="setting-row"><div><b>Giới hạn nhiệm vụ mỗi ngày</b><small>Số lượt tối đa trên mỗi tài khoản.</small></div><input className="setting-input" type="number" defaultValue="5" /></div><div className="setting-row"><div><b>Thời gian tối thiểu</b><small>Số giây trước khi cho phép xác minh.</small></div><input className="setting-input" type="number" defaultValue="30" /></div><div className="setting-row"><div><b>Hạn mức rút tối thiểu</b><small>Đơn vị: VND.</small></div><input className="setting-input" type="number" defaultValue="10000" /></div><button className="primary-button save-settings" onClick={() => toast("Cài đặt chưa được lưu lên máy chủ.")}>Lưu cài đặt</button></>}
    </section>}
  </>;
}
