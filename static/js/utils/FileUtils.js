// 管理浏览器里的文件操作
export const FileUtils = {
  // 延迟指定毫秒数
  delay(ms) {
    // 等指定时间后继续
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  // 触发浏览器下载（支持字符串和 Blob）
  downloadAsFile(data, filename, mimeType = "application/json") {
    const blob =
      data instanceof Blob ? data : new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  },
};
