// 把后端接口封装
class ApiService {
  constructor() {
    // 初始化：设置接口前缀、超时和默认请求头
    this.baseURL = "";
    this.timeout = 30000;
    this.defaultHeaders = {
      "Content-Type": "application/json",
    };
  }

  // 把 axios 的报错“翻译”成用户能看懂的提示文字
  _handleError(error) {
    if (error.response) {
      // 服务器返回错误状态码
      const status = error.response.status;
      const message =
        error.response.data?.error || error.response.data?.message;

      switch (status) {
        case 400:
          return `请求错误: ${message || "参数有误"}`;
        case 401:
          return "未授权，请重新登录";
        case 403:
          return "拒绝访问";
        case 404:
          return "请求的资源不存在";
        case 500:
          return `服务器错误: ${message || "请稍后重试"}`;
        case 503:
          return "服务暂时不可用";
        default:
          return message || `请求失败 (${status})`;
      }
    } else if (error.request) {
      // 请求已发送但未收到响应
      return "网络连接失败，请检查网络";
    } else {
      // 请求配置错误
      return error.message || "请求配置错误";
    }
  }

  // 发起 GET 请求，并直接返回后端 JSON 数据
  async get(url, config = {}) {
    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        ...config,
      });
      return response.data;
    } catch (error) {
      const errorMsg = this._handleError(error);
      console.error(`[ApiService] GET ${url} 失败:`, errorMsg);
      throw new Error(errorMsg);
    }
  }

  // 发起 POST 请求：支持 JSON 或 FormData（上传文件时用）
  async post(url, data = {}, config = {}) {
    const isFormData = data instanceof FormData;
    const requestHeaders = isFormData ? {} : this.defaultHeaders;

    try {
      const response = await axios.post(url, data, {
        timeout: this.timeout,
        // 合并请求头，允许 config 中的 headers 覆盖默认值
        headers: { ...requestHeaders, ...config.headers },
        ...config,
      });
      return response.data;
    } catch (error) {
      const errorMsg = this._handleError(error);
      console.error(`[ApiService] POST ${url} 失败:`, errorMsg);
      throw new Error(errorMsg);
    }
  }

  // ==================== 业务 API ====================

  // 获取后端提供的默认配置（角色映射、引号、动作表情等）
  async getConfig() {
    return await this.get("/api/config");
  }

  // 获取后端提供的服装配置（可用服装 + 默认服装）
  async getCostumes() {
    return await this.get("/api/costumes");
  }

  // 把“项目文件(projectFile)”转换成 Bestdori 可导入的 JSON 字符串
  async convertText(
    projectFile,
    quoteConfig = [],
    narratorName = " ",
    appendSpaces = 0,
    appendSpacesBeforeNewline = 0
  ) {
    return await this.post("/api/convert", {
      projectFile,
      quoteConfig,
      narratorName,
      appendSpaces,
      appendSpacesBeforeNewline,
    });
  }

  // 上传剧本文件（txt/docx/md），让后端解析成纯文本
  async uploadFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    // 不设置Content-Type,让浏览器自动添加boundary
    return await this.post("/api/upload", formData);
  }

  // 让后端生成一个可下载的 JSON 文件（返回 blob）
  async downloadResult(content, filename) {
    try {
      const response = await axios.post(
        "/api/download",
        { content, filename },
        {
          responseType: "blob",
          timeout: this.timeout,
        }
      );
      return response.data;
    } catch (error) {
      const errorMsg = this._handleError(error);
      console.error("[ApiService] 下载失败:", errorMsg);
      throw new Error(errorMsg);
    }
  }

  // 请求后端关闭本地服务器（桌面打包版会用到）
  async shutdownServer() {
    try {
      await this.post("/api/shutdown", {}, { timeout: 1000 });
    } catch (error) {
      console.warn("Shutdown request sent. Server is closing.");
    }
  }
}

// 导出一个全局单例（全站共用同一套 API 调用）
export const apiService = new ApiService();
