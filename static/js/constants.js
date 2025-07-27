// constants.js - 常量和共享状态管理

export const state = {
    currentResult: '',
    currentConfig: {},
    quotesConfig: {},
    customQuotes: [],
    batchFiles: [],
    batchResults: [],
    autoPreviewEnabled: true,
    previewDebounceTimer: null,
    enableLive2D: false,        // 新增：是否启用Live2D布局
    currentCostumes: {}         // 新增：当前服装配置
};

export const GRADIENTS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
];

export const FILE_EXTENSIONS = {
    TXT: '.txt',
    DOCX: '.docx',
    MD: '.md'
};

export const VALID_EXTENSIONS = [FILE_EXTENSIONS.TXT, FILE_EXTENSIONS.DOCX, FILE_EXTENSIONS.MD];