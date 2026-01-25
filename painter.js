/**
 * Gartic-Lite 画布核心插件
 * 功能：坐标校准、压力感应适配、路径管理、导出功能
 */
class DrawingBoard {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.color = options.color || '#6c5ce7';
        this.lineWidth = options.lineWidth || 5;
        
        this.init();
        this.bindEvents();
    }

    // 解决“坐标偏移”和“模糊”的核心：校准分辨率
    init() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        // 设置绘图基础属性
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }

    bindEvents() {
        const getPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: (e.clientX || e.touches?.[0].clientX) - rect.left,
                y: (e.clientY || e.touches?.[0].clientY) - rect.top
            };
        };

        const start = (e) => {
            this.isDrawing = true;
            const pos = getPos(e);
            this.ctx.beginPath();
            this.ctx.moveTo(pos.x, pos.y);
        };

        const move = (e) => {
            if (!this.isDrawing) return;
            const pos = getPos(e);
            this.ctx.strokeStyle = this.color;
            this.ctx.lineWidth = this.lineWidth;
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
            
            // 每次画完一小段立刻重连，保证笔触顺滑无断点
            this.ctx.beginPath();
            this.ctx.moveTo(pos.x, pos.y);
        };

        const stop = () => {
            this.isDrawing = false;
            this.ctx.closePath();
        };

        // 统一使用 Pointer Events 兼容所有设备
        this.canvas.addEventListener('pointerdown', start);
        this.canvas.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop);
        
        // 窗口大小改变时重置（可选，注意重置会清空画布）
        window.addEventListener('resize', () => this.init());
    }

    // 插件对外提供的 API 接口
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    setColor(newColor) { this.color = newColor; }
    
    setSize(newSize) { this.lineWidth = newSize; }

    // 导出画作为图片（Base64）
    save() {
        return this.canvas.toDataURL('image/png');
    }
}
