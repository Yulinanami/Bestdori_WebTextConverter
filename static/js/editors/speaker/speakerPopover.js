import { DOMUtils } from "@utils/DOMUtils.js";

// 点击徽章后弹出列表并支持删除。
export function attachSpeakerPopover(editor) {
  Object.assign(editor, {
    // 显示多说话人弹窗（定位在 targetElement 附近）
    showMultiSpeakerPopover(actionId, targetElement) {
      DOMUtils.getElements("#speaker-popover").forEach((p) => p.remove());

      const action = editor.projectFileState.actions.find(
        (a) => a.id === actionId
      );
      if (!action) return;

      const popover = DOMUtils.createElement("div", {
        id: "speaker-popover",
        className: "speaker-popover-menu",
        style: {
          position: "fixed",
          borderRadius: "8px",
          boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
          zIndex: "10001",
          padding: "8px",
          minWidth: "150px",
        },
      });

      const items = action.speakers.map((speaker) => {
        const nameSpan = DOMUtils.createElement(
          "span",
          {
            style: { flexGrow: "1" },
          },
          speaker.name
        );

        const deleteBtn = DOMUtils.createElement(
          "button",
          {
            className: "speaker-delete-btn",
            style: {
              borderRadius: "50%",
              width: "22px",
              height: "22px",
              cursor: "pointer",
              marginLeft: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              lineHeight: "1",
            },
            onClick: (e) => {
              e.stopPropagation();
              editor.removeSpeakerFromAction(actionId, speaker.characterId);
              popover.remove();
            },
          },
          "×"
        );

        return DOMUtils.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              padding: "6px 8px",
              borderRadius: "5px",
            },
          },
          [nameSpan, deleteBtn]
        );
      });

      DOMUtils.appendChildren(popover, items);
      document.body.appendChild(popover);

      const rect = targetElement.getBoundingClientRect();
      popover.style.top = `${rect.bottom + 5}px`;
      popover.style.left = `${rect.left}px`;

      setTimeout(() => {
        document.addEventListener(
          "click",
          function onClickOutside(e) {
            if (!popover.contains(e.target)) {
              popover.remove();
              document.removeEventListener("click", onClickOutside);
            }
          },
          { once: true }
        );
      }, 0);
    },
  });
}
