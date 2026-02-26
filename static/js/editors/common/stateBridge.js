// 把 baseEditor 的几个关键字段“转发”到 target 上
export function applyStateBridge(target, baseEditor) {
  Object.defineProperties(target, {
    // 代理项目状态对象。
    projectFileState: {
      enumerable: true,
      // 读取 projectFileState 时转发到 baseEditor。
      get() {
        return baseEditor.projectFileState;
      },
      set(value) {
        baseEditor.projectFileState = value;
      },
    },
    // 代理“打开时原始状态”。
    originalStateOnOpen: {
      enumerable: true,
      // 读取 originalStateOnOpen 时转发到 baseEditor。
      get() {
        return baseEditor.originalStateOnOpen;
      },
      set(value) {
        baseEditor.originalStateOnOpen = value;
      },
    },
    // 代理当前展开分组索引。
    activeGroupIndex: {
      enumerable: true,
      // 读取 activeGroupIndex 时转发到 baseEditor。
      get() {
        return baseEditor.activeGroupIndex;
      },
      set(value) {
        baseEditor.activeGroupIndex = value;
      },
    },
  });
}
