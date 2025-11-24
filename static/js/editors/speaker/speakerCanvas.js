import { DOMUtils } from "@utils/DOMUtils.js";
import { renderGroupedView } from "@utils/uiUtils.js";
import { editorService } from "@services/EditorService.js";

// 负责渲染左侧对话/布局卡片，以及多说话人弹窗
export function attachSpeakerCanvas(editor) {
  Object.assign(editor, {
    /**
     * 渲染左侧对话卡片画布
     * 支持分组模式和普通模式两种渲染方式:
     * - 分组模式: 每50条对话折叠为一组,提升长剧本性能
     * - 普通模式: 一次性渲染所有对话卡片
     * 卡片显示对话文本、说话人头像、序号,支持多说话人徽章
     * @returns {Set<number>} 已使用的角色ID集合
     */
    renderCanvas() {
      const canvas = editor.domCache.canvas;
      if (!canvas) return new Set();

      const usedIds = editor._getUsedCharacterIds();
      const isGroupingEnabled = editor.domCache.groupCheckbox?.checked || false;
      const actions = editor.projectFileState.actions;
      const groupSize = 50;

      const templates =
        editor.domCache.templates ||
        (editor.domCache.templates = {
          talk: document.getElementById("text-snippet-card-template"),
          layout: document.getElementById("timeline-layout-card-template"),
        });
      const configEntries = editorService.getCurrentConfig() || {};
      const characterNameMap = new Map(
        Object.entries(configEntries).flatMap(([name, ids]) =>
          ids.map((id) => [id, name])
        )
      );

      const renderSingleCard = (action, globalIndex = -1) => {
        let card;

        if (action.type === "talk") {
          card = templates.talk.content.cloneNode(true);
          const dialogueItem = card.firstElementChild;
          dialogueItem.dataset.id = action.id;
          const avatarContainer = dialogueItem.querySelector(
            ".speaker-avatar-container"
          );
          const avatarDiv = dialogueItem.querySelector(".dialogue-avatar");
          const speakerNameDiv = dialogueItem.querySelector(".speaker-name");
          const multiSpeakerBadge = dialogueItem.querySelector(
            ".multi-speaker-badge"
          );

          if (action.speakers && action.speakers.length > 0) {
            const firstSpeaker = action.speakers[0];
            avatarContainer.style.display = "flex";
            speakerNameDiv.style.display = "block";
            dialogueItem.classList.remove("narrator");
            editorService.updateCharacterAvatar(
              { querySelector: () => avatarDiv },
              firstSpeaker.characterId,
              firstSpeaker.name
            );
            const allNames = action.speakers.map((s) => s.name).join(" & ");
            speakerNameDiv.textContent = allNames;

            if (action.speakers.length > 1) {
              multiSpeakerBadge.style.display = "flex";
              multiSpeakerBadge.textContent = `+${action.speakers.length - 1}`;
              avatarContainer.style.cursor = "pointer";
              avatarContainer.addEventListener("click", (e) => {
                e.stopPropagation();
                editor.showMultiSpeakerPopover(action.id, avatarContainer);
              });
            } else {
              multiSpeakerBadge.style.display = "none";
              avatarContainer.style.cursor = "default";
            }
          } else {
            avatarContainer.style.display = "none";
            speakerNameDiv.style.display = "none";
            multiSpeakerBadge.style.display = "none";
            dialogueItem.classList.add("narrator");
          }

          dialogueItem.querySelector(".dialogue-text").textContent =
            action.text;
        } else if (action.type === "layout") {
          card = templates.layout.content.cloneNode(true);
          const item = card.firstElementChild;
          item.dataset.id = action.id;
          item.dataset.layoutType = action.layoutType;
          item.classList.remove("dialogue-item");
          item.classList.add("layout-item");

          // 根据类型添加样式
          DOMUtils.applyLayoutTypeClass(item, action.layoutType);

          const characterId = action.characterId;
          const characterName =
            action.characterName || characterNameMap.get(characterId);

          item.querySelector(".speaker-name").textContent =
            characterName || `未知角色 (ID: ${characterId})`;
          const avatarDiv = item.querySelector(".dialogue-avatar");
          editorService.updateCharacterAvatar(
            { querySelector: () => avatarDiv },
            characterId,
            characterName
          );
          // 使用共享的渲染函数（在对话编辑器中隐藏切换按钮）
          editor.renderLayoutCardControls(card, action, characterName, {
            showToggleButton: false,
          });
        } else {
          return null;
        }

        const numberDiv = card.querySelector(".card-sequence-number");
        if (numberDiv && globalIndex !== -1) {
          numberDiv.textContent = `#${globalIndex + 1}`;
        }
        return card;
      };

      if (isGroupingEnabled && actions.length > groupSize) {
        renderGroupedView({
          container: canvas,
          actions,
          activeGroupIndex: editor.activeGroupIndex,
          onGroupClick: (index) => {
            const isOpening = editor.activeGroupIndex !== index;
            editor.activeGroupIndex = isOpening ? index : null;
            editor.renderCanvas();
            if (isOpening) {
              setTimeout(() => {
                const scrollContainer = editor.domCache.canvas;
                const header = scrollContainer?.querySelector(
                  `.timeline-group-header[data-group-idx="${index}"]`
                );
                if (
                  scrollContainer &&
                  header &&
                  scrollContainer.scrollTop !== header.offsetTop - 110
                ) {
                  scrollContainer.scrollTo({
                    top: header.offsetTop - 110,
                    behavior: "smooth",
                  });
                }
              }, 0);
            }
          },
          renderItemFn: renderSingleCard,
          groupSize,
        });
      } else {
        DOMUtils.clearElement(canvas);
        const fragment = document.createDocumentFragment();
        actions.forEach((action, idx) => {
          const renderedCard = renderSingleCard(action, idx);
          if (renderedCard) fragment.appendChild(renderedCard);
        });
        canvas.appendChild(fragment);
      }

      return usedIds;
    },

    /**
     * 显示多说话人弹出菜单
     * 点击多说话人徽章时触发,显示该对话的所有说话人列表
     * 每个说话人旁边有删除按钮,点击外部自动关闭
     * @param {string} actionId - 动作ID
     * @param {HTMLElement} targetElement - 触发弹出菜单的元素(用于定位)
     */
    showMultiSpeakerPopover(actionId, targetElement) {
      // 移除所有旧的 popover 防止内存泄漏
      DOMUtils.getElements("#speaker-popover").forEach((p) => p.remove());

      const action = editor.projectFileState.actions.find(
        (a) => a.id === actionId
      );
      if (!action) return;

      // 使用 DOMUtils 创建 popover
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

      // 为每个说话人创建列表项
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

      // 批量添加所有列表项
      DOMUtils.appendChildren(popover, items);
      document.body.appendChild(popover);

      // 定位 popover
      const rect = targetElement.getBoundingClientRect();
      popover.style.top = `${rect.bottom + 5}px`;
      popover.style.left = `${rect.left}px`;

      // 点击外部关闭
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
