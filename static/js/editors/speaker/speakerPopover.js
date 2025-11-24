import { DOMUtils } from "@utils/DOMUtils.js";

export function attachSpeakerPopover(editor) {
  Object.assign(editor, {
    /**
     * 显示多说话人弹出菜单
     * 点击多说话人徽章时触发,显示该对话的所有说话人列表
     * @param {string} actionId - 动作ID
     * @param {HTMLElement} targetElement - 触发弹出菜单的元素(用于定位)
     */
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
