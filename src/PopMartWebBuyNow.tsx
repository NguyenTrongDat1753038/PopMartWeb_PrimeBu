import React, { useEffect, useMemo, useRef, useState } from "react";
// Load initial data from project root via Vite raw import
// Vite allows importing text files with ?raw
// This points to the root-level Data.txt from within src/
import defaultData from "../Data.txt?raw";

const wallpaperUrl = new URL("../img/wallpaper.jpg", import.meta.url).href;
const popmartLogoUrl = new URL("../img/popmart_img.png", import.meta.url).href;

/**
 * Pop Mart BUYNOW Link Builder
 * - Paste or upload a text file where the FIRST LINE is the header:
 *   Name,URL,skuid_single,skuid_set
 *   Example line (after the header):
 *   Labubu V3, https://www.popmart.com/vn/products/6890/THE-MONSTERS-Big-into-Energy-Series-Vinyl-Plush-Pendant-Blind-Box, 10528, 10529
 * - If a SKU column is "null" or empty, that variant will be hidden.
 * - Choose product -> choose variant -> enter quantity (Single max 28, Set max 2) -> Generate link.
 */

// Types
interface ItemRow {
  name: string;
  url: string;
  skuSingle: string | null; // may be null
  skuSet: string | null; // may be null
}

type Variant = "single" | "set";

export default function App() {
  const [rawText, setRawText] = useState<string>("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [variant, setVariant] = useState<Variant | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [generated, setGenerated] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load initial data from bundled Data.txt (?raw)
  useEffect(() => {
    const text = defaultData ?? "";
    setRawText(text);
    const parsed = parseText(text);
    setItems(parsed);
    const idx = parsed.length > 0 ? 0 : -1;
    setSelectedIndex(idx);
    if (idx >= 0) {
      const it = parsed[0];
      const v: Variant | null = it.skuSingle ? "single" : it.skuSet ? "set" : null;
      setVariant(v);
      setQty(v === "set" ? 1 : 1);
    }
    setGenerated("");
  }, []);

  // Parse CSV-ish text (lenient, comma-separated)
  const parseText = (text: string): ItemRow[] => {
    const lines = text
      .split(/\r?\n/) // lines
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) return [];

    const rows: ItemRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Split by commas, but keep URL commas safe by a simple splitter that doesn't break "http,"
      // Our format is simple enough that a naive split works if users don't put commas in the Name.
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 2) continue;

      const name = parts[0] ?? "";
      const url = parts[1] ?? "";
      const skuSingleRaw = parts[2] ?? "";
      const skuSetRaw = parts[3] ?? "";

      const norm = (v: string) => {
        if (!v) return null;
        const s = v.replace(/\s+/g, "");
        if (s.length === 0 || s.toLowerCase() === "null") return null;
        return s; // keep as string
      };

      const skuSingle = norm(skuSingleRaw);
      const skuSet = norm(skuSetRaw);

      // minimal URL sanity
      if (!/^https?:\/\//i.test(url)) continue;

      rows.push({ name, url, skuSingle, skuSet });
    }

    return rows;
  };

  const handleLoad = () => {
    const parsed = parseText(rawText);
    setItems(parsed);
    setSelectedIndex(parsed.length > 0 ? 0 : -1);
    // Set default variant based on availability
    if (parsed.length > 0) {
      const it = parsed[0];
      const v: Variant | null = it.skuSingle ? "single" : it.skuSet ? "set" : null;
      setVariant(v);
      setQty(v === "set" ? 1 : 1);
      setGenerated("");
    }
  };

  const onUploadFile = async (file: File) => {
    const text = await file.text();
    setRawText(text);
    const parsed = parseText(text);
    setItems(parsed);
    setSelectedIndex(parsed.length > 0 ? 0 : -1);
    if (parsed.length > 0) {
      const it = parsed[0];
      const v: Variant | null = it.skuSingle ? "single" : it.skuSet ? "set" : null;
      setVariant(v);
      setQty(v === "set" ? 1 : 1);
      setGenerated("");
    }
  };

  const current = useMemo(() => {
    if (selectedIndex < 0 || selectedIndex >= items.length) return null;
    return items[selectedIndex];
  }, [selectedIndex, items]);

  const maxQty = useMemo(() => {
    if (variant === "single") return 28;
    if (variant === "set") return 2;
    return 1;
  }, [variant]);

  const handleVariantChange = (v: Variant) => {
    setVariant(v);
    setQty(1);
    setGenerated("");
  };

  const clampQty = (value: number) => {
    if (value < 1) return 1;
    if (value > maxQty) return maxQty;
    return value;
  };

  const buildBuyNowLink = (productUrl: string, skuId: string, count: number): string => {
    let spuId = "";
    let spuTitle = "";

    try {
      const u = new URL(productUrl);
      // Expected pattern: /vn/products/{spuId}/{slug}
      const parts = u.pathname.split("/").filter(Boolean);
      // Find the index of "products" and grab the next segment as spuId
      const idx = parts.findIndex((p) => p.toLowerCase() === "products");
      if (idx >= 0 && parts.length > idx + 1) {
        spuId = parts[idx + 1];
      }
      // slug is the last segment
      const slug = parts[parts.length - 1] ?? "";
      spuTitle = slug.toLowerCase();
    } catch (e) {
      throw new Error("URL sản phẩm không hợp lệ");
    }

    if (!spuId) throw new Error("Không tìm thấy spuId trong URL sản phẩm");

    const params = new URLSearchParams({
      spuId: spuId,
      skuId: skuId,
      count: String(count),
      spuTitle: spuTitle,
    });

    return `https://www.popmart.com/vn/order-confirmation?${params.toString()}`;
  };

  const handleGenerate = () => {
    try {
      if (!current) throw new Error("Chưa chọn sản phẩm");
      if (!variant) throw new Error("Chưa chọn phân loại");

      const skuId = variant === "single" ? current.skuSingle : current.skuSet;
      if (!skuId) throw new Error("Phân loại này không có skuId trong danh sách");

      const q = clampQty(qty);
      setQty(q);

      const link = buildBuyNowLink(current.url, skuId, q);
      setGenerated(link);
    } catch (err: any) {
      setGenerated(`Lỗi: ${err?.message ?? String(err)}`);
    }
  };

  const copyToClipboard = async () => {
    if (!generated || generated.startsWith("Lỗi:")) return;
    try {
      await navigator.clipboard.writeText(generated);
      alert("Đã copy link vào clipboard");
    } catch (e) {
      alert("Không thể copy. Hãy copy thủ công ở dưới.");
    }
  };

  return (
    <div
      className="min-h-screen text-neutral-800 p-4 md:p-6 bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url(${wallpaperUrl})` }}
    >

      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 rounded-3xl bg-white/80 backdrop-blur-md shadow-2xl px-4 md:px-8 py-6">
        <header className="py-2">
          <h1 className="text-xl md:text-2xl font-bold text-center">
            <span className="inline-flex items-center justify-center gap-3 px-5 py-3 rounded-2xl bg-white/90 shadow-xl backdrop-blur-sm">
              <span className="sr-only">Pop Mart</span>
              <img
                src={popmartLogoUrl}
                alt="Pop Mart"
                className="h-10 md:h-12 w-auto drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)]"
              />
              <span className="uppercase tracking-wide text-neutral-900">BUYNOW Link Builder</span>
            </span>
          </h1>
          {/* <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-xl bg-white shadow border hover:bg-neutral-50 text-sm"
          >
            Tải file .txt
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadFile(f);
            }}
          /> */}
        </header>

        {/* Paste area */}
        {/* <section className="bg-white rounded-2xl shadow p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Dán nội dung danh sách (dòng 1 là header)</h2>
            <button
              onClick={handleLoad}
              className="px-3 py-2 rounded-xl bg-black text-white text-sm hover:opacity-90"
            >
              Load danh sách
            </button>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={6}
            className="w-full rounded-xl border p-3 font-mono text-sm"
            placeholder={
              "Name,URL,skuid_single,skuid_set\nLabubu V3, https://..., 10528, 10529"
            }
          />
          <p className="text-xs text-neutral-500">
            Ghi chú: Nếu sản phẩm không có một phân loại, đặt giá trị đó là <code>null</code> hoặc để trống.
          </p>
        </section> */}

        {/* Controls */}
        <section className="bg-white rounded-2xl shadow p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="space-y-2 text-sm md:text-base">
              <label className="text-sm font-medium">Chọn sản phẩm</label>
              <select
                value={selectedIndex}
                onChange={(e) => {
                  const idx = parseInt(e.target.value, 10);
                  setSelectedIndex(idx);
                  const it = items[idx];
                  if (it) {
                    const v: Variant | null = it.skuSingle
                      ? "single"
                      : it.skuSet
                      ? "set"
                      : null;
                    setVariant(v);
                    setQty(1);
                    setGenerated("");
                  }
                }}
                className="w-full border rounded-xl p-3 md:p-2"
              >
                <option value={-1}>-- Chưa chọn --</option>
                {items.map((it, idx) => (
                  <option key={idx} value={idx}>
                    {it.name}
                  </option>
                ))}
              </select>
              {current && (
                <p className="text-xs text-neutral-500 break-all">
                  URL: {current.url}
                </p>
              )}
            </div>

            <div className="space-y-2 text-sm md:text-base">
              <label className="text-sm font-medium">Chọn phân loại</label>
              <div className="flex gap-3 items-center">
                <label className={`inline-flex items-center gap-2 ${!current?.skuSingle ? "opacity-40" : ""}`}>
                  <input
                    type="radio"
                    name="variant"
                    disabled={!current?.skuSingle}
                    checked={variant === "single"}
                    onChange={() => handleVariantChange("single")}
                  />
                  <span>Single Box</span>
                </label>
                <label className={`inline-flex items-center gap-2 ${!current?.skuSet ? "opacity-40" : ""}`}>
                  <input
                    type="radio"
                    name="variant"
                    disabled={!current?.skuSet}
                    checked={variant === "set"}
                    onChange={() => handleVariantChange("set")}
                  />
                  <span>Whole Set</span>
                </label>
              </div>
            </div>

            <div className="space-y-2 text-sm md:text-base">
              <label className="text-sm font-medium">Số lượng</label>
              <input
                type="number"
                min={1}
                max={maxQty}
                value={qty}
                onChange={(e) => setQty(clampQty(parseInt(e.target.value || "1", 10)))}
                className="w-full border rounded-xl p-3 md:p-2"
              />
              <p className="text-xs text-neutral-500">
                {variant === "single" && "Tối đa 14 hộp"}
                {variant === "set" && "Tối đa 2 set"}
                {!variant && "Hãy chọn phân loại"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              className="px-4 py-3 md:py-2 rounded-xl bg-emerald-600 text-white text-base md:text-sm hover:opacity-90"
            >
              Tạo link BUYNOW
            </button>
            <button
              onClick={copyToClipboard}
              disabled={!generated || generated.startsWith("Lỗi:")}
              className="px-4 py-3 md:py-2 rounded-xl bg-neutral-900 text-white text-base md:text-sm hover:opacity-90 disabled:opacity-40"
            >
              Copy link
            </button>
          </div>

          <div className="mt-2">
            <label className="text-sm font-medium">Kết quả</label>
            <div className="mt-1 p-3 border rounded-xl bg-neutral-50 break-all">
              {generated ? (
                generated.startsWith("Lỗi:") ? (
                  <span className="text-red-600">{generated}</span>
                ) : (
                  <a href={generated} target="_blank" rel="noreferrer" className="underline">
                    {generated}
                  </a>
                )
              ) : (
                <span className="text-neutral-500">Chưa có link</span>
              )}
            </div>
          </div>
        </section>

        <div className="hidden">
          <p>
            Quy tắc: Link BUYNOW dạng
            <code className="mx-1">/order-confirmation?spuId=...&skuId=...&count=...&spuTitle=...</code>
            . Ứng dụng sẽ tự trích <code>spuId</code> từ đường dẫn dạng
            <code className="mx-1">/products/{"{spuId}"}/{"{slug}"}</code> và chuyển slug thành chữ
            thường làm <code>spuTitle</code>.
          </p>
        </div>
        
      </div>
    </div>
  );
}
