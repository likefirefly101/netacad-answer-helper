/** 从已完成的 netacad JSON 请求 URL 解析 contentBase 与模块号 */
function parseNetacadCourseJsonUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== "www.netacad.com") return null;
    const marker = "/courses/content/";
    const i = u.pathname.indexOf(marker);
    if (i === -1) return null;
    const before = u.pathname.slice(0, i);
    const rest = u.pathname.slice(i + marker.length);
    const contentSlash = "/content/";
    const ci = before.indexOf(contentSlash);
    if (ci === -1) return null;
    const contentBase = before.slice(ci + contentSlash.length);
    const segs = rest.split("/").filter(Boolean);
    if (segs.length < 3) return null;
    const mm = segs[0].match(/^m(\d+)$/i);
    if (!mm) return null;
    const locale = segs[1];
    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(locale)) return null;
    const file = segs[2] || "";
    if (
      !/^(course|components|blocks|articles|contentObjects)\.json$/i.test(file)
    )
      return null;
    return {
      contentBase,
      module: parseInt(mm[1], 10),
      locale,
    };
  } catch (_e) {
    return null;
  }
}

chrome.webRequest.onCompleted.addListener(
  (details) => {
    const parsed = parseNetacadCourseJsonUrl(details.url);
    if (!parsed) return;
    chrome.storage.local.set({
      netacadContentBase: parsed.contentBase,
      netacadModuleFromNet: parsed.module,
      netacadLocale: parsed.locale,
      netacadLastJsonUrl: details.url,
      netacadCapturedAt: Date.now(),
    });
  },
  { urls: ["https://www.netacad.com/content/*"] }
);
