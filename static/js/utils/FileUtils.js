// 文件操作工具：封装浏览器端文件操作的通用逻辑
export const FileUtils = {
  // 延迟指定毫秒数
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  // 以 Promise 方式读取文件为文本
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (loadEvent) => resolve(loadEvent.target.result);
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsText(file);
    });
  },

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
