"use client";

import { useEffect, useState } from "react";
import AdminTasks from "./components/AdminTasks";

type PageId = "dashboard" | "tasks" | "wallet" | "leaderboard" | "checkin" | "profile" | "admin";
type AuthState = "loading" | "ready" | "error";

type AppTask = {
  id: string;
  title: string;
  description: string | null;
  reward: string;
  minDurationSec: number;
  provider: string;
};

type TransactionRecord = {
  id: string;
  type: string;
  amount: string;
  createdAt: string;
};

type AppUser = {
  telegramId: string;
  username: string | null;
  balance: string;
  isAdmin: boolean;
  transactions: TransactionRecord[];
};

const navigation: { id: PageId; label: string; icon: string }[] = [
  { id: "dashboard", label: "Tổng quan", icon: "⌂" },
  { id: "tasks", label: "Nhiệm vụ", icon: "▤" },
  { id: "wallet", label: "Ví & rút tiền", icon: "◈" },
  { id: "leaderboard", label: "Xếp hạng", icon: "♜" },
  { id: "checkin", label: "Điểm danh", icon: "✓" },
  { id: "profile", label: "Tài khoản", icon: "○" },
];

export default function Home() {
  const [page, setPage] = useState<PageId>("dashboard");
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authError, setAuthError] = useState("");
  const [user, setUser] = useState<AppUser | null>(null);
  const [tasks, setTasks] = useState<AppTask[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function authenticate() {
      try {
        for (let attempt = 0; attempt < 30 && !window.Telegram?.WebApp; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 100));
        }

        const webApp = window.Telegram?.WebApp;
        if (!webApp?.initData) {
          throw new Error("Hãy mở ứng dụng từ nút Mini App trong Telegram.");
        }

        webApp.ready();
        webApp.expand();

        const loginResponse = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: webApp.initData }),
        });
        const loginResult: { error?: string } = await loginResponse.json();
        if (!loginResponse.ok) {
          throw new Error(loginResult.error ?? "Không thể xác minh Telegram.");
        }

        const meResponse = await fetch("/api/me", { cache: "no-store" });
        const meResult: { error?: string; user?: AppUser; tasks?: AppTask[] } =
          await meResponse.json();
        if (!meResponse.ok || !meResult.user || !meResult.tasks) {
          throw new Error(meResult.error ?? "Không thể tải dữ liệu ứng dụng.");
        }

        if (!cancelled) {
          setUser(meResult.user);
          setTasks(meResult.tasks);
          setAuthState("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : "Đăng nhập không thành công.");
          setAuthState("error");
        }
      }
    }

    void authenticate();
    return () => {
      cancelled = true;
    };
  }, []);

  if (authState !== "ready" || !user) {
    return <AuthGate loading={authState === "loading"} error={authError} />;
  }

  const title = navigation.find((item) => item.id === page)?.label ?? "Quản lý nhiệm vụ";
  const initial = (user.username ?? "T").slice(0, 1).toUpperCase();
  const mobileNavigation = user.isAdmin
    ? [
        navigation[0],
        navigation[1],
        navigation[2],
        navigation[5],
        { id: "admin" as const, label: "Quản trị", icon: "⚙" },
      ]
    : [navigation[0], navigation[1], navigation[2], navigation[3], navigation[5]];

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
              {item.id === "tasks" && <span className="nav-count">{tasks.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        {user.isAdmin && <button className={`nav-item admin-nav ${page === "admin" ? "active" : ""}`} onClick={() => setPage("admin")}>
          <span className="nav-icon">⚙</span><span>Quản trị</span>
        </button>}
        <div className="sidebar-user">
          <div className="avatar">{initial}</div>
          <div><b>{user.username ?? "Telegram user"}</b><small>Telegram · {user.telegramId}</small></div>
          <span className="online-dot" />
        </div>
        <div className="sidebar-foot">Đã xác thực Telegram</div>
      </aside>

      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb">Ứng dụng <span>/</span> <b>{title}</b></div>
          <div className="top-actions"><span className="preview-pill"><i /> ĐÃ KẾT NỐI</span><div className="top-avatar">{initial}</div></div>
        </header>
        <div className="content">
          {page === "dashboard" && <Dashboard user={user} tasks={tasks} setPage={setPage} />}
          {page === "tasks" && <Tasks tasks={tasks} />}
          {page === "wallet" && <Wallet balance={user.balance} transactions={user.transactions} />}
          {page === "leaderboard" && <ComingSoon title="Bảng xếp hạng" description="Bảng xếp hạng sẽ hiển thị sau khi có dữ liệu giao dịch tổng hợp thật." />}
          {page === "checkin" && <ComingSoon title="Điểm danh" description="Tính năng điểm danh chưa được nối API, nên hiện chưa thể ghi nhận thưởng." />}
          {page === "profile" && <Profile user={user} />}
          {page === "admin" && user.isAdmin && <AdminTasks />}
        </div>
        <footer className="page-footer"><span>© 2026 Maymay Mini App</span><span><i /> Telegram đã xác thực · PostgreSQL</span></footer>
      </section>

      <nav className="bottom-nav" aria-label="Điều hướng di động">
        {mobileNavigation.map((item) => (
          <button key={item.id} className={page === item.id ? "selected" : ""} onClick={() => setPage(item.id)}>
            <span>{item.icon}</span><small>{item.id === "dashboard" ? "Trang chủ" : item.id === "wallet" ? "Ví" : item.label}</small>
          </button>
        ))}
      </nav>
    </main>
  );
}

function AuthGate({ loading, error }: { loading: boolean; error: string }) {
  return <main className="page auth-page"><section className="card auth-card">
    <span className="brand-mark">m</span>
    <p className="eyebrow">MAYMAY · TELEGRAM MINI APP</p>
    <h1>{loading ? "Đang kết nối tài khoản" : "Chưa thể mở ứng dụng"}</h1>
    <p className="description">{loading ? "Đang xác minh Telegram và tải dữ liệu từ PostgreSQL…" : error}</p>
    {!loading && <p className="auth-help">Hãy mở ứng dụng từ Telegram. Nếu lỗi cấu hình, kiểm tra Railway Variables và PostgreSQL service.</p>}
  </section></main>;
}

function ComingSoon({ title, description }: { title: string; description: string }) {
  return <>
    <PageHeading eyebrow="MAYMAY" title={title} description={description} />
    <section className="panel empty-state"><span>◷</span><h2>Tính năng chưa được kích hoạt</h2><p>Ứng dụng sẽ chỉ hiển thị dữ liệu đã lưu thật; phần này sẽ mở khi API và quy trình máy chủ hoàn tất.</p></section>
  </>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: React.ReactNode; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="heading-description">{description}</p></div>{action}</div>;
}

function formatVnd(amount: string): string {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return "—";
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(parsed)}đ`;
}

function Dashboard({ user, tasks, setPage }: { user: AppUser; tasks: AppTask[]; setPage: (page: PageId) => void }) {
  const name = user.username ?? "bạn";
  return <>
    <PageHeading eyebrow={`TELEGRAM ID · ${user.telegramId}`} title={<>Xin chào, <span className="gradient-text">{name}!</span></>} description="Tài khoản đã xác minh. Thông tin số dư và nhiệm vụ được tải từ PostgreSQL." />
    <section className="hero-card">
      <div className="hero-copy"><span className="hero-kicker"><i /> SỐ DƯ TỪ LEDGER</span><div className="hero-balance">{formatVnd(user.balance)}</div><div className="hero-caption">Số dư được lấy từ tài khoản của bạn trong cơ sở dữ liệu.</div><div className="hero-actions"><button className="primary-button" onClick={() => setPage("tasks")}>Xem nhiệm vụ <span>→</span></button><button className="hero-link" onClick={() => setPage("wallet")}>Ví của tôi <span>↗</span></button></div></div>
      <div className="hero-art" aria-hidden="true"><div className="orb orb-one" /><div className="orb orb-two" /><div className="coin coin-one">₫</div><div className="coin coin-two">✦</div></div>
    </section>
    <div className="stats-grid">
      <StatCard icon="▤" tone="purple" label="Nhiệm vụ khả dụng" value={String(tasks.length)} note="Đọc trực tiếp từ PostgreSQL" />
      <StatCard icon="◷" tone="blue" label="Giao dịch gần đây" value={String(user.transactions.length)} note="Các bản ghi mới nhất trong ledger" />
      <StatCard icon="♙" tone="orange" label="Trạng thái tài khoản" value="Đã xác minh" note={`Telegram · ${user.telegramId}`} />
    </div>
    <div className="section-heading"><div><h2>Nhiệm vụ dành cho bạn</h2><p>Danh sách nhiệm vụ đang hoạt động trong database</p></div><button className="text-button" onClick={() => setPage("tasks")}>Xem tất cả <span>→</span></button></div>
    {tasks.length > 0 ? <div className="task-preview-grid">{tasks.slice(0, 2).map((task, index) => <DatabaseTaskCard key={task.id} task={task} index={index} />)}</div> : <section className="panel empty-inline"><span>▤</span><p>Chưa có nhiệm vụ đang hoạt động trong cơ sở dữ liệu.</p></section>}
    <div className="lower-grid">
      <section className="panel"><div className="panel-title"><div><h3>Giao dịch gần đây</h3><p>Đọc từ ledger PostgreSQL</p></div></div>{user.transactions.length ? user.transactions.slice(0, 4).map((transaction) => <Transaction key={transaction.id} transaction={transaction} />) : <p className="empty-copy">Chưa có giao dịch nào được ghi nhận.</p>}</section>
      <section className="panel"><div className="panel-title"><div><h3>Nhiệm vụ & xác minh</h3><p>Trạng thái tích hợp</p></div></div><p className="empty-copy">Tài khoản và danh sách nhiệm vụ đã nối database. Luồng link rút gọn, callback và ghi thưởng cần triển khai phía máy chủ.</p><button className="text-button rank-all" onClick={() => setPage("tasks")}>Mở danh sách nhiệm vụ <span>→</span></button></section>
    </div>
  </>;
}

function StatCard({ icon, tone, label, value, note }: { icon: string; tone: string; label: string; value: string; note: string }) {
  return <article className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><span className="stat-label">{label}</span><b className="stat-value">{value}</b><small>{note}</small></article>;
}

function Tasks({ tasks }: { tasks: AppTask[] }) {
  return <>
    <PageHeading eyebrow="DỮ LIỆU TỪ POSTGRESQL" title="Nhiệm vụ" description="Danh sách này được tải từ các nhiệm vụ đang hoạt động trong database." action={<span className="task-available"><i /> {tasks.length} NHIỆM VỤ</span>} />
    {tasks.length ? <div className="task-list">{tasks.map((task, index) => <DatabaseTaskCard key={task.id} task={task} index={index} />)}</div> : <section className="panel empty-state"><span>▤</span><h2>Chưa có nhiệm vụ</h2><p>Khi quản trị viên tạo nhiệm vụ trong PostgreSQL, chúng sẽ xuất hiện ở đây.</p></section>}
    <div className="info-banner"><span>i</span><div><b>Chưa thể bắt đầu nhiệm vụ</b><p>Đang hoàn thiện adapter nhà cung cấp link và callback xác minh. Chưa có phần thưởng nào được ghi nhận.</p></div></div>
  </>;
}

function DatabaseTaskCard({ task, index }: { task: AppTask; index: number }) {
  const colors = ["violet", "blue", "orange"];
  const icons = ["↗", "◉", "✦"];
  return <article className="task-card"><div className={`task-symbol ${colors[index % colors.length]}`}>{icons[index % icons.length]}</div><div className="task-info"><div className="task-card-title">{task.title}</div><p>{task.description ?? `Nhà cung cấp: ${task.provider}`}</p><div className="task-meta"><span>◷ {task.minDurationSec} giây tối thiểu</span><span>⌁ {task.provider}</span></div></div><div className="task-card-action"><b>+{formatVnd(task.reward)}</b><button className="small-primary" disabled title="Cần tích hợp nhà cung cấp link và callback">Chưa mở</button></div></article>;
}

function Wallet({ balance, transactions }: { balance: string; transactions: TransactionRecord[] }) {
  return <>
    <PageHeading eyebrow="DỮ LIỆU TÀI KHOẢN" title="Ví của bạn" description="Số dư và giao dịch được đọc từ tài khoản của bạn trong PostgreSQL." />
    <section className="wallet-balance"><div><span>SỐ DƯ KHẢ DỤNG</span><b>{formatVnd(balance)}</b><small>Số dư lưu trên tài khoản</small></div><div className="wallet-decoration">◈</div></section>
    <div className="wallet-grid">
      <section className="panel"><div className="panel-title"><div><h3>Rút tiền</h3><p>Chưa bật giao dịch rút tiền thật.</p></div></div><div className="info-banner"><span>i</span><div><b>Chưa thể tạo yêu cầu rút</b><p>Cần API giữ số dư, tạo yêu cầu và admin duyệt trong transaction PostgreSQL trước khi bật chức năng này.</p></div></div></section>
      <section className="panel history-panel"><div className="panel-title"><div><h3>Lịch sử giao dịch</h3><p>Các bản ghi mới nhất trong ledger</p></div></div>{transactions.length ? transactions.map((transaction) => <Transaction key={transaction.id} transaction={transaction} />) : <p className="empty-copy">Chưa có giao dịch trong ledger.</p>}</section>
    </div>
  </>;
}

function Transaction({ transaction }: { transaction: TransactionRecord }) {
  const positive = Number(transaction.amount) > 0;
  return <div className="transaction"><span className={`transaction-icon ${positive ? "income" : ""}`}>{positive ? "↗" : "⇢"}</span><div><b>{transaction.type}</b><small>{new Date(transaction.createdAt).toLocaleString("vi-VN")}</small></div><strong className={positive ? "income-text" : ""}>{formatVnd(transaction.amount)}</strong></div>;
}

function Profile({ user }: { user: AppUser }) {
  return <>
    <PageHeading eyebrow="TÀI KHOẢN ĐÃ XÁC THỰC" title="Tài khoản" description="Thông tin định danh được xác minh từ Telegram và lưu trong PostgreSQL." />
    <section className="profile-card"><div className="profile-avatar">{(user.username ?? "T").slice(0, 1).toUpperCase()}</div><div><h2>{user.username ?? "Telegram user"}</h2><p>Telegram ID {user.telegramId}</p><span className="verified-badge">✓ Telegram initData hợp lệ</span></div></section>
    <div className="profile-grid">
      <section className="panel"><div className="panel-title"><div><h3>Thông tin tài khoản</h3><p>Dữ liệu hồ sơ hiện có</p></div></div><div className="profile-field"><span>Tên Telegram</span><b>{user.username ?? "Chưa đặt username"}</b></div><div className="profile-field"><span>Telegram ID</span><b>{user.telegramId}</b></div><div className="profile-field"><span>Quyền quản trị</span><b>{user.isAdmin ? "Được cấp" : "Người dùng"}</b></div><div className="profile-field"><span>Số dư</span><b>{formatVnd(user.balance)}</b></div></section>
      <section className="panel"><div className="panel-title"><div><h3>Phiên đăng nhập</h3><p>Cookie phiên được ký phía máy chủ</p></div></div><div className="security-row"><span className="security-symbol">✓</span><div><b>Telegram Mini App</b><small>Thông tin tài khoản được đọc qua API đã xác thực.</small></div></div><div className="info-banner"><span>i</span><div><b>Không chia sẻ liên kết đăng nhập</b><p>Phiên đăng nhập lưu trong cookie HttpOnly và tự hết hạn sau 7 ngày.</p></div></div></section>
    </div>
  </>;
}
