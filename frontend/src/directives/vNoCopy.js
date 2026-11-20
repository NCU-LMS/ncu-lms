import { trackEvent } from "@/utils/activityTracker.js";

let toastEl = null;
let toastTimer = null;

function showWarningToast(message = "此作答欄位禁止複製與貼上，請手動輸入作答！") {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.style.position = "fixed";
    toastEl.style.top = "24px";
    toastEl.style.left = "50%";
    toastEl.style.transform = "translateX(-50%)";
    toastEl.style.backgroundColor = "#dc2626"; // Tailwind red-600
    toastEl.style.color = "#ffffff";
    toastEl.style.padding = "10px 20px";
    toastEl.style.borderRadius = "8px";
    toastEl.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
    toastEl.style.fontSize = "14px";
    toastEl.style.fontWeight = "bold";
    toastEl.style.zIndex = "99999";
    toastEl.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    toastEl.style.pointerEvents = "none";
    document.body.appendChild(toastEl);
  }

  toastEl.textContent = message;
  toastEl.style.opacity = "1";
  toastEl.style.transform = "translateX(-50%) translateY(0)";

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (toastEl) {
      toastEl.style.opacity = "0";
      toastEl.style.transform = "translateX(-50%) translateY(-10px)";
    }
  }, 2500);
}

function handleBlock(e, el, actionType) {
  e.preventDefault();
  e.stopPropagation();

  showWarningToast();

  trackEvent({
    eventType: "COPY_BLOCKED",
    targetElement: el.name || el.placeholder || el.tagName.toLowerCase(),
    actionData: {
      action: actionType,
      message: "嘗試進行禁止之複製/貼上/剪下操作",
      currentLength: el.value ? el.value.length : 0,
    },
  });
}

export const vNoCopy = {
  mounted(el, binding) {
    const target = el.tagName === "TEXTAREA" || el.tagName === "INPUT" ? el : el.querySelector("textarea, input") || el;

    const onPaste = (e) => handleBlock(e, target, "PASTE");
    const onCopy = (e) => handleBlock(e, target, "COPY");
    const onCut = (e) => handleBlock(e, target, "CUT");
    const onContextMenu = (e) => handleBlock(e, target, "CONTEXTMENU");
    const onDrop = (e) => handleBlock(e, target, "DROP");
    const onDragOver = (e) => e.preventDefault();

    const onKeyDown = (e) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if ((isCtrlOrCmd && key === "v") || (e.shiftKey && e.key === "Insert")) {
        handleBlock(e, target, "SHORTCUT_PASTE");
        return;
      }
      if (isCtrlOrCmd && key === "c") {
        handleBlock(e, target, "SHORTCUT_COPY");
        return;
      }
      if (isCtrlOrCmd && key === "x") {
        handleBlock(e, target, "SHORTCUT_CUT");
        return;
      }
    };

    target.addEventListener("paste", onPaste);
    target.addEventListener("copy", onCopy);
    target.addEventListener("cut", onCut);
    target.addEventListener("contextmenu", onContextMenu);
    target.addEventListener("drop", onDrop);
    target.addEventListener("dragover", onDragOver);
    target.addEventListener("keydown", onKeyDown);

    target._noCopyHandlers = {
      onPaste,
      onCopy,
      onCut,
      onContextMenu,
      onDrop,
      onDragOver,
      onKeyDown,
    };
  },

  unmounted(el) {
    const target = el.tagName === "TEXTAREA" || el.tagName === "INPUT" ? el : el.querySelector("textarea, input") || el;
    if (target && target._noCopyHandlers) {
      const h = target._noCopyHandlers;
      target.removeEventListener("paste", h.onPaste);
      target.removeEventListener("copy", h.onCopy);
      target.removeEventListener("cut", h.onCut);
      target.removeEventListener("contextmenu", h.onContextMenu);
      target.removeEventListener("drop", h.onDrop);
      target.removeEventListener("dragover", h.onDragOver);
      target.removeEventListener("keydown", h.onKeyDown);
      delete target._noCopyHandlers;
    }
  },
};
