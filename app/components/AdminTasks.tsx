"use client";

import { FormEvent, useEffect, useState } from "react";

type AdminTask = {
  id: string;
  title: string;
  description: string | null;
  destinationUrl: string;
  provider: string;
  reward: string;
  status: string;
  minDurationSec: number;
  createdAt: string;
};

export default function AdminTasks() {
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      try {
        const response = await fetch("/api/admin/tasks", { cache: "no-store" });
        const result: { tasks?: AdminTask[]; error?: string } = await response.json();
        if (!response.ok || !result.tasks) {
          throw new Error(result.error ?? "Không thể tải danh sách nhiệm vụ.");
        }
        if (!cancelled) setTasks(result.tasks);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Không thể tải nhiệm vụ.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTasks();
    return () => {
      cancelled = true;
    };
  }, []);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    setError("");
    setSuccess("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      title: formData.get("title"),
      description: formData.get("description"),
      destinationUrl: formData.get("destinationUrl"),
      provider: formData.get("provider"),
      reward: formData.get("reward"),
      minDurationSec: formData.get("minDurationSec"),
    };

    try {
      const response = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: { task?: AdminTask; error?: string } = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Không thể lưu nhiệm vụ.");
      }
      if (!result.task) {
        throw new Error("Máy chủ không trả về nhiệm vụ vừa tạo.");
      }
      const createdTask = result.task;
      setTasks((current) => [createdTask, ...current]);
      form.reset();
      setSuccess("Đã lưu nhiệm vụ vào PostgreSQL. Nhiệm vụ đang tạm dừng.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu nhiệm vụ.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTaskStatus(task: AdminTask) {
    const status = task.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    if (status === "ACTIVE" && !window.confirm(
      "Chỉ kích hoạt nếu URL provider nhận callback_url và chuyển người dùng về đúng URL đó khi hoàn tất. Kích hoạt nhiệm vụ?",
    )) return;

    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status }),
      });
      const result: { task?: { id: string; status: string }; error?: string } = await response.json();
      if (!response.ok || !result.task) {
        throw new Error(result.error ?? "Không thể cập nhật nhiệm vụ.");
      }
      const updatedTask = result.task;
      setTasks((current) => current.map((item) => item.id === updatedTask.id
        ? { ...item, status: updatedTask.status }
        : item));
      setSuccess(status === "ACTIVE" ? "Đã kích hoạt nhiệm vụ." : "Đã tạm dừng nhiệm vụ.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Không thể cập nhật nhiệm vụ.");
    }
  }

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">QUẢN TRỊ · DỮ LIỆU THẬT</p><h1>Quản lý nhiệm vụ</h1><p className="heading-description">Mỗi phiên được lưu trên PostgreSQL; provider cần nhận tham số callback_url để quay lại trang xác nhận trên trình duyệt.</p></div>
    </div>
    <div className="admin-warning"><span>i</span><p>Nhiệm vụ mới luôn ở trạng thái <b>PAUSED</b>. Chỉ kích hoạt nếu URL provider hỗ trợ tham số <b>callback_url</b> và chuyển trình duyệt người dùng tới URL này sau khi hoàn tất.</p></div>
    <section className="panel task-editor real-task-editor">
      <h2>Tạo nhiệm vụ</h2>
      <form className="editor-grid" onSubmit={createTask}>
        <label>Tên nhiệm vụ<input name="title" required minLength={3} maxLength={100} placeholder="Ví dụ: Trải nghiệm ứng dụng" /></label>
        <label>Nhà cung cấp<input name="provider" required minLength={2} maxLength={40} pattern="[a-zA-Z0-9_-]+" placeholder="Ví dụ: link4m" /></label>
        <label className="wide-field">URL provider (HTTPS, nhận callback_url)<input name="destinationUrl" required type="url" placeholder="https://provider.example/create-link" /></label>
        <label>Mức thưởng (VND)<input name="reward" required type="number" min={1} max={1000000} step={1} placeholder="1500" /></label>
        <label>Thời gian tối thiểu (giây)<input name="minDurationSec" required type="number" min={0} max={86400} step={1} defaultValue={30} /></label>
        <label className="wide-field">Mô tả<textarea name="description" maxLength={500} placeholder="Mô tả ngắn cho người dùng" /></label>
        <div className="wide-field"><button className="primary-button" type="submit" disabled={saving}>{saving ? "Đang lưu…" : "Lưu nhiệm vụ"}</button></div>
      </form>
      {error && <p className="admin-form-message error" role="alert">{error}</p>}
      {success && <p className="admin-form-message success" role="status">{success}</p>}
    </section>
    <section className="panel real-task-list">
      <div className="panel-title"><div><h3>Nhiệm vụ đã lưu</h3><p>{tasks.length} bản ghi gần nhất</p></div></div>
      {loading ? <p className="empty-copy">Đang tải từ PostgreSQL…</p> : tasks.length === 0 ? <p className="empty-copy">Chưa có nhiệm vụ nào trong database.</p> : <div className="admin-table"><div className="admin-table-head admin-task-row"><span>TÊN NHIỆM VỤ</span><span>THƯỞNG</span><span>TRẠNG THÁI</span><span>NHÀ CUNG CẤP</span><span></span></div>{tasks.map((task) => <div className="admin-table-row admin-task-row" key={task.id}><b>{task.title}</b><span>{new Intl.NumberFormat("vi-VN").format(Number(task.reward))}đ</span><span className={task.status === "ACTIVE" ? "active-state" : "pending-state"}>● {task.status}</span><span>{task.provider}</span><button type="button" disabled={task.status === "ARCHIVED"} onClick={() => void updateTaskStatus(task)}>{task.status === "ACTIVE" ? "Tạm dừng" : task.status === "PAUSED" ? "Kích hoạt" : "Đã lưu trữ"}</button></div>)}</div>}
    </section>
  </>;
}
