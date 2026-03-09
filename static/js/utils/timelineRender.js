import { updateGroupHeader } from "@editors/common/groupHeaderUtils.js";

// 时间线列表的增量刷新

// 把节点转成卡片元素
function normalizeCardElement(cardNode) {
  if (!cardNode) return null;
  if (cardNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    return cardNode.firstElementChild;
  }
  return cardNode;
}

// 更新卡片序号
function updateSequenceNumber(cardEl, index) {
  if (cardEl) {
    cardEl.dataset.actionIndex = String(index);
  }
  const numberDiv = cardEl?.querySelector(".card-sequence-number");
  if (numberDiv) {
    numberDiv.textContent = `#${index + 1}`;
  }
}

// 删掉已经没用的缓存卡片
function removeStaleNodes(cache, validIds) {
  for (const [id, node] of cache.nodesById.entries()) {
    if (!validIds.has(id)) {
      node?.remove();
      cache.nodesById.delete(id);
      cache.signatures.delete(id);
    }
  }
}

// 拿到一张可用的卡片
function ensureCard({
  action,
  index,
  renderCard,
  cache,
  signatureResolver,
  updateCard,
}) {
  const signature =
    typeof signatureResolver === "function"
      ? signatureResolver(action)
      : JSON.stringify(action);
  const cachedSignature = cache.signatures.get(action.id);
  let cardEl = cache.nodesById.get(action.id);

  // 签名变了才更新或重建卡片
  if (!cardEl || cachedSignature !== signature) {
    let updated = false;
    if (cardEl && typeof updateCard === "function") {
      updated = updateCard(action, cardEl, index) === true;
    }

    if (!updated) {
      const rendered = normalizeCardElement(renderCard(action, index));
      if (!rendered) return null;

      cache.nodesById.set(action.id, rendered);
      cardEl = rendered;
    }

    cache.signatures.set(action.id, signature);
  } else {
    cache.signatures.set(action.id, signature);
  }

  updateSequenceNumber(cardEl, index);
  return cardEl;
}

// 创建分组标题
function createGroupHeader({ start, end, index, isActive, onClick }) {
  const header = document.createElement("div");
  updateGroupHeader(header, {
    groupIndex: index,
    isActive,
    startNum: start,
    endNum: end,
    onToggle: typeof onClick === "function" ? onClick : null,
  });
  return header;
}

// 创建时间线缓存
export function createCache() {
  return {
    nodesById: new Map(),
    signatures: new Map(),
    contextSignature: null,
  };
}

// 清空时间线缓存
export function clearCache(cache) {
  if (!cache) return;
  cache.nodesById.clear();
  cache.signatures.clear();
  cache.contextSignature = null;
}

// 按变化刷新时间线
export function renderFast({
  container,
  actions = [],
  renderCard,
  cache,
  updateCard,
  groupingEnabled = false,
  groupSize = 50,
  activeGroupIndex = null,
  onGroupToggle,
  contextSignature = "",
  signatureResolver,
}) {
  if (!container || typeof renderCard !== "function" || !cache) return;

  // 上下文变了就重新比对卡片
  if (cache.contextSignature !== contextSignature) {
    cache.signatures.clear();
    cache.contextSignature = contextSignature;
  }

  const validIds = new Set(actions.map((actionItem) => actionItem.id));
  removeStaleNodes(cache, validIds);

  const preserveScrollTop = container.scrollTop;
  const shouldGroup = groupingEnabled && actions.length > groupSize;

  // 非分组时直接平铺所有卡片
  if (!shouldGroup) {
    const nodes = actions
      .map((action, actionIndex) =>
        ensureCard({
          action,
          index: actionIndex,
          renderCard,
          cache,
          signatureResolver,
          updateCard,
        })
      )
      .filter(Boolean);

    container.replaceChildren(...nodes);
    container.scrollTop = preserveScrollTop;
    return;
  }

  const fragment = document.createDocumentFragment();
  const total = actions.length;
  const numGroups = Math.ceil(total / groupSize);

  // 分组时先建组头 只给当前展开组放卡片
  for (let groupIndex = 0; groupIndex < numGroups; groupIndex++) {
    const startNum = groupIndex * groupSize + 1;
    const endNum = Math.min((groupIndex + 1) * groupSize, total);
    const header = createGroupHeader({
      start: startNum,
      end: endNum,
      index: groupIndex,
      isActive: groupIndex === activeGroupIndex,
      onClick: onGroupToggle,
    });
    fragment.appendChild(header);

    if (groupIndex === activeGroupIndex) {
      for (
        let actionIndex = startNum - 1;
        actionIndex < endNum;
        actionIndex++
      ) {
        const cardElement = ensureCard({
          action: actions[actionIndex],
          index: actionIndex,
          renderCard,
          cache,
          signatureResolver,
          updateCard,
        });
        if (cardElement) {
          fragment.appendChild(cardElement);
        }
      }
    }
  }

  container.replaceChildren(fragment);
  container.scrollTop = preserveScrollTop;
}
