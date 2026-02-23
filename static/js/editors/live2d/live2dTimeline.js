import {
  createTimelineRenderCache,
  renderIncrementalTimeline,
} from "@utils/IncrementalTimelineRenderer.js";
import { DataUtils } from "@utils/DataUtils.js";
import { editorService } from "@services/EditorService.js";
import { createLive2DRenderers } from "@editors/live2d/live2dTimelineRenderers.js";

// 渲染卡片、响应删除/控件修改等
export function attachLive2DTimeline(editor) {
  const timelineCache = createTimelineRenderCache();

  Object.assign(editor, {
    // 绑定时间线上的点击/修改事件（删除、展开终点位置、改下拉框等）
    bindTimelineEvents() {
      const timeline = editor.domCache.timeline;
      if (!timeline) return;

      timeline.onclick = (clickEvent) => {
        const layoutCard = clickEvent.target.closest(".layout-item");
        if (!layoutCard) return;

        // 删除卡片
        if (clickEvent.target.matches(".layout-remove-btn")) {
          editor.deleteLayoutAction(layoutCard.dataset.id);
          return;
        }

        // 切换 to 位置信息是否独立配置
        if (clickEvent.target.closest(".toggle-position-btn")) {
          const toggleButton = layoutCard.querySelector(".toggle-position-btn");
          const toPositionContainer = layoutCard.querySelector(
            ".to-position-container",
          );
          const mainPositionLabel = layoutCard.querySelector(".main-position-label");
          const mainOffsetLabel = layoutCard.querySelector(".main-offset-label");
          const isExpanded = toggleButton.classList.contains("expanded");
          const actionId = layoutCard.dataset.id;

          if (isExpanded) {
            // 收起：修改标签为"位置"，隐藏终点容器，清除独立配置标记
            toggleButton.classList.remove("expanded");
            if (mainPositionLabel) mainPositionLabel.textContent = "位置:";
            if (mainOffsetLabel) mainOffsetLabel.textContent = "偏移:";
            toPositionContainer.style.display = "none";

            // 将终点位置设置为与起点相同（取消独立配置），并清除独立标记
            editor.baseEditor.executeCommand((currentState) => {
              const currentAction = currentState.actions.find(
                (actionItem) => actionItem.id === actionId,
              );
              if (currentAction && currentAction.position) {
                delete currentAction.customToPosition;
                if (!currentAction.position.to) currentAction.position.to = {};
                currentAction.position.to.side =
                  currentAction.position.from?.side || "center";
                currentAction.position.to.offsetX =
                  currentAction.position.from?.offsetX || 0;
              }
            });

            // 更新主位置UI显示（根据卡片类型决定显示 from 还是 to）
            const action = editor.projectFileState.actions.find(
              (actionItem) => actionItem.id === actionId,
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

              layoutCard.querySelector(".layout-position-select").value =
                displaySide;
              layoutCard.querySelector(".layout-offset-input").value =
                displayOffsetX;
            }
          } else {
            // 展开：修改标签为"起点"，显示终点容器，设置独立标记
            toggleButton.classList.add("expanded");
            if (mainPositionLabel) mainPositionLabel.textContent = "起点:";
            if (mainOffsetLabel) mainOffsetLabel.textContent = "偏移:";
            toPositionContainer.style.display = "grid";

            // 设置独立配置标记，阻止自动同步
            editor.baseEditor.executeCommand((currentState) => {
              const currentAction = currentState.actions.find(
                (actionItem) => actionItem.id === actionId,
              );
              if (currentAction) {
                currentAction.customToPosition = true;
              }
            });

            // 初始化位置UI显示
            const action = editor.projectFileState.actions.find(
              (actionItem) => actionItem.id === actionId,
            );
            if (action) {
              // 主位置（起点）显示 from 的值
              const fromSide = action.position?.from?.side || "center";
              const fromOffsetX = action.position?.from?.offsetX || 0;
              layoutCard.querySelector(".layout-position-select").value =
                fromSide;
              layoutCard.querySelector(".layout-offset-input").value =
                fromOffsetX;

              // 终点位置显示 to 的值
              const toSide =
                action.position?.to?.side ||
                action.position?.from?.side ||
                "center";
              const toOffsetX =
                action.position?.to?.offsetX ??
                action.position?.from?.offsetX ??
                0;
              layoutCard.querySelector(".layout-position-select-to").value =
                toSide;
              layoutCard.querySelector(".layout-offset-input-to").value =
                toOffsetX;
            }
          }
        }
      };

      timeline.onchange = (changeEvent) => {
        const layoutCard = changeEvent.target.closest(".layout-item");
        if (!layoutCard || !changeEvent.target.matches("select, input")) return;
        editor.updateLayoutActionProperty(
          layoutCard.dataset.id,
          changeEvent.target
        );
      };
    },

    // 渲染时间线：对话卡片只读，布局卡片可编辑（支持分组模式）
    renderTimeline() {
      const timeline = editor.domCache.timeline;
      if (!timeline) return;

      const isGroupingEnabled = editor.domCache.groupCheckbox?.checked || false;
      const actions = editor.projectFileState.actions || [];
      const templates =
        editor.domCache.templates ||
        (editor.domCache.templates = {
          talk: document.getElementById("timeline-talk-card-template"),
          layout: document.getElementById("timeline-layout-card-template"),
        });
      const configEntries = editorService.state.get("currentConfig") || {};
      const characterNameMap = new Map(
        Object.entries(configEntries).flatMap(([name, ids]) =>
          ids.map((id) => [id, name]),
        ),
      );
      const { renderSingleCard, updateCard, contextSignature } =
        createLive2DRenderers(editor, { templates, characterNameMap });
      const configSignature = contextSignature(configEntries);

      renderIncrementalTimeline({
        container: timeline,
        actions,
        cache: timelineCache,
        renderCard: renderSingleCard,
        updateCard,
        signatureResolver: DataUtils.actionSignature,
        groupingEnabled: isGroupingEnabled,
        groupSize: 50,
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
                `.timeline-group-header[data-group-idx="${index}"]`,
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
