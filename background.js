/** 路径最后一段是否像 UUID */
function segmentLooksLikeUuid(seg) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(seg || "")
  );
}

/** 与 pathname 末尾语言段一致 */
function looksLikeLocaleSegment(seg) {
  return /^[a-z]{2}(?:-[A-Z]{2})?$/i.test(String(seg || ""));
}

/** 从课节路径段推断占位模块号 */
function parseCourseContentSlug(slug) {
  const s = String(slug || "");
  const mm = s.match(/^m(\d+)$/i);
  if (mm) return { moduleNumber: parseInt(mm[1], 10) };
  const ck = s.match(/^checkpoint(\d+)$/i);
  if (ck) return { moduleNumber: parseInt(ck[1], 10) };
  if (/^[a-z0-9][a-z0-9._-]{0,120}$/i.test(s)) {
    const nums = s.match(/\d+/g);
    const moduleNumber =
      nums && nums.length ? parseInt(nums[nums.length - 1], 10) : null;
    return { moduleNumber };
  }
  return { moduleNumber: null };
}

/** basePath 去掉末尾的 /components.json */
function slugBeforeComponentsJson(basePath) {
  const parts = String(basePath || "").split("/").filter(Boolean);
  if (!parts.length) return "";
  const last = parts[parts.length - 1];
  if (looksLikeLocaleSegment(last) && parts.length >= 2)
    return parts[parts.length - 2];
  return last;
}

/** 识别 www.netacad.com 上任意以 /components.json 结尾的请求 */
function parseNetacadComponentsJsonUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== "www.netacad.com") return null;
    const path = u.pathname || "";
    const suf = "/components.json";
    const low = path.toLowerCase();
    if (!low.endsWith(suf)) return null;
    const basePath = path.slice(0, path.length - suf.length);
    if (!basePath || basePath === "/" || basePath[0] !== "/") return null;
    const parts = basePath.split("/").filter(Boolean);
    const last = parts.length ? parts[parts.length - 1] : "";
    const localeFromPath = looksLikeLocaleSegment(last) ? last : null;
    const slug = slugBeforeComponentsJson(basePath);
    let moduleNumber = null;
    if (slug && !segmentLooksLikeUuid(slug)) {
      moduleNumber = parseCourseContentSlug(slug).moduleNumber;
    }
    return { basePath, localeFromPath, moduleNumber };
  } catch (_e) {
    return null;
  }
}

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!/\/components\.json(\?|$|#)/i.test(details.url)) return;
    const parsed = parseNetacadComponentsJsonUrl(details.url);
    if (!parsed) return;
    chrome.storage.local.set({
      netacadComponentsBasePath: parsed.basePath,
      netacadLocale: parsed.localeFromPath,
      netacadModuleFromNet: parsed.moduleNumber,
      netacadLastJsonUrl: details.url,
      netacadCapturedAt: Date.now(),
    });
  },
  { urls: ["https://www.netacad.com/*"] }
);
