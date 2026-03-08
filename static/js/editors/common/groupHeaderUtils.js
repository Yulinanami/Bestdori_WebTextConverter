// 分组标题
export function resolveGroupRange(groupIndex, groupSize, totalActions) {
  const startNum = groupIndex * groupSize + 1;
  const endNum = Math.min((groupIndex + 1) * groupSize, totalActions);
  return { startNum, endNum };
}

// 生成分组标题文字
export function buildGroupHeaderText(isActive, startNum, endNum) {
  return `${isActive ? "▼" : "▶"} 对话 ${startNum} - ${endNum} (${
    endNum - startNum + 1
  }条)`;
}

// 更新分组标题的样式和文字
export function updateGroupHeader(header, options) {
  const { groupIndex, isActive, startNum, endNum, onToggle } = options;
  header.classList.add("timeline-group-header");
  header.dataset.groupIdx = String(groupIndex);
  // 先写入基础样式
  header.style.cursor = "pointer";
  header.style.padding = "12px 18px";
  header.style.background = "var(--bg-secondary)";
  header.style.border = "1px solid var(--border-primary)";
  header.style.borderRadius = "var(--radius-lg)";
  header.style.marginBottom = "15px";
  header.style.fontWeight = "600";
  header.style.transition = "all 0.2s ease";
  header.classList.toggle("active", isActive);
  if (isActive) {
    header.style.background = "var(--group-header-active-bg, #ebf8ff)";
    header.style.borderColor = "var(--group-header-active-border, #90cdf4)";
  } else {
    header.style.borderColor = "var(--border-primary)";
  }
  header.textContent = buildGroupHeaderText(isActive, startNum, endNum);
  if (onToggle) {
    // 点击标题时切换分组
    header.onclick = () => onToggle(groupIndex);
  }
}

// 滚动到指定分组标题
export function scrollToGroupHeader(container, groupIndex, offset = 110) {
  const header = container?.querySelector(
    `.timeline-group-header[data-group-idx="${groupIndex}"]`
  );
  if (!header) {
    return;
  }

  const targetTop = header.offsetTop - offset;
  if (container.scrollTop !== targetTop) {
    container.scrollTo({
      top: targetTop,
      behavior: "smooth",
    });
  }
}
