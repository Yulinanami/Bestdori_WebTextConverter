// 把 baseEditor 的几个关键字段“转发”到 target 上
export function applyStateBridge(target, baseEditor) {
  Object.defineProperties(target, {
    projectFileState: {
      enumerable: true,
      get() {
        return baseEditor.projectFileState;
      },
      set(value) {
        baseEditor.projectFileState = value;
      },
    },
    originalStateOnOpen: {
      enumerable: true,
      get() {
        return baseEditor.originalStateOnOpen;
      },
      set(value) {
        baseEditor.originalStateOnOpen = value;
      },
    },
    activeGroupIndex: {
      enumerable: true,
      get() {
        return baseEditor.activeGroupIndex;
      },
      set(value) {
        baseEditor.activeGroupIndex = value;
      },
    },
  });
}
