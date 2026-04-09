(function () {
  "use strict";

  const PANEL_ID = "netacad-answer-helper-panel";
  const CONTENT_BASE_FALLBACK = "itn/1.0";
  const LOCALE_FALLBACK = "zh-CN";
  const NET_CAPTURE_TTL_MS = 5 * 60 * 1000;

  let components = null;
  let model = null;
  let loadedKey = null;
  let loadInProgress = false;

  let settings = {
    netacadContentBase: null,
    netacadModuleFromNet: null,
    netacadCapturedAt: null,
    netacadLocale: null,
  };

  let pollTimer = null;
  let observer = null;
  let onResizeSync = null;
  let fabLayoutSyncedOnce = false;

  function applyModulePlaceholder(text, m) {
    if (text == null || text === "") return text;
    return String(text).split("{{_moduleNumber}}").join(String(m));
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

  function normalizeForMatch(text) {
    if (!text) return "";
    return String(text)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /** 规范化后比对用 */
  function relaxForMatch(text) {
    return normalizeForMatch(text)
      .replace(/[,，.。?？!！:：;；、（）()[\]{}'"]/g, " ")
      .replace(/[-_/\\·…`—]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** 从 _r2aMapId 解析小节号 */
  function extractMcqSectionFromR2aMapId(mapId) {
    if (mapId == null || mapId === "") return null;
    const m = String(mapId).match(/mcq-(\d+(?:\.\d+)*)-/i);
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

    // 侧栏/大纲
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

    // 主区 h1/h2 行首小节号
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
      '.mcq__title-inner, .mcq__body, .mcq__body-inner, .mcq__item, .mcq__item-text-inner, [class*="mcq__title" i], [class*="mcq__body" i], [class*="mcq__item"], [class*="mcq__stem" i], [class*="mcq__prompt" i], [class*="mcq__"]';
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

  /** 视口内是否有足够大的 MCQ 题干区 */
  function hasVisibleMcqBodyInViewport() {
    const nodes = querySelectorAllDeep(
      document,
      '.mcq__body, .mcq__body-inner, [class*="mcq__body" i]',
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

  /** 是否视为正在做题 */
  function hasVisibleActiveMcqSession() {
    if (looksLikeSubmittedOrResultUi()) return false;
    if (isMcqResultSummaryView()) return false;
    const bodyOk = hasVisibleMcqBodyInViewport();
    const choiceOk = hasVisibleMcqChoiceSurface();
    if (!bodyOk && !choiceOk) return false;
    if (!bodyOk && choiceOk) {
      if (getLitBlockButtonQOrdinal() != null) return true;
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
        '[class*="quiz" i], [class*="assessment" i], [class*="multiple" i][class*="choice" i], [data-testid*="question" i], [data-testid*="choice" i], [class*="mcq__"]'
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

      // 弱关键词须配合 MCQ DOM 或单选，免阅读课误当测验
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

  /** 轻量检测测验结果/提交态 */
  function looksLikeSubmittedOrResultUi() {
    try {
      let blob = "";
      const main = document.querySelector("main");
      if (main && main.innerText) blob += main.innerText.slice(0, 7000);
      if (document.body && document.body.innerText) {
        blob += "\n" + document.body.innerText.slice(0, 9000);
      }
      blob += "\n" + tryReadSameOriginIframesText(document, 0).slice(0, 5000);
      blob = blob.replace(/\s+/g, " ").trim();
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

  function getContentBase() {
    return settings.netacadContentBase || CONTENT_BASE_FALLBACK;
  }

  function getLocale() {
    return settings.netacadLocale || LOCALE_FALLBACK;
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
      const hm = (u.hash || "").match(/\/courses\/content\/m(\d+)\b/i);
      if (hm) {
        const n = parseInt(hm[1], 10);
        if (n > 0 && n < 99) return n;
      }
    } catch (_e) {
      /*  */
    }
    return null;
  }

  function getEffectiveModel() {
    if (isNetworkModuleFresh() && settings.netacadModuleFromNet != null) {
      return settings.netacadModuleFromNet;
    }
    const d = detectModuleNumberFromPage();
    if (d != null) return d;
    const fromLoc = getModuleFromLocationUrl();
    if (fromLoc != null) return fromLoc;
    return null;
  }

  function modelSourceLabel(eff) {
    if (isNetworkModuleFresh() && settings.netacadModuleFromNet === eff) {
      return "网络请求";
    }
    const d = detectModuleNumberFromPage();
    if (d === eff) return "侧栏";
    if (getModuleFromLocationUrl() === eff) return "地址栏/Hash";
    return "自动";
  }

  function sectionFromNearestPrecedingText(componentsInfo, mcqIdx, m) {
    let j = mcqIdx - 1;
    while (j >= 0 && componentsInfo[j]._component === "mcq") j -= 1;
    if (j < 0 || componentsInfo[j]._component !== "text") return [null, null];
    const prev = componentsInfo[j];
    const t =
      applyModulePlaceholder(prev.title || "", m).trim() || null;
    const b = stripHtmlToPlain(
      applyModulePlaceholder(prev.body || "", m)
    );
    return [t, b];
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

  function buildAllMcqEntries(componentsInfo, m) {
    const out = [];
    for (let idx = 0; idx < componentsInfo.length; idx++) {
      if (componentsInfo[idx]._component !== "mcq") continue;
      const [ut, ub] = sectionFromNearestPrecedingText(componentsInfo, idx, m);
      out.push({
        index: idx,
        r2aMapId: componentsInfo[idx]._r2aMapId || "",
        entry: buildMcqEntry(componentsInfo[idx], ut, ub),
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

  function componentsUrl(m, base, loc) {
    return `https://www.netacad.com/content/${base}/courses/content/m${m}/${loc}/components.json`;
  }

  async function loadComponents(m, base, loc) {
    const url = componentsUrl(m, base, loc);
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}：${url}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("components.json 格式异常（应为数组）");
    return data;
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
      '.mcq__body-inner, .mcq__body, [class*="mcq__body-inner"], [class*="mcq__body" i]';
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

  /** 从题干附近 DOM 解析当前题号 */
  function extractVisibleMcqQuestionNumber(skip) {
    const bodies = querySelectorAllDeep(
      document,
      '.mcq__body-inner, .mcq__body, [class*="mcq__body" i]',
      16
    );
    for (const bodyEl of bodies) {
      if (skip(bodyEl)) continue;
      const rawStem = (bodyEl.innerText || bodyEl.textContent || "").trim();
      const stemKey = rawStem.slice(0, Math.min(48, rawStem.length));
      if (stemKey.length < 4) continue;

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

  /** 主内容区多段文本，供题干模糊匹配 */
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
      '.mcq__body, .mcq__body-inner, [class*="mcq__body" i], .mcq__item-text-inner, .mcq__item, [class*="mcq__item"]',
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

    // 主区域整段
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

    // 主列 elementsFromPoint 采样
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

  /** 视口内面积最大的可见题干块 */
  function getVisibleMcqStemText() {
    const nodes = querySelectorAllDeep(
      document,
      '.mcq__body-inner, [class*="mcq__body-inner"], .mcq__body, [class*="mcq__body" i]',
      28
    );
    let best = "";
    let bestArea = 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const n of nodes) {
      if (!n || isInOurPanel(n)) continue;
      const r = n.getBoundingClientRect();
      const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      const area = visW * visH;
      const t = (n.innerText || n.textContent || "").trim();
      if (t.length < 12 || area < 40) continue;
      if (area > bestArea) {
        bestArea = area;
        best = t;
      }
    }
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
      '.mcq__title-inner, [class*="mcq__title-inner"], [class*="mcq__title" i]',
      48
    );
    let best = "";
    let bestArea = 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const n of nodes) {
      if (!n || isInOurPanel(n)) continue;
      const r = n.getBoundingClientRect();
      const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      const area = visW * visH;
      const t = cleanMcqTitleInnerText(mcqTitleInnerPlainFromNode(n));
      if (!t || t.length < 2 || area < 25) continue;
      if (area > bestArea) {
        bestArea = area;
        best = t;
      }
    }
    return best || null;
  }

  /** 顶栏 Q 条最大 Qn */
  function getMaxTopStripQNavOrdinal() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const TOP_Q_STRIP_MAX_Y = 560;
    const navCandidates = querySelectorAllDeep(
      document,
      'button, a[href], [role="tab"], [role="button"]',
      200
    );
    let maxN = 0;
    for (const el of navCandidates) {
      if (!el || isInOurPanel(el) || isInCourseChromeSidebar(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top > TOP_Q_STRIP_MAX_Y || r.bottom < 0) continue;
      const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (visW * visH < 12) continue;
      const t = (el.innerText || el.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!/^Q\s*\d+$/i.test(t)) continue;
      const qm = t.match(/^Q\s*(\d+)$/i);
      if (!qm) continue;
      const v = parseInt(qm[1], 10);
      if (v > 0 && v < 500 && v > maxN) maxN = v;
    }
    return maxN;
  }

  /** 题号大于顶栏最大 Qn 则丢弃 */
  function capOrdinalStringByTopStripQNav(ordStr) {
    if (ordStr == null) return null;
    const v = parseInt(String(ordStr).trim(), 10);
    if (!Number.isFinite(v) || v < 1) return ordStr;
    const cap = getMaxTopStripQNavOrdinal();
    if (cap >= 1 && v > cap) return null;
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
    const rows = [];
    for (const el of nodes) {
      if (!el || isInOurPanel(el)) continue;
      /* 主列容器勿当侧栏过滤 */
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
      let n = null;
      const qm = t.match(/\bQ\s*(\d+)\b/i);
      if (qm) n = parseInt(qm[1], 10);
      if (n == null || !Number.isFinite(n)) n = d >= 1 ? d : d + 1;
      if (n <= 0 || n >= 500) continue;
      const hasActive = /\bactive-block\b/i.test(String(el.className || ""));
      rows.push({ el, n, hasActive, area: visW * visH });
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
    const cn = el.className && String(el.className);
    if (cn && /\b(active|selected|current|is-active|is-selected)\b/i.test(cn))
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

    /* 顶栏 Q 条 y 上限 */
    const TOP_Q_STRIP_MAX_Y = 560;
    const navCandidates = querySelectorAllDeep(
      document,
      'button, a[href], [role="tab"], [role="button"]',
      200
    );
    const strip = [];
    for (const el of navCandidates) {
      if (!el || isInOurPanel(el) || isInCourseChromeSidebar(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top > TOP_Q_STRIP_MAX_Y || r.bottom < 0) continue;
      const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      const area = visW * visH;
      if (area < 12) continue;
      const t = (el.innerText || el.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!/^Q\s*\d+$/i.test(t)) continue;
      const qm = t.match(/^Q\s*(\d+)$/i);
      if (!qm) continue;
      const v = parseInt(qm[1], 10);
      if (v <= 0 || v >= 500) continue;
      strip.push({ el, n: v, area });
    }

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

    const stripMaxN = strip.length ? Math.max(...strip.map((s) => s.n)) : 0;
    const titleOrd = extractMcqOrdinalFromTitlePlain(
      getVisibleMcqTitleText() || ""
    );
    if (titleOrd != null && strip.length) {
      const want = parseInt(titleOrd, 10);
      if (Number.isFinite(want) && want > 0) {
        if (stripMaxN >= 1 && want > stripMaxN) {
          /* 标题题号大于 Q 条 */
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
          if (d >= 0 && d < 500) n = d >= 1 ? d : d + 1;
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

  /** 当前题序：block/顶栏 Q, 标题, lastDom；tick 里与 scopeMcqs[n-1] 对齐 */
  function resolveMcqOrdinalContext() {
    if (!hasVisibleActiveMcqSession()) {
      return { ordinal: null };
    }

    const block = getActiveLessonBlockQOrdinal();
    if (block != null) return { ordinal: block };

    const fromTitle = extractMcqOrdinalFromTitlePlain(
      getVisibleMcqTitleText() || ""
    );
    if (fromTitle != null) {
      const c = capOrdinalStringByTopStripQNav(fromTitle);
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

  /** 可见题干与 JSON 题干是否像同一题 */
  function visibleStemMatchesQuestion(visibleStem, qRaw) {
    const vNorm = normalizeForMatch(visibleStem);
    const vRel = relaxForMatch(visibleStem);
    if (vNorm.length < 12) return false;
    const nq = normalizeForMatch(qRaw || "");
    const nqRel = relaxForMatch(qRaw || "");
    if (nq.length < 8) return false;
    if (vNorm.includes(nq)) return true;
    if (nq.length >= 14 && vNorm.includes(nq.slice(0, Math.min(80, nq.length))))
      return true;
    const vp = vNorm.slice(0, Math.min(48, vNorm.length));
    if (vp.length >= 12 && nq.includes(vp)) return true;
    if (nqRel.length >= 12 && vRel.includes(nqRel.slice(0, Math.min(64, nqRel.length))))
      return true;
    const vr = vRel.slice(0, Math.min(48, vRel.length));
    if (vr.length >= 12 && nqRel.includes(vr)) return true;
    return false;
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

  function findBestMcqCore(mcqs, pageText, outlineRef) {
    const normView = normalizeForMatch(pageText);
    if (!normView || normView.length < 15) return null;
    const normViewRel = relaxForMatch(pageText);

    let best = null;
    let bestScore = 0;
    let bestBonus = -1;

    const consider = (row, baseScore) => {
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
      let nq = normalizeForMatch(q);
      if (nq.length < 10) continue;
      const nqRel = relaxForMatch(q);

      if (normView.includes(nq)) {
        consider(row, nq.length);
        continue;
      }

      if (normViewRel.includes(nqRel) && nqRel.length >= 10) {
        consider(row, nqRel.length);
        continue;
      }

      // 题干在 JSON 里可能无 问题 n：前缀，页面有；试去掉前缀再比
      const stripped = normView
        .replace(/问题\s*\d+\s*[:：]\s*/gi, " ")
        .replace(/\bquestion\s*\d+\s*[:.]\s*/gi, " ");
      if (stripped.includes(nq)) {
        consider(row, nq.length);
        continue;
      }

      const strippedRel = relaxForMatch(
        pageText
          .replace(/问题\s*\d+\s*[:：]\s*/gi, " ")
          .replace(/\bquestion\s*\d+\s*[:.]\s*/gi, " ")
      );
      if (strippedRel.includes(nqRel) && nqRel.length >= 10) {
        consider(row, nqRel.length);
        continue;
      }

      const headLen = Math.min(72, nq.length);
      const head = nq.slice(0, headLen);
      if (head.length >= 10 && normView.includes(head)) {
        consider(row, head.length);
        continue;
      }

      const headRel = nqRel.slice(0, Math.min(72, nqRel.length));
      if (headRel.length >= 10 && normViewRel.includes(headRel)) {
        consider(row, headRel.length);
      }
    }
    return best;
  }

  function findBestMcq(mcqs, pageText, outlineRef, visibleStem) {
    const vs = visibleStem && String(visibleStem).trim();
    if (vs && vs.length >= 12) {
      const narrowed = mcqs.filter((row) =>
        visibleStemMatchesQuestion(vs, row.entry.问题 || "")
      );
      if (narrowed.length === 1) return narrowed[0];
      if (narrowed.length > 1) return findBestMcqCore(narrowed, pageText, outlineRef);
      const biased = `${vs}\n\n${pageText}`;
      return findBestMcqCore(mcqs, biased, outlineRef);
    }
    return findBestMcqCore(mcqs, pageText, outlineRef);
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
  function renderQuizSummary(body, questionLabel, questionStem, answerRaw) {
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
    body.innerHTML = `<div class="netacad-ah-simple">
      <div class="netacad-ah-simple-row"><span class="netacad-ah-simple-k">题号</span><span class="netacad-ah-simple-v">${qHtml}</span></div>
      <div class="netacad-ah-simple-row netacad-ah-simple-row--stem"><span class="netacad-ah-simple-k">题目</span><span class="netacad-ah-simple-v netacad-ah-simple-stem">${stemHtml}</span></div>
      <div class="netacad-ah-simple-row netacad-ah-simple-row--answer"><span class="netacad-ah-simple-k">答案</span><div class="netacad-ah-simple-v netacad-ah-answer-wrap">${answerBoxHtml}</div></div>
    </div>`;
  }

  function resolveQuestionStemForPanel(state) {
    if (state.current && state.current.entry) {
      const raw = state.current.entry.问题;
      const plain =
        stripHtmlToPlain(raw) ||
        String(raw || "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      return plain || null;
    }
    const vis = getVisibleMcqStemText();
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

    /* quizInactive：清空展示 */
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

    /* 无题序则不展示题干答案 */
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
      renderQuizSummary(body, qLabel, stem, labeled || fallback);
      updateFabTooltip(qLabel, stem);
      return;
    }

    renderQuizSummary(body, qLabel, stem, null);
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
      "netacadContentBase",
      "netacadModuleFromNet",
      "netacadCapturedAt",
      "netacadLocale",
    ]);
    settings = {
      netacadContentBase: sessionData.netacadContentBase || null,
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
    panel.classList.add("netacad-ah-dormant");
    const pageText = getQuizPageTextForMatch();
    const eff = getEffectiveModel();
    let mcqCount = 0;
    if (components && eff != null && !Number.isNaN(eff)) {
      try {
        mcqCount = buildAllMcqEntries(components, model ?? eff).length;
      } catch (_e) {
        mcqCount = 0;
      }
    }
    renderPanel({
      loaded: true,
      quizInactive: true,
      model: eff != null && !Number.isNaN(eff) ? eff : null,
      contentBase: getContentBase(),
      pathHint: settings.netacadContentBase ? "网络" : "默认",
      mcqCount,
      current: null,
      error: null,
      needModel: false,
      modelSource:
        eff != null && !Number.isNaN(eff) ? modelSourceLabel(eff) : "—",
      pageQuestionNumber: extractPageQuestionNumber(pageText),
      mcqOrdinal: null,
      componentIndex: null,
      answerGrabbed: false,
    });
  }

  async function tick() {
    await refreshSettings();
    const panel = ensurePanel();
    try {
      if (looksLikeSubmittedOrResultUi()) {
        applyDormantQuizUi(panel);
        return;
      }
      if (!isLikelyQuizPage()) {
        applyDormantQuizUi(panel);
        return;
      }
      if (isMcqResultSummaryView()) {
        applyDormantQuizUi(panel);
        return;
      }
      if (!hasVisibleActiveMcqSession()) {
        applyDormantQuizUi(panel);
        return;
      }
      panel.classList.remove("netacad-ah-dormant");

      const contentBase = getContentBase();
      const eff = getEffectiveModel();

      if (eff == null || Number.isNaN(eff)) {
        renderPanel({
          loaded: false,
          needModel: true,
          error: null,
          contentBase,
          pathHint: settings.netacadContentBase ? "网络" : "默认（进课节加载后更新）",
        });
        return;
      }

      const loc = getLocale();
      const loadKey = `${contentBase}|${eff}|${loc}`;
      if (loadKey !== loadedKey || !components) {
        if (loadInProgress) return;
        loadInProgress = true;
        renderPanel({
          loaded: false,
          needModel: false,
          error: null,
          contentBase,
          pathHint: settings.netacadContentBase ? "网络" : "默认（进课节加载后更新）",
        });
        try {
          components = await loadComponents(eff, contentBase, loc);
          loadedKey = loadKey;
          model = eff;
        } catch (e) {
          components = null;
          loadedKey = null;
          renderPanel({
            error: String(e.message || e),
            loaded: false,
            contentBase,
            pathHint: settings.netacadContentBase ? "网络" : "默认",
          });
          loadInProgress = false;
          return;
        }
        loadInProgress = false;
      }

      const mcqs = buildAllMcqEntries(components, model);
      const { list: scopeMcqs, didFilter: outlineMcqScopeOk } =
        filterMcqsByOutlineRef(mcqs, lastDomOutlineRef);
      const pageText = getQuizPageTextForMatch();
      const visibleStem = getVisibleMcqStemText();
      const ordCtx = resolveMcqOrdinalContext();
      let visibleMcqOrdinal = ordCtx.ordinal;
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
      const pageQuestionNumber = extractPageQuestionNumber(pageText);
      let current = null;
      let useDirectIndex = false;
      if (visibleMcqOrdinal != null) {
        const n = parseInt(visibleMcqOrdinal, 10);
        const pool = outlineMcqScopeOk ? scopeMcqs : mcqs;
        useDirectIndex =
          outlineMcqScopeOk &&
          Number.isFinite(n) &&
          n >= 1 &&
          n <= scopeMcqs.length;
        if (useDirectIndex) {
          current = scopeMcqs[n - 1];
        } else {
          current = findBestMcq(
            pool,
            pageText,
            lastDomOutlineRef,
            visibleStem
          );
          const vs = visibleStem && String(visibleStem).trim();
          if (
            outlineMcqScopeOk &&
            Number.isFinite(n) &&
            n >= 1 &&
            n <= scopeMcqs.length &&
            vs &&
            vs.length >= 14
          ) {
            const byOrd = scopeMcqs[n - 1];
            const qOrd = byOrd && (byOrd.entry?.问题 || "");
            const qCur = current && (current.entry?.问题 || "");
            const matchOrd = visibleStemMatchesQuestion(vs, qOrd);
            const matchCur = visibleStemMatchesQuestion(vs, qCur);
            if (matchOrd && !matchCur) current = byOrd;
            else if (matchOrd && matchCur && current !== byOrd) current = byOrd;
          }
        }
      }

      const mcqOrdinal =
        current && mcqs.length ? mcqs.indexOf(current) + 1 : null;
      const answerGrabbed = !!(
        current &&
        current.entry &&
        String(current.entry.正确答案 || "").trim()
      );
      renderPanel({
        loaded: true,
        model,
        contentBase,
        pathHint: settings.netacadContentBase ? "网络" : "默认（未抓到请求时用 itn/1.0）",
        mcqCount: mcqs.length,
        current,
        error: null,
        needModel: false,
        modelSource: modelSourceLabel(model),
        pageQuestionNumber,
        visibleMcqOrdinal,
        mcqOrdinal,
        componentIndex: current ? current.index : null,
        answerGrabbed,
      });
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
      window.requestAnimationFrame(() => {
        void tick();
      });
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
