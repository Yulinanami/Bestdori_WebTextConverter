// 项目文件校验与导出

// 校验对象是否为可识别的项目文件结构。
function isProjectFile(projectFile) {
  if (!projectFile || !Array.isArray(projectFile.actions)) {
    return false;
  }
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

// 导出项目文件并去掉运行态字段 characterStates。
function buildProjectExport(projectFile) {
  const copy = JSON.parse(JSON.stringify(projectFile));
  copy.actions.forEach((action) => {
    delete action.characterStates;
  });
  const content = JSON.stringify(copy, null, 2);
  const filename = copy.projectName || `bestdori_project_${Date.now()}.json`;
  return { content, filename };
}

module.exports = {
  isProjectFile,
  buildProjectExport,
};
