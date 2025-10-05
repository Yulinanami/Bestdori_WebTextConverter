/**
 * ApiService - 统一的 HTTP 请求服务
 * 封装 axios 调用，提供统一的错误处理和请求配置
 */

class ApiService {
  constructor() {
    this.baseURL = "";
    this.timeout = 30000; // 30秒超时
    this.defaultHeaders = {
      "Content-Type": "application/json",
    };
  }

  /**
   * 处理 API 错误
   * @param {Error} error - axios 错误对象
   * @returns {string} 错误消息
   */
  _handleError(error) {
    if (error.response) {
      // 服务器返回错误状态码
      const status = error.response.status;
      const message = error.response.data?.error || error.response.data?.message;

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

  /**
   * 通用 GET 请求
   * @param {string} url - 请求路径
   * @param {object} config - axios 配置
   * @returns {Promise<any>} 响应数据
   */
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

  /**
   * 通用 POST 请求
   * @param {string} url - 请求路径
   * @param {any} data - 请求数据
   * @param {object} config - axios 配置
   * @returns {Promise<any>} 响应数据
   */
  async post(url, data = {}, config = {}) {
    try {
      const response = await axios.post(url, data, {
        timeout: this.timeout,
        headers: this.defaultHeaders,
        ...config,
      });
      return response.data;
    } catch (error) {
      const errorMsg = this._handleError(error);
      console.error(`[ApiService] POST ${url} 失败:`, errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * 通用 PUT 请求
   * @param {string} url - 请求路径
   * @param {any} data - 请求数据
   * @param {object} config - axios 配置
   * @returns {Promise<any>} 响应数据
   */
  async put(url, data = {}, config = {}) {
    try {
      const response = await axios.put(url, data, {
        timeout: this.timeout,
        headers: this.defaultHeaders,
        ...config,
      });
      return response.data;
    } catch (error) {
      const errorMsg = this._handleError(error);
      console.error(`[ApiService] PUT ${url} 失败:`, errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * 通用 DELETE 请求
   * @param {string} url - 请求路径
   * @param {object} config - axios 配置
   * @returns {Promise<any>} 响应数据
   */
  async delete(url, config = {}) {
    try {
      const response = await axios.delete(url, {
        timeout: this.timeout,
        ...config,
      });
      return response.data;
    } catch (error) {
      const errorMsg = this._handleError(error);
      console.error(`[ApiService] DELETE ${url} 失败:`, errorMsg);
      throw new Error(errorMsg);
    }
  }

  // ==================== 业务相关 API ====================

  /**
   * 获取配置
   * @returns {Promise<object>} 配置数据
   */
  async getConfig() {
    return await this.get("/api/config");
  }

  /**
   * 获取服装配置
   * @returns {Promise<object>} 服装配置数据
   */
  async getCostumes() {
    return await this.get("/api/costumes");
  }

  /**
   * 转换文本
   * @param {object} projectFile - 项目文件
   * @param {Array} quoteConfig - 引号配置
   * @param {string} narratorName - 旁白名称
   * @returns {Promise<object>} 转换结果
   */
  async convertText(projectFile, quoteConfig = [], narratorName = " ") {
    return await this.post("/api/convert", {
      projectFile,
      quoteConfig,
      narratorName,
    });
  }

  /**
   * 上传文件
   * @param {File} file - 文件对象
   * @returns {Promise<object>} 上传结果
   */
  async uploadFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    return await this.post("/api/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  }

  /**
   * 下载结果
   * @param {string} content - 内容
   * @param {string} filename - 文件名
   * @returns {Promise<Blob>} 文件 Blob
   */
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

  /**
   * 批量转换
   * @param {Array} files - 文件列表
   * @param {Array} quoteConfig - 引号配置
   * @param {string} narratorName - 旁白名称
   * @returns {Promise<object>} 批量转换结果
   */
  async batchConvert(files, quoteConfig = [], narratorName = " ") {
    return await this.post("/api/batch-convert", {
      files,
      quoteConfig,
      narratorName,
    });
  }
}

// 导出单例
export const apiService = new ApiService();
