// batchProcessor.js - 批量处理相关功能（修改版）

import { state, FILE_EXTENSIONS } from './constants.js';
import { ui } from './uiUtils.js';
import { quoteManager } from './quoteManager.js';

export const batchProcessor = {
    // 打开批量处理模态框
    openBatchModal() {
        document.getElementById('batchFileInput').value = '';
        const fileList = document.getElementById('batchFileList');
        if (fileList) fileList.innerHTML = '';

        const progressSection = document.getElementById('batchProgressSection');
        const logSection = document.getElementById('batchLogSection');
        const progressBar = document.getElementById('batchProgressBar');
        const statusText = document.getElementById('batchStatusText');
        
        progressSection.style.display = 'none';
        logSection.style.display = 'none';
        progressBar.style.width = '0%';
        statusText.textContent = '正在处理...';

        document.getElementById('downloadBatchResultBtn').style.display = 'none';
        const startBtn = document.getElementById('startBatchBtn');
        startBtn.style.display = 'inline-flex';
        startBtn.disabled = true;
        startBtn.innerHTML = '开始批量转换';

        const cancelBtn = document.querySelector('#batchConvertModal .btn-secondary[onclick*="batchConvertModal"]');
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';

        state.batchFiles = [];
        state.batchResults = [];
        
        ui.openModal('batchConvertModal');
    },

    // 更新批量文件列表
    updateBatchFileList() {
        const fileInput = document.getElementById('batchFileInput');
        const fileList = document.getElementById('batchFileList');
        fileList.innerHTML = '';
        state.batchFiles = Array.from(fileInput.files);
        
        if (state.batchFiles.length > 0) {
            state.batchFiles.forEach(file => {
                const li = document.createElement('li');
                const icon = file.name.endsWith(FILE_EXTENSIONS.DOCX) ? '📄' : 
                            file.name.endsWith(FILE_EXTENSIONS.MD) ? '📝' : '📃';
                li.textContent = `${icon} ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
                fileList.appendChild(li);
            });
            document.getElementById('startBatchBtn').disabled = false;
        } else {
            document.getElementById('startBatchBtn').disabled = true;
        }
    },

    // 开始批量转换（修改版）
    async startBatchConversion() {
        if (state.batchFiles.length === 0) {
            ui.showStatus('请先选择文件！', 'error');
            return;
        }

        const startBtn = document.getElementById('startBatchBtn');
        startBtn.disabled = true;
        startBtn.innerHTML = '<div class="loading"></div> 上传并准备中...';

        try {
            const filesData = await Promise.all(
                state.batchFiles.map(file => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        const filename = file.name.toLowerCase();
                        
                        // 根据文件类型选择读取方式
                        if (filename.endsWith(FILE_EXTENSIONS.DOCX)) {
                            reader.onload = () => resolve({ 
                                name: file.name, 
                                content: reader.result, 
                                encoding: 'base64' 
                            });
                            reader.readAsDataURL(file);
                        } else {
                            reader.onload = () => resolve({ 
                                name: file.name, 
                                content: reader.result, 
                                encoding: 'text' 
                            });
                            reader.readAsText(file);
                        }
                        reader.onerror = reject;
                    });
                })
            );

            startBtn.style.display = 'none';
            document.getElementById('batchProgressSection').style.display = 'block';
            document.getElementById('batchLogSection').style.display = 'block';
            document.getElementById('batchLogOutput').innerHTML = '';

            const narratorName = document.getElementById('narratorName').value || ' ';
            const selectedQuotePairs = quoteManager.getSelectedQuotes();

            const response = await axios.post('/api/batch_convert/start', {
                files: filesData,
                narrator_name: narratorName,
                selected_quote_pairs: selectedQuotePairs,
                character_mapping: state.currentConfig,      // 已有
                enable_live2d: state.enableLive2D,          // 新增：传递Live2D设置
                costume_mapping: state.currentCostumes      // 新增：传递服装映射
            });

            const { task_id } = response.data;
            if (task_id) {
                this.pollBatchStatus(task_id);
            } else {
                throw new Error("未能从服务器获取任务ID。");
            }
        } catch (error) {
            ui.showStatus(`启动批量处理失败: ${error.response?.data?.error || error.message}`, 'error');
            startBtn.disabled = false;
            startBtn.innerHTML = '开始批量转换';
            startBtn.style.display = 'inline-flex';
            document.getElementById('batchProgressSection').style.display = 'none';
            document.getElementById('batchLogSection').style.display = 'none';
        }
    },

    // 轮询批量处理状态
    pollBatchStatus(taskId) {
        const intervalId = setInterval(async () => {
            try {
                const response = await axios.get(`/api/batch_convert/status/${taskId}`);
                const data = response.data;

                document.getElementById('batchProgressBar').style.width = `${data.progress}%`;
                document.getElementById('batchStatusText').textContent = data.status_text;
                const logOutput = document.getElementById('batchLogOutput');
                logOutput.innerHTML = data.logs.join('<br>');
                logOutput.scrollTop = logOutput.scrollHeight;

                if (data.status === 'completed') {
                    clearInterval(intervalId);
                    
                    state.batchResults = data.results || [];
                    
                    if (state.batchResults.length > 0) {
                        document.getElementById('downloadBatchResultBtn').style.display = 'inline-flex';
                    }
                    
                    const cancelBtn = document.querySelector('#batchConvertModal .btn-secondary');
                    if (cancelBtn) cancelBtn.style.display = 'none';
                    
                    ui.showStatus('批量处理完成！', 'success');
                }
            } catch (error) {
                clearInterval(intervalId);
                document.getElementById('batchStatusText').textContent = '轮询状态失败，任务可能已在后台完成或中断。';
                ui.showStatus(`获取处理状态失败: ${error.message}`, 'error');
            }
        }, 1500);
    },

    // 处理批量下载
    handleBatchDownload() {
        if (state.batchResults.length === 0) {
            ui.showStatus('没有可下载的批量处理结果！', 'error');
            return;
        }

        const zip = new JSZip();
        
        state.batchResults.forEach(result => {
            zip.file(result.name, result.content);
        });

        zip.generateAsync({ type: "blob" })
            .then(function(content) {
                const filename = `batch_results_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.zip`;
                saveAs(content, filename);
                ui.showStatus('结果已打包下载！', 'success');
            })
            .catch(err => {
                ui.showStatus(`打包下载失败: ${err.message}`, 'error');
            });
    }
};