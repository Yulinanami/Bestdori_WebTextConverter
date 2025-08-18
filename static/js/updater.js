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
    button.innerHTML = '<span class="spinner"></span>正在检查...';
    try {
      const response = await axios.get("/api/check_update");
      const data = response.data;
      if (data.status === "up_to_date") {
        ui.showStatus(data.message, "success");
      } else if (data.status === "behind") {
        ui.showStatus(data.message, "info");
      } else {
        ui.showStatus(data.message, "warning");
      }
    } catch (error) {
      console.error("检查更新失败:", error);
      const errorMessage =
        error.response?.data?.message || "检查更新时发生网络错误或服务器错误。";
      ui.showStatus(errorMessage, "error");
    } finally {
      button.disabled = false;
      button.innerHTML = originalText;
    }
  }
}

export const updater = new Updater();
