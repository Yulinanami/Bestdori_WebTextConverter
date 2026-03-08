// 把值整理成更短的文字
export function shortValue(value, maxLength = 84) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text === undefined) return "undefined";
  if (text === "") return '""';
  const normalized = String(text).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

// 把变化整理成一行短文字
export function summarizeChanges(changes = [], maxLength = 84) {
  if (!Array.isArray(changes) || changes.length === 0) {
    return "";
  }
  return changes
    .slice(0, 3)
    .map(
      (change) =>
        `${change.path}: ${shortValue(change.beforeValue, maxLength)} -> ${shortValue(
          change.afterValue,
          maxLength,
        )}`,
    )
    .join("; ");
}
