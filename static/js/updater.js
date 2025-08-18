// updater.js - 检查更新模块

import { ui } from "./uiUtils.js";

class Updater {
  constructor() {
    this.checkUpdateBtn = null;
  }

  init() {
    this.checkUpdateBtn = document.getElementById("checkUpdateBtn");
    if (this.checkUpdateBtn) {
      this.checkUpdateBtn.addEventListener(
        "click",
        this.checkForUpdates.bind(this)
      );
    }
  }

  async checkForUpdates() {
    const button = this.checkUpdateBtn;
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span>正在更新...';
    try {
      const response = await axios.post("/api/update");
      const data = response.data;
      ui.showStatus(data.message, data.status === 'success' ? 'success' : 'info');
      if (data.status === "success") {
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      }
    } catch (error) {
      console.error("更新失败:", error);
      const errorMessage =
        error.response?.data?.message || "更新时发生网络错误或服务器错误。";
      ui.showStatus(errorMessage, "error");
    } finally {
      button.disabled = false;
      button.innerHTML = originalText;
    }
  }
}

export const updater = new Updater();
