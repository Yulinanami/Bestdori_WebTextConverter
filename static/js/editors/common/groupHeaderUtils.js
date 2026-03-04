// 计算某个分组的起止序号（1-based）。
export function getGroupRange(groupIndex, groupSize, totalActions) {
  const startNum = groupIndex * groupSize + 1;
  const endNum = Math.min((groupIndex + 1) * groupSize, totalActions);
  return { startNum, endNum };
}

// 统一分组头文案。
export function getGroupHeaderText(isActive, startNum, endNum) {
  return `${isActive ? "▼" : "▶"} 对话 ${startNum} - ${endNum} (${
    endNum - startNum + 1
  }条)`;
}

// 同步分组头样式和文案；需要时绑定点击事件。
export function updateGroupHeader(header, options) {
  const { groupIndex, isActive, startNum, endNum, onToggle } = options;
  header.classList.add("timeline-group-header");
  header.dataset.groupIdx = String(groupIndex);
  // 统一组头基础样式，保证局部短路新建组头与全量渲染外观一致。
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
  header.textContent = getGroupHeaderText(isActive, startNum, endNum);
  if (onToggle) {
    header.onclick = () => onToggle(groupIndex);
  }
}
