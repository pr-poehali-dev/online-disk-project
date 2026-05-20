import { useState, useRef, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";

type Page = "home" | "upload" | "files";

interface FileItem {
  id: string;
  name: string;
  size: number;
  mime_type: string;
  shared: boolean;
  share_token?: string;
  created_at: string;
}

const API_UPLOAD = "https://functions.poehali.dev/94290466-4cfc-4f2d-a557-972f80d884af";
const API_LIST = "https://functions.poehali.dev/4f7f5f03-b426-4537-b544-841e547d62ca";
const API_DELETE = "https://functions.poehali.dev/1f89adf4-3099-43e2-9cee-45da626d0219";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} ГБ`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function getFileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "file";
}

function getFileColor(name: string): string {
  const ext = getFileExt(name);
  const map: Record<string, string> = {
    pptx: "#ff6b35", ppt: "#ff6b35",
    xlsx: "#00cc6a", xls: "#00cc6a", csv: "#00cc6a",
    jpg: "#4d9fff", jpeg: "#4d9fff", png: "#4d9fff", gif: "#4d9fff", webp: "#4d9fff",
    pdf: "#ff4d4d",
    zip: "#a855f7", rar: "#a855f7", "7z": "#a855f7",
    mp4: "#f59e0b", mov: "#f59e0b", avi: "#f59e0b",
    doc: "#3b82f6", docx: "#3b82f6",
    mp3: "#ec4899", wav: "#ec4899",
  };
  return map[ext] || "#8b9cbe";
}

function getFileIcon(name: string): string {
  const ext = getFileExt(name);
  if (["jpg","jpeg","png","gif","webp","svg"].includes(ext)) return "Image";
  if (["mp4","mov","avi","mkv"].includes(ext)) return "Video";
  if (["mp3","wav","flac","ogg"].includes(ext)) return "Music";
  if (["zip","rar","7z","tar","gz"].includes(ext)) return "Archive";
  if (["pdf"].includes(ext)) return "FileText";
  if (["doc","docx"].includes(ext)) return "FileText";
  if (["xls","xlsx","csv"].includes(ext)) return "FileSpreadsheet";
  if (["ppt","pptx"].includes(ext)) return "FilePresentation";
  return "File";
}

export default function Index() {
  const [page, setPage] = useState<Page>("home");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadingName, setUploadingName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FileItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_LIST);
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      showNotification("Ошибка загрузки файлов");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (page === "files") loadFiles();
  }, [page]);

  const uploadFile = async (file: File) => {
    setUploadingName(file.name);
    setUploadProgress(10);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      setUploadProgress(40);
      try {
        const res = await fetch(API_UPLOAD, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: base64, name: file.name, mime_type: file.type || "application/octet-stream" }),
        });
        setUploadProgress(90);
        if (!res.ok) throw new Error("upload failed");
        setUploadProgress(100);
        setTimeout(() => {
          setUploadProgress(null);
          setUploadingName("");
          showNotification("Файл успешно загружен!");
          setPage("files");
        }, 500);
      } catch {
        setUploadProgress(null);
        setUploadingName("");
        showNotification("Ошибка при загрузке файла");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleShare = (fileId: string, fileName: string) => {
    const link = `${window.location.origin}/s/${Math.random().toString(36).slice(2, 8)}`;
    setFiles(f => f.map(file => file.id === fileId ? { ...file, shared: true, share_token: link } : file));
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopiedId(fileId);
    showNotification(`Ссылка на «${fileName}» скопирована!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyLink = (file: FileItem) => {
    navigator.clipboard?.writeText(file.share_token || "").catch(() => {});
    setCopiedId(file.id);
    showNotification("Ссылка скопирована в буфер обмена!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (file: FileItem) => setDeleteConfirm(file);

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await fetch(`${API_DELETE}?id=${deleteConfirm.id}`, { method: "DELETE" });
      setFiles(f => f.filter(file => file.id !== deleteConfirm.id));
      showNotification(`«${deleteConfirm.name}» удалён`);
    } catch {
      showNotification("Ошибка при удалении");
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const sharedCount = files.filter(f => f.shared).length;

  return (
    <div className="min-h-screen bg-mesh">
      {/* Notification */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 animate-scale-in">
          <div className="glass px-5 py-3 rounded-xl flex items-center gap-3" style={{ borderColor: "rgba(0,255,136,0.4)", boxShadow: "0 0 20px rgba(0,255,136,0.15)" }}>
            <Icon name="CheckCircle" size={18} style={{ color: "var(--neon-green)" }} />
            <span className="text-sm font-medium">{notification}</span>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-40 glass border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setPage("home")}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center animate-pulse-glow" style={{ background: "linear-gradient(135deg, var(--neon-green), var(--neon-blue))" }}>
              <Icon name="Cloud" size={16} className="text-black" />
            </div>
            <span className="font-bold text-lg tracking-wide" style={{ fontFamily: "Oswald, sans-serif" }}>
              AMS<span style={{ color: "var(--neon-green)" }}>Drive</span>
            </span>
          </div>

          <div className="flex items-center gap-1 glass rounded-xl p-1">
            {(["home", "upload", "files"] as Page[]).map((p) => {
              const labels: Record<Page, string> = { home: "Главная", upload: "Загрузка", files: "Мои файлы" };
              const icons: Record<Page, string> = { home: "Home", upload: "Upload", files: "FolderOpen" };
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    page === p ? "text-black" : "text-white/50 hover:text-white/80"
                  }`}
                  style={page === p ? { background: "var(--neon-green)", boxShadow: "0 0 15px rgba(0,255,136,0.4)" } : {}}
                >
                  <Icon name={icons[p]} size={14} />
                  <span className="hidden sm:inline">{labels[p]}</span>
                </button>
              );
            })}
          </div>

          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "linear-gradient(135deg, var(--neon-blue), var(--neon-purple))", color: "white" }}>
            А
          </div>
        </div>
      </nav>

      {/* HOME PAGE */}
      {page === "home" && (
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-24 animate-fade-in">
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-sm mb-8" style={{ borderColor: "rgba(0,255,136,0.3)", color: "var(--neon-green)" }}>
              <Icon name="Zap" size={14} />
              <span>Новое поколение хранилища</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-bold leading-tight mb-6 tracking-tight">
              Храни.{" "}
              <span className="neon-text">Делись.</span>
              <br />
              Управляй.
            </h1>
            <p className="text-xl text-white/50 max-w-xl mx-auto mb-10 leading-relaxed">
              Облачное хранилище нового уровня. Загружай файлы и мгновенно делись ссылками с кем угодно.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <button
                onClick={() => setPage("upload")}
                className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200 hover:scale-105"
                style={{ background: "var(--neon-green)", color: "#0a0e14", boxShadow: "0 0 30px rgba(0,255,136,0.4)" }}
              >
                <Icon name="Upload" size={18} />
                Загрузить файл
              </button>
              <button
                onClick={() => setPage("files")}
                className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base glass glass-hover"
              >
                <Icon name="FolderOpen" size={18} />
                Мои файлы
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-24 animate-fade-in delay-200">
            {[
              { val: "15 ГБ", label: "Место в хранилище", icon: "HardDrive", color: "var(--neon-green)" },
              { val: `${files.length}`, label: "Файлов загружено", icon: "Files", color: "var(--neon-blue)" },
              { val: `${sharedCount}`, label: "Поделились ссылками", icon: "Share2", color: "var(--neon-purple)" },
            ].map((stat, i) => (
              <div key={i} className="glass glass-hover rounded-2xl p-6 text-center">
                <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: `${stat.color}18` }}>
                  <Icon name={stat.icon} size={20} style={{ color: stat.color }} />
                </div>
                <div className="text-3xl font-bold mb-1" style={{ fontFamily: "Oswald, sans-serif", color: stat.color }}>{stat.val}</div>
                <div className="text-sm text-white/40">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-6 animate-fade-in delay-300">
            {[
              { icon: "Upload", title: "Быстрая загрузка", desc: "Drag & drop или выбор файла. Поддержка любых форматов до 2 ГБ.", color: "var(--neon-green)" },
              { icon: "Link", title: "Ссылки для шаринга", desc: "Одним кликом создай ссылку и отправь любому человеку без регистрации.", color: "var(--neon-blue)" },
              { icon: "Shield", title: "Надёжное хранение", desc: "Файлы хранятся в зашифрованном виде и доступны 24/7 из любой точки мира.", color: "var(--neon-purple)" },
            ].map((feat, i) => (
              <div key={i} className="glass glass-hover rounded-2xl p-7">
                <div className="w-12 h-12 rounded-xl mb-5 flex items-center justify-center" style={{ background: `${feat.color}15` }}>
                  <Icon name={feat.icon} size={22} style={{ color: feat.color }} />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.03em" }}>{feat.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UPLOAD PAGE */}
      {page === "upload" && (
        <div className="max-w-2xl mx-auto px-6 py-20">
          <div className="animate-fade-in text-center mb-12">
            <h2 className="text-5xl font-bold mb-3" style={{ fontFamily: "Oswald, sans-serif" }}>
              Загрузить <span className="neon-text">файл</span>
            </h2>
            <p className="text-white/40">Перетащи файл или выбери с устройства</p>
          </div>

          <div
            className={`glass rounded-3xl p-16 text-center cursor-pointer transition-all duration-300 animate-fade-in delay-100 ${isDragging ? "neon-border scale-[1.02]" : "hover:border-white/20"}`}
            style={isDragging ? { background: "rgba(0,255,136,0.05)", boxShadow: "0 0 40px rgba(0,255,136,0.15)" } : {}}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => uploadProgress === null && fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
            <div className={`w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center ${isDragging ? "animate-pulse-glow" : "animate-float"}`}
              style={{ background: isDragging ? "rgba(0,255,136,0.2)" : "rgba(0,255,136,0.08)" }}>
              <Icon name={uploadProgress !== null ? "Loader" : "Upload"} size={36} style={{ color: "var(--neon-green)" }} />
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: "Oswald, sans-serif" }}>
              {uploadProgress !== null ? "Загружаем..." : isDragging ? "Отпусти файл здесь" : "Перетащи файл сюда"}
            </h3>
            <p className="text-white/40 text-sm mb-6">или нажми для выбора</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {["PDF", "JPG", "PNG", "MP4", "ZIP", "DOCX"].map(ext => (
                <span key={ext} className="text-xs px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                  {ext}
                </span>
              ))}
            </div>
          </div>

          {uploadProgress !== null && (
            <div className="glass rounded-2xl p-6 mt-6 animate-scale-in">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,255,136,0.1)" }}>
                  <Icon name="File" size={18} style={{ color: "var(--neon-green)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{uploadingName}</div>
                  <div className="text-xs text-white/40 mt-0.5">{uploadProgress < 100 ? "Загрузка..." : "Завершено!"}</div>
                </div>
                <span className="text-sm font-bold" style={{ color: "var(--neon-green)" }}>{Math.round(Math.min(uploadProgress, 100))}%</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full progress-bar" style={{ width: `${Math.min(uploadProgress, 100)}%` }} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mt-8 animate-fade-in delay-300">
            {[
              { icon: "HardDrive", text: "До 2 ГБ за один файл", color: "var(--neon-blue)" },
              { icon: "Lock", text: "Зашифровано и безопасно", color: "var(--neon-green)" },
              { icon: "Link", text: "Ссылки для шаринга", color: "var(--neon-purple)" },
              { icon: "Clock", text: "Хранение без срока", color: "#f59e0b" },
            ].map((tip, i) => (
              <div key={i} className="glass rounded-xl p-4 flex items-center gap-3">
                <Icon name={tip.icon} size={16} style={{ color: tip.color }} />
                <span className="text-sm text-white/60">{tip.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FILES PAGE */}
      {page === "files" && (
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex items-center justify-between mb-10 animate-fade-in">
            <div>
              <h2 className="text-5xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>
                Мои <span className="neon-text">файлы</span>
              </h2>
              <p className="text-white/40 mt-1">{files.length} файлов · {formatSize(totalSize)}</p>
            </div>
            <button
              onClick={() => setPage("upload")}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105"
              style={{ background: "var(--neon-green)", color: "#0a0e14", boxShadow: "0 0 20px rgba(0,255,136,0.3)" }}
            >
              <Icon name="Plus" size={16} />
              Загрузить
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse-glow" style={{ background: "rgba(0,255,136,0.1)" }}>
                  <Icon name="Loader" size={24} style={{ color: "var(--neon-green)" }} />
                </div>
                <span className="text-white/40 text-sm">Загружаем файлы...</span>
              </div>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 animate-fade-in">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6" style={{ background: "rgba(0,255,136,0.06)" }}>
                <Icon name="FolderOpen" size={36} style={{ color: "rgba(0,255,136,0.4)" }} />
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: "Oswald, sans-serif" }}>Файлов пока нет</h3>
              <p className="text-white/35 text-sm mb-6">Загрузи свой первый файл</p>
              <button
                onClick={() => setPage("upload")}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105"
                style={{ background: "var(--neon-green)", color: "#0a0e14" }}
              >
                <Icon name="Upload" size={16} />
                Загрузить файл
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {files.map((file, i) => (
                <div
                  key={file.id}
                  className="glass glass-hover rounded-2xl p-5 animate-fade-in"
                  style={{ animationDelay: `${i * 0.05}s`, animationFillMode: "both", opacity: 0 }}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${getFileColor(file.name)}18` }}>
                      <Icon name={getFileIcon(file.name)} size={22} style={{ color: getFileColor(file.name) }} fallback="File" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-tight">{file.name}</p>
                      <p className="text-xs text-white/35 mt-1">{formatSize(file.size)} · {formatDate(file.created_at)}</p>
                    </div>
                    {file.shared && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,255,136,0.15)" }}>
                        <Icon name="Share2" size={10} style={{ color: "var(--neon-green)" }} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {file.shared ? (
                      <button
                        onClick={() => copyLink(file)}
                        className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: copiedId === file.id ? "rgba(0,255,136,0.15)" : "rgba(0,255,136,0.08)",
                          color: "var(--neon-green)",
                          border: "1px solid rgba(0,255,136,0.2)"
                        }}
                      >
                        <Icon name={copiedId === file.id ? "Check" : "Copy"} size={12} />
                        {copiedId === file.id ? "Скопировано!" : "Скопировать ссылку"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleShare(file.id, file.name)}
                        className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-xs font-medium glass transition-all hover:border-white/20"
                        style={{ color: "rgba(255,255,255,0.6)" }}
                      >
                        <Icon name="Share2" size={12} />
                        Поделиться
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(file)}
                      className="w-8 h-8 rounded-lg glass flex items-center justify-center transition-all hover:border-red-500/30 hover:text-red-400 text-white/40"
                    >
                      <Icon name="Trash2" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
          <div className="glass rounded-2xl p-8 max-w-sm w-full animate-scale-in" style={{ borderColor: "rgba(255,77,77,0.3)", boxShadow: "0 0 40px rgba(255,77,77,0.1)" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(255,77,77,0.1)" }}>
              <Icon name="Trash2" size={26} style={{ color: "#ff4d4d" }} />
            </div>
            <h3 className="text-xl font-bold text-center mb-2" style={{ fontFamily: "Oswald, sans-serif" }}>Удалить файл?</h3>
            <p className="text-white/50 text-sm text-center mb-6 leading-relaxed">
              «<span className="text-white/80">{deleteConfirm.name}</span>» будет удалён безвозвратно
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold glass transition-all hover:border-white/20 disabled:opacity-50"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                Отмена
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#ff4d4d", color: "white", boxShadow: "0 0 20px rgba(255,77,77,0.3)" }}
              >
                {deleting ? <Icon name="Loader" size={14} /> : <Icon name="Trash2" size={14} />}
                {deleting ? "Удаляем..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
