(function () {
  "use strict";

  const PANEL_ID = "netacad-answer-helper-panel";
  const CONTENT_BASE_FALLBACK = "itn/1.0";
  const LOCALE_FALLBACK = "zh-CN";
  const NET_CAPTURE_TTL_MS = 5 * 60 * 1000;

  /** MCQ 正确项高亮 class */
  const MCQ_CORRECT_HINT_CLASS = "netacad-ah-mcq-correct-hint";
  const MCQ_CORRECT_HINT_INNER_CLASS = "netacad-ah-mcq-correct-hint-inner";
  /** matching 下拉正确项高亮 class */
  const MATCHING_DD_CORRECT_CLASS = "netacad-ah-matching-dd-correct";
  /** Shadow 内高亮样式注入标记 */
  const NETACAD_SHADOW_HIGHLIGHT_ATTR = "data-netacad-ah-hl";
  const MCQ_SHADOW_HIGHLIGHT_CSS = `
label.mcq__item-label.netacad-ah-mcq-correct-hint,
label.js-item-label.netacad-ah-mcq-correct-hint,
label[role="listitem"].netacad-ah-mcq-correct-hint,
.mcq__item.netacad-ah-mcq-correct-hint,
.js-mcq-item.netacad-ah-mcq-correct-hint,
button.netacad-ah-mcq-correct-hint {
  position: relative !important;
  box-sizing: border-box !important;
  isolation: isolate;
}
label.mcq__item-label.netacad-ah-mcq-correct-hint::after,
label.js-item-label.netacad-ah-mcq-correct-hint::after,
label[role="listitem"].netacad-ah-mcq-correct-hint::after,
.mcq__item.netacad-ah-mcq-correct-hint::after,
.js-mcq-item.netacad-ah-mcq-correct-hint::after,
button.netacad-ah-mcq-correct-hint::after {
  content: "" !important;
  position: absolute !important;
  inset: 0 !important;
  border-radius: inherit;
  z-index: 999 !important;
  pointer-events: none !important;
  box-sizing: border-box !important;
  box-shadow: inset 0 0 0 3px #15803d !important;
  background-color: rgba(34, 197, 94, 0.18) !important;
}
.mcq__item-text-inner.netacad-ah-mcq-correct-hint-inner,
[class*="mcq__item-text-inner"].netacad-ah-mcq-correct-hint-inner {
  outline: none !important;
  box-shadow: none !important;
  background: transparent !important;
}
`.trim();
  const OM_ROW_CORRECT_CLASS = "netacad-ah-om-correct";
  const OM_ROW_WRONG_CLASS = "netacad-ah-om-wrong";
  const OM_ROW_PLACEHOLDER_CLASS = "netacad-ah-om-placeholder";
  const OM_PAIR_TINT_ATTR = "data-netacad-ah-om-pair";
  const OM_CATEGORY_MATCH_MIN = 1;
  /** objectMatching 行样式 */
  const OBJECT_MATCHING_SHADOW_CSS = `
.matching__item-container-options-wrapper.netacad-ah-om-correct {
  box-sizing: border-box !important;
  border-radius: 10px !important;
  outline: 3px solid #15803d !important;
  outline-offset: 2px !important;
}
.matching__item-container-options-wrapper.netacad-ah-om-wrong {
  box-sizing: border-box !important;
  border-radius: 10px !important;
  outline: 3px solid #c2410c !important;
  outline-offset: 2px !important;
}
.matching__item-container-options-wrapper.netacad-ah-om-placeholder {
  box-sizing: border-box !important;
  border-radius: 10px !important;
  outline: 3px solid #2563eb !important;
  outline-offset: 2px !important;
}
/* matching 下拉 li 高亮 */
li.${MATCHING_DD_CORRECT_CLASS}[role="option"],
li.${MATCHING_DD_CORRECT_CLASS} {
  position: relative !important;
  box-sizing: border-box !important;
  isolation: isolate;
  border-radius: 8px !important;
  outline: none !important;
  list-style: none !important;
}
li.${MATCHING_DD_CORRECT_CLASS}[role="option"]::after,
li.${MATCHING_DD_CORRECT_CLASS}::after {
  content: "" !important;
  position: absolute !important;
  inset: 0 !important;
  border-radius: inherit;
  z-index: 0 !important;
  pointer-events: none !important;
  box-sizing: border-box !important;
  box-shadow: inset 0 0 0 3px #15803d !important;
  background-color: rgba(34, 197, 94, 0.18) !important;
}
li.${MATCHING_DD_CORRECT_CLASS}[role="option"] > *,
li.${MATCHING_DD_CORRECT_CLASS} > * {
  position: relative !important;
  z-index: 1 !important;
}
.dropdown__item-inner.${MATCHING_DD_CORRECT_CLASS},
.js-dropdown-list-item-inner.${MATCHING_DD_CORRECT_CLASS} {
  position: relative !important;
  isolation: isolate;
}
.dropdown__item-inner.${MATCHING_DD_CORRECT_CLASS}::after,
.js-dropdown-list-item-inner.${MATCHING_DD_CORRECT_CLASS}::after {
  content: "" !important;
  position: absolute !important;
  inset: 0 !important;
  border-radius: inherit;
  z-index: 0 !important;
  pointer-events: none !important;
  box-sizing: border-box !important;
  box-shadow: inset 0 0 0 3px #15803d !important;
  background-color: rgba(34, 197, 94, 0.18) !important;
}
.dropdown__item-inner.${MATCHING_DD_CORRECT_CLASS} > *,
.js-dropdown-list-item-inner.${MATCHING_DD_CORRECT_CLASS} > * {
  position: relative !important;
  z-index: 1 !important;
}
`.trim();
  const NETACAD_SHADOW_HIGHLIGHT_CSS =
    MCQ_SHADOW_HIGHLIGHT_CSS + "\n" + OBJECT_MATCHING_SHADOW_CSS;

  function ensureNetacadHighlightStylesInShadow(el) {
    try {
      if (!el) return;
      /** 下拉等子 shadow 须用 el.shadowRoot */
      let root = el.shadowRoot || null;
      if (!root) {
        const r = el.getRootNode && el.getRootNode();
        if (r && typeof ShadowRoot !== "undefined" && r instanceof ShadowRoot)
          root = r;
      }
      if (!root) return;
      const sel = "style[" + NETACAD_SHADOW_HIGHLIGHT_ATTR + "]";
      if (root.querySelector(sel)) return;
      const st = document.createElement("style");
      st.setAttribute(NETACAD_SHADOW_HIGHLIGHT_ATTR, "1");
      st.textContent = NETACAD_SHADOW_HIGHLIGHT_CSS;
      root.appendChild(st);
    } catch (_e) {
      /* */
    }
  }
  /** MCQ 高亮/映射：选项匹配分通过线 */
  const MCQ_DOM_OPTION_MATCH_MIN = 0.52;
  /** MCQ DOM↔JSON 选项初配通过线 */
  const MCQ_DOM_JSON_MAP_PAIR_MIN = 0.68;

  /** 是否计分题型组件 */
  function isQuizQuestionComponent(c) {
    const t = c && c._component;
    return t === "mcq" || t === "objectMatching" || t === "matching";
  }

  const OBJECT_MATCHING_DOM =
    '[class*="objectmatching" i], [class*="object-matching" i], [class*="matching__" i], [class*="component-objectmatching" i], [class*="component-matching" i], [class*="component__matching" i], object-matching-view, matching-view';

  /** Lit block-button data-index 转题号 */
  function litBlockDataIndexToQuestionOrdinal(d, minDataIndexAmongBlocks) {
    if (minDataIndexAmongBlocks === 0) return d + 1;
    if (minDataIndexAmongBlocks === 1) return d;
    if (minDataIndexAmongBlocks == null) return d + 1;
    return d + 1;
  }

  function computeLitBlockDataIndexMin() {
    const nodes = querySelectorAllDeep(
      document,
      [
        "button[data-index][class*='block-button']",
        "button.block-button[data-index]",
        "button[data-index].block-button",
      ].join(", "),
      220
    );
    let minD = null;
    for (const el of nodes) {
      if (!el || isInOurPanel(el)) continue;
      const raw = el.getAttribute("data-index");
      if (raw == null || !/^\d+$/.test(String(raw).trim())) continue;
      const d = parseInt(String(raw).trim(), 10);
      if (d < 0 || d >= 500) continue;
      minD = minD == null ? d : Math.min(minD, d);
    }
    return minD;
  }

  let components = null;
  let model = null;
  let loadedKey = null;
  let loadInProgress = false;

  /** 多条题干匹配导航 */
  let lastMatchCandidateSig = "";
  let matchCandidateIndex = 0;
  let panelMatchNavTotal = 0;
  let panelMatchNavClickBound = false;
  /** 上次 tick 面板状态快照 */
  let lastTickPanelState = null;
  let lastAmbiguousHitsForNav = [];
  let lastMcqsFullListForNav = [];
  let ambHintMountedParent = null;
  /** tick 代数，用于取消过期的异步 tick */
  let tickRunGeneration = 0;
  /** 匹配栏点击后的 observer 防抖窗口 */
  let matchNavInteractionUntil = 0;
  let observerCoalesceTimer = null;

  /** matching 下拉重涂用 */
  let lastEntryForMatchingDdRehint = null;
  let matchingDdRehintTimer = null;
  const matchingDropdownHintObserverByHost = new Map();

  let settings = {
    netacadComponentsBasePath: null,
    netacadContentBase: null,
    netacadCourseSegment: null,
    netacadModuleFromNet: null,
    netacadCapturedAt: null,
    netacadLocale: null,
  };

  let pollTimer = null;
  let observer = null;
  let onResizeSync = null;
  let fabLayoutSyncedOnce = false;

  /** href 未变时粘住最近一次解析出的课节段 */
  let locCourseSticky = {
    href: "",
    contentBase: null,
    courseSlug: null,
  };

  function bumpLocCourseSticky() {
    const href = String(location.href || "");
    if (href !== locCourseSticky.href) {
      locCourseSticky.href = href;
      locCourseSticky.contentBase = getContentBaseFromPageLocation();
      locCourseSticky.courseSlug = getCourseContentSlugFromPageLocation();
      return;
    }
    const b = getContentBaseFromPageLocation();
    const sl = getCourseContentSlugFromPageLocation();
    if (b) locCourseSticky.contentBase = b;
    if (sl) locCourseSticky.courseSlug = sl;
  }

  function applyModulePlaceholder(text, m) {
    if (text == null || text === "") return text;
    return String(text).split("{{_moduleNumber}}").join(String(m));
  }

  function segmentLooksLikeUuid(seg) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(seg || "")
    );
  }

  function looksLikeLocaleSegment(seg) {
    return /^[a-z]{2}(?:-[A-Z]{2})?$/i.test(String(seg || ""));
  }

  /** basePath 上用于模块占位符的路径段 */
  function slugForModuleFromComponentsBasePath(basePath) {
    const parts = String(basePath || "").split("/").filter(Boolean);
    if (!parts.length) return "";
    const last = parts[parts.length - 1];
    if (looksLikeLocaleSegment(last) && parts.length >= 2)
      return parts[parts.length - 2];
    return last;
  }

  /** 课节段转模块号 */
  function deriveModuleNumberFromSegment(seg) {
    if (seg == null || seg === "") return null;
    const s = String(seg);
    const mm = s.match(/^m(\d+)$/i);
    if (mm) return parseInt(mm[1], 10);
    const ck = s.match(/^checkpoint(\d+)$/i);
    if (ck) return parseInt(ck[1], 10);
    const nums = s.match(/\d+/g);
    if (nums && nums.length) return parseInt(nums[nums.length - 1], 10);
    return null;
  }

  function moduleNumberForPlaceholder(courseSegment) {
    const fromSeg = deriveModuleNumberFromSegment(courseSegment);
    if (fromSeg != null) return fromSeg;
    const n = detectModuleNumberFromPage() ?? getModuleFromLocationUrl();
    if (n != null) return n;
    return 1;
  }

  function stripHtmlToPlain(text) {
    if (text == null || text === "") return null;
    let s = String(text).replace(/<br\s*\/?>/gi, " ");
    s = s.replace(/<\/p>\s*/gi, " ").replace(/<p[^>]*>/gi, " ");
    s = s.replace(/<[^>]+>/g, "");
    const ta = document.createElement("textarea");
    ta.innerHTML = s;
    s = ta.value;
    s = s.replace(/\s+/g, " ").trim();
    return s || null;
  }

  /** MCQ 选项转纯文本 */
  function mcqOptionPlainText(raw) {
    if (raw == null) return "";
    const s0 = String(raw).trim();
    if (!s0) return "";
    const p = stripHtmlToPlain(s0);
    if (p) return p;
    return s0.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  /** 比对用归一化 */
  function normalizeForMatch(text) {
    if (!text) return "";
    return String(text)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /** 比对用宽松归一化 */
  function relaxForMatch(text) {
    return normalizeForMatch(text)
      .replace(/[,，.。?？!！:：;；、（）()[\]{}'"]/g, " ")
      .replace(/[-_/\\·…`—]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** 题干 HTML 内标签间插空格 */
  function preJoinAdjacentHtmlTags(s) {
    return String(s == null ? "" : s).replace(/></g, "> <");
  }

  /** 去掉题干前无障碍/状态前缀 */
  function stripQuizAccessibilityStemNoise(text) {
    let s = String(text || "")
      .replace(/[\u200b\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    for (let i = 0; i < 4 && s; i++) {
      const prev = s;
      s = s.replace(/^(不完整|完成)\s+/gi, "").trim();
      s = s.replace(/^问题\s*\d+\s*[:：．.、]?\s*/i, "").trim();
      if (s === prev) break;
    }
    return s;
  }

  /** 页面可见题干转可比纯文本 */
  function unifiedPlainFromVisibleStem(visibleStem) {
    const raw = String(visibleStem || "").trim();
    let s = raw
      .replace(/[\u200b\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    s = stripQuizAccessibilityStemNoise(s);
    if (s.length < 8) {
      s = stripQuizAccessibilityStemNoise(raw.replace(/\s+/g, " ").trim());
    }
    return s.normalize("NFKC").replace(/\s+/g, " ").trim();
  }

  /** 题库题干 HTML 转可比纯文本 */
  function unifiedPlainFromQuestionHtml(html) {
    const joined = preJoinAdjacentHtmlTags(html || "");
    let plain = stripHtmlToPlain(joined);
    if (plain == null || plain === "") {
      plain = String(joined)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    let s = String(plain)
      .replace(/[\u200b\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    s = stripQuizAccessibilityStemNoise(s);
    return s.normalize("NFKC").replace(/\s+/g, " ").trim();
  }

  /** 可见题干 exact key（与选项同一套归一化） */
  function stemUnifiedExactKeyFromVisibleStem(visibleStem) {
    return normalizeMcqOptionPlainForExactCompare(
      unifiedPlainFromVisibleStem(visibleStem)
    );
  }

  /** 题库题干 HTML 的 exact key */
  function stemUnifiedExactKeyFromQuestionHtml(qRaw) {
    return normalizeMcqOptionPlainForExactCompare(
      unifiedPlainFromQuestionHtml(qRaw || "")
    );
  }

  function canonicalStemStrict(unifiedPlain) {
    return normalizeForMatch(String(unifiedPlain || ""));
  }

  function normalizeQuestionHtmlForMatch(html) {
    return canonicalStemStrict(unifiedPlainFromQuestionHtml(html));
  }

  /** 题干中提取思科式 MAC */
  function extractMacLikeTokensFromStem(visibleStem) {
    const re = /\b[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}\b/gi;
    const out = [];
    let m;
    const s = String(visibleStem || "");
    while ((m = re.exec(s)) !== null) {
      const tok = m[0].toLowerCase();
      if (out.indexOf(tok) < 0) out.push(tok);
    }
    return out;
  }

  /** 从 _r2aMapId 解析小节号 */
  function extractMcqSectionFromR2aMapId(mapId) {
    if (mapId == null || mapId === "") return null;
    const m = String(mapId).match(
      /(?:mcq|objectMatching|matching)-(\d+(?:\.\d+)*)-/i
    );
    return m ? m[1] : null;
  }

  /** 页眉大纲与 map 小节号分段前缀一致则同节 */
  function outlineRefMatchesR2aMapSection(outlineRef, sectionFromMap) {
    const o = String(outlineRef || "").trim();
    const s = String(sectionFromMap || "").trim();
    if (!o || !s) return false;
    const oParts = o.split(".").filter(Boolean);
    const sParts = s.split(".").filter(Boolean);
    if (!oParts.length || !sParts.length) return false;
    const min = Math.min(oParts.length, sParts.length);
    for (let i = 0; i < min; i++) {
      if (oParts[i] !== sParts[i]) return false;
    }
    return true;
  }

  /** 推断模块号 m1/m2... */
  function detectModuleNumberFromPage() {
    const scores = Object.create(null);
    const add = (n, w) => {
      const x = Number(n);
      if (!Number.isFinite(x) || x < 1 || x > 99) return;
      scores[x] = (scores[x] || 0) + w;
    };

    function moduleFromOutlineLine(t) {
      const s = String(t || "").replace(/\s+/g, " ").trim();
      if (!s) return null;
      const tri = s.match(/^(\d+)\.\d+\.\d+/);
      if (tri) return tri[1];
      const two = s.match(/^(\d+)\.\d+(?!\.\d)/);
      if (two) return two[1];
      return null;
    }

    function scanSidebarText(t, weightTrip, weightTwo, weightModuleWord) {
      const s = String(t || "").replace(/\s+/g, " ").trim();
      if (!s || s.length > 120) return;
      if (/^模块\s*\d+\s*$/i.test(s) || /^module\s*\d+\s*$/i.test(s)) {
        const mm = s.match(/\d+/);
        if (mm) add(mm[0], weightModuleWord + 4);
        return;
      }
      const mzh = s.match(/(?:^|\s)模块\s*(\d+)/i);
      if (mzh) add(mzh[1], weightModuleWord);
      const men = s.match(/(?:^|\s)module\s*(\d+)/i);
      if (men) add(men[1], weightModuleWord);
      const tri = s.match(/^(\d+)\.\d+\.\d+/);
      if (tri) add(tri[1], weightTrip);
      else {
        const two = s.match(/^(\d+)\.\d+(?!\.\d)/);
        if (two) add(two[1], weightTwo);
      }
    }

    // 侧栏大纲
    const sidebarSelectors =
      "aside, aside nav, [role='navigation'], [class*='sidebar' i], [class*='Sidebar' i], [class*='toc' i], [class*='outline' i], [class*='curriculum' i], [class*='course-outline' i], [data-testid*='sidebar' i]";
    for (const root of document.querySelectorAll(sidebarSelectors)) {
      for (const el of root.querySelectorAll(
        "span, div, li, a, p, strong, h1, h2, h3, h4"
      )) {
        if (el.closest && el.closest("#" + PANEL_ID)) continue;
        const t = (el.innerText || "").split(/\n/)[0] || "";
        scanSidebarText(t, 5, 2, 6);
      }
    }

    for (const el of document.querySelectorAll(
      '[aria-current="true"], [aria-selected="true"]'
    )) {
      if (el.closest && el.closest("#" + PANEL_ID)) continue;
      const role = (el.getAttribute("role") || "").toLowerCase();
      if (role === "tab") continue;
      const raw = (el.innerText || "").replace(/\s+/g, " ").trim();
      if (/^q\s*\d+$/i.test(raw)) continue;
      if (/^问题\s*\d+/i.test(raw)) continue;
      const firstLine = (el.innerText || "").split(/\n/)[0] || "";
      const fl = firstLine.replace(/\s+/g, " ").trim();
      const mod = moduleFromOutlineLine(fl);
      if (mod != null) add(mod, 7);
    }

    // 主区标题行小节号
    for (const sel of ["main h1", "main h2", "[role='main'] h1", "[role='main'] h2"]) {
      for (const h of document.querySelectorAll(sel)) {
        if (h.closest && h.closest("#" + PANEL_ID)) continue;
        const fl = ((h.innerText || "").split(/\n/)[0] || "").replace(/\s+/g, " ").trim();
        const tri = fl.match(/^(\d+)\.\d+\.\d+/);
        if (tri) add(tri[1], 3);
      }
    }

    let best = null;
    let bestS = 0;
    for (const k of Object.keys(scores)) {
      const s = scores[k];
      if (s > bestS) {
        bestS = s;
        best = Number(k);
      }
    }
    return best;
  }

  /** 递归采集 open shadow 内文本 */
  function collectShadowInnerTextDeep(root, depth) {
    if (!root || depth > 14) return "";
    const out = [];
    try {
      const t = root.innerText || "";
      if (t.trim()) out.push(t);
      root.querySelectorAll("*").forEach((el) => {
        if (!el || isInOurPanel(el)) return;
        if (el.shadowRoot) {
          out.push(collectShadowInnerTextDeep(el.shadowRoot, depth + 1));
        }
      });
    } catch (_e) {
      /*  */
    }
    return out.join("\n");
  }

  function getMergedDomInnerText() {
    const parts = [];
    const add = (s) => {
      if (s == null || s === "") return;
      const t = String(s).trim();
      if (t) parts.push(t);
    };
    try {
      add(document.body?.innerText);
      for (const sel of ["main", "[role='main']", "#root", "article"]) {
        document.querySelectorAll(sel).forEach((n) => {
          if (n && !isInOurPanel(n)) {
            add(n.innerText);
            if (n.shadowRoot) add(collectShadowInnerTextDeep(n.shadowRoot, 0));
          }
        });
      }
      document.querySelectorAll("*").forEach((el) => {
        if (!el || isInOurPanel(el)) return;
        if (el.shadowRoot) {
          try {
            add(collectShadowInnerTextDeep(el.shadowRoot, 0));
          } catch (_e) {
            /* closed shadow */
          }
        }
      });
    } catch (_e) {
      /*  */
    }
    return parts.join("\n").replace(/\s+/g, " ").trim();
  }

  /** 是否存在 MCQ 相关 DOM*/
  function hasMcqCourseWidgetDom() {
    const sel =
      '.mcq__title-inner, .mcq__body, .mcq__body-inner, .mcq__item, .mcq__item-text-inner, [class*="mcq__title" i], [class*="mcq__body" i], [class*="mcq__item"], [class*="mcq__stem" i], [class*="mcq__prompt" i], [class*="mcq__"], ' +
      OBJECT_MATCHING_DOM;
    try {
      if (document.querySelector(sel)) return true;
      return querySelectorAllDeep(document, sel, 32).length > 0;
    } catch (_e) {
      return false;
    }
  }

  /** 是否在课程侧栏 */
  function isInCourseChromeSidebar(el) {
    return (
      el &&
      el.closest &&
      el.closest(
        'aside, nav, [role="navigation"], [class*="sidebar" i], [class*="Sidebar" i], [class*="course-menu" i], [data-testid*="sidebar" i]'
      )
    );
  }

  function normalizeQuizNavControlText(el) {
    if (!el) return "";
    return String(
      (el.innerText || el.textContent || "")
        .replace(/[\u200b\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  /** 顶栏 Q 按钮解析题号 */
  function parseTopQuizQButtonOrdinal(el) {
    const raw = normalizeQuizNavControlText(el);
    if (!raw) return null;
    const compact = raw.replace(/\s+/g, "");
    let m = compact.match(/^Q(\d{1,3})$/i);
    if (m) return parseInt(m[1], 10);
    m = raw.match(/^\s*Q\s*(\d{1,3})\b/i);
    if (m) return parseInt(m[1], 10);
    m = raw.match(/\bQ\s*(\d{1,3})\b/i);
    if (m && raw.length <= 20) return parseInt(m[1], 10);
    return null;
  }

  /** 顶栏测验 Q 导航控件 */
  function isTopQuizQNavControl(el) {
    if (!el || parseTopQuizQButtonOrdinal(el) == null) return false;
    try {
      const r = el.getBoundingClientRect();
      if (r.bottom < -2 || r.top > 400) return false;
      const vw = window.innerWidth || 800;
      if (r.left > vw * 0.92) return false;
    } catch (_e) {
      return false;
    }
    return true;
  }

  function shouldExcludeFromTopQStripScan(el) {
    if (!el || isInOurPanel(el)) return true;
    if (isTopQuizQNavControl(el)) return false;
    return isInCourseChromeSidebar(el);
  }

  /** 底部「2 的 3 问题」→ 当前第 2 题 */
  function extractZhNthOfMTotalProgressQuestion() {
    const parts = [];
    const push = (root) => {
      if (!root || isInOurPanel(root)) return;
      try {
        const t = (root.innerText || "").replace(/\s+/g, " ").trim();
        if (t.length >= 4) parts.push(t);
      } catch (_e) {
        /*  */
      }
    };
    push(document.body);
    document
      .querySelectorAll(
        '[class*="footer" i], [class*="toolbar" i], [class*="sticky" i], [class*="bottom-bar" i], [class*="action-bar" i], [class*="submission" i], main, [role="main"], article'
      )
      .forEach(push);
    const blob = parts.join(" ");
    const re = /(\d+)\s*的\s*(\d+)\s*问题/g;
    let best = null;
    let m;
    while ((m = re.exec(blob)) !== null) {
      const cur = parseInt(m[1], 10);
      const tot = parseInt(m[2], 10);
      if (
        Number.isFinite(cur) &&
        Number.isFinite(tot) &&
        cur > 0 &&
        tot > 0 &&
        cur <= tot &&
        cur < 500 &&
        tot < 500
      )
        best = cur;
    }
    return best;
  }

  function dedupeTopQStripByN(strip) {
    const byN = Object.create(null);
    for (const row of strip) {
      const prev = byN[row.n];
      if (!prev || row.area > prev.area) byN[row.n] = row;
    }
    return Object.keys(byN)
      .map((k) => byN[k])
      .sort((a, b) => a.n - b.n);
  }

  function collectTopQuizQNavStripRows() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const TOP_Q_STRIP_MAX_Y = 560;
    const navCandidates = querySelectorAllDeep(
      document,
      'button, a[href], [role="tab"], [role="button"]',
      260
    );
    const strip = [];
    for (const el of navCandidates) {
      if (shouldExcludeFromTopQStripScan(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top > TOP_Q_STRIP_MAX_Y || r.bottom < 0) continue;
      const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (visW * visH < 8) continue;
      const v = parseTopQuizQButtonOrdinal(el);
      if (v == null || v <= 0 || v >= 500) continue;
      strip.push({ el, n: v, area: visW * visH });
    }
    return dedupeTopQStripByN(strip);
  }

  /** 视口内是否有足够大的 MCQ 题干区 */
  function hasVisibleMcqBodyInViewport() {
    const nodes = querySelectorAllDeep(
      document,
      '.mcq__body, .mcq__body-inner, [class*="mcq__body" i], ' + OBJECT_MATCHING_DOM,
      48
    );
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const n of nodes) {
      if (!n || isInOurPanel(n) || isInCourseChromeSidebar(n)) continue;
      const r = n.getBoundingClientRect();
      const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (visW * visH >= 360) return true;
    }
    return false;
  }

  /** 视口内是否有可选选项控件 */
  function hasVisibleMcqChoiceSurface() {
    const sels = [
      "button[role='radio']",
      'input[type="radio"]',
      'input[type="checkbox"]',
      '[role="radio"]',
      '[role="checkbox"]',
      '[role="radiogroup"]',
      ".mcq__item",
      ".mcq__item-text-inner",
      '[class*="mcq__item" i]',
      '[class*="mcq__choice" i]',
      "select",
      '[class*="objectmatching" i] button',
      '[class*="objectmatching" i] [role="combobox"]',
      '[class*="object-matching" i] button',
      '[class*="matching__" i] select',
      '[class*="component-matching" i] select',
      '[class*="component-matching" i] button',
      "object-matching-view",
      "matching-view",
      "matching-dropdown-view",
    ];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const minArea = 80;
    for (const sel of sels) {
      const nodes = querySelectorAllDeep(document, sel, 72);
      for (const n of nodes) {
        if (!n || isInOurPanel(n) || isInCourseChromeSidebar(n)) continue;
        const r = n.getBoundingClientRect();
        const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
        const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
        if (visW * visH >= minArea) return true;
      }
    }
    return false;
  }

  /** 是否处于可答题的测验会话 */
  function hasVisibleActiveMcqSession() {
    const bodyOk = hasVisibleMcqBodyInViewport();
    const choiceOk = hasVisibleMcqChoiceSurface();
    if (!bodyOk && !choiceOk) {
      // 无 MCQ 区时用顶栏/进度判会话
      const qStrip = collectTopQuizQNavStripRows();
      if (qStrip.length >= 2) {
        // 结果/提交态顶栏不算答题中
        if (looksLikeSubmittedOrResultUi() || isMcqResultSummaryView())
          return false;
        return true;
      }
      if (qStrip.length >= 1 && extractZhNthOfMTotalProgressQuestion() != null)
        return true;
      if (extractZhNthOfMTotalProgressQuestion() != null) return true;
      return false;
    }
    if (!bodyOk && choiceOk) {
      if (getLitBlockButtonQOrdinal() != null) return true;
      if (collectTopQuizQNavStripRows().length >= 1) return true;
      if (extractZhNthOfMTotalProgressQuestion() != null) return true;
      const titleRaw = getVisibleMcqTitleText();
      if (titleRaw && extractMcqOrdinalFromTitlePlain(titleRaw)) return true;
      if (
        lastDomQuizQuestionNumber != null &&
        Number.isFinite(lastDomQuizQuestionNumber)
      )
        return true;
      return false;
    }
    if (bodyOk && choiceOk) return true;
    const titleRaw = getVisibleMcqTitleText();
    return !!(titleRaw && extractMcqOrdinalFromTitlePlain(titleRaw));
  }

  function isNetacadHost() {
    try {
      const h = location.hostname || "";
      return h === "www.netacad.com" || h.endsWith(".netacad.com");
    } catch (_e) {
      return false;
    }
  }

  /** 是否像测验/选择题页 */
  function isLikelyQuizPage() {
    extractQuizDomContext();
    if (hasMcqCourseWidgetDom()) return true;

    const merged = getMergedDomInnerText();
    const stem = (lastDomStemBlob || "").trim();
    const blob = (merged + "\n" + stem).replace(/\s+/g, " ").trim();

    if (
      /检查您的理解情况|检验您的理解|理解水平|检验理解|单元测试/.test(blob)
    )
      return true;
    if (/check your understanding|knowledge check|unit test/i.test(blob))
      return true;

    const hasRadioLight = !!document.querySelector(
      'input[type="radio"], [role="radio"], [role="radiogroup"], button[role="radio"]'
    );
    const hasRadioDeep =
      querySelectorAllDeep(
        document,
        'input[type="radio"], [role="radio"], [role="radiogroup"]',
        8
      ).length > 0;
    const hasRadio = hasRadioLight || hasRadioDeep;

    const hasMcqLikeDom =
      !!document.querySelector(
        '[class*="quiz" i], [class*="assessment" i], [class*="multiple" i][class*="choice" i], [data-testid*="question" i], [data-testid*="choice" i], [class*="mcq__"], ' +
          OBJECT_MATCHING_DOM
      ) ||
      hasRadio ||
      querySelectorAllDeep(document, "[class*=\"mcq__\"]", 3).length > 0;

    if (window !== window.top) {
      const hasQuestionCue =
        /问题\s*\d+/.test(blob) ||
        /\bquestion\s*\d+/i.test(blob) ||
        /\bQ\s*\d+/i.test(blob);
      if (hasQuestionCue && (blob.length > 20 || hasRadio || hasMcqLikeDom)) {
        return true;
      }

      const quizChrome =
        /跳过问题|全部跳过|提交|下一个问题|Check Your Understanding/i.test(
          blob
        );
      if (hasRadio && (blob.length > 40 || quizChrome)) return true;

      if (hasRadio && /\d+\s*的\s*\d+/.test(blob) && blob.length > 30) {
        return true;
      }

      if (
        isNetacadHost() &&
        /跳过问题|全部跳过/.test(blob) &&
        blob.length > 25
      ) {
        return true;
      }

      if (isNetacadHost() && hasMcqLikeDom && blob.length > 35) return true;

      // 弱关键词须配合测验 DOM
      if (
        isNetacadHost() &&
        /(?:检查|检验|理解|问题|question|q\s*\d|请选择|下列|哪[一个几]|which)/i.test(
          blob
        ) &&
        blob.length > 45 &&
        (hasMcqLikeDom || hasRadio)
      ) {
        return true;
      }
    }
    const MARK = /检查您的理解情况|检验您的理解|理解水平|单元测试/;
    const roots = document.querySelectorAll(
      "aside, [class*='sidebar' i], [class*='Sidebar' i], [class*='outline' i], [class*='toc' i], [class*='curriculum' i]"
    );
    for (const root of roots) {
      const actives = root.querySelectorAll(
        '[aria-current="true"], [aria-selected="true"]'
      );
      for (const el of actives) {
        if (el.closest && el.closest("#" + PANEL_ID)) continue;
        let n = el;
        for (let i = 0; i < 14 && n && root.contains(n); i++) {
          if (MARK.test(n.textContent || "")) return true;
          n = n.parentElement;
        }
      }
    }
    return false;
  }

  /** 含 open shadow 的测验页全文，用于结果态检测 */
  function shadowInclusiveQuizBlob(maxLen) {
    maxLen = maxLen || 80000;
    const parts = [];
    let total = 0;
    const push = (t) => {
      if (t == null || total >= maxLen) return;
      const s = String(t).replace(/\s+/g, " ").trim();
      if (!s) return;
      const n = Math.min(s.length, maxLen - total);
      if (n <= 0) return;
      parts.push(s.slice(0, n));
      total += n;
    };
    try {
      const main = document.querySelector("main");
      if (main && main.innerText) push(main.innerText);
      if (document.body && document.body.innerText) push(document.body.innerText);
      push(tryReadSameOriginIframesText(document, 0));
      const hosts = querySelectorAllDeep(document, "*", 220);
      for (const el of hosts) {
        if (total >= maxLen) break;
        if (!el || !el.shadowRoot) continue;
        try {
          const st =
            el.shadowRoot.innerText ||
            el.shadowRoot.textContent ||
            "";
          push(st);
        } catch (_e) {
          /* */
        }
      }
    } catch (_e) {
      /* */
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  /** 轻量检测测验结果/提交态 */
  function looksLikeSubmittedOrResultUi() {
    try {
      const blob = shadowInclusiveQuizBlob(72000);
      if (blob.length < 8) return false;
      if (
        /你的得分是\s*\d+\s*%|您的得分是\s*\d+\s*%|得分(?:为|是)\s*\d+\s*%/.test(
          blob
        )
      )
        return true;
      if (
        /恭喜你[^。]{0,40}通过|你通过了考试|您通过了考试|未通过|已通过/.test(blob)
      )
        return true;
      if (
        /尝试次数|总分|满分/.test(blob) &&
        /%/.test(blob) &&
        /通过|未通过|失败/.test(blob)
      )
        return true;
      if (
        /测验已完成|测验.?反馈|成绩.?汇总|答题.?概况|感谢.*完成|答题回顾|测验结果|结果页面|查看.*结果|回顾.*答题/i.test(
          blob
        )
      )
        return true;
      if (
        /正确\s*(?:题|答案)|错误\s*(?:题|答案)|未回答|漏答/.test(blob) &&
        (/\d+\s*\/\s*\d+/.test(blob) || /共\s*\d+\s*题/.test(blob))
      )
        return true;
      if (/您已提交|已提交.*答案|本次测验|测验结束|考试结束/i.test(blob))
        return true;
      if (/\byour score is\b.*\d+\s*%/i.test(blob)) return true;
      return false;
    } catch (_e) {
      return false;
    }
  }

  /** 测验结果/分数页 */
  function isMcqResultSummaryView() {
    if (looksLikeSubmittedOrResultUi()) return true;
    extractQuizDomContext();
    const merged = getMergedDomInnerText();
    const iframeTxt = tryReadSameOriginIframesText();
    const stem = (lastDomStemBlob || "").trim();
    const blob = (merged + "\n" + iframeTxt + "\n" + stem)
      .replace(/\s+/g, " ")
      .trim();

    const tabLooksSelected = (el) => {
      if (!el || isInOurPanel(el)) return false;
      if (el.getAttribute("aria-selected") === "true") return true;
      if (el.getAttribute("aria-current") === "true") return true;
      if (el.getAttribute("aria-pressed") === "true") return true;
      if (el.getAttribute("data-selected") === "true") return true;
      if (el.getAttribute("data-state") === "active") return true;
      if (el.getAttribute("data-state") === "on") return true;
      if (el.classList && el.classList.contains("selected")) return true;
      if (el.classList && el.classList.contains("active")) return true;
      return false;
    };

    try {
      const deepTabs = querySelectorAllDeep(document, '[role="tab"]', 56);
      for (const el of deepTabs) {
        if (!tabLooksSelected(el)) continue;
        const tx = (el.innerText || el.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        if (/结果页面|测验结果/i.test(tx) && tx.length < 56) return true;
        if (/^results?$/i.test(tx) && tx.length < 24) return true;
      }
      const loose = querySelectorAllDeep(
        document,
        '[role="button"], button',
        40
      );
      for (const el of loose) {
        if (!tabLooksSelected(el)) continue;
        const tx = (el.innerText || el.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        if (/^结果页面$/i.test(tx) || /^结果页面\s*$/i.test(tx)) return true;
      }
    } catch (_e) {
      /* */
    }

    if (
      /你的得分是\s*\d+\s*%/.test(blob) ||
      /您的得分是\s*\d+\s*%/.test(blob) ||
      /得分(?:为|是)\s*\d+\s*%/.test(blob) ||
      /恭喜你[^。]{0,40}通过/.test(blob) ||
      /你通过了考试|您通过了考试/.test(blob) ||
      (/尝试次数|总分|满分/.test(blob) &&
        /%/.test(blob) &&
        /通过|未通过|失败/.test(blob))
    ) {
      return true;
    }
    if (
      /测验已完成|测验.?反馈|测试.?反馈|成绩.?汇总|答题.?概况|感谢.*完成/i.test(
        blob
      )
    ) {
      return true;
    }
    if (
      /正确\s*(?:题|答案)|错误\s*(?:题|答案)|未回答|漏答/i.test(blob) &&
      (/\d+\s*\/\s*\d+/.test(blob) || /共\s*\d+\s*题/.test(blob))
    ) {
      return true;
    }
    if (
      /\byour score is\b.*\d+\s*%/i.test(blob) ||
      /\bcongratulations\b.*\bpass/i.test(blob)
    ) {
      return true;
    }

    return false;
  }

  /** 顶层 main 过短时不在此 frame 挂 UI */
  function shouldMountUi() {
    const isTop = window === window.top;
    if (!isTop) return true;

    const mainLen = (
      document.querySelector("main")?.innerText || ""
    ).trim().length;
    const bodyLen = ((document.body && document.body.innerText) || "").trim()
      .length;

    if (mainLen >= 400) return true;
    if (bodyLen > 3200) return true;
    return false;
  }

  function isNetworkModuleFresh() {
    const t = settings.netacadCapturedAt;
    if (t == null) return false;
    return Date.now() - Number(t) < NET_CAPTURE_TTL_MS;
  }

  /** 是否已捕获 components.json 路径 */
  function hasNetacadPathCapture() {
    return (
      isNetworkModuleFresh() &&
      settings.netacadComponentsBasePath != null &&
      String(settings.netacadComponentsBasePath).trim() !== ""
    );
  }

  /** 从地址解析课节段 slug */
  function getCourseContentSlugFromPageLocation() {
    try {
      const u = new URL(location.href);
      let h = (u.hash || "").replace(/^#/, "");
      if (h.indexOf("%") >= 0) {
        try {
          h = decodeURIComponent(h);
        } catch (_e) {
          /*  */
        }
      }
      const blob = `${u.pathname}/${h}`.replace(/#/g, "/");
      const m = blob.match(/\/courses\/content\/([^/]+)(?:\/|$)/i);
      return m ? m[1] : null;
    } catch (_e) {
      return null;
    }
  }

  /** 缓存路径与当前页课节是否一致 */
  function netacadStoredPathMatchesCurrentPage() {
    const urlSlug = getCourseContentSlugFromPageLocation();
    if (urlSlug == null || urlSlug === "") return true;
    const storedSlug = slugForModuleFromComponentsBasePath(
      settings.netacadComponentsBasePath || ""
    );
    if (!storedSlug) return true;
    return (
      String(urlSlug).toLowerCase() === String(storedSlug).toLowerCase()
    );
  }

  function hasUsableNetacadPathCapture() {
    return hasNetacadPathCapture() && netacadStoredPathMatchesCurrentPage();
  }

  function pathHintFromSettings() {
    if (!isNetworkModuleFresh()) return "默认";
    if (
      hasUsableNetacadPathCapture() ||
      settings.netacadContentBase ||
      settings.netacadCourseSegment
    )
      return "网络";
    return "默认";
  }

  /** 捕获路径推断模块占位符 */
  function resolvePlaceholderFromCapture() {
    const n = settings.netacadModuleFromNet;
    if (n != null && !Number.isNaN(Number(n))) return Number(n);
    const p = String(settings.netacadComponentsBasePath || "").replace(
      /\/+$/,
      ""
    );
    const slug = slugForModuleFromComponentsBasePath(p);
    if (slug && !segmentLooksLikeUuid(slug)) {
      const d = deriveModuleNumberFromSegment(slug);
      if (d != null) return d;
    }
    return (
      detectModuleNumberFromPage() ?? getModuleFromLocationUrl() ?? 1
    );
  }

  function canResolveComponentsTarget() {
    if (hasUsableNetacadPathCapture()) return true;
    return getDomInferredCourseSegment() != null;
  }

  /** 从地址解析 contentBase */
  function getContentBaseFromPageLocation() {
    try {
      const u = new URL(location.href);
      let h = (u.hash || "").replace(/^#/, "");
      if (h.indexOf("%") >= 0) {
        try {
          h = decodeURIComponent(h);
        } catch (_e) {
          /*  */
        }
      }
      const blob = `${u.pathname}/${h}`.replace(/#/g, "/");
      const m = blob.match(/\/content\/(.+?)\/courses\/content\//i);
      if (!m) return null;
      const base = m[1].replace(/^\/+|\/+$/g, "");
      return base || null;
    } catch (_e) {
      return null;
    }
  }

  function getContentBase() {
    bumpLocCourseSticky();
    return (
      locCourseSticky.contentBase ||
      settings.netacadContentBase ||
      CONTENT_BASE_FALLBACK
    );
  }

  function getLocale() {
    return settings.netacadLocale || LOCALE_FALLBACK;
  }

  /** 存储的 basePath 拼 components.json 绝对 URL */
  function absoluteComponentsUrlFromStoredPath() {
    const p = String(settings.netacadComponentsBasePath || "").replace(
      /\/+$/,
      ""
    );
    if (!p) return null;
    const lastSeg = p.split("/").filter(Boolean).pop() || "";
    if (looksLikeLocaleSegment(lastSeg)) {
      return `https://www.netacad.com${p}/components.json`;
    }
    const loc = getLocale();
    return `https://www.netacad.com${p}/${loc}/components.json`;
  }

  /** 从 URL 参数或 hash 解析模块号 */
  function getModuleFromLocationUrl() {
    try {
      const u = new URL(location.href);
      const q = u.searchParams.get("moduleNumber");
      if (q && /^\d+$/.test(q)) {
        const n = parseInt(q, 10);
        if (n > 0 && n < 99) return n;
      }
      const hm = (u.hash || "").match(/\/courses\/content\/([^/]+)\b/i);
      if (hm) {
        const n = deriveModuleNumberFromSegment(hm[1]);
        if (n != null && n > 0 && n < 99) return n;
      }
    } catch (_e) {
      /*  */
    }
    return null;
  }

  /** 从地址解析课节路径段 */
  function getCourseSegmentFromLocationUrl() {
    return getCourseContentSlugFromPageLocation();
  }

  /** DOM/地址栏推断课节段 */
  function getDomInferredCourseSegment() {
    bumpLocCourseSticky();
    const fromPath = locCourseSticky.courseSlug || getCourseSegmentFromLocationUrl();
    if (fromPath && /^[a-z0-9][a-z0-9._-]{0,120}$/i.test(fromPath))
      return fromPath;
    const n = detectModuleNumberFromPage() ?? getModuleFromLocationUrl();
    if (n != null) return `m${n}`;
    return null;
  }

  function modelSourceLabel(placeholderMod) {
    if (hasUsableNetacadPathCapture()) return "网络请求";
    const d = detectModuleNumberFromPage();
    if (d === placeholderMod) return "侧栏";
    if (getModuleFromLocationUrl() === placeholderMod) return "地址栏/Hash";
    return "自动";
  }

  function sectionFromNearestPrecedingText(componentsInfo, mcqIdx, m) {
    let j = mcqIdx - 1;
    while (j >= 0 && isQuizQuestionComponent(componentsInfo[j])) j -= 1;
    if (j < 0 || componentsInfo[j]._component !== "text") return [null, null];
    const prev = componentsInfo[j];
    const t =
      applyModulePlaceholder(prev.title || "", m).trim() || null;
    const b = stripHtmlToPlain(
      applyModulePlaceholder(prev.body || "", m)
    );
    return [t, b];
  }

  function objectMatchingFeedbackPlain(comp) {
    const fb = comp._feedback || comp.feedback;
    if (!fb) return null;
    const raw = fb.correct || fb._correct || "";
    return stripHtmlToPlain(raw) || null;
  }

  /** objectMatching 条目 */
  function buildObjectMatchingEntry(componentInfo, unitTitle, unitBody) {
    const body = componentInfo.body || "";
    let items = componentInfo._items;
    if (!Array.isArray(items)) items = [];
    const categoryHints = [];
    for (const it of items) {
      const hq = (
        stripHtmlToPlain(it.question) ||
        String(it.question || "")
          .replace(/<[^>]+>/g, " ")
          .trim()
      )
        .replace(/\s+/g, " ")
        .trim();
      if (hq && categoryHints.indexOf(hq) < 0) categoryHints.push(hq);
    }
    const lines = [];
    for (const it of items) {
      const q = (
        stripHtmlToPlain(it.question) ||
        String(it.question || "")
          .replace(/<[^>]+>/g, " ")
          .trim()
      )
        .replace(/\s+/g, " ")
        .trim();
      const a = (
        stripHtmlToPlain(it.answer) ||
        String(it.answer || "")
          .replace(/<[^>]+>/g, " ")
          .trim()
      )
        .replace(/\s+/g, " ")
        .trim();
      if (q && a) lines.push(`${q}：${a}`);
      else if (a) lines.push(a);
    }
    let correctDisplay = lines.join("\n").trim() || null;
    if (!correctDisplay) {
      correctDisplay = objectMatchingFeedbackPlain(componentInfo);
    }
    // 组装 objectMatching 题干
    const 问题 =
      categoryHints.length > 0
        ? `${body}\n${categoryHints.join("\n")}`
        : body;
    const answerKeys = [];
    for (const it of items) {
      const ak = (
        stripHtmlToPlain(it.answer) ||
        String(it.answer || "")
          .replace(/<[^>]+>/g, " ")
          .trim()
      )
        .replace(/\s+/g, " ")
        .trim();
      if (ak && answerKeys.indexOf(ak) < 0) answerKeys.push(ak);
    }
    return {
      所属单元: { 标题: unitTitle, 说明: unitBody },
      问题,
      正确答案: correctDisplay,
      正确答案标号行: correctDisplay,
      选项: lines.length ? lines : correctDisplay ? [correctDisplay] : [],
      objectMatchingCategoryKeys:
        categoryHints.length >= 2 ? categoryHints : null,
      objectMatchingAnswerKeys: answerKeys.length ? answerKeys : null,
    };
  }

  /** matching 组件转与 objectMatching 统一的条目结构 */
  function buildMatchingEntry(componentInfo, unitTitle, unitBody) {
    const body = componentInfo.body || "";
    let items = componentInfo._items;
    if (!Array.isArray(items)) items = [];
    const categoryHints = [];
    const lines = [];
    const answerKeys = [];
    for (const it of items) {
      const rowText = (
        stripHtmlToPlain(it.text) ||
        String(it.text || "")
          .replace(/<[^>]+>/g, " ")
          .trim()
      )
        .replace(/\s+/g, " ")
        .trim();
      if (!rowText) continue;
      const opts = Array.isArray(it._options) ? it._options : [];
      let correctOpt = null;
      for (let oi = 0; oi < opts.length; oi++) {
        const o = opts[oi];
        if (o && o._isCorrect === true) {
          correctOpt = o;
          break;
        }
      }
      const ansText = correctOpt
        ? (
            stripHtmlToPlain(correctOpt.text) ||
            String(correctOpt.text || "")
              .replace(/<[^>]+>/g, " ")
              .trim()
          )
            .replace(/\s+/g, " ")
            .trim()
        : "";
      if (rowText && ansText) {
        lines.push(rowText + "：" + ansText);
        if (categoryHints.indexOf(rowText) < 0) categoryHints.push(rowText);
        if (answerKeys.indexOf(ansText) < 0) answerKeys.push(ansText);
      }
    }
    let correctDisplay = lines.join("\n").trim() || null;
    if (!correctDisplay) {
      correctDisplay = objectMatchingFeedbackPlain(componentInfo);
    }
    const 问题 =
      categoryHints.length > 0
        ? body + "\n" + categoryHints.join("\n")
        : body;
    return {
      所属单元: { 标题: unitTitle, 说明: unitBody },
      问题,
      正确答案: correctDisplay,
      正确答案标号行: correctDisplay,
      选项: lines.length ? lines : correctDisplay ? [correctDisplay] : [],
      objectMatchingCategoryKeys:
        categoryHints.length >= 2 ? categoryHints : null,
      objectMatchingAnswerKeys: answerKeys.length ? answerKeys : null,
    };
  }

  function buildMcqEntry(componentInfo, unitTitle, unitBody) {
    const body = componentInfo.body || "";
    let items = componentInfo._items;
    if (!Array.isArray(items)) items = [];

    const correctTexts = items
      .filter((it) => it._shouldBeSelected)
      .map((it) => mcqOptionPlainText(it.text))
      .filter(Boolean);

    let correctDisplay = null;
    if (correctTexts.length === 0) correctDisplay = null;
    else if (correctTexts.length === 1) correctDisplay = correctTexts[0];
    else correctDisplay = correctTexts.join("\n");

    const optionLines = items.map((it) => {
      const text = mcqOptionPlainText(it.text);
      let line = text;
      if (it._shouldBeSelected) line += " （正确答案）";
      return line;
    });

    const 正确答案标号行 =
      correctTexts.length > 0 ? correctTexts.join("\n") : null;

    return {
      所属单元: { 标题: unitTitle, 说明: unitBody },
      问题: body,
      正确答案: correctDisplay,
      正确答案标号行,
      选项: optionLines,
    };
  }

  /** 全部计分题条目列表 */
  function buildAllMcqEntries(componentsInfo, m) {
    const out = [];
    for (let idx = 0; idx < componentsInfo.length; idx++) {
      const comp = componentsInfo[idx];
      if (!isQuizQuestionComponent(comp)) continue;
      if (comp._isDeprecated === true) continue;
      const [ut, ub] = sectionFromNearestPrecedingText(componentsInfo, idx, m);
      const entry =
        comp._component === "mcq"
          ? buildMcqEntry(comp, ut, ub)
          : comp._component === "matching"
            ? buildMatchingEntry(comp, ut, ub)
            : buildObjectMatchingEntry(comp, ut, ub);
      out.push({
        index: idx,
        r2aMapId: comp._r2aMapId || "",
        componentId:
          comp._id != null && String(comp._id).trim() !== ""
            ? String(comp._id).trim()
            : "",
        entry,
      });
    }
    return out;
  }

  /** 按当前小节筛 MCQ */
  function filterMcqsByOutlineRef(mcqs, outlineRef) {
    if (!outlineRef || !Array.isArray(mcqs) || !mcqs.length) {
      return { list: mcqs, didFilter: false };
    }
    const rawO = String(outlineRef).trim();
    if (!rawO) return { list: mcqs, didFilter: false };
    const oRel = relaxForMatch(rawO);
    if (!oRel || oRel.length < 2) return { list: mcqs, didFilter: false };

    const byR2a = [];
    for (const row of mcqs) {
      const mapSec = extractMcqSectionFromR2aMapId(row.r2aMapId || "");
      if (mapSec && outlineRefMatchesR2aMapSection(rawO, mapSec)) {
        byR2a.push(row);
      }
    }
    if (byR2a.length) {
      return { list: byR2a, didFilter: true };
    }

    const out = [];
    for (const row of mcqs) {
      const ut = row.entry.所属单元?.标题;
      const ub = row.entry.所属单元?.说明;
      const rawPack = [ut, ub].filter(Boolean).join(" ");
      if (rawPack.includes(rawO)) {
        out.push(row);
        continue;
      }
      const utr = relaxForMatch(ut || "");
      const ubr = relaxForMatch(ub || "");
      if (utr && (utr.includes(oRel) || oRel.includes(utr.slice(0, Math.min(24, utr.length)))))
        out.push(row);
      else if (ubr && (ubr.includes(oRel) || oRel.includes(ubr.slice(0, Math.min(24, ubr.length)))))
        out.push(row);
    }
    if (!out.length) return { list: mcqs, didFilter: false };
    return { list: out, didFilter: true };
  }

  function componentsUrl(courseSegment, base, loc) {
    const seg = String(courseSegment || "").replace(/^\/+|\/+$/g, "");
    if (!seg) throw new Error("课节路径段为空");
    return `https://www.netacad.com/content/${base}/courses/content/${seg}/${loc}/components.json`;
  }

  async function fetchComponentsAtUrl(url) {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}：${url}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("components.json 格式异常（应为数组）");
    return data;
  }

  async function loadComponents(courseSegment, base, loc) {
    return fetchComponentsAtUrl(componentsUrl(courseSegment, base, loc));
  }

  function isInOurPanel(el) {
    return (
      el &&
      (el.id === PANEL_ID || (el.closest && el.closest("#" + PANEL_ID)))
    );
  }

  /** 穿透 open shadow 查询 */
  function querySelectorAllDeep(root, selector, max) {
    max = max == null ? 120 : max;
    const out = [];
    if (!root || !selector) return out;
    const stack = [root];
    const seen = new WeakSet();
    while (stack.length && out.length < max) {
      const cur = stack.pop();
      if (!cur || seen.has(cur)) continue;
      seen.add(cur);
      try {
        if (typeof cur.querySelectorAll === "function") {
          cur.querySelectorAll(selector).forEach((n) => {
            if (out.length < max && n && !isInOurPanel(n)) out.push(n);
          });
          cur.querySelectorAll("*").forEach((host) => {
            if (host && host.shadowRoot) stack.push(host.shadowRoot);
          });
        }
      } catch (_e) {
        /*  */
      }
    }
    return out;
  }

  function isLikelySidebar(el) {
    return el && el.closest && el.closest("aside, nav, [role='navigation']");
  }

  let lastDomQuizQuestionNumber = null;
  let lastDomQuizHints = null;
  let lastDomStemBlob = "";
  let lastDomOutlineRef = null;

  /** 解析课节大纲号 供与 JSON 小节对齐 */
  function extractCourseOutlineRefNearMcq(skip) {
    const mcqSel =
      '.mcq__body-inner, .mcq__body, [class*="mcq__body-inner"], [class*="mcq__body" i], ' +
      OBJECT_MATCHING_DOM;
    const nodes = querySelectorAllDeep(document, mcqSel, 24);
    const pickFromLine = (line) => {
      const s = String(line || "").replace(/\s+/g, " ").trim();
      if (!s) return null;
      const head = s.match(/^(\d{1,2}\.\d+(?:\.\d+){0,5})\b/);
      if (head) return head[1];
      const mid = s.match(/\b(\d{1,2}\.\d+(?:\.\d+){1,5})\b/);
      return mid ? mid[1] : null;
    };
    const pickFromBlock = (text) => {
      const flat = String(text || "").replace(/\s+/g, " ").trim();
      if (!flat) return null;
      const head = flat.match(/^(\d{1,2}\.\d+(?:\.\d+){0,5})\b/);
      if (head) return head[1];
      const lines = flat.split(/[|\n]/);
      for (const ln of lines) {
        const p = pickFromLine(ln);
        if (p) return p;
      }
      const mid = flat.match(/\b(\d{1,2}\.\d+(?:\.\d+){1,5})\b/);
      return mid ? mid[1] : null;
    };
    for (const node of nodes) {
      if (skip(node)) continue;
      let el = node;
      for (let d = 0; d < 22 && el; d++) {
        const slice = (el.innerText || "").slice(0, 900);
        const hit = pickFromBlock(slice);
        if (hit) return hit;
        el = el.parentElement;
      }
      for (
        let sib = node.previousElementSibling;
        sib;
        sib = sib.previousElementSibling
      ) {
        const hit = pickFromBlock((sib.innerText || "").slice(0, 500));
        if (hit) return hit;
      }
    }
    for (const sel of [
      "main h1",
      "main h2",
      "[role='main'] h1",
      "[role='main'] h2",
    ]) {
      const h = document.querySelector(sel);
      if (!h || skip(h)) continue;
      const firstLine = ((h.innerText || "").split("\n")[0] || "").trim();
      const hit = pickFromLine(firstLine);
      if (hit) return hit;
    }
    for (const h of querySelectorAllDeep(document, "h1, h2, h3", 72)) {
      if (!h || skip(h)) continue;
      const firstLine = ((h.innerText || "").split("\n")[0] || "").trim();
      const hit = pickFromLine(firstLine);
      if (hit) return hit;
    }
    {
      const tHit = pickFromLine(document.title || "");
      if (tHit) return tHit;
    }
    return null;
  }

  /** 从 DOM 解析当前题号 */
  function extractVisibleMcqQuestionNumber(skip) {
    const sel =
      '.mcq__body-inner, .mcq__body, [class*="mcq__body" i], ' +
      OBJECT_MATCHING_DOM;
    const bodies = querySelectorAllDeep(document, sel, 56);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const anchorY = vh * 0.4;
    const scored = [];
    for (const bodyEl of bodies) {
      if (skip(bodyEl)) continue;
      if (!domElLikelyRenderedForUser(bodyEl)) continue;
      const r = bodyEl.getBoundingClientRect();
      const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      const area = visW * visH;
      if (visW * visH < 24) continue;
      const rawStem = (bodyEl.innerText || bodyEl.textContent || "").trim();
      if (rawStem.length < 4) continue;
      const midY =
        (Math.max(r.top, 0) + Math.min(r.bottom, vh)) / 2 || r.top + r.height / 2;
      const dist = Math.abs(midY - anchorY);
      scored.push({ bodyEl, rawStem, area, dist });
    }
    scored.sort((a, b) => {
      const strong = (x) => (x.area >= 72 ? 1 : 0);
      const ds = strong(b) - strong(a);
      if (ds !== 0) return ds;
      return b.area - a.area || a.dist - b.dist;
    });

    const tryParseFromBody = (bodyEl, rawStem) => {
      const stemKey = rawStem.slice(0, Math.min(48, rawStem.length));
      if (stemKey.length < 4) return null;

      let scope =
        bodyEl.closest('[class*="component"]') || bodyEl.parentElement;
      for (let up = 0; up < 18 && scope; up++) {
        const full = (scope.innerText || "").replace(/\s+/g, " ");
        const prog = full.match(/(\d+)\s*的\s*(\d+)\s*问题/);
        if (prog) {
          const a = parseInt(prog[1], 10);
          const b = parseInt(prog[2], 10);
          if (a > 0 && b > 0 && a < 500 && b < 500) {
            if (a <= b) return a;
            if (a === b + 1) return b;
          }
        }
        const stemIdx =
          stemKey.length >= 6 ? full.indexOf(stemKey.slice(0, 6)) : -1;
        let bestN = null;
        let bestPos = -1;
        const re = /问题\s*(\d+)/gi;
        let m;
        while ((m = re.exec(full)) !== null) {
          const pos = m.index;
          const num = parseInt(m[1], 10);
          if (num <= 0 || num >= 500) continue;
          const beforeStem = stemIdx < 0 || pos < stemIdx;
          if (beforeStem && pos > bestPos) {
            bestPos = pos;
            bestN = num;
          }
        }
        if (bestN != null) return bestN;

        const reQ = /\bQ\s*(\d+)\b/gi;
        bestN = null;
        bestPos = -1;
        while ((m = reQ.exec(full)) !== null) {
          const pos = m.index;
          const num = parseInt(m[1], 10);
          if (num <= 0 || num >= 500) continue;
          const beforeStem = stemIdx < 0 || pos < stemIdx;
          if (beforeStem && pos > bestPos) {
            bestPos = pos;
            bestN = num;
          }
        }
        if (bestN != null) return bestN;

        scope = scope.parentElement;
      }
      return null;
    };

    for (const { bodyEl, rawStem } of scored.slice(0, 10)) {
      const hit = tryParseFromBody(bodyEl, rawStem);
      if (hit != null) return hit;
    }
    return null;
  }

  /** 扫描 DOM 更新 lastDom* */
  function extractQuizDomContext() {
    lastDomQuizQuestionNumber = null;
    lastDomOutlineRef = null;
    lastDomQuizHints = {
      tabQ: null,
      headingQs: [],
      dataHint: null,
      contentQ: null,
    };
    const stems = [];
    const seenStem = new Set();
    const addStem = (t) => {
      const s = String(t || "")
        .replace(/\s+/g, " ")
        .trim();
      if (s.length < 12 || s.length > 12000) return;
      const key = s.slice(0, 120);
      if (seenStem.has(key)) return;
      seenStem.add(key);
      stems.push(s);
    };

    const skip = (el) => !el || isInOurPanel(el);

    try {
      const visQ = extractVisibleMcqQuestionNumber(skip);
      if (visQ != null) {
        lastDomQuizQuestionNumber = visQ;
        lastDomQuizHints.contentQ = visQ;
      }

      const outlineHit = extractCourseOutlineRefNearMcq(skip);
      if (outlineHit) lastDomOutlineRef = outlineHit;

      document
        .querySelectorAll(
          'h1, h2, h3, h4, [role="heading"], [class*="question" i], [class*="prompt" i]'
        )
        .forEach((h) => {
          if (skip(h)) return;
          const t = (h.innerText || h.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
          if (t.length < 4) return;
          const mq = t.match(/问题\s*(\d+)\s*[:：]?\s*/i);
          if (mq) {
            const n = parseInt(mq[1], 10);
            if (n > 0 && n < 500) {
              lastDomQuizHints.headingQs.push(n);
              if (lastDomQuizQuestionNumber == null) {
                lastDomQuizQuestionNumber = n;
              }
            }
          }
          const mqEn = t.match(/question\s*(\d+)\s*[:：]?\s*/i);
          if (mqEn) {
            const n = parseInt(mqEn[1], 10);
            if (n > 0 && n < 500) {
              lastDomQuizHints.headingQs.push(n);
              if (lastDomQuizQuestionNumber == null) {
                lastDomQuizQuestionNumber = n;
              }
            }
          }
          addStem(t);
        });

      document
        .querySelectorAll(
          "[data-question-number], [data-question-id], [data-item-index], [data-questionindex]"
        )
        .forEach((el) => {
          if (skip(el)) return;
          const v =
            el.getAttribute("data-question-number") ||
            el.getAttribute("data-question-id") ||
            el.getAttribute("data-item-index") ||
            el.getAttribute("data-questionindex");
          if (v && /^\d+$/.test(String(v).trim())) {
            const n = parseInt(String(v).trim(), 10);
            if (n > 0 && n < 500) {
              lastDomQuizHints.dataHint = n;
              if (lastDomQuizQuestionNumber == null) {
                lastDomQuizQuestionNumber = n;
              }
            }
          }
        });

      document
        .querySelectorAll(
          '[role="tab"][aria-selected="true"], [role="tab"][aria-current="true"]'
        )
        .forEach((tab) => {
          if (skip(tab)) return;
          const raw = (tab.innerText || tab.textContent || "").replace(
            /\s+/g,
            " "
          );
          const t = raw.trim();
          let m = t.match(/^Q\s*(\d+)$/i);
          if (!m) m = t.match(/^问题\s*(\d+)\s*$/i);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > 0 && n < 500) {
              lastDomQuizHints.tabQ = n;
              if (lastDomQuizQuestionNumber == null) {
                lastDomQuizQuestionNumber = n;
              }
            }
          }
        });

      let rgRoot = document.querySelector('[role="radiogroup"]');
      if (!rgRoot) {
        const deepRg = querySelectorAllDeep(
          document,
          '[role="radiogroup"]',
          6
        );
        if (deepRg.length) rgRoot = deepRg[0];
      }
      if (!rgRoot) {
        const inp =
          document.querySelector('input[type="radio"], [role="radio"]') ||
          querySelectorAllDeep(
            document,
            'input[type="radio"], [role="radio"]',
            4
          )[0];
        if (inp && !skip(inp)) {
          rgRoot =
            inp.closest('[role="radiogroup"]') ||
            inp.closest("form") ||
            inp.parentElement;
        }
      }
      if (rgRoot && !skip(rgRoot)) {
        addStem(rgRoot.innerText);
        let p = rgRoot.parentElement;
        for (let d = 0; d < 7 && p; d++) {
          if (!skip(p)) addStem(p.innerText);
          p = p.parentElement;
        }
      }

      querySelectorAllDeep(
        document,
        [
          ".mcq__body",
          ".mcq__body-inner",
          '[class*="mcq__body" i]',
          ".mcq__item-text-inner",
          ".mcq__item",
          '[class*="mcq__stem" i]',
          '[class*="mcq__prompt" i]',
          '[class*="mcq__question" i]',
          '[class*="mcq__statement" i]',
          OBJECT_MATCHING_DOM,
        ].join(", "),
        80
      ).forEach((node) => {
        if (skip(node)) return;
        addStem(node.innerText || node.textContent);
      });
    } catch (_e) {
      /*  */
    }

    const domStemBlob = stems.join("\n\n");
    lastDomStemBlob = domStemBlob;
    return {
      domQuestionNumber: lastDomQuizQuestionNumber,
      domStemBlob,
      hints: lastDomQuizHints,
    };
  }

  /** 同源 iframe 递归读 body */
  function tryReadSameOriginIframesText(root, depth) {
    root = root || document;
    depth = depth || 0;
    if (depth > 8) return "";
    let s = "";
    for (const ifr of root.querySelectorAll("iframe")) {
      if (isInOurPanel(ifr)) continue;
      try {
        const doc = ifr.contentDocument;
        if (doc && doc.body) {
          s += "\n" + (doc.body.innerText || "");
          s += tryReadSameOriginIframesText(doc, depth + 1);
        }
      } catch (_e) {
        /* 跨域 */
      }
    }
    return s;
  }

  /** 主内容区多段文本 */
  function getQuizPageTextForMatch() {
    const chunks = [];
    const pushChunk = (t, max) => {
      if (!t || t.length < 20) return;
      chunks.push(String(t).slice(0, max || 10000));
    };
    const pushChunkLoose = (t, max) => {
      if (!t || t.length < 10) return;
      chunks.push(String(t).slice(0, max || 10000));
    };

    const domQuiz = extractQuizDomContext();
    pushChunk(domQuiz.domStemBlob, 20000);
    pushChunkLoose(domQuiz.domStemBlob, 20000);

    querySelectorAllDeep(
      document,
      '.mcq__body, .mcq__body-inner, [class*="mcq__body" i], .mcq__item-text-inner, .mcq__item, [class*="mcq__item"], ' +
        OBJECT_MATCHING_DOM,
      60
    ).forEach((n) => {
      if (!isInOurPanel(n)) {
        const t = (n.innerText || n.textContent || "").trim();
        pushChunkLoose(t, 3000);
      }
    });

    pushChunk(getMergedDomInnerText(), 32000);

    if (window !== window.top) {
      document
        .querySelectorAll('[role="radiogroup"], [role="group"]')
        .forEach((rg) => {
          if (!isInOurPanel(rg)) pushChunkLoose(rg.innerText, 8000);
        });
    }

    pushChunk(tryReadSameOriginIframesText(), 15000);

    // main 全文
    const mainSelectors = [
      "main",
      "[role='main']",
      "#root main",
      "article",
    ];
    const seenMain = new Set();
    for (const sel of mainSelectors) {
      document.querySelectorAll(sel).forEach((root) => {
        if (!root || isInOurPanel(root) || isLikelySidebar(root)) return;
        const key = root;
        if (seenMain.has(key)) return;
        seenMain.add(key);
        pushChunk(root.innerText || "", 12000);
      });
    }

    // 主列采样
    const w = window.innerWidth;
    const h = window.innerHeight;
    const xs = [0.48, 0.52, 0.56, 0.44].map((r) => Math.floor(w * r));
    const seenSig = new Set();
    for (let frac = 0.18; frac <= 0.88; frac += 0.06) {
      const y = Math.floor(h * frac);
      for (const x of xs) {
        const stack = document.elementsFromPoint(x, y);
        for (const el of stack) {
          if (!el || el.nodeType !== 1) continue;
          if (isInOurPanel(el) || isLikelySidebar(el)) continue;
          let cur = el;
          for (let d = 0; d < 8 && cur; d++) {
            if (isLikelySidebar(cur)) break;
            const sig = cur.tagName + (cur.className || "").slice(0, 80);
            if (!seenSig.has(sig)) {
              seenSig.add(sig);
              const t = cur.innerText || "";
              if (t.length > 35) pushChunk(t.slice(0, 1500), 1500);
            }
            cur = cur.parentElement;
          }
        }
      }
    }

    let merged = chunks.join("\n");
    merged = merged
      .replace(/\bNetAcad\s*答案助手\b/g, " ")
      .replace(/netacad-answer-helper/gi, " ")
      .replace(/未识别为测验页/g, " ")
    return merged.replace(/\s+/g, " ").trim();
  }

  /** 是否像对用户可见的渲染节点 */
  function domElLikelyRenderedForUser(el) {
    if (!el || !el.isConnected) return false;
    try {
      if (typeof el.checkVisibility === "function") {
        return el.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
        });
      }
    } catch (_e) {
      /*  */
    }
    let cur = el;
    for (let d = 0; d < 14 && cur; d++) {
      try {
        const st = window.getComputedStyle(cur);
        if (st.display === "none" || st.visibility === "hidden") return false;
        if (parseFloat(st.opacity) === 0) return false;
      } catch (_e) {
        return false;
      }
      cur = cur.parentElement;
    }
    return true;
  }

  /** 从标题文案解析测验题号（问题 n / Qn） */
  function extractQuizOrdinalFromTitlePlain(plain) {
    if (plain == null) return null;
    const p = String(plain)
      .replace(/[\u200b\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!p) return null;
    const reQ =
      /(?:^|[\s:：])(?:问题|question)\s*[:：]?\s*(\d+)(?!\d)(?:\s|$|:|：|\.|，|,)/i;
    const m = p.match(reQ);
    if (m) {
      const v = parseInt(m[1], 10);
      if (Number.isFinite(v) && v > 0 && v < 500) return v;
    }
    const compact = p.replace(/\s+/g, "");
    const m2 = compact.match(/^Q(\d+)(?!\d)$/i);
    if (m2) {
      const v = parseInt(m2[1], 10);
      if (Number.isFinite(v) && v > 0 && v < 500) return v;
    }
    return null;
  }

  /** 标题文案是否对应当前题号 */
  function titlePlainMatchesQuizOrdinal(plain, n) {
    if (plain == null || !Number.isFinite(n) || n < 1 || n >= 500) return false;
    return extractQuizOrdinalFromTitlePlain(plain) === n;
  }

  /** MCQ 正文节点所属组件标题上的题号 */
  function quizOrdinalForMcqBodyInner(bodyEl) {
    if (!bodyEl) return null;
    const host =
      bodyEl.closest("[class*='component-mcq' i]") ||
      bodyEl.closest(".component-mcq") ||
      bodyEl.closest("[class*='component' i]");
    if (!host || isInOurPanel(host)) return null;
    const t = host.querySelector(
      ".mcq__title-inner, [class*='mcq__title-inner' i], [class*='mcq__title' i]"
    );
    if (!t) return null;
    const plain =
      cleanMcqTitleInnerText(mcqTitleInnerPlainFromNode(t)) ||
      String(t.innerText || "")
        .replace(/\s+/g, " ")
        .trim();
    return extractQuizOrdinalFromTitlePlain(plain);
  }

  /** 题号对应的 is-question 宿主上的 data-socialgoodpulse-id（与 JSON _id 一致） */
  function extractDomSocialGoodPulseIdForQuizOrdinal(ordinalStr) {
    const n = parseInt(String(ordinalStr).trim(), 10);
    if (!Number.isFinite(n) || n < 1 || n >= 500) return null;
    const hosts = querySelectorAllDeep(document, "[data-socialgoodpulse-id]", 100);
    let bestId = null;
    let bestArea = -1;
    for (let hi = 0; hi < hosts.length; hi++) {
      const host = hosts[hi];
      if (
        !host ||
        isInOurPanel(host) ||
        !domElLikelyRenderedForUser(host)
      )
        continue;
      const cls = String(host.className || "");
      if (!/\bis-question\b/i.test(cls)) continue;

      const titles = querySelectorAllDeep(
        host,
        ".mcq__title-inner, [class*='mcq__title-inner'], .objectMatching__title-inner, [class*='objectMatching__title-inner']",
        8
      );
      let ordMatch = false;
      for (let ti = 0; ti < titles.length; ti++) {
        const t = titles[ti];
        if (!t || isInOurPanel(t)) continue;
        const plain =
          cleanMcqTitleInnerText(mcqTitleInnerPlainFromNode(t)) ||
          String(t.innerText || "")
            .replace(/\s+/g, " ")
            .trim();
        if (extractQuizOrdinalFromTitlePlain(plain) === n) {
          ordMatch = true;
          break;
        }
      }
      if (!ordMatch) continue;

      const area = elementVisibleViewportArea(host);
      if (area < 64) continue;
      const id = host.getAttribute("data-socialgoodpulse-id");
      if (!id || !String(id).trim()) continue;
      if (area > bestArea) {
        bestArea = area;
        bestId = String(id).trim();
      }
    }
    return bestId;
  }

  /** 用 DOM 组件 id 在 pool 中找唯一一行 */
  function findPoolRowByComponentDomId(ordinalStr, pool) {
    const cid = extractDomSocialGoodPulseIdForQuizOrdinal(ordinalStr);
    if (!cid || !pool || !pool.length) return null;
    const hits = [];
    for (let i = 0; i < pool.length; i++) {
      const r = pool[i];
      if (r && r.componentId && String(r.componentId) === cid) hits.push(r);
    }
    if (hits.length === 1) return hits[0];
    return null;
  }

  /** 按「问题 n」标题在附近 scope 取题干 */
  function stemTextAnchoredByProblemTitle(n) {
    if (!Number.isFinite(n) || n < 1 || n >= 500) return null;
    const titleSels = [
      ".mcq__title-inner",
      '[class*="mcq__title-inner"]',
      '[class*="mcq__title" i]',
      "h1",
      "h2",
      "h3",
      "h4",
      '[role="heading"]',
    ].join(", ");
    const titles = querySelectorAllDeep(document, titleSels, 120);
    let globalBestStem = null;
    let globalBestScore = -1;
    for (const t of titles) {
      if (
        !t ||
        isInOurPanel(t) ||
        isInCourseChromeSidebar(t) ||
        !domElLikelyRenderedForUser(t)
      )
        continue;
      const plain =
        cleanMcqTitleInnerText(mcqTitleInnerPlainFromNode(t)) ||
        String(t.innerText || "")
          .replace(/\s+/g, " ")
          .trim();
      if (!titlePlainMatchesQuizOrdinal(plain, n)) continue;

      const scopes = [];
      const comp = t.closest("[class*='component']");
      if (comp) scopes.push(comp);
      const art = t.closest("article");
      if (art) scopes.push(art);
      const mainEl = t.closest("main,[role='main']");
      if (mainEl) scopes.push(mainEl);
      scopes.push(t.parentElement);

      const bodySel = [
        ".component__body-inner.mcq__body-inner",
        ".mcq__body-inner",
        "[class*='mcq__body-inner']",
        ".mcq__body",
        "[class*='mcq__body' i]",
        '[class*="objectmatching" i]',
        '[class*="object-matching" i]',
        '[class*="matching__" i]',
        '[class*="component-objectmatching" i]',
        '[class*="component-matching" i]',
        '[class*="component__matching" i]',
      ].join(", ");

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let bestStem = null;
      let bestScore = -1;
      for (const scope of scopes) {
        if (!scope) continue;
        const bodies = scope.querySelectorAll(bodySel);
        for (const b of bodies) {
          if (!b || isInOurPanel(b) || !domElLikelyRenderedForUser(b)) continue;
          if (!(t.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING))
            continue;
          const stem = String(b.innerText || "")
            .replace(/\s+/g, " ")
            .trim();
          if (stem.length < 8 || stem.length > 12000) continue;
          const cls = String(b.className || "");
          const isOm =
            /objectmatching|object-matching|matching__|component-objectmatching|component-matching|component__matching/i.test(
              cls
            );
          let rank = 2;
          if (cls.includes("mcq__body-inner") || cls.includes("body-inner"))
            rank = 4;
          else if (isOm) rank = 3;
          const br = b.getBoundingClientRect();
          const visW = Math.max(0, Math.min(br.right, vw) - Math.max(br.left, 0));
          const visH = Math.max(
            0,
            Math.min(br.bottom, vh) - Math.max(br.top, 0)
          );
          const area = visW * visH;
          if (area < 40) continue;
          const macN = extractMacLikeTokensFromStem(stem).length;
          let score = area;
          if (macN >= 2) score += 5e10;
          else if (macN === 1) score += 2e8;
          if (isOm) score += 1e7;
          score += rank * 1e4;
          if (score > bestScore) {
            bestScore = score;
            bestStem = stem;
          }
        }
      }
      if (bestStem && bestScore > globalBestScore) {
        globalBestScore = bestScore;
        globalBestStem = bestStem;
      }
    }
    return globalBestStem;
  }

  /** 元素在视口内的可见面积 */
  function elementVisibleViewportArea(el) {
    if (!el || !domElLikelyRenderedForUser(el)) return 0;
    try {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const r = el.getBoundingClientRect();
      const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      return visW * visH;
    } catch (_e) {
      return 0;
    }
  }

  function maxMatchingLikeHostVisibleArea() {
    let best = 0;
    const hosts = querySelectorAllDeep(
      document,
      "matching-view, object-matching-view",
      16
    );
    for (let i = 0; i < hosts.length; i++) {
      const a = elementVisibleViewportArea(hosts[i]);
      if (a > best) best = a;
    }
    return best;
  }

  /** MCQ 题干区（inner / body 外壳）视口内最大可见面积 */
  function maxMcqBodyInnerVisibleArea() {
    let best = 0;
    const nodes = querySelectorAllDeep(
      document,
      '.mcq__body-inner, [class*="mcq__body-inner"], .mcq__body, [class*="mcq__body" i]',
      64
    );
    for (let i = 0; i < nodes.length; i++) {
      const a = elementVisibleViewportArea(nodes[i]);
      if (a > best) best = a;
    }
    return best;
  }

  /** matching 宿主内聚合说明与各行特征为一段题干 */
  function collectAggregatedMatchingLikeStemFromHost(mvHost) {
    if (!mvHost || isInOurPanel(mvHost) || !domElLikelyRenderedForUser(mvHost))
      return null;
    if (elementVisibleViewportArea(mvHost) < 200) return null;
    const sr = mvHost.shadowRoot;
    if (!sr) return null;
    const bodyInner =
      sr.querySelector(".matching__body-inner") ||
      sr.querySelector(".objectMatching__body-inner") ||
      sr.querySelector("[class*='matching__body-inner' i]") ||
      sr.querySelector("[class*='objectMatching__body-inner' i]");
    const bodyTxt = bodyInner
      ? String(bodyInner.innerText || bodyInner.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
      : "";
    const dds = sr.querySelectorAll(
      "matching-dropdown-view, object-matching-dropdown-view"
    );
    const rowLines = [];
    for (let di = 0; di < dds.length; di++) {
      const dd = dds[di];
      const dsr = dd.shadowRoot;
      if (!dsr) continue;
      const titleEl =
        dsr.querySelector(
          ".matching__item-title .matching__item-title_inner"
        ) || dsr.querySelector(".matching__item-title_inner");
      const line = String(
        (titleEl && (titleEl.innerText || titleEl.textContent)) || ""
      )
        .replace(/\s+/g, " ")
        .trim();
      if (
        line.length >= 2 &&
        !/请选择一个选项|请选择|select an option/i.test(line)
      )
        rowLines.push(line);
    }
    if (!bodyTxt && rowLines.length < 2) return null;
    const pack = [bodyTxt].concat(rowLines).filter(Boolean).join("\n");
    const t = pack.replace(/\s+/g, " ").trim();
    return t.length >= 16 ? t : null;
  }

  function collectAggregatedMatchingLikeStem() {
    const mv = querySelectorAllDeep(document, "matching-view", 8);
    for (let i = 0; i < mv.length; i++) {
      const hit = collectAggregatedMatchingLikeStemFromHost(mv[i]);
      if (hit) return hit;
    }
    const om = querySelectorAllDeep(document, "object-matching-view", 8);
    for (let j = 0; j < om.length; j++) {
      const hit = collectAggregatedMatchingLikeStemFromHost(om[j]);
      if (hit) return hit;
    }
    return null;
  }

  /** 当前屏可见 MCQ / matching 题干文本 */
  function getVisibleMcqStemText(hintOrdinal) {
    const hn =
      hintOrdinal != null ? parseInt(String(hintOrdinal).trim(), 10) : NaN;
    const matArea = maxMatchingLikeHostVisibleArea();
    const mcqArea = maxMcqBodyInnerVisibleArea();
    const matMcqSum = matArea + mcqArea + 1;
    const matchingAreaShare = matMcqSum > 0 ? matArea / matMcqSum : 0;
    const matchingVisiblyDominatesMcq =
      matArea >= 200 && matArea >= mcqArea * 0.88 + 48;
    const almostNoMcqBody = mcqArea < 420;
    const matchingTakesRoughHalfOrMore = matchingAreaShare >= 0.38;
    const matchingNotClearlyBehindMcq =
      matArea + 48 >= mcqArea * 0.9;
    const useMatchingAggregate =
      matArea >= 200 &&
      matchingNotClearlyBehindMcq &&
      (almostNoMcqBody ||
        matchingTakesRoughHalfOrMore ||
        matchingVisiblyDominatesMcq);

    const aggStem = useMatchingAggregate
      ? collectAggregatedMatchingLikeStem()
      : null;

    let anchored = null;
    if (Number.isFinite(hn) && hn >= 1 && hn < 500)
      anchored = stemTextAnchoredByProblemTitle(hn);

    if (anchored && anchored.length >= 8) {
      if (useMatchingAggregate && aggStem) return aggStem;
      return anchored;
    }

    if (aggStem) return aggStem;

    const nodes = querySelectorAllDeep(
      document,
      '.mcq__body-inner, [class*="mcq__body-inner"], .mcq__body, [class*="mcq__body" i], ' +
        OBJECT_MATCHING_DOM,
      52
    );
    let best = "";
    let bestScore = 0;
    let mac2Best = "";
    let mac2Area = 0;
    let mac1OmBest = "";
    let mac1OmScore = 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const node of nodes) {
      if (!node || isInOurPanel(node) || !domElLikelyRenderedForUser(node))
        continue;
      if (Number.isFinite(hn) && hn >= 1 && hn < 500) {
        const tn = String(node.tagName || "").toLowerCase();
        const cl = String(node.className || "");
        const isMatchingLikeDom =
          /objectmatching|object-matching|matching__|component-objectmatching|component-matching|component__matching/i.test(
            cl
          ) ||
          tn === "object-matching-view" ||
          tn === "matching-view";
        if (!isMatchingLikeDom) {
          const bodyOrd = quizOrdinalForMcqBodyInner(node);
          if (bodyOrd != null && bodyOrd !== hn) continue;
        }
      }
      const r = node.getBoundingClientRect();
      const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      const area = visW * visH;
      const txt = (node.innerText || node.textContent || "").trim();
      if (txt.length < 8 || area < 40) continue;
      const cls = String(node.className || "");
      const isOm =
        /objectmatching|object-matching|matching__|component-objectmatching|component-matching|component__matching/i.test(
          cls
        );
      const macN = extractMacLikeTokensFromStem(txt).length;
      if (macN >= 2) {
        if (area > mac2Area) {
          mac2Area = area;
          mac2Best = txt;
        }
      }
      if (macN >= 1 && isOm) {
        const s = area * 2 + macN * 1e6;
        if (s > mac1OmScore) {
          mac1OmScore = s;
          mac1OmBest = txt;
        }
      }
      if (txt.length < 12) continue;
      const innerBoost =
        cls.includes("mcq__body-inner") || cls.includes("body-inner")
          ? 1.28
          : 1;
      const omBoost = isOm ? 1.15 : 1;
      const score = area * innerBoost * omBoost;
      if (score > bestScore) {
        bestScore = score;
        best = txt;
      }
    }
    if (mac2Best) return mac2Best;
    if (mac1OmBest) return mac1OmBest;
    return best || null;
  }

  function cleanMcqTitleInnerText(raw) {
    let s = String(raw || "")
      .replace(/\s+/g, " ")
      .trim();
    s = s.replace(/^完成\s+/i, "").replace(/\s+完成\s+/gi, " ").trim();
    s = s.replace(/^不完整\s+/i, "").replace(/\s+不完整\s+/gi, " ").trim();
    return s || null;
  }

  /** 标题纯文本 */
  function mcqTitleInnerPlainFromNode(n) {
    if (!n || typeof n.cloneNode !== "function") return "";
    try {
      const clone = n.cloneNode(true);
      clone
        .querySelectorAll(
          ".accessibility-completion-indicator, [class*='accessibility-completion-indicator' i]"
        )
        .forEach((el) => {
          el.remove();
        });
      return (clone.innerText || clone.textContent || "").trim();
    } catch (_e) {
      return (n.innerText || n.textContent || "").trim();
    }
  }

  /** 视口内最显眼的 MCQ 标题文案 */
  function getVisibleMcqTitleText() {
    const nodes = querySelectorAllDeep(
      document,
      '.mcq__title-inner, [class*="mcq__title-inner"], [class*="mcq__title" i], ' +
        OBJECT_MATCHING_DOM +
        ' [class*="title" i]',
      48
    );
    let best = "";
    let bestScore = -1e9;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const anchorY = vh * 0.32;
    for (const n of nodes) {
      if (!n || isInOurPanel(n) || !domElLikelyRenderedForUser(n)) continue;
      const r = n.getBoundingClientRect();
      const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      const area = visW * visH;
      const t = cleanMcqTitleInnerText(mcqTitleInnerPlainFromNode(n));
      if (!t || t.length < 2 || area < 20) continue;
      const midY =
        (Math.max(r.top, 0) + Math.min(r.bottom, vh)) / 2 || r.top + r.height / 2;
      const dist = Math.abs(midY - anchorY);
      const score = area * 2.2 - dist;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best || null;
  }

  /** 顶栏 Q 条最大 Qn */
  function getMaxTopStripQNavOrdinal() {
    const strip = collectTopQuizQNavStripRows();
    if (!strip.length) return 0;
    return Math.max(...strip.map((s) => s.n));
  }

  /** 题号大于顶栏最大 Qn 则丢弃 */
  function capOrdinalStringByTopStripQNav(ordStr) {
    if (ordStr == null) return null;
    const v = parseInt(String(ordStr).trim(), 10);
    if (!Number.isFinite(v) || v < 1) return ordStr;
    const cap = getMaxTopStripQNavOrdinal();
    if (cap >= 1 && v > cap) {
      const zhCur = extractZhNthOfMTotalProgressQuestion();
      if (zhCur === v) return ordStr;
      return null;
    }
    return ordStr;
  }

  /** Lit block-button 导航上的当前题序 */
  function getLitBlockButtonQOrdinal() {
    const nodes = querySelectorAllDeep(
      document,
      [
        "button[data-index][class*='block-button']",
        "button.block-button[data-index]",
        "button[data-index].block-button",
      ].join(", "),
      200
    );
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const raw = [];
    for (const el of nodes) {
      if (!el || isInOurPanel(el)) continue;
      const r = el.getBoundingClientRect();
      const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (visW * visH < 6) continue;
      const rawDi = el.getAttribute("data-index");
      if (rawDi == null || !/^\d+$/.test(String(rawDi).trim())) continue;
      const d = parseInt(String(rawDi).trim(), 10);
      const t = (el.innerText || el.textContent || "")
        .replace(/[\u200b\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const hasActive = /\bactive-block\b/i.test(String(el.className || ""));
      raw.push({ el, d, t, hasActive, area: visW * visH });
    }
    if (!raw.length) return null;

    const minD = Math.min(...raw.map((x) => x.d));
    const rows = [];
    for (const row of raw) {
      let n = null;
      const qm = row.t.match(/\bQ\s*(\d+)\b/i);
      if (qm) n = parseInt(qm[1], 10);
      if (n == null || !Number.isFinite(n)) {
        n = litBlockDataIndexToQuestionOrdinal(row.d, minD);
      }
      if (n <= 0 || n >= 500) continue;
      rows.push({
        el: row.el,
        n,
        hasActive: row.hasActive,
        area: row.area,
      });
    }
    if (!rows.length) return null;

    const litCap = (s) => capOrdinalStringByTopStripQNav(s);

    const activeOnes = rows.filter((x) => x.hasActive);
    if (activeOnes.length === 1) return litCap(String(activeOnes[0].n));
    if (activeOnes.length > 1) {
      activeOnes.sort((a, b) => b.area - a.area);
      return litCap(String(activeOnes[0].n));
    }

    const titleOrd = extractMcqOrdinalFromTitlePlain(
      getVisibleMcqTitleText() || ""
    );
    if (titleOrd != null) {
      const want = parseInt(titleOrd, 10);
      if (Number.isFinite(want) && want > 0) {
        const hits = rows.filter((x) => x.n === want);
        if (hits.length >= 1) {
          hits.sort((a, b) => b.area - a.area);
          return litCap(String(want));
        }
      }
    }

    const visQ = extractVisibleMcqQuestionNumber((e) => !e || isInOurPanel(e));
    if (visQ != null) {
      const hits = rows.filter((x) => x.n === visQ);
      if (hits.length >= 1) {
        hits.sort((a, b) => b.area - a.area);
        return litCap(String(visQ));
      }
    }

    if (rows.length === 1) return litCap(String(rows[0].n));

    return null;
  }

  function qNavButtonLooksSelected(el) {
    if (!el) return false;
    if (el.getAttribute("aria-selected") === "true") return true;
    if (el.getAttribute("aria-current") === "true") return true;
    if (el.getAttribute("aria-pressed") === "true") return true;
    if (el.getAttribute("aria-checked") === "true") return true;
    if (el.getAttribute("data-state") === "active") return true;
    if (el.getAttribute("data-selected") === "true") return true;
    if (el.getAttribute("data-active") === "true") return true;
    const cn = el.className && String(el.className);
    if (
      cn &&
      /\b(active|selected|current|is-active|is-selected|active-block|tab-active|btn-active|chip-active)\b/i.test(
        cn
      )
    )
      return true;
    try {
      if (
        el.querySelector &&
        el.querySelector(
          ".selected, .active, [class*='selected' i], [class*='active' i], [aria-checked='true']"
        )
      ) {
        return true;
      }
    } catch (_e) {
      /* */
    }
    return false;
  }

  /** 顶栏 Q 条或 active-block 上的题序 */
  function getActiveLessonBlockQOrdinal() {
    const litBlock = getLitBlockButtonQOrdinal();
    if (litBlock != null) return litBlock;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const strip = collectTopQuizQNavStripRows();

    let navBest = null;
    let navArea = 0;
    for (const row of strip) {
      if (!qNavButtonLooksSelected(row.el)) continue;
      if (row.area >= navArea) {
        navArea = row.area;
        navBest = String(row.n);
      }
    }
    if (navBest != null) return capOrdinalStringByTopStripQNav(navBest);

    const zhProg = extractZhNthOfMTotalProgressQuestion();
    if (
      zhProg != null &&
      strip.length >= 2 &&
      strip.some((s) => s.n === zhProg)
    ) {
      return capOrdinalStringByTopStripQNav(String(zhProg));
    }

    const stripMaxN = strip.length ? Math.max(...strip.map((s) => s.n)) : 0;
    const titleOrd = extractMcqOrdinalFromTitlePlain(
      getVisibleMcqTitleText() || ""
    );
    if (titleOrd != null && strip.length) {
      const want = parseInt(titleOrd, 10);
      if (Number.isFinite(want) && want > 0) {
        if (stripMaxN >= 1 && want > stripMaxN) {
          // 超顶栏题号丢弃
        } else {
          const hits = strip.filter((r) => r.n === want);
          if (hits.length === 1) return capOrdinalStringByTopStripQNav(String(want));
          if (hits.length > 1) {
            hits.sort((a, b) => b.area - a.area);
            return capOrdinalStringByTopStripQNav(String(hits[0].n));
          }
        }
      }
    }

    if (strip.length === 1)
      return capOrdinalStringByTopStripQNav(String(strip[0].n));

    const nodes = querySelectorAllDeep(
      document,
      [
        "button.active-block[data-index]",
        "button.block-button.active-block",
        "button.active-block.block-button",
        '[class*="block-button"][class*="active-block"]',
        '[class*="active-block"][class*="block-button"]',
      ].join(", "),
      48
    );
    const blockIdxMin = computeLitBlockDataIndexMin();
    let best = null;
    let bestArea = 0;
    for (const el of nodes) {
      if (!el || isInOurPanel(el)) continue;
      const r = el.getBoundingClientRect();
      const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      const area = visW * visH;
      if (area < 4) continue;
      const t = (el.innerText || el.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      let n = null;
      const qm = t.match(/\bQ\s*(\d+)\b/i);
      if (qm) {
        const v = parseInt(qm[1], 10);
        if (v > 0 && v < 500) n = v;
      }
      if (n == null) {
        const di = el.getAttribute("data-index");
        if (di != null && /^\d+$/.test(String(di).trim())) {
          const d = parseInt(String(di).trim(), 10);
          if (d >= 0 && d < 500)
            n = litBlockDataIndexToQuestionOrdinal(d, blockIdxMin);
        }
      }
      if (n != null && n > 0 && n < 500 && area >= bestArea) {
        bestArea = area;
        best = String(n);
      }
    }
    if (
      best != null &&
      strip.length &&
      stripMaxN >= 1 &&
      parseInt(best, 10) > stripMaxN
    ) {
      return null;
    }
    return capOrdinalStringByTopStripQNav(best);
  }

  /** 标题文案中的题序数字 */
  function extractMcqOrdinalFromTitlePlain(raw) {
    if (raw == null || !String(raw).trim()) return null;
    const t = String(raw).trim();
    const m1 = t.match(/(?:问题|question)\s*[:：]?\s*(\d+)/i);
    if (m1) {
      const n = parseInt(m1[1], 10);
      if (n > 0 && n < 500) return String(n);
    }
    const m2 = t.match(/^Q\s*(\d+)\s*$/i);
    if (m2) {
      const n = parseInt(m2[1], 10);
      if (n > 0 && n < 500) return String(n);
    }
    const m2b = t.match(/\bQ\s*(\d+)\b/i);
    if (m2b) {
      const n = parseInt(m2b[1], 10);
      if (n > 0 && n < 500) return String(n);
    }
    const m3 = t.match(/^(\d+)$/);
    if (m3) {
      const n = parseInt(m3[1], 10);
      if (n > 0 && n < 500) return String(n);
    }
    return null;
  }

  /** 综合解析当前题序 */
  function resolveMcqOrdinalContext() {
    const sessionOk = hasVisibleActiveMcqSession();
    const stripLen = collectTopQuizQNavStripRows().length;
    const zhProg = extractZhNthOfMTotalProgressQuestion();
    if (!sessionOk && stripLen < 1 && zhProg == null) {
      return { ordinal: null };
    }

    const block = getActiveLessonBlockQOrdinal();
    if (block != null) return { ordinal: block };

    // 题号：标题优先于正文
    const fromTitle = extractMcqOrdinalFromTitlePlain(
      getVisibleMcqTitleText() || ""
    );
    if (fromTitle != null) {
      const c = capOrdinalStringByTopStripQNav(fromTitle);
      if (c != null) return { ordinal: c };
    }

    const fromStem = extractVisibleMcqQuestionNumber((e) => !e || isInOurPanel(e));
    if (fromStem != null) {
      const c = capOrdinalStringByTopStripQNav(String(fromStem));
      if (c != null) return { ordinal: c };
    }

    const zhProgOnly = extractZhNthOfMTotalProgressQuestion();
    if (zhProgOnly != null) {
      const c = capOrdinalStringByTopStripQNav(String(zhProgOnly));
      if (c != null) return { ordinal: c };
    }

    if (
      lastDomQuizQuestionNumber != null &&
      Number.isFinite(lastDomQuizQuestionNumber)
    ) {
      const c = capOrdinalStringByTopStripQNav(
        String(lastDomQuizQuestionNumber)
      );
      if (c != null) return { ordinal: c };
    }
    return { ordinal: null };
  }

  function resolveVisibleMcqOrdinal() {
    return resolveMcqOrdinalContext().ordinal;
  }

  function resolvePanelMcqTitleLabel() {
    const o = resolveVisibleMcqOrdinal();
    return o != null ? o : "—";
  }

  /** 可见题干与题库题干是否 exact 匹配 */
  function visibleStemMatchesQuestion(visibleStem, qRaw) {
    if (!stemIpv4CidrTokensAlign(visibleStem, qRaw)) return false;
    const a = stemUnifiedExactKeyFromVisibleStem(visibleStem);
    const b = stemUnifiedExactKeyFromQuestionHtml(qRaw);
    return !!a && !!b && a === b;
  }

  /** 可见题干是否对应当前题库行 */
  function visibleStemMatchesMcqRow(visibleStem, row) {
    const e = row && row.entry;
    if (!e) return false;
    if (!stemUnifiedExactKeyFromVisibleStem(visibleStem)) return false;
    return visibleStemMatchesQuestion(visibleStem, e.问题 || "");
  }

  const RE_IPV4_CIDR_TOKEN =
    /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:\/\d{1,2})?)\b/gi;

  function extractIpv4CidrTokensUnique(s) {
    const raw = String(s || "");
    const out = [];
    const seen = Object.create(null);
    let m;
    RE_IPV4_CIDR_TOKEN.lastIndex = 0;
    while ((m = RE_IPV4_CIDR_TOKEN.exec(raw)) !== null) {
      const t = m[1].toLowerCase();
      if (!seen[t]) {
        seen[t] = 1;
        out.push(t);
      }
    }
    return out;
  }

  /** IPv4/CIDR 在页面与题库题干间是否一致 */
  function stemIpv4CidrTokensAlign(visibleStem, qRaw) {
    const vPlain = unifiedPlainFromVisibleStem(visibleStem);
    const qPlain = unifiedPlainFromQuestionHtml(qRaw || "");
    const vToks = extractIpv4CidrTokensUnique(vPlain);
    const qToks = extractIpv4CidrTokensUnique(qPlain);
    if (qToks.length === 0 && vToks.length === 0) return true;
    const vNorm = canonicalStemStrict(vPlain);
    const qNorm = normalizeQuestionHtmlForMatch(qRaw || "");
    let i;
    for (i = 0; i < qToks.length; i++) {
      if (!vNorm.includes(qToks[i])) return false;
    }
    if (vToks.length >= 2 && qToks.length >= 2) {
      for (i = 0; i < vToks.length; i++) {
        if (!qNorm.includes(vToks[i])) return false;
      }
    }
    return true;
  }

  /** MCQ 选项/配对文案归一化（exact 比对用） */
  function normalizeMcqOptionPlainForExactCompare(s) {
    return String(s || "")
      .normalize("NFKC")
      .replace(/[\u200b\uFEFF]/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /** 去掉选项前的列表序号前缀 */
  function stripLeadingMcqListOrdinalFromDomPlain(s) {
    let t = String(s || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\./.test(t)) return t;
    for (let pass = 0; pass < 4; pass++) {
      const u = t;
      t = t.replace(/^\s*[\[(（]?\s*[A-Za-z]\s*[\])）、.．:：]\s+/, "").trim();
      t = t.replace(/^\s*\d{1,2}\s*[.)）、.．:：]\s+/, "").trim();
      if (t === u) break;
    }
    return t;
  }

  /** objectMatching 选中后可能把「A 」写进正文，去掉行首单字母标签 */
  function stripObjectMatchingLeadingLetterBadge(s) {
    let t = stripLeadingMcqListOrdinalFromDomPlain(s);
    for (let pass = 0; pass < 3; pass++) {
      const u = t;
      t = t.replace(/^\s*[A-Za-z]\s+/, "").trim();
      if (t === u) break;
    }
    return t;
  }

  /** 两段文案 exact 匹配分（1/0） */
  function mcqOptionPairExactMatchScore(textA, textB) {
    const a = normalizeMcqOptionPlainForExactCompare(
      stripLeadingMcqListOrdinalFromDomPlain(String(textA || ""))
    );
    const b = normalizeMcqOptionPlainForExactCompare(
      stripLeadingMcqListOrdinalFromDomPlain(String(textB || ""))
    );
    if (!a || !b) return 0;
    return a === b ? 1 : 0;
  }

  /** DOM 选项 vs 题库选项 */
  function optionTextMatchScoreMcq(domPlain, jsonPlain) {
    return mcqOptionPairExactMatchScore(domPlain, jsonPlain);
  }

  /** 取 MCQ 选项正文（排除无障碍 position 子树） */
  function mcqItemTextInnerPlainExcludingA11y(innerEl) {
    if (!innerEl) return "";
    const parts = [];
    function walk(node) {
      if (!node) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const x = String(node.nodeValue || "").replace(/\u00a0/g, " ");
        if (x.trim()) parts.push(x);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const cn = String(node.className || "");
      if (/screenReader-position/i.test(cn)) return;
      for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
    }
    walk(innerEl);
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  function hasVisibleMcqItemTextInnerInViewport() {
    const sels = [
      ".mcq__item-text-inner",
      "[class*='mcq__item-text-inner' i]",
    ].join(", ");
    const nodes = querySelectorAllDeep(document, sels, 72);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const n of nodes) {
      if (!n || isInOurPanel(n) || isInCourseChromeSidebar(n)) continue;
      const r = n.getBoundingClientRect();
      const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (visW * visH >= 80) return true;
    }
    return false;
  }

  function inferMcqOptionLabelFromRowEl(innerEl) {
    const row =
      (innerEl.closest &&
        innerEl.closest(".mcq__item, [class*='mcq__item' i]")) ||
      innerEl.parentElement;
    if (!row) return null;
    const pick = (s) => {
      const t = String(s || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, "")
        .trim();
      if (/^[A-Z]$/i.test(t)) return t.toUpperCase();
      if (/^\d{1,2}$/.test(t)) return t;
      return null;
    };
    const small =
      row.querySelectorAll(
        "[class*='label' i], [class*='index' i], [class*='prefix' i], .mcq__item-label, .mcq__item-index"
      );
    for (const c of small) {
      const x = pick(c.textContent);
      if (x) return x;
    }
    let sib = innerEl.previousElementSibling;
    for (let k = 0; k < 3 && sib; k++) {
      const x = pick(sib.textContent);
      if (x) return x;
      sib = sib.previousElementSibling;
    }
    return null;
  }

  function collectVisibleMcqOptionRows() {
    const sels = [
      ".mcq__item-text-inner",
      "[class*='mcq__item-text-inner' i]",
    ].join(", ");
    const nodes = querySelectorAllDeep(document, sels, 80);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const seen = new WeakSet();
    const out = [];
    for (const n of nodes) {
      if (!n || seen.has(n) || isInOurPanel(n) || isInCourseChromeSidebar(n))
        continue;
      const r = n.getBoundingClientRect();
      const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (visW * visH < 80) continue;
      let t = mcqItemTextInnerPlainExcludingA11y(n);
      if (!t.length) {
        t = (n.innerText || n.textContent || "")
          .replace(/\u00a0/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
      seen.add(n);
      out.push({
        label: inferMcqOptionLabelFromRowEl(n),
        text: t,
        el: n,
      });
    }
    out.sort((a, b) => {
      const ra = a.el.getBoundingClientRect();
      const rb = b.el.getBoundingClientRect();
      const dy = ra.top - rb.top;
      if (Math.abs(dy) > 10) return dy;
      return ra.left - rb.left;
    });
    for (let i = 0; i < out.length; i++) {
      if (out[i].label == null && i < 26) {
        out[i].label = String.fromCharCode(65 + i);
      }
    }
    return out;
  }

  function mapDomOptionRowsToJsonIndices(domRows, jsonPlain) {
    const nD = domRows.length;
    const nJ = jsonPlain.length;
    const out = new Array(nD).fill(-1);
    if (!nD || !nJ) return out;
    const pairs = [];
    for (let i = 0; i < nD; i++) {
      for (let j = 0; j < nJ; j++) {
        const sc = optionTextMatchScoreMcq(domRows[i].text, jsonPlain[j]);
        if (sc >= MCQ_DOM_JSON_MAP_PAIR_MIN) pairs.push({ i, j, sc });
      }
    }
    pairs.sort((a, b) => b.sc - a.sc);
    const usedI = new Set();
    const usedJ = new Set();
    for (const p of pairs) {
      if (usedI.has(p.i) || usedJ.has(p.j)) continue;
      out[p.i] = p.j;
      usedI.add(p.i);
      usedJ.add(p.j);
    }
    return out;
  }

  function mcqBinomial(n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    let c = 1;
    const useK = k < n - k ? k : n - k;
    for (let i = 0; i < useK; i++) c = (c * (n - i)) / (i + 1);
    return Math.round(c);
  }

  function mcqFactorial(k) {
    let f = 1;
    for (let i = 2; i <= k; i++) f *= i;
    return f;
  }

  function mcqCombinationsChooseK(n, k) {
    const out = [];
    const path = [];
    function dfs(start) {
      if (path.length === k) {
        out.push(path.slice());
        return;
      }
      for (let i = start; i < n; i++) {
        path.push(i);
        dfs(i + 1);
        path.pop();
      }
    }
    dfs(0);
    return out;
  }

  function mcqPermuteArray(arr) {
    const n = arr.length;
    if (n <= 1) return [arr.slice()];
    const res = [];
    for (let i = 0; i < n; i++) {
      const h = arr[i];
      const rest = arr.slice(0, i).concat(arr.slice(i + 1));
      const subs = mcqPermuteArray(rest);
      for (let si = 0; si < subs.length; si++) {
        res.push([h].concat(subs[si]));
      }
    }
    return res;
  }

  /** 正确选项 JSON 行到 DOM 行的映射 */
  function assignMcqCorrectJsonToDomRows(domRows, jsonPlain, correctIdx) {
    const jToI = Object.create(null);
    if (!domRows.length || !correctIdx.length) return jToI;
    const n = domRows.length;
    const k = correctIdx.length;

    function pairScore(jIdx, domI) {
      return optionTextMatchScoreMcq(
        domRows[domI].text,
        String(jsonPlain[jIdx] || "")
      );
    }

    if (k === 1) {
      const j0 = correctIdx[0];
      let bestI = -1;
      let bestS = 0;
      for (let i = 0; i < n; i++) {
        const s = pairScore(j0, i);
        if (s > bestS) {
          bestS = s;
          bestI = i;
        }
      }
      if (bestI >= 0 && bestS >= MCQ_DOM_OPTION_MATCH_MIN) jToI[j0] = bestI;
      return jToI;
    }

    const bruteWork = mcqBinomial(n, k) * mcqFactorial(k);
    if (k <= n && k <= 5 && bruteWork <= 24000) {
      const combs = mcqCombinationsChooseK(n, k);
      let bestTotal = -1;
      let bestPerm = null;
      for (let ci = 0; ci < combs.length; ci++) {
        const pick = combs[ci];
        const perms = mcqPermuteArray(pick);
        for (let pi = 0; pi < perms.length; pi++) {
          const perm = perms[pi];
          let total = 0;
          let ok = true;
          for (let t = 0; t < k; t++) {
            const s = pairScore(correctIdx[t], perm[t]);
            if (s < MCQ_DOM_OPTION_MATCH_MIN) {
              ok = false;
              break;
            }
            total += s;
          }
          if (!ok) continue;
          if (total > bestTotal) {
            bestTotal = total;
            bestPerm = perm;
          }
        }
      }
      if (bestPerm && bestTotal >= 0) {
        for (let t = 0; t < k; t++) {
          jToI[correctIdx[t]] = bestPerm[t];
        }
      }
      return jToI;
    }

    const usedI = new Set();
    const sortedJ = [...correctIdx].sort(
      (a, b) =>
        String(jsonPlain[b] || "").length - String(jsonPlain[a] || "").length
    );
    for (let sj = 0; sj < sortedJ.length; sj++) {
      const j = sortedJ[sj];
      const want = String(jsonPlain[j] || "");
      if (!want) continue;
      let bestI = -1;
      let bestS = 0;
      for (let i = 0; i < domRows.length; i++) {
        if (usedI.has(i)) continue;
        const s = pairScore(j, i);
        if (s > bestS) {
          bestS = s;
          bestI = i;
        }
      }
      if (bestI >= 0 && bestS >= MCQ_DOM_OPTION_MATCH_MIN) {
        usedI.add(bestI);
        jToI[j] = bestI;
      }
    }
    return jToI;
  }

  /** 合并答案多行与选项行做 exact 配对 */
  function assignAnswerLinesToJsonOptionIndices(jsonPlain, answerLines) {
    const n = jsonPlain.length;
    const k = answerLines.length;
    if (!k || !n) return [];
    function pairScore(t, j) {
      return mcqOptionPairExactMatchScore(
        String(answerLines[t] || ""),
        String(jsonPlain[j] || "")
      );
    }
    if (k === 1) {
      let bestJ = -1;
      let bestS = 0;
      for (let j = 0; j < n; j++) {
        const s = pairScore(0, j);
        if (s > bestS) {
          bestS = s;
          bestJ = j;
        }
      }
      return bestJ >= 0 && bestS >= MCQ_DOM_JSON_MAP_PAIR_MIN ? [bestJ] : [];
    }
    const bruteWork = mcqBinomial(n, k) * mcqFactorial(k);
    if (k <= n && k <= 5 && bruteWork <= 24000) {
      const combs = mcqCombinationsChooseK(n, k);
      let bestTotal = -1;
      let bestPerm = null;
      for (let ci = 0; ci < combs.length; ci++) {
        const pick = combs[ci];
        const perms = mcqPermuteArray(pick);
        for (let pi = 0; pi < perms.length; pi++) {
          const perm = perms[pi];
          let total = 0;
          let ok = true;
          for (let t = 0; t < k; t++) {
            const s = pairScore(t, perm[t]);
            if (s < MCQ_DOM_JSON_MAP_PAIR_MIN) {
              ok = false;
              break;
            }
            total += s;
          }
          if (!ok) continue;
          if (total > bestTotal) {
            bestTotal = total;
            bestPerm = perm;
          }
        }
      }
      if (bestPerm && bestTotal >= 0) {
        return [...new Set(bestPerm)].sort((a, b) => a - b);
      }
      return [];
    }
    const usedJ = new Set();
    const sortedT = Array.from({ length: k }, (_, i) => i).sort(
      (a, b) =>
        String(answerLines[b] || "").length -
        String(answerLines[a] || "").length
    );
    const picked = [];
    for (let si = 0; si < sortedT.length; si++) {
      const t = sortedT[si];
      let bestJ = -1;
      let bestS = 0;
      for (let j = 0; j < n; j++) {
        if (usedJ.has(j)) continue;
        const s = pairScore(t, j);
        if (s > bestS) {
          bestS = s;
          bestJ = j;
        }
      }
      if (bestJ >= 0 && bestS >= MCQ_DOM_JSON_MAP_PAIR_MIN) {
        usedJ.add(bestJ);
        picked.push(bestJ);
      }
    }
    return picked.sort((a, b) => a - b);
  }

  /** 解析 MCQ 正确选项在 选项 数组中的下标 */
  function resolveMcqCorrectOptionIndices(entry) {
    const rawOpts = Array.isArray(entry.选项) ? entry.选项 : [];
    const jsonPlain = rawOpts.map((l) =>
      String(l).replace(/\s*（正确答案）\s*$/, "").trim()
    );
    const markers = [];
    rawOpts.forEach((l, i) => {
      if (String(l).indexOf("（正确答案）") >= 0) markers.push(i);
    });
    const markersU = [...new Set(markers)].sort((a, b) => a - b);

    const ansRaw =
      entry.正确答案标号行 != null && String(entry.正确答案标号行).trim()
        ? String(entry.正确答案标号行).trim()
        : String(entry.正确答案 != null ? entry.正确答案 : "").trim();
    const answerLines = ansRaw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (markersU.length >= 2) {
      return markersU;
    }
    if (answerLines.length >= 2) {
      const fromLines = assignAnswerLinesToJsonOptionIndices(
        jsonPlain,
        answerLines
      );
      if (fromLines.length >= 2) return fromLines;
      if (fromLines.length > markersU.length) return fromLines;
    }
    if (markersU.length === 1) {
      return markersU;
    }
    if (answerLines.length === 1) {
      const one = assignAnswerLinesToJsonOptionIndices(jsonPlain, answerLines);
      if (one.length === 1) return one;
    }
    return markersU;
  }

  /** 高亮用的 MCQ 选项外层节点 */
  function resolveMcqItemHostForHighlight(innerEl) {
    if (!innerEl) return null;
    const lab =
      innerEl.closest &&
      innerEl.closest(
        "label.mcq__item-label, label.js-item-label, label[role='listitem']"
      );
    if (lab && !isInOurPanel(lab)) return lab;
    const cnOf = (el) => String((el && el.className) || "");
    const isMcqItemSubPart = (cn) =>
      /\bmcq__item-text-inner\b/i.test(cn) ||
      /\bmcq__item-text\b/i.test(cn) ||
      /\bmcq__item-label\b/i.test(cn) ||
      /\bmcq__item-input\b/i.test(cn) ||
      /\bmcq__item-icon\b/i.test(cn) ||
      /\bmcq__item-state\b/i.test(cn) ||
      /\bmcq__item-answer-icon\b/i.test(cn);
    const isMcqOptionRowHost = (el) => {
      if (!el || isInOurPanel(el)) return false;
      const cn = cnOf(el);
      if (isMcqItemSubPart(cn)) return false;
      const tag = String(el.tagName || "").toLowerCase();
      const role = String((el.getAttribute && el.getAttribute("role")) || "");
      if (tag === "input" && role === "radio") return false;
      if (/\bmcq__item\b/i.test(cn) || /js-mcq-item/i.test(cn)) return true;
      if (/mcq__choice|mcq-choice/i.test(cn)) return true;
      if (/mcq__row|mcq-row/i.test(cn)) return true;
      if (tag === "button" && /mcq/i.test(cn)) return true;
      if (role === "radio" && tag !== "input") return true;
      return false;
    };
    let p = innerEl.parentElement;
    for (let d = 0; d < 26 && p; d++) {
      if (isInOurPanel(p)) break;
      if (isMcqOptionRowHost(p)) return p;
      p = p.parentElement;
    }
    return innerEl.parentElement;
  }

  /** 视口内 MCQ 选项与 JSON 对齐上下文 */
  function resolveMcqDomHighlightContext(entry) {
    if (!entry) return null;
    const rawOpts = Array.isArray(entry.选项) ? entry.选项 : [];
    if (rawOpts.length < 2) return null;
    const jsonPlain = rawOpts.map((l) =>
      String(l).replace(/\s*（正确答案）\s*$/, "").trim()
    );
    const correctIdx = resolveMcqCorrectOptionIndices(entry);
    if (correctIdx.length === 0) return null;
    if (!hasVisibleMcqItemTextInnerInViewport()) return null;
    const correctField =
      entry.正确答案 != null ? String(entry.正确答案).trim() : "";
    const correctLbl =
      entry.正确答案标号行 != null
        ? String(entry.正确答案标号行).trim()
        : "";
    const correct =
      correctIdx.map((j) => jsonPlain[j]).filter(Boolean).join("\n") ||
      correctLbl ||
      correctField;
    const domRows = collectVisibleMcqOptionRows();
    if (domRows.length < 1) return null;
    const mapDj = mapDomOptionRowsToJsonIndices(domRows, jsonPlain);
    const jToDomI = assignMcqCorrectJsonToDomRows(
      domRows,
      jsonPlain,
      correctIdx
    );
    return { correct, domRows, mapDj, correctIdx, jToDomI };
  }

  /** 面板答案区展示用 HTML/文本 */
  function buildPanelAnswerDisplay(entry) {
    const correct =
      entry && entry.正确答案 != null ? String(entry.正确答案).trim() : "";

    if (
      entry.objectMatchingCategoryKeys &&
      entry.objectMatchingCategoryKeys.length >= 2
    ) {
      return correct || null;
    }

    const rawOpts = Array.isArray(entry.选项) ? entry.选项 : [];
    if (rawOpts.length < 2) {
      return correct || null;
    }

    const correctIdx = resolveMcqCorrectOptionIndices(entry);
    if (correctIdx.length === 0) {
      return correct || null;
    }

    const parts = [];
    for (const j of correctIdx) {
      const plain = String(rawOpts[j])
        .replace(/\s*（正确答案）\s*$/, "")
        .trim();
      if (plain) parts.push(plain);
    }
    if (parts.length === 0) return correct || null;
    return parts.join("\n");
  }

  function clearAllMcqCorrectHighlights() {
    const nodes = querySelectorAllDeep(
      document,
      "." +
        MCQ_CORRECT_HINT_CLASS +
        ", ." +
        MCQ_CORRECT_HINT_INNER_CLASS,
      260
    );
    for (const el of nodes) {
      el.classList.remove(MCQ_CORRECT_HINT_CLASS);
      el.classList.remove(MCQ_CORRECT_HINT_INNER_CLASS);
    }
  }

  /** 已勾选则不叠加正确项高亮 */
  function isMcqOptionRowSiteSelected(innerEl) {
    if (!innerEl) return false;
    try {
      const label =
        innerEl.closest &&
        innerEl.closest(
          "label.mcq__item-label, label.js-item-label, label[role='listitem']"
        );
      if (
        label &&
        label.classList &&
        (label.classList.contains("is-selected") ||
          label.classList.contains("selected"))
      )
        return true;
      const row =
        innerEl.closest &&
        innerEl.closest(".mcq__item.js-mcq-item, .mcq__item");
      if (
        row &&
        row.classList &&
        (row.classList.contains("is-selected") ||
          row.classList.contains("selected"))
      )
        return true;
      const input =
        label &&
        label.querySelector &&
        label.querySelector('input[type="checkbox"], input[type="radio"]');
      if (input && input.checked) return true;
    } catch (_e) {
      /* */
    }
    return false;
  }

  function parseObjectMatchingPairsFromEntry(entry) {
    if (
      !entry ||
      !entry.objectMatchingCategoryKeys ||
      entry.objectMatchingCategoryKeys.length < 2
    )
      return null;
    const opts = Array.isArray(entry.选项) ? entry.选项 : [];
    const pairs = [];
    for (const line of opts) {
      const raw = String(line).replace(/\s+/g, " ").trim();
      if (!raw) continue;
      let sep = raw.indexOf("：");
      if (sep < 0) sep = raw.indexOf(":");
      if (sep < 1) continue;
      const cat = raw.slice(0, sep).trim();
      const ans = raw.slice(sep + 1).trim();
      if (cat && ans) pairs.push({ category: cat, answer: ans });
    }
    return pairs.length ? pairs : null;
  }

  function isObjectMatchingPlaceholderDropdownText(t) {
    const s = String(t || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!s) return true;
    return /请选择一个选项|请选择|select an option|choose an option|select\s+a\s+choice/i.test(
      s
    );
  }

  /** matching 下拉是否已选定具体项 */
  function isMatchingDropdownListItemSiteSelected(innerEl, wrapper) {
    if (!innerEl || !wrapper) return false;
    try {
      const dropEl =
        wrapper.querySelector(".dropdown__inner.js-dropdown-inner") ||
        wrapper.querySelector(".dropdown__inner");
      const dropRaw = String(
        (dropEl && (dropEl.innerText || dropEl.textContent)) || ""
      )
        .replace(/\s+/g, " ")
        .trim();
      if (isObjectMatchingPlaceholderDropdownText(dropRaw)) return false;

      if (innerEl.getAttribute && innerEl.getAttribute("aria-selected") === "true")
        return true;
      const li =
        innerEl.closest &&
        innerEl.closest(
          "li[role='option'], li.dropdown__item, li.js-dropdown-list-item"
        );
      if (li && li.getAttribute && li.getAttribute("aria-selected") === "true")
        return true;
    } catch (_e) {
      /* */
    }
    return false;
  }

  function parseCssColorToRgbTuple(css) {
    if (!css) return null;
    const s = String(css).trim();
    let m = s.match(
      /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i
    );
    if (m) {
      const a = m[4] != null ? parseFloat(m[4]) : 1;
      if (a < 0.08) return null;
      return [+m[1], +m[2], +m[3]];
    }
    m = s.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    if (m) {
      let h = m[1];
      if (h.length === 3)
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
    }
    return null;
  }

  function readOmBadgeRgbTuple(wrapper) {
    const badge = wrapper.querySelector(
      ".category-item-number, [class*='category-item-number' i]"
    );
    if (!badge) return null;
    try {
      const cs = getComputedStyle(badge).backgroundColor;
      const t = parseCssColorToRgbTuple(cs);
      if (t) return t;
    } catch (_e) {
      /* */
    }
    try {
      const st = badge.getAttribute && badge.getAttribute("style");
      if (st) {
        const bm = st.match(/background(?:-color)?\s*:\s*([^;]+)/i);
        if (bm) return parseCssColorToRgbTuple(bm[1].trim());
      }
    } catch (_e2) {
      /* */
    }
    return null;
  }

  function applyObjectMatchingPairTint(wrapper, rgbTuple) {
    if (!wrapper || !rgbTuple || rgbTuple.length !== 3) return;
    const [r, g, b] = rgbTuple;
    const fill = "rgba(" + r + "," + g + "," + b + ",0.26)";
    const edge = "rgba(" + r + "," + g + "," + b + ",0.88)";
    try {
      wrapper.setAttribute(OM_PAIR_TINT_ATTR, "1");
      wrapper.style.setProperty("box-sizing", "border-box", "important");
      wrapper.style.setProperty("border-radius", "10px", "important");
      wrapper.style.setProperty("background-color", fill, "important");
      wrapper.style.setProperty(
        "box-shadow",
        "inset 0 0 0 2px " + edge,
        "important"
      );
    } catch (_e) {
      /* */
    }
  }

  function clearObjectMatchingPairTints() {
    const sel = "[" + OM_PAIR_TINT_ATTR + '="1"]';
    const nodes = querySelectorAllDeep(document, sel, 220);
    const props = [
      "background-color",
      "box-shadow",
      "box-sizing",
      "border-radius",
    ];
    for (const el of nodes) {
      el.removeAttribute(OM_PAIR_TINT_ATTR);
      for (const p of props) {
        try {
          el.style.removeProperty(p);
        } catch (_e) {
          /* */
        }
      }
    }
  }

  function objectMatchingRowTitlePlain(wrapper) {
    const titleEl =
      wrapper.querySelector(
        ".matching__item-title .matching__item-title_inner"
      ) || wrapper.querySelector(".matching__item-title_inner");
    let t = String(
      (titleEl && (titleEl.innerText || titleEl.textContent)) || ""
    )
      .replace(/\s+/g, " ")
      .trim();
    if (t) return stripObjectMatchingLeadingLetterBadge(t);
    try {
      const c = wrapper.cloneNode(true);
      c
        .querySelectorAll(
          ".category-item-number, [class*='category-item-number' i]"
        )
        .forEach((n) => n.remove());
      t = String(c.innerText || "")
        .replace(/\s+/g, " ")
        .trim();
      return stripObjectMatchingLeadingLetterBadge(t);
    } catch (_e) {
      return "";
    }
  }

  /** matching 类下拉宿主 */
  function collectMatchingLikeDropdownRows() {
    const hosts = querySelectorAllDeep(
      document,
      "object-matching-dropdown-view, matching-dropdown-view",
      96
    );
    const seen = new WeakSet();
    const rows = [];
    for (let hi = 0; hi < hosts.length; hi++) {
      const h = hosts[hi];
      if (!h || seen.has(h) || isInOurPanel(h) || isInCourseChromeSidebar(h))
        continue;
      const sr = h.shadowRoot;
      if (!sr) continue;
      const w = sr.querySelector(".matching__item-container-options-wrapper");
      if (!w) continue;
      seen.add(h);
      rows.push({
        wrapper: w,
        host: h,
        tag: (h.tagName && h.tagName.toLowerCase()) || "",
      });
    }
    rows.sort((a, b) => {
      const ia = parseInt(String(a.host.getAttribute("index") || ""), 10);
      const ib = parseInt(String(b.host.getAttribute("index") || ""), 10);
      if (Number.isFinite(ia) && Number.isFinite(ib) && ia !== ib)
        return ia - ib;
      const ra = a.host.getBoundingClientRect().top;
      const rb = b.host.getBoundingClientRect().top;
      return ra - rb;
    });
    return rows;
  }

  function matchingDropdownItemPlainForHint(el) {
    if (!el) return "";
    try {
      const v = el.getAttribute && el.getAttribute("value");
      if (v != null) {
        const vt = String(v).replace(/\s+/g, " ").trim();
        if (vt) return vt;
      }
    } catch (_e) {
      /* */
    }
    return String(el.innerText || el.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function applyMatchingDropdownCorrectHints(wrapper, pair) {
    if (!wrapper || !pair || !pair.answer) return;
    try {
      const items = wrapper.querySelectorAll(
        ".dropdown__item-inner.js-dropdown-list-item-inner, .dropdown__item-inner[role='button'], .dropdown__item-inner"
      );
      const scored = [];
      for (let ii = 0; ii < items.length; ii++) {
        const el = items[ii];
        el.classList.remove(MATCHING_DD_CORRECT_CLASS);
        const li =
          el.closest &&
          el.closest(
            "li[role='option'], li.dropdown__item, li.js-dropdown-list-item"
          );
        if (li) li.classList.remove(MATCHING_DD_CORRECT_CLASS);
        const t = matchingDropdownItemPlainForHint(el);
        const sc = t
          ? optionTextMatchScoreMcq(t, pair.answer)
          : 0;
        scored.push({ el: el, li: li, sc: sc });
      }
      let bi = -1;
      let best = -1;
      let second = -1;
      for (let si = 0; si < scored.length; si++) {
        const s = scored[si].sc;
        if (s > best) {
          second = best;
          best = s;
          bi = si;
        } else if (s > second) second = s;
      }
      const margin = 0.06;
      if (
        bi >= 0 &&
        best >= MCQ_DOM_OPTION_MATCH_MIN &&
        best - second >= margin
      ) {
        const win = scored[bi];
        if (!isMatchingDropdownListItemSiteSelected(win.el, wrapper)) {
          if (win.li) win.li.classList.add(MATCHING_DD_CORRECT_CLASS);
          else win.el.classList.add(MATCHING_DD_CORRECT_CLASS);
        }
      }
    } catch (_e) {
      /* */
    }
  }

  function disconnectMatchingDropdownHintObservers() {
    if (matchingDdRehintTimer != null) {
      try {
        clearTimeout(matchingDdRehintTimer);
      } catch (_e) {
        /* */
      }
      matchingDdRehintTimer = null;
    }
    for (const [, obs] of matchingDropdownHintObserverByHost) {
      try {
        obs.disconnect();
      } catch (_e2) {
        /* */
      }
    }
    matchingDropdownHintObserverByHost.clear();
  }

  function reapplyMatchingDropdownHintsOnly() {
    const entry = lastEntryForMatchingDdRehint;
    if (!entry) return;
    const pairs = parseObjectMatchingPairsFromEntry(entry);
    if (!pairs || !pairs.length) return;
    const left = collectMatchingLikeDropdownRows();
    if (!left.length) return;
    for (let ri = 0; ri < left.length; ri++) {
      if (left[ri].host)
        ensureNetacadHighlightStylesInShadow(left[ri].host);
    }
    applyMatchingDropdownHintsForLeftRows(left, pairs);
    for (let si = 0; si < left.length; si++) {
      syncMatchingDropdownRowOutline(left[si].wrapper, left[si].host);
    }
  }

  function scheduleMatchingDdRehint() {
    if (matchingDdRehintTimer != null) {
      try {
        clearTimeout(matchingDdRehintTimer);
      } catch (_e) {
        /* */
      }
      matchingDdRehintTimer = null;
    }
    matchingDdRehintTimer = window.setTimeout(() => {
      matchingDdRehintTimer = null;
      reapplyMatchingDropdownHintsOnly();
    }, 70);
  }

  function installMatchingDropdownHintObservers(leftRows) {
    if (!leftRows || !leftRows.length) return;
    for (let ri = 0; ri < leftRows.length; ri++) {
      const host = leftRows[ri].host;
      if (!host || !host.shadowRoot || matchingDropdownHintObserverByHost.has(host))
        continue;
      try {
        const obs = new MutationObserver(() => {
          scheduleMatchingDdRehint();
        });
        obs.observe(host.shadowRoot, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["class", "aria-expanded", "aria-hidden", "hidden"],
        });
        matchingDropdownHintObserverByHost.set(host, obs);
      } catch (_e) {
        /* */
      }
    }
  }

  function resolvePairForMatchingWrapper(wrapper, pairs, rowIndex) {
    const titleEl =
      wrapper.querySelector(
        ".matching__item-title .matching__item-title_inner"
      ) || wrapper.querySelector(".matching__item-title_inner");
    const catRaw = String(
      (titleEl && (titleEl.innerText || titleEl.textContent)) || ""
    )
      .replace(/\s+/g, " ")
      .trim();
    let pair = null;
    let bestS = 0;
    for (let pi = 0; pi < pairs.length; pi++) {
      const p = pairs[pi];
      const s = mcqOptionPairExactMatchScore(catRaw, p.category);
      if (s > bestS) {
        bestS = s;
        pair = p;
      }
    }
    if (!pair || bestS < OM_CATEGORY_MATCH_MIN) {
      if (pairs[rowIndex]) pair = pairs[rowIndex];
      else return null;
    }
    return pair;
  }

  function getMatchingRowDropdownPlain(wrapper) {
    if (!wrapper) return "";
    const dropEl =
      wrapper.querySelector(".dropdown__inner.js-dropdown-inner") ||
      wrapper.querySelector(".dropdown__inner");
    return String(
      (dropEl && (dropEl.innerText || dropEl.textContent)) || ""
    )
      .replace(/\s+/g, " ")
      .trim();
  }

  /** objectMatching 行高亮 class 更新 */
  function syncMatchingDropdownRowOutline(wrapper, host) {
    if (!wrapper) return;
    const dropRaw = getMatchingRowDropdownPlain(wrapper);
    const tag =
      host && String(host.tagName || "").toLowerCase();
    wrapper.classList.remove(OM_ROW_CORRECT_CLASS);
    wrapper.classList.remove(OM_ROW_WRONG_CLASS);
    const ph = isObjectMatchingPlaceholderDropdownText(dropRaw);
    if (ph) {
      if (tag !== "matching-dropdown-view")
        wrapper.classList.add(OM_ROW_PLACEHOLDER_CLASS);
      else wrapper.classList.remove(OM_ROW_PLACEHOLDER_CLASS);
    } else {
      wrapper.classList.remove(OM_ROW_PLACEHOLDER_CLASS);
    }
  }

  function applyMatchingDropdownHintsForLeftRows(left, pairs) {
    if (!pairs || !pairs.length || !left || !left.length) return;
    for (let i = 0; i < left.length; i++) {
      const pair = resolvePairForMatchingWrapper(left[i].wrapper, pairs, i);
      if (pair) applyMatchingDropdownCorrectHints(left[i].wrapper, pair);
    }
  }

  function getObjectMatchingWalkRoot() {
    const hits = querySelectorAllDeep(
      document,
      [
        "matching-view",
        "object-matching-view",
        '[class*="objectMatching__widget" i]',
        '[class*="object-matching__widget" i]',
        '[class*="component__widget"][class*="objectmatching" i]',
        '[class*="component-matching" i]',
        '[class*="matching__widget" i]',
      ].join(", "),
      16
    );
    for (const h of hits) {
      if (
        h &&
        !isInOurPanel(h) &&
        !isInCourseChromeSidebar(h) &&
        domElLikelyRenderedForUser(h)
      )
        return h;
    }
    return document.body;
  }

  /** 遍历收集 matching / objectMatching 宿主 */
  function walkCollectObjectMatchingHosts(entryRoot, maxHosts) {
    maxHosts = maxHosts == null ? 64 : maxHosts;
    const hosts = [];
    const seenHost = new WeakSet();
    const stack = [entryRoot || document.body];
    const seenNode = new WeakSet();
    let steps = 0;
    const budget = 14000;
    while (stack.length && hosts.length < maxHosts && steps++ < budget) {
      const node = stack.pop();
      if (!node || seenNode.has(node)) continue;
      seenNode.add(node);
      if (node.nodeType === 1) {
        const tag = node.tagName && node.tagName.toLowerCase();
        const isMatchingLikeTag =
          tag &&
          (tag.indexOf("object-matching-") === 0 ||
            (tag.indexOf("matching-") === 0 && !/^matching-lines/i.test(tag)));
        if (
          isMatchingLikeTag &&
          node.shadowRoot &&
          !seenHost.has(node) &&
          !isInOurPanel(node) &&
          !isInCourseChromeSidebar(node)
        ) {
          const w = node.shadowRoot.querySelector(
            ".matching__item-container-options-wrapper"
          );
          if (w) {
            seenHost.add(node);
            hosts.push({ host: node, wrapper: w, tag: tag });
          }
        }
        if (node.shadowRoot) stack.push(node.shadowRoot);
        const ch = node.children;
        if (ch)
          for (let i = ch.length - 1; i >= 0; i--) stack.push(ch[i]);
      } else if (node.nodeType === 11) {
        const ch = node.children;
        if (ch)
          for (let i = ch.length - 1; i >= 0; i--) stack.push(ch[i]);
      }
    }
    return hosts;
  }

  function classifyObjectMatchingLeftRightRows(allHosts) {
    const strip = (h) => ({ host: h.host, wrapper: h.wrapper, tag: h.tag });
    const withDrop = [];
    const withoutDrop = [];
    for (const h of allHosts) {
      if (isInOurPanel(h.host) || isInCourseChromeSidebar(h.host)) continue;
      const w = h.wrapper;
      const hasDrop = !!(
        w.querySelector(".dropdown__inner") ||
        w.querySelector(".js-dropdown-inner") ||
        w.querySelector("select")
      );
      (hasDrop ? withDrop : withoutDrop).push(strip(h));
    }
    if (withDrop.length && withoutDrop.length)
      return { left: withDrop, right: withoutDrop };
    if (allHosts.length >= 2) {
      const scored = [];
      for (const h of allHosts) {
        if (isInOurPanel(h.host) || isInCourseChromeSidebar(h.host)) continue;
        const r = h.host.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        scored.push(Object.assign({}, strip(h), { cx: cx }));
      }
      if (scored.length >= 2) {
        scored.sort((a, b) => a.cx - b.cx);
        const mid =
          (scored[0].cx + scored[scored.length - 1].cx) / 2;
        const left = [];
        const right = [];
        for (const s of scored) {
          const { cx: _cx, ...rest } = s;
          (s.cx <= mid ? left : right).push(rest);
        }
        if (left.length && right.length) return { left: left, right: right };
      }
    }
    return {
      left: withDrop.length ? withDrop : allHosts.map(strip),
      right: [],
    };
  }

  function clearObjectMatchingHighlights() {
    disconnectMatchingDropdownHintObservers();
    lastEntryForMatchingDdRehint = null;
    clearObjectMatchingPairTints();
    const sel =
      "." +
      OM_ROW_CORRECT_CLASS +
      ", ." +
      OM_ROW_WRONG_CLASS +
      ", ." +
      OM_ROW_PLACEHOLDER_CLASS;
    const nodes = querySelectorAllDeep(document, sel, 140);
    for (const el of nodes) {
      el.classList.remove(OM_ROW_CORRECT_CLASS);
      el.classList.remove(OM_ROW_WRONG_CLASS);
      el.classList.remove(OM_ROW_PLACEHOLDER_CLASS);
    }
    const ddHint = querySelectorAllDeep(
      document,
      "." + MATCHING_DD_CORRECT_CLASS,
      220
    );
    for (let di = 0; di < ddHint.length; di++) {
      ddHint[di].classList.remove(MATCHING_DD_CORRECT_CLASS);
    }
  }

  /** 连线式 object-matching-view 文案采集 */
  function objectMatchingV2RowPlain(btn) {
    if (!btn) return "";
    const te = btn.querySelector(".category-item-text");
    if (te) {
      const raw = String(te.innerText || te.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      return stripObjectMatchingLeadingLetterBadge(raw);
    }
    return objectMatchingRowTitlePlain(btn);
  }

  function collectObjectMatchingViewContexts() {
    const hosts = querySelectorAllDeep(document, "object-matching-view", 40);
    const out = [];
    for (let i = 0; i < hosts.length; i++) {
      const host = hosts[i];
      if (!host || isInOurPanel(host) || isInCourseChromeSidebar(host))
        continue;
      const sr = host.shadowRoot;
      if (!sr) continue;
      const cats = sr.querySelectorAll(
        ".categories-container .objectMatching-category-item"
      );
      const opts = sr.querySelectorAll(
        ".options-container .objectMatching-option-item"
      );
      if (cats.length && opts.length) {
        out.push({
          host: host,
          cats: Array.from(cats),
          opts: Array.from(opts),
        });
      }
    }
    return out;
  }

  /** objectMatching 页面高亮 */
  function applyObjectMatchingHighlights(entry) {
    clearObjectMatchingHighlights();
    const pairs = parseObjectMatchingPairsFromEntry(entry);
    if (!pairs || !pairs.length) return;

    const v2ctxs = collectObjectMatchingViewContexts();
    if (v2ctxs.length) {
      for (let vi = 0; vi < v2ctxs.length; vi++) {
        const ctx = v2ctxs[vi];
        ensureNetacadHighlightStylesInShadow(ctx.host);
        for (let pi = 0; pi < pairs.length; pi++) {
          const pair = pairs[pi];
          let bestCat = null;
          let bestCatS = 0;
          for (let ci = 0; ci < ctx.cats.length; ci++) {
            const btn = ctx.cats[ci];
            const catRaw = objectMatchingV2RowPlain(btn);
            const s = mcqOptionPairExactMatchScore(catRaw, pair.category);
            if (s > bestCatS) {
              bestCatS = s;
              bestCat = btn;
            }
          }
          if (!bestCat || bestCatS < OM_CATEGORY_MATCH_MIN) continue;

          let bestOpt = null;
          let bestOptS = 0;
          for (let oi = 0; oi < ctx.opts.length; oi++) {
            const btn = ctx.opts[oi];
            const optRaw = objectMatchingV2RowPlain(btn);
            const s = optionTextMatchScoreMcq(optRaw, pair.answer);
            if (s > bestOptS) {
              bestOptS = s;
              bestOpt = btn;
            }
          }
          if (!bestOpt || bestOptS < MCQ_DOM_OPTION_MATCH_MIN) continue;

          const rgb = readOmBadgeRgbTuple(bestCat);
          if (!rgb) continue;
          applyObjectMatchingPairTint(bestCat, rgb);
          applyObjectMatchingPairTint(bestOpt, rgb);
        }
      }
      return;
    }

    const walkRoot = getObjectMatchingWalkRoot();
    let allHosts = walkCollectObjectMatchingHosts(walkRoot, 72);
    let left, right;
    if (allHosts.length) {
      const split = classifyObjectMatchingLeftRightRows(allHosts);
      left = split.left;
      right = split.right;
    } else {
      left = [];
      right = [];
    }

    if (!left.length) {
      left = collectMatchingLikeDropdownRows();
    }
    if (!left.length) return;

    const injectHosts = left.concat(right || []);
    for (let r = 0; r < injectHosts.length; r++) {
      if (injectHosts[r].host)
        ensureNetacadHighlightStylesInShadow(injectHosts[r].host);
    }

    if (right && right.length) {
      for (const pair of pairs) {
        let bestL = null;
        let bestLS = 0;
        for (const row of left) {
          const catRaw = objectMatchingRowTitlePlain(row.wrapper);
          const s = mcqOptionPairExactMatchScore(catRaw, pair.category);
          if (s > bestLS) {
            bestLS = s;
            bestL = row;
          }
        }
        if (!bestL || bestLS < OM_CATEGORY_MATCH_MIN) continue;

        let bestR = null;
        let bestRS = 0;
        for (const row of right) {
          const optRaw = objectMatchingRowTitlePlain(row.wrapper);
          const s = optionTextMatchScoreMcq(optRaw, pair.answer);
          if (s > bestRS) {
            bestRS = s;
            bestR = row;
          }
        }
        if (!bestR || bestRS < MCQ_DOM_OPTION_MATCH_MIN) continue;

        const rgb = readOmBadgeRgbTuple(bestL.wrapper);
        if (!rgb) continue;
        applyObjectMatchingPairTint(bestL.wrapper, rgb);
        applyObjectMatchingPairTint(bestR.wrapper, rgb);
      }
    }

    lastEntryForMatchingDdRehint = entry;
    installMatchingDropdownHintObservers(left);
    applyMatchingDropdownHintsForLeftRows(left, pairs);

    for (let i = 0; i < left.length; i++) {
      syncMatchingDropdownRowOutline(left[i].wrapper, left[i].host);
    }
  }

  /** MCQ 正确项页面高亮 */
  function applyMcqCorrectOptionHighlights(entry) {
    clearAllMcqCorrectHighlights();
    if (!entry) {
      return;
    }
    const ctx = resolveMcqDomHighlightContext(entry);
    if (!ctx) return;
    if (ctx.domRows[0] && ctx.domRows[0].el)
      ensureNetacadHighlightStylesInShadow(ctx.domRows[0].el);
    const seenHost = new WeakSet();
    const rawOptsHl = Array.isArray(entry.选项) ? entry.选项 : [];
    for (const j of ctx.correctIdx) {
      const i =
        ctx.jToDomI[j] != null
          ? ctx.jToDomI[j]
          : (() => {
              for (let di = 0; di < ctx.mapDj.length; di++) {
                if (ctx.mapDj[di] === j) return di;
              }
              return -1;
            })();
      if (i < 0 || !ctx.domRows[i]) continue;
      const jsonPlainJ = String(rawOptsHl[j] || "")
        .replace(/\s*（正确答案）\s*$/, "")
        .trim();
      const rowT = String(ctx.domRows[i].text || "")
        .replace(/\s+/g, " ")
        .trim();
      const score = jsonPlainJ
        ? optionTextMatchScoreMcq(rowT, jsonPlainJ)
        : 0;
      if (!jsonPlainJ || score < MCQ_DOM_OPTION_MATCH_MIN) continue;
      const inner = ctx.domRows[i].el;
      if (!inner || isInOurPanel(inner)) continue;
      if (isMcqOptionRowSiteSelected(inner)) continue;
      const host = resolveMcqItemHostForHighlight(inner);
      if (!host || isInOurPanel(host) || seenHost.has(host)) continue;
      seenHost.add(host);
      host.classList.add(MCQ_CORRECT_HINT_CLASS);
    }
  }

  /** findBestMcq 平分时用所属单元/大纲加权重 */
  function sectionAnchorBonus(row, normView, outlineRef) {
    let b = 0;
    const ut = row.entry.所属单元?.标题;
    const ub = row.entry.所属单元?.说明;
    const uPack = normalizeForMatch([ut, ub].filter(Boolean).join(" "));
    if (uPack.length > 10) {
      const frag = uPack.slice(0, Math.min(48, uPack.length));
      if (normView.includes(frag)) b += Math.min(frag.length, 36);
    }
    if (outlineRef) {
      const o = relaxForMatch(outlineRef);
      const utr = relaxForMatch(ut || "");
      const ubr = relaxForMatch(ub || "");
      if (o) {
        if (utr && (utr.startsWith(o) || utr.includes(o))) b += 120;
        else if (ubr && ubr.includes(o)) b += 70;
        else if (uPack.includes(o)) b += 90;
      }
    }
    return b;
  }

  /** 按题干 exact key 在题库列表中选一行 */
  function findBestMcqCore(mcqs, pageText, outlineRef, ipv4StrictStem) {
    if (!mcqs || !mcqs.length) return null;
    const normView = normalizeForMatch(pageText);
    if (!normView || normView.length < 8) return null;
    const ipv4Gate =
      ipv4StrictStem != null && String(ipv4StrictStem).trim().length >= 12
        ? ipv4StrictStem
        : pageText;

    const stemSrc =
      ipv4StrictStem != null && String(ipv4StrictStem).trim().length >= 8
        ? ipv4StrictStem
        : pageText;
    const viewKey = stemUnifiedExactKeyFromVisibleStem(stemSrc);

    let best = null;
    let bestScore = 0;
    let bestBonus = -1;

    const consider = (row, baseScore) => {
      const q = row.entry.问题 || "";
      if (!stemIpv4CidrTokensAlign(ipv4Gate, q)) return;
      const bonus = sectionAnchorBonus(row, normView, outlineRef);
      if (
        baseScore > bestScore ||
        (baseScore === bestScore && bonus > bestBonus)
      ) {
        bestScore = baseScore;
        bestBonus = bonus;
        best = row;
      }
    };

    for (const row of mcqs) {
      const q = row.entry.问题 || "";
      const bankKey = stemUnifiedExactKeyFromQuestionHtml(q);
      if (!bankKey) continue;
      if (viewKey && viewKey === bankKey) {
        consider(row, bankKey.length);
      }
    }
    return best;
  }

  /** 按 MAC 在 pool 中锁定行 */
  function findMcqRowByMacLikeInPool(visibleStem, pool) {
    const macs = extractMacLikeTokensFromStem(visibleStem);
    if (macs.length < 1 || !pool || !pool.length) return null;
    const hits = [];
    for (const row of pool) {
      const nq = normalizeQuestionHtmlForMatch(row.entry?.问题 || "");
      if (!nq || nq.length < 12) continue;
      if (macs.every((tok) => nq.includes(tok))) hits.push(row);
    }
    if (hits.length === 1) return hits[0];
    if (hits.length > 1)
      return pickStemAmbiguousRow(hits, pool, null, visibleStem);
    return null;
  }

  /** 题干多匹配时用题号决胜 */
  function pickStemAmbiguousRow(narrowed, fullPool, ordinalHint, visibleStem) {
    if (!narrowed || !narrowed.length) return null;
    if (narrowed.length === 1) return narrowed[0];
    const rawStem = visibleStem && String(visibleStem).trim();
    const stemOk =
      rawStem && stripQuizAccessibilityStemNoise(rawStem).length >= 8;
    if (stemOk) {
      const exactHits = narrowed.filter((row) =>
        visibleStemMatchesQuestion(visibleStem, row.entry?.问题 || "")
      );
      if (exactHits.length === 1) return exactHits[0];
    }
    const n = parseInt(String(ordinalHint), 10);
    if (Number.isFinite(n) && n >= 1) {
      const want = n - 1;
      const exact = narrowed.find((row) => fullPool.indexOf(row) === want);
      if (exact) return exact;
      let best = narrowed[0];
      let bestD = Infinity;
      for (const row of narrowed) {
        const i = fullPool.indexOf(row);
        if (i < 0) continue;
        const d = Math.abs(i - want);
        if (d < bestD) {
          bestD = d;
          best = row;
        }
      }
      return best;
    }
    return narrowed[0];
  }

  /** 用可见题干在 pool 中校正 current */
  function realignCurrentToVisibleStem(pool, visibleStem, ordinalHint, current) {
    if (!pool || !pool.length || visibleStem == null) return current;
    const vsRaw = String(visibleStem).trim();
    let vs = stripQuizAccessibilityStemNoise(vsRaw);
    if (vs.length < 6) vs = vsRaw;
    if (vs.length < 12) return current;
    if (current != null) {
      const ok = visibleStemMatchesMcqRow(vs, current);
      if (ok) return current;
    }
    const hits = pool.filter((row) => visibleStemMatchesMcqRow(vs, row));
    if (hits.length === 0) return current;
    if (hits.length === 1) return hits[0];
    return pickStemAmbiguousRow(hits, pool, ordinalHint, visibleStem);
  }

  function findBestMcq(mcqs, pageText, outlineRef, visibleStem, ordinalHint) {
    const raw = visibleStem && String(visibleStem).trim();
    const stripped = raw ? stripQuizAccessibilityStemNoise(raw) : "";
    const vs =
      stripped.length >= 6 ? stripped : raw;
    if (vs && vs.length >= 12) {
      const narrowed = mcqs.filter((row) => visibleStemMatchesMcqRow(vs, row));
      if (narrowed.length === 1) return narrowed[0];
      if (narrowed.length > 1)
        return pickStemAmbiguousRow(narrowed, mcqs, ordinalHint, vs);
      const fromStemOnly = findBestMcqCore(mcqs, vs, outlineRef, vs);
      if (fromStemOnly && visibleStemMatchesMcqRow(vs, fromStemOnly)) {
        return fromStemOnly;
      }
      const biased = `${vs}\n\n${pageText}`;
      return findBestMcqCore(mcqs, biased, outlineRef, vs);
    }
    return findBestMcqCore(mcqs, pageText, outlineRef, null);
  }

  /** 从合并正文猜题号 */
  function extractPageQuestionNumber(pageText) {
    if (
      lastDomQuizQuestionNumber != null &&
      Number.isFinite(lastDomQuizQuestionNumber)
    ) {
      return lastDomQuizQuestionNumber;
    }
    const s = String(pageText || "").replace(/\s+/g, " ");
    const reZh = /(\d+)\s*的\s*(\d+)\s*问题/g;
    let zhBest = null;
    let zm;
    while ((zm = reZh.exec(s)) !== null) {
      const cur = parseInt(zm[1], 10);
      const tot = parseInt(zm[2], 10);
      if (
        Number.isFinite(cur) &&
        Number.isFinite(tot) &&
        cur > 0 &&
        tot > 0 &&
        cur <= tot &&
        cur < 500 &&
        tot < 500
      )
        zhBest = cur;
    }
    if (zhBest != null) return zhBest;
    const patterns = [
      /问题\s*(\d+)/i,
      /\bQ\s*(\d+)/i,
      /\bquestion\s*(\d+)/i,
    ];
    for (const re of patterns) {
      const m = s.match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && n > 0 && n < 500) return n;
      }
    }
    return null;
  }

  function scheduleFabSync() {
    syncPanelPositionToSiteFabs();
    requestAnimationFrame(() => syncPanelPositionToSiteFabs());
  }

  function ensurePanel() {
    let el = document.getElementById(PANEL_ID);
    if (el) {
      bindPanelMatchNavOnce(el);
      return el;
    }
    el = document.createElement("div");
    el.id = PANEL_ID;
    el.className = "netacad-ah-collapsed";
    el.innerHTML = `
      <button type="button" class="netacad-ah-fab" title="展开 NetAcad 答案助手">答</button>
      <div class="netacad-ah-card">
        <div class="netacad-ah-head">
          <span>NetAcad 答案助手</span>
          <button type="button" class="netacad-ah-close" aria-label="收起">×</button>
        </div>
        <div class="netacad-ah-body"></div>
      </div>
    `;
    document.documentElement.appendChild(el);
    bindPanelMatchNavOnce(el);
    syncPanelPositionToSiteFabs();
    const expand = () => {
      el.classList.remove("netacad-ah-collapsed");
      el.classList.add("netacad-ah-expanded");
      scheduleFabSync();
    };
    const collapse = () => {
      el.classList.add("netacad-ah-collapsed");
      el.classList.remove("netacad-ah-expanded");
      scheduleFabSync();
    };
    el.querySelector(".netacad-ah-fab").addEventListener("click", expand);
    el.querySelector(".netacad-ah-close").addEventListener("click", collapse);
    scheduleFabSync();
    return el;
  }

  const FAB_GAP_ABOVE_PX = 12;
  const FAB_VERTICAL_STEP_FALLBACK = 60;
  const FAB_IFRAME_RIGHT_NUDGE_PX = 9;

  function resolveSiteFabAnchor() {
    const pick = (doc) => {
      if (!doc) return null;
      const green = doc.getElementById("fabActionBtn");
      if (green && green.isConnected)
        return { el: green, extraBottom: 0 };
      const webex = doc.getElementById("webexFabActionBtn");
      if (webex && webex.isConnected)
        return { el: webex, extraBottom: FAB_VERTICAL_STEP_FALLBACK };
      return null;
    };
    let w = window;
    for (let depth = 0; depth < 8 && w; depth++) {
      const hit = pick(w.document);
      if (hit) return { ...hit, fabWin: w };
      if (w === w.top) break;
      try {
        w = w.parent;
      } catch (_e) {
        break;
      }
    }
    return null;
  }

  function syncPanelPositionToSiteFabs() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const anchor = resolveSiteFabAnchor();
    if (!anchor) {
      if (!fabLayoutSyncedOnce) {
        panel.style.removeProperty("right");
        panel.style.removeProperty("bottom");
      }
      return;
    }
    const { el, extraBottom, fabWin } = anchor;
    const r = el.getBoundingClientRect();
    const pw = window;
    if (fabWin === pw) {
      const rightPx = pw.innerWidth - r.right;
      const bottomPx =
        pw.innerHeight - r.top + extraBottom + FAB_GAP_ABOVE_PX;
      applyFabSyncLayout(panel, rightPx, bottomPx);
      fabLayoutSyncedOnce = true;
      return;
    }
    const fr = pw.frameElement;
    if (!fr || !fr.isConnected) {
      if (!fabLayoutSyncedOnce) {
        panel.style.removeProperty("right");
        panel.style.removeProperty("bottom");
      }
      return;
    }
    const box = fr.getBoundingClientRect();
    const cl = fr.clientLeft;
    const ct = fr.clientTop;
    const rightPx =
      pw.innerWidth -
      (r.right - box.left - cl) -
      FAB_IFRAME_RIGHT_NUDGE_PX;
    const bottomPx =
      pw.innerHeight -
      r.top +
      box.top +
      ct +
      extraBottom +
      FAB_GAP_ABOVE_PX;
    applyFabSyncLayout(panel, rightPx, bottomPx);
    fabLayoutSyncedOnce = true;
  }

  /** 面板 right/bottom 与站点 FAB 对齐 */
  function applyFabSyncLayout(panel, rightPx, bottomPx) {
    panel.style.right = `${Math.max(0, Math.round(rightPx))}px`;
    panel.style.bottom = `${Math.max(0, Math.round(bottomPx))}px`;
  }

  /** 答案 HTML：单选一行，多选多行 */
  function buildAnswerBoxHtml(answerRaw) {
    if (answerRaw === "…") {
      return '<div class="netacad-ah-answer-box"><span class="netacad-ah-answer netacad-ah-answer--loading">…</span></div>';
    }
    const t =
      answerRaw != null && answerRaw !== undefined
        ? String(answerRaw).trim()
        : "";
    if (!t) {
      return '<div class="netacad-ah-answer-box"><span class="netacad-ah-answer-empty">—</span></div>';
    }
    const lines = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (lines.length <= 1) {
      return `<div class="netacad-ah-answer-box"><span class="netacad-ah-answer">${escapeHtml(
        t
      )}</span></div>`;
    }
    const inner = lines
      .map(
        (line) =>
          `<div class="netacad-ah-answer-line"><span class="netacad-ah-answer">${escapeHtml(
            line
          )}</span></div>`
      )
      .join("");
    return `<div class="netacad-ah-answer-box netacad-ah-answer-box--multi">${inner}</div>`;
  }

  /** 渲染面板主体 */
  function renderQuizSummary(body, questionLabel, questionStem, answerRaw, matchNav) {
    const qHtml =
      questionLabel && questionLabel !== "—"
        ? escapeHtml(questionLabel)
        : "—";
    let stemHtml;
    if (questionStem === "…") {
      stemHtml = "…";
    } else {
      const st =
        questionStem != null && String(questionStem).trim()
          ? String(questionStem).trim()
          : "";
      stemHtml = st ? escapeHtml(st) : "—";
    }
    const answerBoxHtml = buildAnswerBoxHtml(answerRaw);
    let navRow = "";
    if (
      matchNav &&
      matchNav.total > 1 &&
      matchNav.index >= 1 &&
      matchNav.index <= matchNav.total
    ) {
      navRow = `<div class="netacad-ah-matchnav-bar" role="group" aria-label="多条答案匹配切换"><span class="netacad-ah-matchnav-lbl">匹配</span><button type="button" class="netacad-ah-match-prev netacad-ah-match-iconbtn" title="上一条" aria-label="上一条匹配">‹</button><span class="netacad-ah-match-pos">${matchNav.index}/${matchNav.total}</span><button type="button" class="netacad-ah-match-next netacad-ah-match-iconbtn" title="下一条" aria-label="下一条匹配">›</button></div>`;
    }
    body.innerHTML = `<div class="netacad-ah-simple">${navRow}
      <div class="netacad-ah-simple-row"><span class="netacad-ah-simple-k">题号</span><span class="netacad-ah-simple-v">${qHtml}</span></div>
      <div class="netacad-ah-simple-row netacad-ah-simple-row--stem"><span class="netacad-ah-simple-k">题目</span><span class="netacad-ah-simple-v netacad-ah-simple-stem">${stemHtml}</span></div>
      <div class="netacad-ah-simple-row netacad-ah-simple-row--answer"><span class="netacad-ah-simple-k">答案</span><div class="netacad-ah-simple-v netacad-ah-answer-wrap">${answerBoxHtml}</div></div>
    </div>`;
  }

  const AMB_STEM_HINT_ID = "netacad-ah-amb-stem-hint";

  /** 查找当前测验题标题元素 */
  function findMcqQuestionTitleHeadingEl() {
    const deep = querySelectorAllDeep(
      document,
      ".mcq__title-inner, .component__title-inner, " +
        "[class*='mcq__title-inner'], [class*='component__title-inner']",
      96
    );
    const scored = [];
    for (let i = 0; i < deep.length; i++) {
      const el = deep[i];
      if (!el || isInOurPanel(el) || isInCourseChromeSidebar(el)) continue;
      const area = elementVisibleViewportArea(el);
      const vis = domElLikelyRenderedForUser(el);
      if (area < 4 && !vis) continue;
      const t = cleanMcqTitleInnerText(mcqTitleInnerPlainFromNode(el)) || "";
      if (t.length < 2 || !/问题|question|Q\b/i.test(t)) continue;
      let score = area;
      if (vis) score += 1e6;
      scored.push({ el, score });
    }
    scored.sort((a, b) => b.score - a.score);
    if (scored.length) return scored[0].el;
    for (let j = 0; j < deep.length; j++) {
      const el = deep[j];
      if (!el || isInOurPanel(el) || isInCourseChromeSidebar(el)) continue;
      const area = elementVisibleViewportArea(el);
      const vis = domElLikelyRenderedForUser(el);
      if (area < 4 && !vis) continue;
      scored.push({ el, score: area + (vis ? 1e6 : 0) });
    }
    scored.sort((a, b) => b.score - a.score);
    if (scored.length) return scored[0].el;
    const hosts = querySelectorAllDeep(document, "mcq-view", 32);
    for (let hi = 0; hi < hosts.length; hi++) {
      const h = hosts[hi];
      if (!h || isInOurPanel(h) || !domElLikelyRenderedForUser(h)) continue;
      const sr = h.shadowRoot;
      if (!sr) continue;
      const inner =
        sr.querySelector(".mcq__title-inner") ||
        sr.querySelector(".component__title-inner") ||
        sr.querySelector("[class*='mcq__title-inner']") ||
        sr.querySelector("[class*='component__title-inner']");
      if (inner) return inner;
    }
    try {
      const xr = document.evaluate(
        "//*[contains(@class,'mcq__title-inner')][contains(.,'问题')][1]",
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      const n = xr && xr.singleNodeValue;
      if (
        n &&
        n.nodeType === 1 &&
        !isInOurPanel(n) &&
        domElLikelyRenderedForUser(n)
      )
        return n;
    } catch (_e) {
      /* */
    }
    return null;
  }

  function removeAmbiguousStemHint() {
    try {
      const found = querySelectorAllDeep(
        document,
        '[id="netacad-ah-amb-stem-hint"]',
        24
      );
      for (let i = 0; i < found.length; i++) {
        try {
          found[i].remove();
        } catch (_e) {
          /* */
        }
      }
    } catch (_e2) {
      /* */
    }
    ambHintMountedParent = null;
  }

  function ensureAmbiguousStemHintOnPage() {
    const titleEl = findMcqQuestionTitleHeadingEl();
    if (!titleEl || !titleEl.parentElement) return;
    const par = titleEl.parentElement;
    const hintInlineStyle = [
      "display:block",
      "box-sizing:border-box",
      "width:100%",
      "max-width:100%",
      "min-width:0",
      "margin:0.35rem 0 0.45rem",
      "padding:0.3rem 0.5rem 0.3rem 0.55rem",
      'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
      "font-size:11px",
      "font-weight:400",
      "line-height:1.45",
      "font-style:normal",
      "color:#94908c",
      "background:rgba(248,246,244,0.98)",
      "border:none",
      "border-left:3px solid #d4d0ca",
      "border-radius:0 4px 4px 0",
      "box-shadow:inset 0 0 0 1px rgba(0,0,0,0.05)",
    ].join(";");
    const hintText =
      '多条答案匹配：请点右下角"答"，在面板里用匹配栏切换比对题干与答案。';
    const existing = par.querySelector("#" + AMB_STEM_HINT_ID);
    if (existing) {
      existing.textContent = hintText;
      existing.setAttribute("style", hintInlineStyle);
      ambHintMountedParent = par;
      return;
    }
    removeAmbiguousStemHint();
    const aside = document.createElement("aside");
    aside.id = AMB_STEM_HINT_ID;
    aside.className = "netacad-ah-question-amb-hint";
    aside.setAttribute("data-netacad-ah-injected", "1");
    aside.setAttribute("role", "note");
    aside.setAttribute("aria-label", "答案助手提示");
    aside.setAttribute("style", hintInlineStyle);
    aside.textContent = hintText;
    titleEl.insertAdjacentElement("afterend", aside);
    ambHintMountedParent = par;
  }

  function syncMatchCandidateIndexState(hits) {
    if (!hits || hits.length === 0) {
      lastMatchCandidateSig = "";
      matchCandidateIndex = 0;
      return;
    }
    const sig = hits
      .map((r) => r.index)
      .filter((ix) => ix != null)
      .sort((a, b) => a - b)
      .join(",");
    if (sig !== lastMatchCandidateSig) {
      lastMatchCandidateSig = sig;
      matchCandidateIndex = 0;
    }
    if (matchCandidateIndex >= hits.length) matchCandidateIndex = 0;
  }

  function applyMatchNavDelta(delta) {
    tickRunGeneration++;
    matchNavInteractionUntil = Date.now() + 2200;
    const hits = lastAmbiguousHitsForNav;
    const total = hits.length;
    if (total <= 1) return;
    matchCandidateIndex = (matchCandidateIndex + delta + total) % total;
    const st = lastTickPanelState;
    if (!st || !st.loaded) {
      void tick();
      return;
    }
    const row = hits[matchCandidateIndex];
    let ordFromIndex = st.mcqOrdinal;
    if (lastMcqsFullListForNav.length && row && row.index != null) {
      const ix = lastMcqsFullListForNav.findIndex((r) => r.index === row.index);
      if (ix >= 0) ordFromIndex = ix + 1;
    }
    const next = Object.assign({}, st, {
      current: row,
      matchNav: { index: matchCandidateIndex + 1, total: total },
      mcqOrdinal: ordFromIndex,
      componentIndex: row && row.index != null ? row.index : null,
      answerGrabbed: !!(
        row &&
        row.entry &&
        String(row.entry.正确答案 || "").trim()
      ),
    });
    if (row && row.entry) {
      applyMcqCorrectOptionHighlights(row.entry);
      applyObjectMatchingHighlights(row.entry);
    } else {
      clearAllMcqCorrectHighlights();
      clearObjectMatchingHighlights();
    }
    renderPanel(next);
    lastTickPanelState = next;
  }

  function bindPanelMatchNavOnce(panelEl) {
    if (panelMatchNavClickBound || !panelEl) return;
    panelMatchNavClickBound = true;
    panelEl.addEventListener("click", (ev) => {
      const t = ev.target;
      if (!t || !t.closest) return;
      const btn = t.closest(".netacad-ah-match-prev, .netacad-ah-match-next");
      if (!btn || !btn.closest("#" + PANEL_ID)) return;
      ev.preventDefault();
      if (panelMatchNavTotal <= 1) return;
      if (btn.classList.contains("netacad-ah-match-prev")) applyMatchNavDelta(-1);
      else applyMatchNavDelta(1);
    });
  }

  function resolveQuestionStemForPanel(state) {
    const multiMatch =
      state.matchNav &&
      typeof state.matchNav.total === "number" &&
      state.matchNav.total > 1;
    if (state.current && state.current.entry) {
      const raw = state.current.entry.问题;
      const plain =
        stripHtmlToPlain(raw) ||
        String(raw || "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      if (plain) return plain;
    }
    if (multiMatch) {
      const ord =
        state.mcqOrdinal != null && Number.isFinite(Number(state.mcqOrdinal))
          ? String(state.mcqOrdinal)
          : null;
      const comp =
        state.componentIndex != null && Number.isFinite(Number(state.componentIndex))
          ? String(state.componentIndex)
          : null;
      if (ord)
        return `（题库第 ${ord} 题：题干在 JSON 中为空或无法解析，请用 ‹ › 切换条目对照答案。）`;
      if (comp)
        return `（components 索引 ${comp}：题干未解析，请用 ‹ › 切换对照。）`;
      return "（多条答案匹配：请在面板里用匹配栏切换，对照各条目答案。）";
    }
    let domStem = "";
    if (state.visibleDomStem != null) {
      domStem = String(state.visibleDomStem).replace(/\s+/g, " ").trim();
    }
    if (domStem) return domStem;
    const vis = getVisibleMcqStemText(state.visibleMcqOrdinal);
    if (vis) return vis;
    if (lastDomStemBlob && String(lastDomStemBlob).trim()) {
      const first = String(lastDomStemBlob).split(/\n\n+/)[0].trim();
      return first || null;
    }
    return null;
  }

  function updateFabTooltip(mcqTitleLabel, stem) {
    const panel = document.getElementById(PANEL_ID);
    const fab = panel && panel.querySelector(".netacad-ah-fab");
    if (!fab) return;
    const titleLine =
      mcqTitleLabel && mcqTitleLabel !== "—" ? String(mcqTitleLabel).trim() : "";
    const s = stem != null && String(stem).replace(/\s+/g, " ").trim();
    const parts = [];
    if (titleLine) parts.push(titleLine);
    if (s) parts.push(s.slice(0, 200));
    fab.title = parts.length
      ? `答 · ${parts.join(" · ")}`
      : "展开 NetAcad 答案助手";
  }

  function renderPanel(state) {
    ensurePanel();
    const body = document.querySelector("#" + PANEL_ID + " .netacad-ah-body");
    if (!body) return;

    if (state.error) {
      renderQuizSummary(body, null, null, null);
      updateFabTooltip(null, null);
      return;
    }

    if (state.needModel) {
      renderQuizSummary(body, null, null, null);
      updateFabTooltip(null, null);
      return;
    }

    if (!state.loaded) {
      renderQuizSummary(body, "…", null, "…");
      updateFabTooltip(null, null);
      return;
    }

    if (state.quizInactive) {
      renderQuizSummary(body, null, null, null);
      updateFabTooltip(null, null);
      return;
    }

    const domOrd =
      state.visibleMcqOrdinal !== undefined
        ? state.visibleMcqOrdinal
        : resolveVisibleMcqOrdinal();
    const qLabel = domOrd != null ? domOrd : "—";

    // 无题号不展示题干
    if (domOrd == null) {
      renderQuizSummary(body, "—", null, null);
      updateFabTooltip(null, null);
      return;
    }

    const stem = resolveQuestionStemForPanel(state);
    if (state.current) {
      const e = state.current.entry;
      const labeled =
        e.正确答案标号行 != null && String(e.正确答案标号行).trim()
          ? String(e.正确答案标号行).trim()
          : null;
      const fallback =
        e.正确答案 != null && String(e.正确答案).trim()
          ? String(e.正确答案).trim()
          : null;
      const answerRaw =
        buildPanelAnswerDisplay(e) || labeled || fallback;
      renderQuizSummary(body, qLabel, stem, answerRaw, state.matchNav || null);
      updateFabTooltip(qLabel, stem);
      return;
    }

    renderQuizSummary(body, qLabel, stem, null, state.matchNav || null);
    updateFabTooltip(qLabel, stem);
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function refreshSettings() {
    const sessionData = await chrome.storage.local.get([
      "netacadComponentsBasePath",
      "netacadContentBase",
      "netacadCourseSegment",
      "netacadModuleFromNet",
      "netacadCapturedAt",
      "netacadLocale",
    ]);
    const rawSeg = sessionData.netacadCourseSegment;
    const rawPath = sessionData.netacadComponentsBasePath;
    settings = {
      netacadComponentsBasePath:
        rawPath != null && String(rawPath).trim() !== ""
          ? String(rawPath).trim().replace(/\/+$/, "")
          : null,
      netacadContentBase: sessionData.netacadContentBase || null,
      netacadCourseSegment:
        rawSeg != null && String(rawSeg).trim() !== ""
          ? String(rawSeg).trim()
          : null,
      netacadModuleFromNet:
        sessionData.netacadModuleFromNet != null
          ? Number(sessionData.netacadModuleFromNet)
          : null,
      netacadCapturedAt: sessionData.netacadCapturedAt || null,
      netacadLocale: sessionData.netacadLocale || null,
    };
  }

  /** 休眠 UI */
  function applyDormantQuizUi(panel) {
    lastTickPanelState = null;
    removeAmbiguousStemHint();
    panelMatchNavTotal = 0;
    clearAllMcqCorrectHighlights();
    clearObjectMatchingHighlights();
    panel.classList.add("netacad-ah-dormant");
    const pageText = getQuizPageTextForMatch();
    let ph = null;
    if (model != null && Number.isFinite(model)) ph = model;
    else if (hasUsableNetacadPathCapture()) ph = resolvePlaceholderFromCapture();
    else {
      const seg = getDomInferredCourseSegment();
      if (seg != null) ph = moduleNumberForPlaceholder(seg);
    }
    let mcqCount = 0;
    if (components && ph != null && !Number.isNaN(ph)) {
      try {
        mcqCount = buildAllMcqEntries(components, ph).length;
      } catch (_e) {
        mcqCount = 0;
      }
    }
    renderPanel({
      loaded: true,
      quizInactive: true,
      model: ph != null && !Number.isNaN(ph) ? ph : null,
      contentBase: getContentBase(),
      pathHint: pathHintFromSettings(),
      mcqCount,
      current: null,
      error: null,
      needModel: false,
      modelSource:
        ph != null && !Number.isNaN(ph) ? modelSourceLabel(ph) : "—",
      pageQuestionNumber: extractPageQuestionNumber(pageText),
      mcqOrdinal: null,
      componentIndex: null,
      answerGrabbed: false,
    });
  }

  async function tick() {
    const myId = ++tickRunGeneration;
    await refreshSettings();
    if (myId !== tickRunGeneration) return;
    const panel = ensurePanel();
    try {
      if (!isLikelyQuizPage()) {
        applyDormantQuizUi(panel);
        return;
      }
      if (!hasVisibleActiveMcqSession()) {
        applyDormantQuizUi(panel);
        return;
      }
      panel.classList.remove("netacad-ah-dormant");

      const contentBase = getContentBase();

      if (!canResolveComponentsTarget()) {
        lastTickPanelState = null;
        removeAmbiguousStemHint();
        panelMatchNavTotal = 0;
        clearAllMcqCorrectHighlights();
        clearObjectMatchingHighlights();
        renderPanel({
          loaded: false,
          needModel: true,
          error: null,
          contentBase,
          pathHint: pathHintFromSettings() === "网络"
            ? "网络"
            : "默认（进课节加载后更新）",
        });
        return;
      }

      const loc = getLocale();
      let loadKey;
      let componentsUrlToFetch;
      let placeholderMod;
      if (hasUsableNetacadPathCapture()) {
        const p = String(settings.netacadComponentsBasePath || "").replace(
          /\/+$/,
          ""
        );
        componentsUrlToFetch = absoluteComponentsUrlFromStoredPath();
        loadKey = `abs:${p}|${componentsUrlToFetch}`;
        placeholderMod = resolvePlaceholderFromCapture();
      } else {
        const courseSeg = getDomInferredCourseSegment();
        componentsUrlToFetch = componentsUrl(courseSeg, contentBase, loc);
        loadKey = `${contentBase}|${courseSeg}|${loc}`;
        placeholderMod = moduleNumberForPlaceholder(courseSeg);
      }

      if (loadKey !== loadedKey || !components) {
        if (loadInProgress) return;
        loadInProgress = true;
        lastTickPanelState = null;
        removeAmbiguousStemHint();
        panelMatchNavTotal = 0;
        clearAllMcqCorrectHighlights();
        clearObjectMatchingHighlights();
        renderPanel({
          loaded: false,
          needModel: false,
          error: null,
          contentBase,
          pathHint: pathHintFromSettings() === "网络"
            ? "网络"
            : "默认（进课节加载后更新）",
        });
        try {
          components = await fetchComponentsAtUrl(componentsUrlToFetch);
          if (myId !== tickRunGeneration) {
            loadInProgress = false;
            return;
          }
          loadedKey = loadKey;
          model = placeholderMod;
        } catch (e) {
          components = null;
          loadedKey = null;
          lastTickPanelState = null;
          removeAmbiguousStemHint();
          panelMatchNavTotal = 0;
          clearAllMcqCorrectHighlights();
          clearObjectMatchingHighlights();
          renderPanel({
            error: String(e.message || e),
            loaded: false,
            contentBase,
            pathHint: pathHintFromSettings() === "网络" ? "网络" : "默认",
          });
          loadInProgress = false;
          return;
        }
        loadInProgress = false;
      }

      const mcqs = buildAllMcqEntries(components, model);
      const { list: scopeMcqs, didFilter: outlineMcqScopeOk } =
        filterMcqsByOutlineRef(mcqs, lastDomOutlineRef);
      const pool = outlineMcqScopeOk ? scopeMcqs : mcqs;
      const pageText = getQuizPageTextForMatch();
      const ordCtx = resolveMcqOrdinalContext();
      let visibleMcqOrdinal = ordCtx.ordinal;
      const pageQuestionNumber = extractPageQuestionNumber(pageText);
      if (visibleMcqOrdinal == null && pageQuestionNumber != null) {
        visibleMcqOrdinal = String(pageQuestionNumber);
      }
      if (
        outlineMcqScopeOk &&
        visibleMcqOrdinal != null &&
        scopeMcqs.length > 0
      ) {
        const nCap = parseInt(visibleMcqOrdinal, 10);
        if (Number.isFinite(nCap) && nCap > scopeMcqs.length) {
          visibleMcqOrdinal = null;
        }
      }
      const visibleStem = getVisibleMcqStemText(visibleMcqOrdinal);
      const byDomId =
        visibleMcqOrdinal != null
          ? findPoolRowByComponentDomId(String(visibleMcqOrdinal), pool)
          : null;

      let current = null;
      if (byDomId) {
        current = byDomId;
      } else if (visibleMcqOrdinal != null) {
        const n = parseInt(visibleMcqOrdinal, 10);
        const vsRaw = visibleStem && String(visibleStem).trim();
        const vsStripped = vsRaw
          ? stripQuizAccessibilityStemNoise(vsRaw)
          : "";
        const vs = vsStripped.length >= 6 ? vsStripped : vsRaw;
        const stemStrong = vs && vs.length >= 12;
        const byOrd =
          Number.isFinite(n) && n >= 1 && n <= pool.length
            ? pool[n - 1]
            : null;
        // 有题干时题干匹配优先于题号
        const macRow = stemStrong
          ? findMcqRowByMacLikeInPool(vsRaw, pool)
          : null;
        const byStem = stemStrong
          ? macRow ||
            findBestMcq(pool, pageText, lastDomOutlineRef, visibleStem, n)
          : null;

        if (byOrd && stemStrong) {
          const ordOk = visibleStemMatchesMcqRow(vs, byOrd);
          const stemOk = byStem && visibleStemMatchesMcqRow(vs, byStem);
          if (!ordOk && stemOk) {
            current = byStem;
          } else if (ordOk && !stemOk) {
            current = byOrd;
          } else if (ordOk && stemOk && byStem && byStem !== byOrd) {
            const narrowed = pool.filter((row) =>
              visibleStemMatchesMcqRow(vs, row)
            );
            current =
              narrowed.length === 1
                ? narrowed[0]
                : pickStemAmbiguousRow(narrowed, pool, n, vs);
          } else if (!ordOk && !stemOk) {
            // 题干与题号行均未验证通过时不占位
            current = null;
          } else {
            current = byOrd;
          }
        } else if (byOrd) {
          current = byOrd;
        } else {
          current = findBestMcq(
            pool,
            pageText,
            lastDomOutlineRef,
            visibleStem,
            n
          );
        }
      }

      if (!byDomId) {
        current = realignCurrentToVisibleStem(
          pool,
          visibleStem,
          visibleMcqOrdinal,
          current
        );
      }

      const visibleDomStemPanel =
        visibleStem != null
          ? (() => {
              const t = String(visibleStem).trim();
              const d = stripQuizAccessibilityStemNoise(t);
              return d.length >= 6 ? d : t;
            })()
          : null;

      let ambiguousHits = [];
      if (
        !byDomId &&
        visibleDomStemPanel &&
        String(visibleDomStemPanel).trim().length >= 12
      ) {
        ambiguousHits = pool.filter((row) =>
          visibleStemMatchesMcqRow(visibleDomStemPanel, row)
        );
        ambiguousHits.sort((a, b) => (a.index || 0) - (b.index || 0));
      }
      lastAmbiguousHitsForNav = ambiguousHits;
      lastMcqsFullListForNav = mcqs;
      syncMatchCandidateIndexState(ambiguousHits);
      if (byDomId) {
        panelMatchNavTotal = 0;
        removeAmbiguousStemHint();
      } else if (ambiguousHits.length > 1) {
        panelMatchNavTotal = ambiguousHits.length;
        current = ambiguousHits[matchCandidateIndex];
        ensureAmbiguousStemHintOnPage();
      } else {
        panelMatchNavTotal = 0;
        removeAmbiguousStemHint();
        if (ambiguousHits.length === 1) current = ambiguousHits[0];
      }

      const matchNavForPanel =
        !byDomId && ambiguousHits.length > 1
          ? {
              index: matchCandidateIndex + 1,
              total: ambiguousHits.length,
            }
          : null;

      /*
      try {
        const qPlain =
          current &&
          String(current.entry?.问题 || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const aPlain =
          current &&
          String(current.entry?.正确答案 || "")
            .replace(/\s+/g, " ")
            .trim();
        const aShow =
          current && current.entry
            ? buildPanelAnswerDisplay(current.entry) || aPlain
            : null;
        const maxQ = 900;
        const maxA = 1400;
        const qBank = qPlain ? qPlain.slice(0, maxQ) : "";
        const qPageRaw =
          resolveQuestionStemForPanel({
            visibleDomStem: visibleDomStemPanel,
            visibleMcqOrdinal,
            current,
          }) || "";
        const qPage = String(qPageRaw).replace(/\s+/g, " ").trim().slice(0, maxQ);
        const ans = aShow ? String(aShow).slice(0, maxA) : "";
        const logLabel = "color:#64748b;font-weight:600";
        const logBody = "color:inherit";
        console.groupCollapsed(
          "%cNetAcad答案助手",
          "color:#15803d;font-weight:bold"
        );
        console.log("%c页面题目：%c%s", logLabel, logBody, qPage || "");
        console.log(
          "%c题目：%c%s\n%c答案：%c%s",
          logLabel,
          logBody,
          qBank || "",
          logLabel,
          logBody,
          ans || ""
        );
        console.groupEnd();
      } catch (_e) {}
      */

      const mcqOrdinal =
        current && mcqs.length && current.index != null
          ? mcqs.findIndex((r) => r.index === current.index) + 1
          : current && mcqs.length
            ? mcqs.indexOf(current) + 1
            : null;
      const answerGrabbed = !!(
        current &&
        current.entry &&
        String(current.entry.正确答案 || "").trim()
      );
      if (current && current.entry) {
        applyMcqCorrectOptionHighlights(current.entry);
        applyObjectMatchingHighlights(current.entry);
      } else {
        clearAllMcqCorrectHighlights();
        clearObjectMatchingHighlights();
      }
      const panelState = {
        loaded: true,
        model,
        contentBase,
        pathHint:
          pathHintFromSettings() === "网络"
            ? "网络"
            : "默认（未抓到请求时用 itn/1.0）",
        mcqCount: mcqs.length,
        current,
        matchNav: matchNavForPanel,
        error: null,
        needModel: false,
        modelSource: modelSourceLabel(model),
        pageQuestionNumber,
        visibleMcqOrdinal,
        visibleDomStem: visibleDomStemPanel,
        mcqOrdinal,
        componentIndex: current ? current.index : null,
        answerGrabbed,
      };
      if (myId !== tickRunGeneration) return;
      renderPanel(panelState);
      if (myId !== tickRunGeneration) return;
      lastTickPanelState = panelState;
    } finally {
      syncPanelPositionToSiteFabs();
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = window.setInterval(() => {
      void tick();
    }, 900);
    observer = new MutationObserver(() => {
      if (observerCoalesceTimer != null) {
        clearTimeout(observerCoalesceTimer);
        observerCoalesceTimer = null;
      }
      const delay =
        Date.now() < matchNavInteractionUntil ? 720 : 300;
      observerCoalesceTimer = window.setTimeout(() => {
        observerCoalesceTimer = null;
        void tick();
      }, delay);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    if (!onResizeSync) {
      onResizeSync = () => syncPanelPositionToSiteFabs();
      window.addEventListener("resize", onResizeSync);
    }
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (observerCoalesceTimer != null) {
      clearTimeout(observerCoalesceTimer);
      observerCoalesceTimer = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (onResizeSync) {
      window.removeEventListener("resize", onResizeSync);
      onResizeSync = null;
    }
  }

  async function initFromStorage() {
    ensurePanel();
    try {
      await refreshSettings();
      loadedKey = null;
      components = null;
      await tick();
      startPolling();
    } catch (e) {
      removeAmbiguousStemHint();
      panelMatchNavTotal = 0;
      clearAllMcqCorrectHighlights();
      clearObjectMatchingHighlights();
      renderPanel({ error: String(e.message || e), loaded: false });
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "netacad-ah-reload") {
      if (!shouldMountUi()) {
        sendResponse({ ok: true });
        return true;
      }
      stopPolling();
      initFromStorage()
        .then(() => sendResponse({ ok: true }))
        .catch((err) =>
          sendResponse({
            ok: false,
            error: String(err && err.message ? err.message : err),
          })
        );
      return true;
    }
    return false;
  });

  if (shouldMountUi()) {
    void initFromStorage();
  }
})();
