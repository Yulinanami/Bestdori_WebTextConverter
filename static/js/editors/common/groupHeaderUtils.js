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
  header.classList.toggle("active", isActive);
  header.textContent = getGroupHeaderText(isActive, startNum, endNum);
  if (onToggle) {
    header.onclick = () => onToggle(groupIndex);
  }
}
