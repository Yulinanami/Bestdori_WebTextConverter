// fileHandler.js - 文件处理相关功能

import { state, VALID_EXTENSIONS, FILE_EXTENSIONS } from './constants.js';
import { ui } from './uiUtils.js';

export const fileHandler = {
    // 设置文件拖拽功能
    setupFileDragDrop() {
        const fileUpload = document.getElementById('fileUpload');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            fileUpload.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            fileUpload.addEventListener(eventName, () => fileUpload.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            fileUpload.addEventListener(eventName, () => fileUpload.classList.remove('dragover'), false);
        });

        fileUpload.addEventListener('drop', this.handleDrop.bind(this), false);
    },

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    },

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            document.getElementById('fileInput').files = files;
            this.handleFileUpload({ target: { files: files } });
        }
    },

    // 处理文件上传
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const filename = file.name.toLowerCase();
        const isValidFile = VALID_EXTENSIONS.some(ext => filename.endsWith(ext));

        if (!isValidFile) {
            ui.showStatus('只支持 .txt, .docx, .md 文件！', 'error');
            return;
        }

        // 显示上传区域的加载状态
        const fileUploadLabel = document.querySelector('.file-upload-label');
        const originalContent = fileUploadLabel.innerHTML;
        fileUploadLabel.innerHTML = `
            <div>
                <div class="loading" style="margin: 0 auto 10px; font-size: 2rem;"></div>
                <div style="font-weight: 600;">正在上传文件...</div>
                <div style="font-size: 0.9rem; color: #718096;">请稍候</div>
            </div>
        `;

        const formData = new FormData();
        formData.append('file', file);

        try {
            ui.showProgress(20);
            ui.showStatus('正在上传文件...', 'info');

            const response = await axios.post('/api/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            ui.showProgress(100);
            document.getElementById('inputText').value = response.data.content;
            document.getElementById('splitInputText').value = response.data.content;
            ui.showStatus('文件上传成功！', 'success');
            
            setTimeout(() => ui.hideProgress(), 1000);
        } catch (error) {
            ui.showStatus(`文件上传失败: ${error.response?.data?.error || error.message}`, 'error');
            ui.hideProgress();
        } finally {
            // 恢复上传区域的原始内容
            fileUploadLabel.innerHTML = originalContent;
            // 清空文件输入，允许重复上传同一文件
            document.getElementById('fileInput').value = '';
        }
    },

    // 下载结果
    async downloadResult() {
        if (!state.currentResult) {
            ui.showStatus('没有可下载的结果！', 'error');
            return;
        }

        await ui.withButtonLoading('downloadBtn', async () => {
            const filename = `result_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.json`;
            
            try {
                const response = await axios.post('/api/download', {
                    content: state.currentResult,
                    filename: filename
                }, {
                    responseType: 'blob'
                });

                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                
                ui.showStatus('文件下载成功！', 'success');
            } catch (error) {
                ui.showStatus(`下载失败: ${error.response?.data?.error || error.message}`, 'error');
            }
        }, '下载中...');
    },

    // 下载分屏结果
    async downloadSplitResult() {
        if (!state.currentResult) {
            ui.showStatus('没有可下载的结果！', 'error');
            return;
        }
        
        await ui.withButtonLoading('splitDownloadBtn', async () => {
            const filename = `result_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.json`;
            
            try {
                const response = await axios.post('/api/download', {
                    content: state.currentResult,
                    filename: filename
                }, {
                    responseType: 'blob'
                });

                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                
                ui.showStatus('文件下载成功！', 'success');
            } catch (error) {
                ui.showStatus(`下载失败: ${error.response?.data?.error || error.message}`, 'error');
            }
        }, '下载中...');
    }
};