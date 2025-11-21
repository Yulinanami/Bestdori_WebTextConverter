// 提供 projectFileState / originalStateOnOpen / activeGroupIndex 的 getter/setter
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
