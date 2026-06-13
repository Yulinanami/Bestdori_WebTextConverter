// 从 <template> 标签惰性实例化 DOM 内容
//
// 特点：
//   - 首次调用时把 template 内容克隆并插入容器，后续调用直接跳过
//   - cloneNode 是同步操作，没有任何网络延迟
//   - 记录已初始化的模板，防止重复渲染

const instantiated = new Set();

export function instantiateTemplate(templateId, targetContainer) {
  if (instantiated.has(templateId)) return;

  const template = document.getElementById(templateId);
  if (!template) {
    console.warn(`模板 #${templateId} 不存在`);
    return;
  }

  targetContainer.appendChild(template.content.cloneNode(true));
  instantiated.add(templateId);
}
