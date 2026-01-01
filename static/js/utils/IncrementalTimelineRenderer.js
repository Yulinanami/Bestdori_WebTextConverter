// 增量时间线渲染：缓存卡片 DOM，只更新变动的部分，避免整列表重画。

// 把 DocumentFragment/Element 统一转换成卡片元素
function normalizeCardElement(card) {
  if (!card) return null;
  if (card.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    return card.firstElementChild;
  }
  return card;
}

// 更新卡片上的序号（#1/#2/...）
function updateSequenceNumber(cardEl, index) {
  const numberDiv = cardEl?.querySelector(".card-sequence-number");
  if (numberDiv) {
    numberDiv.textContent = `#${index + 1}`;
  }
}

// 清理缓存：把已经不存在的卡片节点删掉
function removeStaleNodes(cache, validIds) {
  for (const [id, node] of cache.nodesById.entries()) {
    if (!validIds.has(id)) {
      node?.remove();
      cache.nodesById.delete(id);
      cache.signatures.delete(id);
    }
  }
}

// 获取某条 action 对应的卡片：能复用就复用，不能就重新渲染
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

// 创建一个“分组标题”节点（点击可展开/收起）
function createGroupHeader({ start, end, index, isActive, onClick }) {
  const header = document.createElement("div");
  header.className = "timeline-group-header";
  header.dataset.groupIdx = index;
  header.style.cursor = "pointer";
  header.style.padding = "12px 18px";
  header.style.background = "var(--bg-secondary)";
  header.style.border = "1px solid var(--border-primary)";
  header.style.borderRadius = "var(--radius-lg)";
  header.style.marginBottom = "15px";
  header.style.fontWeight = "600";
  header.style.transition = "all 0.2s ease";
  header.textContent = `${isActive ? "▼" : "▶"} 对话 ${start} - ${end} (${
    end - start + 1
  }条)`;

  if (isActive) {
    header.classList.add("active");
    header.style.background = "var(--group-header-active-bg, #ebf8ff)";
    header.style.borderColor = "var(--group-header-active-border, #90cdf4)";
  }

  if (typeof onClick === "function") {
    header.addEventListener("click", () => onClick(index));
  }

  return header;
}

// 创建时间线渲染缓存（节点 Map + 签名 Map）
export function createTimelineRenderCache() {
  return {
    nodesById: new Map(),
    signatures: new Map(),
    contextSignature: null,
  };
}

// 增量渲染时间线（支持分组模式：只渲染当前展开的一组）
export function renderIncrementalTimeline({
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

  // 上下文发生变化时强制刷新卡片内容
  if (cache.contextSignature !== contextSignature) {
    cache.signatures.clear();
    cache.contextSignature = contextSignature;
  }

  const validIds = new Set(actions.map((a) => a.id));
  removeStaleNodes(cache, validIds);

  const preserveScrollTop = container.scrollTop;
  const shouldGroup = groupingEnabled && actions.length > groupSize;

  if (!shouldGroup) {
    const nodes = actions
      .map((action, idx) =>
        ensureCard({
          action,
          index: idx,
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

  for (let i = 0; i < numGroups; i++) {
    const startNum = i * groupSize + 1;
    const endNum = Math.min((i + 1) * groupSize, total);
    const header = createGroupHeader({
      start: startNum,
      end: endNum,
      index: i,
      isActive: i === activeGroupIndex,
      onClick: onGroupToggle,
    });
    fragment.appendChild(header);

    if (i === activeGroupIndex) {
      for (let idx = startNum - 1; idx < endNum; idx++) {
        const card = ensureCard({
          action: actions[idx],
          index: idx,
          renderCard,
          cache,
          signatureResolver,
          updateCard,
        });
        if (card) {
          fragment.appendChild(card);
        }
      }
    }
  }

  container.replaceChildren(fragment);
  container.scrollTop = preserveScrollTop;
}
