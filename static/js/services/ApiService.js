// 前端调用后端接口
class ApiService {
  // 创建接口工具
  constructor() {
    // 先保存超时和默认请求头
    this.timeout = 30000;
    this.defaultHeaders = {
      "Content-Type": "application/json",
    };
  }

  // 请求 JSON 接口
  async fetchJson(url, config = {}) {
    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        ...config,
      });
      return response.data;
    } catch (error) {
      const errorMessage = this._handleError(error);
      console.error(`[ApiService] GET ${url} 失败:`, errorMessage);
      throw new Error(errorMessage);
    }
  }

  // 发 POST 请求
  async post(url, data = {}, config = {}) {
    const isFormData = data instanceof FormData;
    // FormData 交给浏览器自己带 boundary
    const requestHeaders = isFormData ? {} : this.defaultHeaders;

    try {
      const response = await axios.post(url, data, {
        timeout: this.timeout,
        // 合并请求头
        headers: { ...requestHeaders, ...config.headers },
        ...config,
      });
      return response.data;
    } catch (error) {
      const errorMessage = this._handleError(error);
      console.error(`[ApiService] POST ${url} 失败:`, errorMessage);
      throw new Error(errorMessage);
    }
  }

  // 把单文件上传统一收在这一层，避免每个接口都重复拼 FormData
  postFile(url, file, fieldName = "file") {
    const formData = new FormData();
    formData.append(fieldName, file);
    return this.post(url, formData);
  }

  // 导入配置文件
  importConfigFile(file) {
    return this.postFile("/api/config-import", file);
  }

  // 导出配置文件
  exportConfigFile(payload) {
    return this.post("/api/config-export", payload);
  }

  // 发送内容开始转换
  convertText(
    projectFile,
    quoteConfig = [],
    narratorName = " ",
    appendSpaces = 0,
    padBeforeNewline = 0,
  ) {
    return this.post("/api/convert", {
      projectFile,
      quoteConfig,
      narratorName,
      appendSpaces,
      appendSpacesBeforeNewline: padBeforeNewline,
    });
  }

  // 上传文本文件
  uploadFile(file) {
    return this.postFile("/api/upload", file);
  }

  // 导入一个待合并文件
  importMergeFile(file) {
    return this.postFile("/api/merge-file-import", file);
  }

  // 发送文件开始合并
  mergeFiles(files) {
    return this.post("/api/merge", { files });
  }

  // 导入项目进度文件
  importProjectFile(file) {
    return this.postFile("/api/project-file-import", file);
  }

  // 导出项目进度文件
  exportProjectFile(projectFile) {
    return this.post("/api/project-export", { projectFile });
  }

  // 下载结果文件
  async downloadResult(content, filename) {
    try {
      const response = await axios.post(
        "/api/download",
        { content, filename },
        {
          responseType: "blob",
          timeout: this.timeout,
        },
      );
      return response.data;
    } catch (error) {
      const errorMessage = this._handleError(error);
      console.error("[ApiService] 下载失败:", errorMessage);
      throw new Error(errorMessage);
    }
  }

  // 让后端关闭服务
  async shutdownServer() {
    try {
      await this.post("/api/shutdown", {}, { timeout: 1000 });
    } catch {
      console.warn("Shutdown request sent. Server is closing.");
    }
  }

  // 把 axios 报错整理成页面提示
  _handleError(error) {
    if (error.response) {
      // 后端返回错误
      const status = error.response.status;
      const message =
        error.response.data?.error || error.response.data?.message;

      // 只保留这个项目实际会用到的错误码提示
      switch (status) {
        case 400:
          return `请求错误: ${message || "参数有误"}`;
        case 404:
          return "请求的资源不存在";
        case 500:
          return `服务器错误: ${message || "请稍后重试"}`;
        case 503:
          return "服务暂时不可用";
        default:
          return message || `请求失败 (${status})`;
      }
    }

    if (error.request) {
      // 请求已发出 但没有响应
      return "网络连接失败，请检查网络";
    }

    // 请求在发出前就出错
    return error.message || "请求配置错误";
  }
}

// 导出一个全局接口工具
export const apiService = new ApiService();
