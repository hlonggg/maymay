"use client";

import { useCallback, useEffect, useState } from "react";
import AdminTasks from "./AdminTasks";

type Section = "overview" | "users" | "tasks" | "withdrawals" | "blocklist" | "activity" | "settings";
type ApiMessage = { error?: string };

type UserRow = {
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  balance: string;
  blockedAt: string | null;
  createdAt: string;
};

type WithdrawalRow = {
  id: string;
  telegramId: string;
  username: string | null;
  amount: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  payoutDetails: unknown;
  hasReservedBalance: boolean;
  createdAt: string;
  reviewedAt: string | null;
};

type ActivityRow = {
  id: string;
  actorId: string | null;
  action: string;
  subjectId: string | null;
  metadata: unknown;
  createdAt: string;
};

type OverviewData = {
  stats: {
    users: number;
    blockedUsers: number;
    tasks: number;
    activeTasks: number;
    pendingWithdrawals: number;
    pendingWithdrawalAmount: string;
  };
  configuration: Record<string, boolean>;
  activity: ActivityRow[];
};

const sections: { id: Section; title: string; icon: string }[] = [
  { id: "overview", title: "Tổng quan", icon: "▦" },
  { id: "users", title: "Người dùng", icon: "♙" },
  { id: "tasks", title: "Nhiệm vụ", icon: "▤" },
  { id: "withdrawals", title: "Rút tiền", icon: "◈" },
  { id: "blocklist", title: "Chặn tài khoản", icon: "⊘" },
  { id: "activity", title: "Nhật ký", icon: "≡" },
  { id: "settings", title: "Cấu hình", icon: "⚙" },
];

async function readJson<T>(response: Response): Promise<T & ApiMessage> {
  const data = await response.json() as T & ApiMessage;
  if (!response.ok) throw new Error(data.error ?? "Yêu cầu quản trị thất bại.");
  return data;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" })
    .format(new Date(value));
}

function formatMoney(value: string): string {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value))}đ`;
}

export default function AdminPanel() {
  const [section, setSection] = useState<Section>("overview");
  const title = sections.find((item) => item.id === section)?.title ?? "Quản trị";

  return <>
    <div className="page-heading">
      <div>
        <p className="eyebrow">MAYMAY · ADMIN</p>
        <h1>{title}</h1>
        <p className="heading-description">Quản trị dữ liệu ứng dụng và hoạt động người dùng.</p>
      </div>
    </div>
    <nav className="admin-section-nav" aria-label="Các trang quản trị">
      {sections.map((item) => (
        <button
          key={item.id}
          type="button"
          className={section === item.id ? "selected" : ""}
          onClick={() => setSection(item.id)}
        >
          <span>{item.icon}</span>{item.title}
        </button>
      ))}
    </nav>
    <div className="admin-section-content" key={section}>
      {section === "overview" && <Overview />}
      {section === "users" && <Users blockedOnly={false} />}
      {section === "tasks" && <AdminTasks />}
      {section === "withdrawals" && <Withdrawals />}
      {section === "blocklist" && <Users blockedOnly />}
      {section === "activity" && <Activity />}
      {section === "settings" && <Settings />}
    </div>
  </>;
}

function useAdminData<T>(url: string): { data: T | null; loading: boolean; error: string } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(url, { cache: "no-store" });
        const result = await readJson<T>(response);
        if (!cancelled) setData(result);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [url]);

  return { data, loading, error };
}

function Overview() {
  const { data, loading, error } = useAdminData<OverviewData>("/api/admin/overview");
  if (loading) return <p className="empty-copy">Đang tải số liệu quản trị…</p>;
  if (error || !data) return <p className="admin-form-message error" role="alert">{error || "Không có dữ liệu."}</p>;

  const stats = [
    ["Tổng người dùng", String(data.stats.users)],
    ["Tài khoản bị chặn", String(data.stats.blockedUsers)],
    ["Tổng nhiệm vụ", String(data.stats.tasks)],
    ["Nhiệm vụ đang hoạt động", String(data.stats.activeTasks)],
    ["Yêu cầu rút chờ duyệt", String(data.stats.pendingWithdrawals)],
    ["Tổng tiền chờ duyệt", formatMoney(data.stats.pendingWithdrawalAmount)],
  ];

  return <>
    <div className="admin-overview-grid">
      {stats.map(([label, value]) => <section className="panel admin-metric" key={label}>
        <span>{label}</span><b>{value}</b>
      </section>)}
    </div>
    <section className="panel admin-data-panel">
      <div className="panel-title"><div><h3>Hoạt động gần đây</h3><p>Nhật ký quản trị mới nhất</p></div></div>
      <ActivityTable rows={data.activity} />
    </section>
  </>;
}

function Users({ blockedOnly }: { blockedOnly: boolean }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (query) params.set("search", query);
        const response = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
        const result = await readJson<{ users: UserRow[] }>(response);
        if (!cancelled) setRows(result.users);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Không thể tải người dùng.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [query]);

  async function setBlocked(user: UserRow) {
    const blocked = !user.blockedAt;
    if (!window.confirm(blocked
      ? `Chặn tài khoản Telegram ${user.telegramId}?`
      : `Bỏ chặn tài khoản Telegram ${user.telegramId}?`)) return;

    setUpdatingId(user.telegramId);
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId: user.telegramId, blocked }),
      });
      const result = await readJson<{ user: { telegramId: string; blockedAt: string | null } }>(response);
      setRows((current) => current.map((row) => row.telegramId === user.telegramId
        ? { ...row, blockedAt: result.user.blockedAt }
        : row));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Không thể cập nhật tài khoản.");
    } finally {
      setUpdatingId("");
    }
  }

  const visible = rows.filter((row) => !blockedOnly || row.blockedAt);

  return <section className="panel admin-data-panel">
    <div className="admin-subhead">
      <p>{blockedOnly ? "Tài khoản bị chặn trong PostgreSQL" : "100 tài khoản gần nhất"}</p>
      {!blockedOnly && <form className="admin-search" onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); }}>
        <input aria-label="Tìm người dùng" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Telegram ID hoặc username" />
        <button className="secondary-button" type="submit">Tìm</button>
      </form>}
    </div>
    {error && <p className="admin-form-message error" role="alert">{error}</p>}
    {loading ? <p className="empty-copy">Đang tải người dùng…</p> : visible.length === 0
      ? <p className="empty-copy">{blockedOnly ? "Không có tài khoản nào bị chặn." : "Không tìm thấy người dùng."}</p>
      : <div className="admin-table">
        <div className="admin-table-head admin-user-row"><span>TELEGRAM</span><span>SỐ DƯ</span><span>THAM GIA</span><span>TRẠNG THÁI</span><span></span></div>
        {visible.map((row) => <div className="admin-table-row admin-user-row" key={row.telegramId}>
          <span><b>{row.username ? `@${row.username}` : row.firstName || "Người dùng"}</b><small>{row.telegramId}</small></span>
          <span>{formatMoney(row.balance)}</span>
          <span>{formatDate(row.createdAt)}</span>
          <span className={row.blockedAt ? "remove-button" : "active-state"}>{row.blockedAt ? "Đã chặn" : "Hoạt động"}</span>
          <button type="button" disabled={updatingId === row.telegramId} onClick={() => void setBlocked(row)}>
            {updatingId === row.telegramId ? "Đang lưu…" : row.blockedAt ? "Bỏ chặn" : "Chặn"}
          </button>
        </div>)}
      </div>}
  </section>;
}

function Withdrawals() {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/withdrawals", { cache: "no-store" });
      const result = await readJson<{ withdrawals: WithdrawalRow[] }>(response);
      setRows(result.withdrawals);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải yêu cầu rút tiền.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function review(row: WithdrawalRow, status: "APPROVED" | "REJECTED") {
    const verb = status === "APPROVED" ? "đã chuyển tiền bên ngoài" : "từ chối và hoàn số dư";
    if (!window.confirm(`Xác nhận ${verb} cho yêu cầu ${row.id} (${formatMoney(row.amount)})?`)) return;
    setUpdatingId(row.id);
    setError("");
    try {
      const response = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, status }),
      });
      await readJson<{ withdrawal: { id: string; status: string } }>(response);
      await reload();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Không thể cập nhật yêu cầu.");
    } finally {
      setUpdatingId("");
    }
  }

  return <>
    <div className="admin-warning"><span>i</span><p>Duyệt chỉ đánh dấu đã thanh toán bên ngoài. Từ chối sẽ hoàn tiền chỉ khi có bút toán giữ số dư hợp lệ.</p></div>
    <section className="panel admin-data-panel">
      <div className="panel-title"><div><h3>Yêu cầu rút tiền</h3><p>Các yêu cầu gần nhất</p></div></div>
      {error && <p className="admin-form-message error" role="alert">{error}</p>}
      {loading ? <p className="empty-copy">Đang tải yêu cầu…</p> : rows.length === 0
        ? <p className="empty-copy">Chưa có yêu cầu rút tiền trong database.</p>
        : <div className="withdrawal-list">{rows.map((row) => <article className="withdrawal-card" key={row.id}>
          <div className="withdrawal-heading"><div><b>{row.username ?? row.telegramId}</b><small>Telegram {row.telegramId} · {formatDate(row.createdAt)}</small></div><strong>{formatMoney(row.amount)}</strong></div>
          <pre>{JSON.stringify(row.payoutDetails, null, 2)}</pre>
          <div className="withdrawal-actions">
            <span className={row.status === "APPROVED" ? "active-state" : row.status === "REJECTED" ? "remove-button" : "pending-state"}>{row.status}</span>
            {row.status === "PENDING" && <>
              {!row.hasReservedBalance && <small className="admin-form-message error">Chưa có bút toán giữ tiền hợp lệ; thao tác bị khóa.</small>}
              <button type="button" className="secondary-button" disabled={!row.hasReservedBalance || updatingId === row.id} onClick={() => void review(row, "APPROVED")}>Đã chuyển tiền</button>
              <button type="button" className="danger-outline" disabled={!row.hasReservedBalance || updatingId === row.id} onClick={() => void review(row, "REJECTED")}>Từ chối & hoàn</button>
            </>}
          </div>
        </article>)}</div>}
    </section>
  </>;
}

function Activity() {
  const { data, loading, error } = useAdminData<{ activity: ActivityRow[] }>("/api/admin/activity");
  if (loading) return <p className="empty-copy">Đang tải nhật ký…</p>;
  if (error || !data) return <p className="admin-form-message error" role="alert">{error || "Không có dữ liệu."}</p>;
  return <section className="panel admin-data-panel">
    <div className="panel-title"><div><h3>Nhật ký quản trị</h3><p>100 sự kiện gần nhất</p></div></div>
    <ActivityTable rows={data.activity} showDetails />
  </section>;
}

function ActivityTable({ rows, showDetails = false }: { rows: ActivityRow[]; showDetails?: boolean }) {
  if (rows.length === 0) return <p className="empty-copy">Chưa có hoạt động được ghi lại.</p>;
  return <div className="admin-table">
    <div className={`admin-table-head admin-activity-row ${showDetails ? "with-details" : ""}`}><span>THỜI GIAN</span><span>THAO TÁC</span><span>QUẢN TRỊ VIÊN</span><span>MỤC TIÊU</span>{showDetails && <span>CHI TIẾT</span>}</div>
    {rows.map((row) => <div className={`admin-table-row admin-activity-row ${showDetails ? "with-details" : ""}`} key={row.id}>
      <span>{formatDate(row.createdAt)}</span><b>{row.action}</b><span>{row.actorId ?? "—"}</span><span>{row.subjectId ?? "—"}</span>
      {showDetails && <span>{row.metadata ? JSON.stringify(row.metadata) : "—"}</span>}
    </div>)}
  </div>;
}

function Settings() {
  const { data, loading, error } = useAdminData<OverviewData>("/api/admin/overview");
  const [callbackRefererDomain, setCallbackRefererDomain] = useState("");
  const [settingLoading, setSettingLoading] = useState(true);
  const [settingError, setSettingError] = useState("");
  const [settingSuccess, setSettingSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadSetting() {
      try {
        const response = await fetch("/api/admin/settings", { cache: "no-store" });
        const result = await readJson<{ callbackRefererDomain: string }>(response);
        if (!cancelled) setCallbackRefererDomain(result.callbackRefererDomain);
      } catch (loadError) {
        if (!cancelled) setSettingError(loadError instanceof Error ? loadError.message : "Không thể tải domain callback.");
      } finally {
        if (!cancelled) setSettingLoading(false);
      }
    }
    void loadSetting();
    return () => { cancelled = true; };
  }, []);

  async function saveCallbackDomains(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSettingError("");
    setSettingSuccess("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackRefererDomain }),
      });
      const result = await readJson<{ callbackRefererDomain: string }>(response);
      setCallbackRefererDomain(result.callbackRefererDomain);
      setSettingSuccess(result.callbackRefererDomain
        ? "Đã lưu các domain nguồn callback."
        : "Đã xóa danh sách domain; callback sẽ bị từ chối cho tới khi cấu hình lại.");
    } catch (saveError) {
      setSettingError(saveError instanceof Error ? saveError.message : "Không thể lưu domain callback.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || settingLoading) return <p className="empty-copy">Đang kiểm tra cấu hình…</p>;
  if (error || !data) return <p className="admin-form-message error" role="alert">{error || "Không có dữ liệu."}</p>;
  const labels: Record<string, string> = {
    telegramBot: "Telegram Bot Token",
    database: "PostgreSQL Database URL",
    sessionSecret: "Khóa ký session",
    miniAppUrl: "Mini App HTTPS URL",
    turnstile: "Cloudflare Turnstile",
  };
  return <>
    <section className="panel admin-data-panel">
      <div className="panel-title"><div><h3>Domain nguồn callback</h3><p>Chỉ nhận lượt quay về có HTTP Referer đúng hostname đã khai báo.</p></div></div>
      <form className="callback-domain-form" onSubmit={saveCallbackDomains}>
        <label htmlFor="callback-referer-domain">Hostname các domain cuối chuyển người dùng về (phân tách bằng dấu chấm phẩy)</label>
        <textarea
          id="callback-referer-domain"
          value={callbackRefererDomain}
          onChange={(event) => setCallbackRefererDomain(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="link4m.com; gtraffic.io; layma.net"
        />
        <small>Nhập hostname, không ghi https:// hay đường dẫn. Callback bị từ chối nếu thiếu hoặc không khớp Referer.</small>
        <button className="primary-button" type="submit" disabled={saving}>{saving ? "Đang lưu…" : "Lưu domain"}</button>
      </form>
      {settingError && <p className="admin-form-message error" role="alert">{settingError}</p>}
      {settingSuccess && <p className="admin-form-message success" role="status">{settingSuccess}</p>}
    </section>
    <section className="panel admin-data-panel">
      <div className="panel-title"><div><h3>Trạng thái cấu hình</h3><p>Chỉ hiển thị trạng thái có/thiếu; giá trị bí mật không được tiết lộ.</p></div></div>
      {Object.entries(data.configuration).map(([key, configured]) => <div className="setting-row" key={key}>
        <div><b>{labels[key] ?? key}</b><small>Quản lý giá trị trong Railway Variables.</small></div>
        <span className={configured ? "active-state" : "pending-state"}>{configured ? "ĐÃ CẤU HÌNH" : "CHƯA CẤU HÌNH"}</span>
      </div>)}
    </section>
  </>;
}
