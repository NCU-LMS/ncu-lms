import api from "@/api/client.js";

let trackerConfig = {
  enabled: true,
  trackClicks: false,
  trackFileUploads: false,
  trackPageViews: false,
  trackInputs: true,
  trackCopyViolations: false,
  inputIntervalSeconds: 30,
  anomalyDetectionEnabled: true,
  maxCharsPerSecond: 15,
  checkFrequencyAnomaly: true,
};

let currentTrackedCourse = null;
let eventQueue = [];
let flushTimer = null;
let inputSnapshotTimer = null;
let initialized = false;

const activeInputs = new Map();


function getAuthHeader() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}


function getApiUrl(path) {
  const base = import.meta.env.VITE_API_BASE_URL || "";
  return `${base}${path}`;
}


export function getCurrentCourseAndHw() {
  const path = window.location.pathname;
  const courseMatch = path.match(/\/course\/([^/?#]+)/i);
  const courseCode = courseMatch ? decodeURIComponent(courseMatch[1]) : null;

  const hwMatch = path.match(/\/homework\/([^/?#]+)/i);
  let homeworkId = hwMatch ? decodeURIComponent(hwMatch[1]) : null;
  if (homeworkId === "create" || homeworkId === "edit") homeworkId = null;

  return { courseCode, homeworkId };
}


export function trackEvent({ eventType, targetElement = null, actionData = null, pageUrl = null, courseCode = null, homeworkId = null }) {
  if (!trackerConfig.enabled) return;

  const type = String(eventType || "").toUpperCase();
  if (type === "BUTTON_CLICK" && !trackerConfig.trackClicks) return;
  if (type === "FILE_UPLOAD" && !trackerConfig.trackFileUploads) return;
  if (type === "PAGE_VIEW" && !trackerConfig.trackPageViews) return;
  if (type === "INPUT_SNAPSHOT" && !trackerConfig.trackInputs) return;
  if (type === "COPY_BLOCKED" && !trackerConfig.trackCopyViolations) return;

  const currentContext = getCurrentCourseAndHw();

  const eventItem = {
    courseCode: courseCode || currentContext.courseCode || null,
    homeworkId: homeworkId || currentContext.homeworkId || null,
    eventType: type,
    pageUrl: pageUrl || window.location.pathname + window.location.search,
    targetElement: targetElement ? String(targetElement).trim().slice(0, 255) : null,
    actionData: actionData || null,
    userAgent: navigator.userAgent,
    clientTimestamp: new Date().toISOString(),
  };

  eventQueue.push(eventItem);

  if (eventQueue.length >= 10) {
    flushEvents();
  }
}


export async function flushEvents() {
  if (eventQueue.length === 0) return;

  const toSend = [...eventQueue];
  eventQueue = [];

  try {
    await fetch(getApiUrl("/api/activity-logs/batch"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ logs: toSend }),
      keepalive: true, // 支援頁面切換或關閉時背景送出
    });
  } catch (err) {
    eventQueue = [...toSend, ...eventQueue].slice(0, 100);
    console.debug("[ActivityTracker] 批次上報暫時失敗，已保留於隊列", err);
  }
}


function scanInputSnapshots(isPeriodic = false) {
  if (!trackerConfig.enabled || !trackerConfig.trackInputs) return;

  for (const [el, lastInfo] of activeInputs.entries()) {
    if (!document.body.contains(el)) {
      activeInputs.delete(el);
      continue;
    }

    const currentVal = el.value || "";
    if (currentVal !== lastInfo.lastValue) {
      const now = Date.now();
      const lengthDiff = currentVal.length - (lastInfo.lastValue ? lastInfo.lastValue.length : 0);
      const durationMs = Math.max(100, now - (lastInfo.lastSnapshotTime || now));
      const durationSec = durationMs / 1000;
      const speedCharsPerSec = lengthDiff > 0 ? Number((lengthDiff / durationSec).toFixed(1)) : 0;

      const keystrokeTimes = lastInfo.keystrokeTimes || [];
      let uniformFrequency = false;
      let keystrokeStdDev = null;
      let avgIntervalMs = null;

      if (keystrokeTimes.length >= 4) {
        const intervals = [];
        for (let i = 1; i < keystrokeTimes.length; i++) {
          intervals.push(keystrokeTimes[i] - keystrokeTimes[i - 1]);
        }
        const sum = intervals.reduce((a, b) => a + b, 0);
        const avg = sum / intervals.length;
        avgIntervalMs = Number(avg.toFixed(1));
        const variance = intervals.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        keystrokeStdDev = Number(stdDev.toFixed(1));

        if (stdDev < 15 && avg > 10) {
          uniformFrequency = true;
        }
      }

      const anomalyReasons = [];
      const maxSpeed = Number(trackerConfig.maxCharsPerSecond) || 15;
      const checkFreq = trackerConfig.checkFrequencyAnomaly !== false;
      const detectionEnabled = trackerConfig.anomalyDetectionEnabled !== false;

      if (detectionEnabled) {
        if (lengthDiff > 5 && speedCharsPerSec > maxSpeed) {
          anomalyReasons.push(`打字速度異常 (${speedCharsPerSec} 字/秒，超過上限 ${maxSpeed} 字/秒)`);
        }
        if (lengthDiff >= 50 && (durationMs <= 1500 || keystrokeTimes.length <= 2)) {
          anomalyReasons.push(`字數短時間暴增 (${lengthDiff} 字，疑似外部貼上或腳本注入)`);
        }
        if (checkFreq && uniformFrequency) {
          anomalyReasons.push(`輸入間隔頻率過於固定 (間隔標準差 ${keystrokeStdDev}ms，疑似機器人腳本)`);
        }
      }

      const isAnomaly = anomalyReasons.length > 0;

      const fieldIdentifier =
        el.getAttribute("data-track") ||
        el.name ||
        el.placeholder ||
        el.id ||
        (el.tagName === "TEXTAREA" ? "文字作答框" : "文字輸入框");

      trackEvent({
        eventType: "INPUT_SNAPSHOT",
        targetElement: fieldIdentifier,
        actionData: {
          trigger: isPeriodic ? "PERIODIC_TIMER" : "BLUR_CHANGE",
          currentLength: currentVal.length,
          lengthDiff,
          durationMs,
          speedCharsPerSec,
          inputCount: keystrokeTimes.length,
          avgIntervalMs,
          keystrokeStdDev,
          uniformFrequency,
          isAnomaly,
          anomalyReasons,
          previewSnippet: currentVal.slice(0, 100) + (currentVal.length > 100 ? "..." : ""),
        },
      });

      lastInfo.lastValue = currentVal;
      lastInfo.lastSnapshotTime = now;
      lastInfo.keystrokeTimes = [];
    }
  }
}


function restartInputTimer() {
  if (inputSnapshotTimer) {
    clearInterval(inputSnapshotTimer);
    inputSnapshotTimer = null;
  }

  const seconds = Math.max(5, Number(trackerConfig.inputIntervalSeconds) || 30);
  const intervalMs = seconds * 1000;

  inputSnapshotTimer = setInterval(() => {
    scanInputSnapshots(true);
  }, intervalMs);
}


export async function refreshTrackerConfig(courseCode = null) {
  const targetCourse = courseCode || getCurrentCourseAndHw().courseCode;
  if (!targetCourse) return;

  try {
    const res = await api.get(`/api/courses/${targetCourse}/activity-logs/config`);
    if (res?.data) {
      trackerConfig = { ...trackerConfig, ...res.data };
      currentTrackedCourse = targetCourse;
      restartInputTimer();
    }
  } catch {
  }
}


export function initActivityTracker({ router = null } = {}) {
  if (initialized) return;
  initialized = true;

  flushTimer = setInterval(flushEvents, 15000);
  restartInputTimer();

  document.addEventListener(
    "click",
    (e) => {
      if (!trackerConfig.enabled || !trackerConfig.trackClicks) return;

      const clickable = e.target.closest(
        'button, a, input[type="button"], input[type="submit"], [role="button"], [data-track]',
      );
      if (!clickable) return;

      const customTrack = clickable.getAttribute("data-track");
      const buttonText =
        customTrack ||
        clickable.innerText?.trim() ||
        clickable.getAttribute("aria-label") ||
        clickable.getAttribute("title") ||
        clickable.value ||
        clickable.id ||
        clickable.className?.slice?.(0, 50) ||
        "未具名按鈕";

      if (!buttonText || buttonText.length === 0) return;

      trackEvent({
        eventType: "BUTTON_CLICK",
        targetElement: buttonText.slice(0, 100),
        actionData: {
          tagName: clickable.tagName.toLowerCase(),
          href: clickable.getAttribute("href") || undefined,
        },
      });
    },
    { capture: true, passive: true },
  );

  document.addEventListener(
    "change",
    (e) => {
      if (!trackerConfig.enabled || !trackerConfig.trackFileUploads) return;
      const target = e.target;
      if (target && target.tagName === "INPUT" && target.type === "file") {
        const files = Array.from(target.files || []).map((f) => ({
          name: f.name,
          sizeBytes: f.size,
          type: f.type,
        }));

        trackEvent({
          eventType: "FILE_UPLOAD",
          targetElement: target.name || target.id || "檔案上傳欄位",
          actionData: {
            filesCount: files.length,
            filesSummary: files,
          },
        });
      }
    },
    { capture: true, passive: true },
  );

  document.addEventListener(
    "focusin",
    (e) => {
      const target = e.target;
      if (target && (target.tagName === "TEXTAREA" || (target.tagName === "INPUT" && target.type === "text"))) {
        if (!activeInputs.has(target)) {
          activeInputs.set(target, {
            lastValue: target.value || "",
            lastSnapshotTime: Date.now(),
            keystrokeTimes: [],
          });
        }
      }
    },
    { capture: true, passive: true },
  );

  document.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target && (target.tagName === "TEXTAREA" || (target.tagName === "INPUT" && target.type === "text"))) {
        const now = Date.now();
        let info = activeInputs.get(target);
        if (!info) {
          info = {
            lastValue: target.value || "",
            lastSnapshotTime: now,
            keystrokeTimes: [],
          };
          activeInputs.set(target, info);
        }
        if (!info.keystrokeTimes) info.keystrokeTimes = [];
        info.keystrokeTimes.push(now);
        if (info.keystrokeTimes.length > 100) {
          info.keystrokeTimes.shift();
        }
      }
    },
    { capture: true, passive: true },
  );

  document.addEventListener(
    "focusout",
    (e) => {
      const target = e.target;
      if (target && activeInputs.has(target)) {
        scanInputSnapshots(false);
      }
    },
    { capture: true, passive: true },
  );

  if (router && typeof router.afterEach === "function") {
    router.afterEach((to) => {
      const { courseCode } = getCurrentCourseAndHw();
      if (courseCode && courseCode !== currentTrackedCourse) {
        refreshTrackerConfig(courseCode);
      }

      trackEvent({
        eventType: "PAGE_VIEW",
        pageUrl: to.fullPath,
        targetElement: String(to.name || to.path),
        actionData: { title: document.title },
      });
    });
  }

  const handleUnload = () => {
    scanInputSnapshots(false);
    flushEvents();
  };

  window.addEventListener("beforeunload", handleUnload);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      handleUnload();
    }
  });
}
