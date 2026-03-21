// 处理项目进度文件

// 判断是不是项目文件
function isProjectFile(projectFile) {
  if (!projectFile || !Array.isArray(projectFile.actions)) {
    return false;
  }
  // 只认编辑器产出的 talk 和 layout 两种动作
  return projectFile.actions.every((action) => {
    if (!action || typeof action !== "object") {
      return false;
    }
    if (typeof action.type !== "string") {
      return false;
    }
    if (action.type === "talk") {
      return Array.isArray(action.speakers) && typeof action.text === "string";
    }
    if (action.type === "layout") {
      return (
        typeof action.layoutType === "string" &&
        Object.hasOwn(action, "characterId")
      );
    }
    return false;
  });
}

// 生成导出内容
function buildProjectExport(projectFile) {
  const copy = JSON.parse(JSON.stringify(projectFile));
  // characterStates 只是编辑时的临时缓存 不需要跟着导出
  copy.actions.forEach((action) => {
    delete action.characterStates;
  });
  return {
    content: JSON.stringify(copy, null, 2),
    filename: copy.projectName || `bestdori_project_${Date.now()}.json`,
  };
}

module.exports = {
  isProjectFile,
  buildProjectExport,
};
