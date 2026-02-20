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
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsText(file);
    });
  },

  downloadAsFile(data, filename, mimeType = "application/json") {
    const blob =
      data instanceof Blob ? data : new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
