import { DOMUtils } from "@utils/DOMUtils.js";
import {
  createTimelineRenderCache,
  renderIncrementalTimeline,
} from "@utils/IncrementalTimelineRenderer.js";
import { DataUtils } from "@utils/DataUtils.js";
import { editorService } from "@services/EditorService.js";
import { createLive2dRenderers } from "@editors/live2d/live2dTimelineRenderers.js";

// 时间轴渲染与事件绑定
export function attachLive2dTimeline(editor) {
  const timelineCache = createTimelineRenderCache();

  Object.assign(editor, {
    bindTimelineEvents() {
      const timeline = editor.domCache.timeline;
      if (!timeline) return;

      timeline.onclick = (e) => {
        const card = e.target.closest(".layout-item");
        if (!card) return;

        // 删除卡片
        if (e.target.matches(".layout-remove-btn")) {
          editor._deleteLayoutAction(card.dataset.id);
          return;
        }

        // 切换 to 位置信息是否独立配置
        if (e.target.closest(".toggle-position-btn")) {
          const toggleBtn = card.querySelector(".toggle-position-btn");
          const toPositionContainer = card.querySelector(
            ".to-position-container"
          );
          const mainPositionLabel = card.querySelector(".main-position-label");
          const mainOffsetLabel = card.querySelector(".main-offset-label");
          const isExpanded = toggleBtn.classList.contains("expanded");
          const actionId = card.dataset.id;

          if (isExpanded) {
            // 收起：修改标签为"位置"，隐藏终点容器，清除独立配置标记
            toggleBtn.classList.remove("expanded");
            if (mainPositionLabel) mainPositionLabel.textContent = "位置:";
            if (mainOffsetLabel) mainOffsetLabel.textContent = "偏移:";
            toPositionContainer.style.display = "none";

            // 将终点位置设置为与起点相同（取消独立配置），并清除独立标记
            editor._executeCommand((currentState) => {
              const currentAction = currentState.actions.find(
                (a) => a.id === actionId
              );
              if (currentAction && currentAction.position) {
                delete currentAction._independentToPosition;
                if (!currentAction.position.to) currentAction.position.to = {};
                currentAction.position.to.side =
                  currentAction.position.from?.side || "center";
                currentAction.position.to.offsetX =
                  currentAction.position.from?.offsetX || 0;
              }
            });

            // 更新主位置UI显示（根据卡片类型决定显示 from 还是 to）
            const action = editor.projectFileState.actions.find(
              (a) => a.id === actionId
            );
            if (action) {
              const isMove = action.layoutType === "move";
              // 移动卡片显示终点，其他卡片显示起点
              const displaySide = isMove
                ? action.position?.to?.side || "center"
                : action.position?.from?.side || "center";
              const displayOffsetX = isMove
                ? action.position?.to?.offsetX || 0
                : action.position?.from?.offsetX || 0;

              card.querySelector(".layout-position-select").value = displaySide;
              card.querySelector(".layout-offset-input").value = displayOffsetX;
            }
          } else {
            // 展开：修改标签为"起点"，显示终点容器，设置独立标记
            toggleBtn.classList.add("expanded");
            if (mainPositionLabel) mainPositionLabel.textContent = "起点:";
            if (mainOffsetLabel) mainOffsetLabel.textContent = "偏移:";
            toPositionContainer.style.display = "grid";

            // 设置独立配置标记，阻止自动同步
            editor._executeCommand((currentState) => {
              const currentAction = currentState.actions.find(
                (a) => a.id === actionId
              );
              if (currentAction) {
                currentAction._independentToPosition = true;
              }
            });

            // 初始化位置UI显示
            const action = editor.projectFileState.actions.find(
              (a) => a.id === actionId
            );
            if (action) {
              // 主位置（起点）显示 from 的值
              const fromSide = action.position?.from?.side || "center";
              const fromOffsetX = action.position?.from?.offsetX || 0;
              card.querySelector(".layout-position-select").value = fromSide;
              card.querySelector(".layout-offset-input").value = fromOffsetX;

              // 终点位置显示 to 的值
              const toSide =
                action.position?.to?.side ||
                action.position?.from?.side ||
                "center";
              const toOffsetX =
                action.position?.to?.offsetX ??
                action.position?.from?.offsetX ??
                0;
              card.querySelector(".layout-position-select-to").value = toSide;
              card.querySelector(".layout-offset-input-to").value = toOffsetX;
            }
          }
        }
      };

      timeline.onchange = (e) => {
        const card = e.target.closest(".layout-item");
        if (!card || !e.target.matches("select, input")) return;
        editor._updateLayoutActionProperty(card.dataset.id, e.target);
      };
    },

    /**
     * 渲染Live2D布局编辑器时间轴
     * 渲染两种类型的卡片:
     * - talk卡片: 显示对话内容和说话人信息(只读)
     * - layout卡片: 可编辑的布局动作,包含类型/位置/服装/偏移量选择器
     * 支持分组模式(50条/组)优化长剧本性能,自动显示卡片序号和布局类型样式
     */
    renderTimeline() {
      const timeline = editor.domCache.timeline;
      if (!timeline) return;

      const isGroupingEnabled = editor.domCache.groupCheckbox?.checked || false;
      const actions = editor.projectFileState.actions || [];
      const groupSize = 50;
      const templates =
        editor.domCache.templates ||
        (editor.domCache.templates = {
          talk: document.getElementById("timeline-talk-card-template"),
          layout: document.getElementById("timeline-layout-card-template"),
        });
      const configEntries = editorService.getCurrentConfig() || {};
      const characterNameMap = new Map(
        Object.entries(configEntries).flatMap(([name, ids]) =>
          ids.map((id) => [id, name])
        )
      );
      const { renderSingleCard, updateCard, contextSignature } =
        createLive2dRenderers(editor, { templates, characterNameMap });
      const configSignature = contextSignature(configEntries);

      renderIncrementalTimeline({
        container: timeline,
        actions,
        cache: timelineCache,
        renderCard: renderSingleCard,
        updateCard,
        signatureResolver: DataUtils.actionSignature,
        groupingEnabled: isGroupingEnabled,
        groupSize,
        activeGroupIndex: editor.activeGroupIndex,
        contextSignature: configSignature,
        onGroupToggle: (index) => {
          const isOpening = editor.activeGroupIndex !== index;
          editor.activeGroupIndex = isOpening ? index : null;
          editor.renderTimeline();

          if (isOpening) {
            setTimeout(() => {
              const scrollContainer = editor.domCache.timeline;
              const header = scrollContainer?.querySelector(
                `.timeline-group-header[data-group-idx="${index}"]`
              );
              if (scrollContainer && header) {
                scrollContainer.scrollTo({
                  top: header.offsetTop - 110,
                  behavior: "smooth",
                });
              }
            }, 0);
          }
        },
      });
    },
  });
}
