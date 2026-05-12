import { useState, useRef, useCallback } from "react";
import './index.css';

// ============ Constants ============
const CATS = ["상의","하의","원피스","아우터","신발","가방","모자","액세서리","수영복","실내복","기타"];
const SEASONS = ["SS (봄/여름)","FW (가을/겨울)","사계절"];
const GENDERS = ["여아","남아","공용"];
const STYLES_P = ["캐주얼","포멀","스포티","러블리","모던","클래식","스트릿","내추럴","빈티지","미니멀"];
const MATS_P = ["면","폴리","린넨","니트","데님","레이스","쉬폰","벨벳","코듀로이","패딩","기모","메쉬"];

let _nextId = 1;
function mkProduct(imageUrl, fn) {
  return {
    id: String(_nextId++), imageUrl, name: "", category: "", season: "",
    targetGender: "", mainColor: "#FFFFFF", subColors: [],
    styleTags: [], materialTags: [], designKeywords: [],
    price: undefined, memo: "", aiAnalysis: null, _fn: fn, _done: false
  };
}

// ============ Image resize ============
function resizeImg(dataUrl, maxW = 384, maxH = 384, q = 0.6) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxW || h > maxH) { const r = Math.min(maxW / w, maxH / h); w = Math.round(w * r); h = Math.round(h * r); }
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", q));
    };
    img.src = dataUrl;
  });
}

// ============ API helper (via Netlify Function) ============
https://github.com/76anna/ozkiz-styling-map/edit/main/src/App.jsx
  });
  if (!res.ok) {
    let msg = "API " + res.status;
    try { var e = await res.json(); msg = e.error || msg; } catch (_) {}
    throw new Error(msg);
  }
  return await res.json();
}
// ============ Colors ============
const C = {
  bg: "#FAFAF8", surface: "#FFFFFF", surfaceAlt: "#F5F3EF",
  border: "#E8E4DC", borderLight: "#F0EDE6",
  text: "#1A1917", textSec: "#6B6860", textTer: "#9E998F",
  accent: "#E8572A", accentLight: "#FFF0EB", accentHover: "#D14A20",
  mint: "#2DB89A", mintLight: "#E8F8F4",
  navy: "#2C3E6B", navyLight: "#EDF0F7",
  gold: "#D4A234", goldLight: "#FDF6E3",
  pink: "#E85D8A", pinkLight: "#FDF0F4",
};

// ============ Toast ============
function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast-msg">{msg}</div>;
}

// ============ Main App ============
export default function App() {
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState("products");
  const [toast, setToast] = useState("");
  const [coordResult, setCoordResult] = useState(null);
  const [coordLoading, setCoordLoading] = useState(false);
  const [coordError, setCoordError] = useState("");
  const [analyzing, setAnalyzing] = useState(null);
  const [batchProgress, setBatchProgress] = useState(null);
  const fileRef = useRef();

  const showToast = useCallback((m) => { setToast(m); setTimeout(() => setToast(""), 2500); }, []);

  const updateProduct = useCallback((id, updates) => {
    if (updates._del) {
      setProducts(prev => prev.filter(p => p.id !== id));
      return;
    }
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  // ---- Upload ----
  const handleFiles = useCallback((files) => {
    [...files].forEach(f => {
      if (!f.type.startsWith("image/")) return;
      const r = new FileReader();
      r.onload = e => {
        setProducts(prev => [...prev, mkProduct(e.target.result, f.name)]);
        showToast(`✅ "${f.name}" 등록`);
      };
      r.readAsDataURL(f);
    });
  }, [showToast]);

  // ---- AI Analysis (single) ----
  const aiAnalyzeOne = useCallback(async (id) => {
    setAnalyzing(id);
    try {
      const currentProducts = await new Promise(resolve => {
        setProducts(prev => { resolve(prev); return prev; });
      });
      const p = currentProducts.find(x => x.id === id);
      if (!p) { setAnalyzing(null); return; }

      const small = await resizeImg(p.imageUrl, 512, 512, 0.7);
      const b64 = small.split(",")[1];
      const analysis = await callClaude([{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
          { type: "text", text: `이 유아동 패션 제품을 분석. 순수 JSON만 응답(마크다운 금지):
{"productNameSuggestion":"한국어명","category":"상의/하의/원피스/아우터/신발/가방/모자/액세서리/수영복/실내복/기타","season":"SS (봄/여름)/FW (가을/겨울)/사계절","targetGender":"여아/남아/공용","mainColor":"#hex","subColors":["#hex"],"styleTags":["2-3개"],"materialTags":["2-3개"],"designKeywords":["2-4개"],"coordinationRole":"주인공/서포트/포인트/베이직 아이템","strengthPoint":"강점","cautionPoint":"주의점"}` }
        ]
      }], 1000);

      setProducts(prev => prev.map(x => {
        if (x.id !== id) return x;
        const updated = { ...x, aiAnalysis: analysis, _done: true };
        if (!x.name && analysis.productNameSuggestion) updated.name = analysis.productNameSuggestion;
        if (!x.category && analysis.category) updated.category = analysis.category;
        if (!x.season && analysis.season) updated.season = analysis.season;
        if (!x.targetGender && analysis.targetGender) updated.targetGender = analysis.targetGender;
        if (analysis.mainColor) updated.mainColor = analysis.mainColor;
        if (analysis.subColors?.length) updated.subColors = [...new Set([...x.subColors, ...analysis.subColors])];
        if (analysis.styleTags?.length) updated.styleTags = [...new Set([...x.styleTags, ...analysis.styleTags])];
        if (analysis.materialTags?.length) updated.materialTags = [...new Set([...x.materialTags, ...analysis.materialTags])];
        if (analysis.designKeywords?.length) updated.designKeywords = [...new Set([...x.designKeywords, ...analysis.designKeywords])];
        return updated;
      }));
      showToast("✅ 분석 완료");
    } catch (e) {
      showToast("⚠️ 분석 실패: " + e.message);
    }
    setAnalyzing(null);
  }, [showToast]);

  // ---- Batch ----
  const batchAnalyze = useCallback(async () => {
    const todo = products.filter(p => !p._done);
    if (!todo.length) { showToast("이미 전체 분석 완료"); return; }
    let done = 0;
    setBatchProgress({ done: 0, total: todo.length });
    for (const p of todo) {
      try { await aiAnalyzeOne(p.id); } catch (_) {}
      done++;
      setBatchProgress({ done, total: todo.length });
    }
    setBatchProgress(null);
    showToast(`✅ ${done}개 분석 완료`);
  }, [products, aiAnalyzeOne, showToast]);

  // ---- AI Coordination ----
  const aiCoord = useCallback(async () => {
    if (products.length < 2) { showToast("⚠️ 2개 이상 필요"); return; }
    setCoordLoading(true); setCoordError(""); setCoordResult(null);
    try {
      // 최대 10개까지만 (Netlify body 크기 제한)
      const useProducts = products.slice(0, 10);
      if (products.length > 10) {
        showToast("⚠️ 처음 10개 제품만 코디 분석합니다");
      }

      const parts = [];
      for (let i = 0; i < useProducts.length; i++) {
        const p = useProducts[i];
        // 더 작게 리사이즈 (256px, 품질 0.4)
        const small = await resizeImg(p.imageUrl, 256, 256, 0.4);
        const b64 = small.split(",")[1];
        parts.push({ type: "text", text: `[제품${i + 1}: "${p.name || p._fn}" / ${p.category || "미분류"} / ${p.targetGender || ""}]` });
        parts.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } });
      }
      parts.push({ type: "text", text: `위 ${useProducts.length}개 유아동 패션 제품의 실제 이미지를 분석하여 베스트 코디를 추천.

규칙:
1. 실제 색상·패턴·소재·분위기를 보고 "진짜 어울리는" 조합만
2. 상의+하의 기본, 아우터/소품 추가 가능
3. matchScore 70 미만 추천 금지
4. 같은 제품 여러 코디 가능
5. 안 어울리는 건 unmatchedProducts에

순수 JSON만(마크다운 금지):
{"coordSets":[{"title":"코디명","description":"이유 2-3문장","occasion":"착용상황","productIndices":[0,2],"matchScore":92,"colorHarmony":"컬러설명","stylingTip":"팁"}],"unmatchedProducts":[{"index":3,"reason":"이유","suggestion":"제안"}]}` });

      const result = await callClaude([{ role: "user", content: parts }], 4000);
      setCoordResult(result);
      showToast("✅ 베스트 코디 완료!");
    } catch (e) {
      setCoordError(e.message);
    }
    setCoordLoading(false);
  }, [products, showToast]);

  // ---- Tags ----
  const addTag = (id, field, val) => {
    val = val.trim(); if (!val) return;
    setProducts(prev => prev.map(p => p.id !== id || p[field].includes(val) ? p : { ...p, [field]: [...p[field], val] }));
  };
  const removeTag = (id, field, val) => {
    setProducts(prev => prev.map(p => p.id !== id ? p : { ...p, [field]: p[field].filter(t => t !== val) }));
  };
  const addSubColor = (id) => {
    setProducts(prev => prev.map(p => p.id !== id || p.subColors.length >= 5 ? p : { ...p, subColors: [...p.subColors, "#CCCCCC"] }));
  };
  const removeSubColor = (id, i) => {
    setProducts(prev => prev.map(p => p.id !== id ? p : { ...p, subColors: p.subColors.filter((_, j) => j !== i) }));
  };

  // ---- Gap ----
  const gapData = (() => {
    if (products.length < 3) return null;
    const cc = {}, gc = {}, sc = {}, stc = {};
    products.forEach(p => {
      if (p.category) cc[p.category] = (cc[p.category] || 0) + 1;
      if (p.targetGender) gc[p.targetGender] = (gc[p.targetGender] || 0) + 1;
      if (p.season) sc[p.season] = (sc[p.season] || 0) + 1;
      p.styleTags.forEach(t => stc[t] = (stc[t] || 0) + 1);
    });
    const gaps = [];
    const mc = CATS.filter(c => !Object.keys(cc).includes(c) && c !== "기타");
    if (mc.length) gaps.push({ icon: "📦", title: "누락 카테고리", desc: `${mc.join(", ")} 없음`, tags: mc, color: C.accent, bg: C.accentLight });
    const ge = Object.entries(gc), gt = ge.reduce((s, [, v]) => s + v, 0);
    ge.forEach(([g, c]) => { if (c / gt > .7) gaps.push({ icon: "⚖️", title: "성별 편중", desc: `${g} ${Math.round(c / gt * 100)}%`, tags: GENDERS.filter(x => x !== g && x !== "공용").map(l => l + " 보강"), color: C.navy, bg: C.navyLight }); });
    const ms = SEASONS.filter(s => !Object.keys(sc).includes(s));
    if (ms.length) gaps.push({ icon: "🌤", title: "시즌 부족", desc: `${ms.join(", ")} 없음`, tags: ms, color: C.gold, bg: C.goldLight });
    if (Object.keys(stc).length < 3) gaps.push({ icon: "🎨", title: "스타일 다양성 부족", desc: `${Object.keys(stc).length}개만`, tags: STYLES_P.filter(s => !Object.keys(stc).includes(s)).slice(0, 3), color: C.pink, bg: C.pinkLight });
    if (!Object.keys(cc).some(k => ["액세서리", "모자", "가방"].includes(k))) gaps.push({ icon: "✨", title: "소품 부재", desc: "코디컷 완성도를 위해 필요", tags: ["가방", "모자", "액세서리"], color: C.mint, bg: C.mintLight });
    if (!gaps.length) gaps.push({ icon: "✅", title: "균형 잡힌 라인업", desc: "카테고리·시즌·성별 균형 양호", tags: [], color: C.mint, bg: C.mintLight });
    return gaps;
  })();

  // ---- Export ----
  const exportData = () => {
    if (!products.length) { showToast("⚠️ 없음"); return; }
    const o = { exportDate: new Date().toISOString(), products: products.map(p => ({ id: p.id, name: p.name, category: p.category, season: p.season, targetGender: p.targetGender, mainColor: p.mainColor, subColors: p.subColors, styleTags: p.styleTags, materialTags: p.materialTags, designKeywords: p.designKeywords, price: p.price, memo: p.memo, aiAnalysis: p.aiAnalysis })) };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(o, null, 2)], { type: "application/json" }));
    a.download = `ozkiz-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    showToast("✅ 다운로드");
  };

  const statCats = new Set(products.map(p => p.category).filter(Boolean)).size;
  const statAI = products.filter(p => p._done).length;

  return (
    <div className="app-root">
      {/* HEADER */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">OZ</div>
          <div className="logo-text">OZKIZ <span>Styling Map</span></div>
        </div>
        <div className="header-right">
          <div className="tab-nav">
            {[["products", "📦 제품 관리"], ["coordination", "👗 크로스 코디"], ["gap", "🔍 Gap 분석"]].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`tab-btn ${tab === k ? "active" : ""}`}>{label}</button>
            ))}
          </div>
          <button className="btn" onClick={exportData}>📥 내보내기</button>
        </div>
      </header>

      <main className="main-content">
        {/* Stats */}
        <div className="stats-bar">
          {[[products.length, "전체 제품"], [statCats, "카테고리"], [statAI, "AI 분석 완료"], [coordResult?.coordSets?.length || 0, "코디 세트"]].map(([n, l], i) => (
            <div key={i} className="stat-card"><div className="stat-num">{n}</div><div className="stat-label">{l}</div></div>
          ))}
        </div>

        {/* PRODUCTS */}
        {tab === "products" && (
          <div>
            <div className="section-header">
              <div className="section-title">제품 카드 <span className="badge">{products.length}개</span></div>
              <div className="section-actions">
                {products.length > 0 && <button className="btn btn-mint" onClick={batchAnalyze}>✨ 전체 AI 분석</button>}
                <button className="btn" onClick={() => { if (confirm("전체 초기화?")) setProducts([]); }}>🗑 초기화</button>
                <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>＋ 이미지 업로드</button>
              </div>
            </div>
            {batchProgress && (
              <div className="batch-progress">
                <div className="batch-bar"><div className="batch-fill" style={{ width: `${Math.round(batchProgress.done / batchProgress.total * 100)}%` }} /></div>
                <span className="batch-label">{batchProgress.done}/{batchProgress.total}</span>
              </div>
            )}
            {products.length === 0 && (
              <div className="upload-zone" onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}>
                <div className="upload-title">제품 이미지를 드래그하거나 클릭하여 업로드</div>
                <div className="upload-sub">여러 장 동시 업로드 가능 · PNG, JPG, WEBP</div>
              </div>
            )}
            <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
            <div className="product-grid">
              {products.map(p => (
                <ProductCard key={p.id} p={p} updateProduct={updateProduct} addTag={addTag} removeTag={removeTag}
                  addSubColor={addSubColor} removeSubColor={removeSubColor}
                  onAnalyze={() => aiAnalyzeOne(p.id)} analyzing={analyzing === p.id} />
              ))}
            </div>
          </div>
        )}

        {/* COORDINATION */}
        {tab === "coordination" && (
          <div>
            <div className="section-header">
              <div className="section-title">크로스 코디 추천 <span className="ai-badge">✨ AI 코디</span></div>
              <button className="btn btn-mint" onClick={aiCoord} disabled={coordLoading}>✨ AI 베스트 코디 생성</button>
            </div>
            {coordLoading && (
              <div className="center-msg">
                <div className="spinner" />
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 20, color: C.mint }}>AI가 {products.length}개 제품을 분석 중...</div>
                <div style={{ fontSize: 13, color: C.textSec, marginTop: 8 }}>이미지 최적화 → 색상·패턴·소재 분석 → 코디 생성</div>
              </div>
            )}
            {coordError && (
              <div className="center-msg">
                <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                <h3>코디 생성 실패</h3>
                <p style={{ color: C.textSec, marginBottom: 20 }}>{coordError}</p>
                <button className="btn btn-mint" onClick={aiCoord}>🔄 다시 시도</button>
              </div>
            )}
            {coordResult && <CoordResults result={coordResult} products={products} />}
            {!coordLoading && !coordError && !coordResult && (
              <div className="center-msg">
                <h3>AI 베스트 코디 생성</h3>
                <p style={{ color: C.textSec, maxWidth: 440, margin: "8px auto 0", lineHeight: 1.6 }}>
                  제품 2개 이상 등록 후 버튼을 누르면, AI가 실제 이미지의 색상·패턴·소재·분위기를 분석하여 진짜 어울리는 코디만 추천합니다.
                </p>
              </div>
            )}
          </div>
        )}

        {/* GAP */}
        {tab === "gap" && (
          <div>
            <div className="section-title" style={{ marginBottom: 20 }}>Gap 분석</div>
            {gapData ? (
              <div className="gap-grid">
                {gapData.map((g, i) => (
                  <div key={i} className="gap-card" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="gap-icon" style={{ background: g.bg }}>{g.icon}</div>
                    <div className="gap-title">{g.title}</div>
                    <div className="gap-desc">{g.desc}</div>
                    {g.tags.length > 0 && <div className="gap-tags">{g.tags.map((t, j) => <span key={j} className="gap-tag" style={{ background: g.bg, color: g.color }}>{t}</span>)}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="center-msg"><h3>제품을 먼저 등록해주세요</h3><p style={{ color: C.textSec }}>3개 이상이면 분석 가능</p></div>
            )}
          </div>
        )}
      </main>
      <Toast msg={toast} />
    </div>
  );
}

// ============ Product Card ============
function ProductCard({ p, updateProduct, addTag, removeTag, addSubColor, removeSubColor, onAnalyze, analyzing }) {
  const [si, setSi] = useState("");
  const [mi, setMi] = useState("");
  const [di, setDi] = useState("");

  return (
    <div className={`product-card ${analyzing ? "analyzing" : ""}`}>
      <div className="card-img-wrap">
        <img src={p.imageUrl} alt="" />
        <div className="card-img-actions">
          <button className="img-btn" onClick={onAnalyze}>✨</button>
          <button className="img-btn" onClick={() => updateProduct(p.id, { _del: true })}>✕</button>
        </div>
      </div>
      <div className="card-body">
        <div className="card-row">
          <input className="card-input" style={{ flex: 2 }} placeholder="제품명" value={p.name} onChange={e => updateProduct(p.id, { name: e.target.value })} />
          <input className="card-input" style={{ flex: 1, textAlign: "right" }} placeholder="판매가" type="number" value={p.price ?? ""} onChange={e => updateProduct(p.id, { price: e.target.value ? +e.target.value : undefined })} />
        </div>
        <div className="card-row">
          <select className="card-select" value={p.category} onChange={e => updateProduct(p.id, { category: e.target.value })}>
            <option value="">카테고리</option>{CATS.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="card-select" value={p.season} onChange={e => updateProduct(p.id, { season: e.target.value })}>
            <option value="">시즌</option>{SEASONS.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="card-select" value={p.targetGender} onChange={e => updateProduct(p.id, { targetGender: e.target.value })}>
            <option value="">성별</option>{GENDERS.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>

        <div className="card-label">컬러</div>
        <div className="color-row">
          <span className="color-lbl">메인</span>
          <input type="color" className="color-pick" value={p.mainColor} onChange={e => updateProduct(p.id, { mainColor: e.target.value })} />
          <span className="color-lbl">서브</span>
          {p.subColors.map((sc, i) => (
            <span key={i} className="sub-color-wrap">
              <input type="color" className="color-pick" value={sc} onChange={e => { const ns = [...p.subColors]; ns[i] = e.target.value; updateProduct(p.id, { subColors: ns }); }} />
              <button className="sub-color-x" onClick={() => removeSubColor(p.id, i)}>×</button>
            </span>
          ))}
          <button className="sub-color-add" onClick={() => addSubColor(p.id)}>+</button>
        </div>

        <TagField label="스타일 태그" tags={p.styleTags} field="styleTags" id={p.id} val={si} setVal={setSi} presets={STYLES_P} addTag={addTag} removeTag={removeTag} />
        <TagField label="소재/특징" tags={p.materialTags} field="materialTags" id={p.id} val={mi} setVal={setMi} presets={MATS_P} addTag={addTag} removeTag={removeTag} />
        <TagField label="디자인 키워드" tags={p.designKeywords} field="designKeywords" id={p.id} val={di} setVal={setDi} addTag={addTag} removeTag={removeTag} navy />

        <div className="card-label">메모</div>
        <textarea className="card-input" rows={2} placeholder="특이사항, 리오더 등" value={p.memo} onChange={e => updateProduct(p.id, { memo: e.target.value })} />

        {p.aiAnalysis ? (
          <div className="ai-panel">
            <div className="ai-panel-title">✨ AI 분석 결과</div>
            {[["추천명", p.aiAnalysis.productNameSuggestion], ["역할", p.aiAnalysis.coordinationRole], ["강점", p.aiAnalysis.strengthPoint], ["주의", p.aiAnalysis.cautionPoint], ["디자인", (p.aiAnalysis.designKeywords || []).join(", ")]].map(([k, v], i) => (
              <div key={i} className="ai-field"><strong>{k}:</strong> {v || "-"}</div>
            ))}
          </div>
        ) : (
          <button className="btn btn-mint" style={{ width: "100%", marginTop: 12, justifyContent: "center" }} onClick={onAnalyze}>✨ AI 자동 분석</button>
        )}
      </div>
    </div>
  );
}

function TagField({ label, tags, field, id, val, setVal, presets, addTag, removeTag, navy }) {
  return (
    <>
      <div className="card-label">{label}</div>
      <div className="tag-wrap">
        {tags.map(t => <span key={t} className={`tag ${navy ? "tag-navy" : ""}`}>{t}<span className="tag-x" onClick={() => removeTag(id, field, t)}>×</span></span>)}
      </div>
      <div className="tag-input-wrap">
        <input className="tag-input" placeholder="입력 후 Enter" value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { addTag(id, field, val); setVal(""); } }} />
        {presets && (
          <select className="tag-preset" value="" onChange={e => { if (e.target.value) { addTag(id, field, e.target.value); e.target.value = ""; } }}>
            <option value="">프리셋</option>{presets.map(s => <option key={s}>{s}</option>)}
          </select>
        )}
      </div>
    </>
  );
}

// ============ Coord Results ============
function CoordResults({ result, products }) {
  const sets = result.coordSets || [];
  const unm = result.unmatchedProducts || [];
  return (
    <div>
      {sets.length > 0 ? (
        <div className="coord-list">
          {sets.map((s, si) => {
            const items = (s.productIndices || []).filter(i => i >= 0 && i < products.length).map(i => products[i]);
            if (!items.length) return null;
            const sc = s.matchScore >= 90 ? C.mint : s.matchScore >= 75 ? C.gold : C.accent;
            return (
              <div key={si} className="coord-card" style={{ animationDelay: `${si * 100}ms` }}>
                <div className="coord-header">
                  <div className="coord-title-row">
                    <span className="coord-name">{s.title}</span>
                    <span className="coord-score" style={{ background: sc }}>{s.matchScore}점</span>
                  </div>
                  <div className="coord-desc">{s.description}</div>
                </div>
                <div className="coord-products">
                  {items.map((p, j) => (
                    <div key={p.id} className="coord-item">
                      <div>
                        <img src={p.imageUrl} className="coord-img" />
                        <div className="coord-item-name">{p.name || p._fn}</div>
                        <div className="coord-item-cat">{p.category || "미분류"}</div>
                      </div>
                      {j < items.length - 1 && <div className="coord-plus">+</div>}
                    </div>
                  ))}
                </div>
                <div className="coord-chips">
                  {s.occasion && <span className="chip">📍 {s.occasion}</span>}
                  {s.colorHarmony && <span className="chip">🎨 {s.colorHarmony}</span>}
                  {s.stylingTip && <span className="chip">💡 {s.stylingTip}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="center-msg"><h3>어울리는 코디를 찾지 못했습니다</h3></div>
      )}
      {unm.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>💡 매칭 제안</div>
          {unm.map((u, i) => {
            const p = products[u.index]; if (!p) return null;
            return (
              <div key={i} className="unmatched-item">
                <img src={p.imageUrl} className="unmatched-img" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name || p._fn}</div>
                  <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>{u.reason}</div>
                  <div style={{ fontSize: 12, color: C.mint, marginTop: 2 }}>→ {u.suggestion}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
