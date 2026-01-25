class DrawingBoard {
    constructor(canvasId, onDrawCallback) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.onDrawCallback = onDrawCallback; // 这里的回调会传给 network.js
        this.isDrawing = false;
        this.init();
    }

    init() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.canvas.addEventListener('pointerdown', e => this.start(e));
        this.canvas.addEventListener('pointermove', e => this.draw(e));
        window.addEventListener('pointerup', () => this.stop());
    }

    // --- 核心：坐标归一化 (发送百分比而非像素) ---
    start(e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x * rect.width, y * rect.height);

        if (this.onDrawCallback) 
            this.onDrawCallback({ type: 'start', x, y });
    }

    draw(e) {
        if (!this.isDrawing) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        this.ctx.strokeStyle = document.getElementById('colorPicker').value;
        this.ctx.lineWidth = document.getElementById('sizePicker').value;
        
        this.ctx.lineTo(x * rect.width, y * rect.height);
        this.ctx.stroke();

        if (this.onDrawCallback) 
            this.onDrawCallback({ type: 'draw', x, y, color: this.ctx.strokeStyle, width: this.ctx.lineWidth });
    }

    stop() { this.isDrawing = false; }

    // --- 核心：接收远程数据并还原像素 ---
    drawRemote(data) {
        const rect = this.canvas.getBoundingClientRect();
        const realX = data.x * rect.width;
        const realY = data.y * rect.height;

        if (data.type === 'start') {
            this.ctx.beginPath();
            this.ctx.moveTo(realX, realY);
        } else {
            this.ctx.strokeStyle = data.color;
            this.ctx.lineWidth = data.width;
            this.ctx.lineTo(realX, realY);
            this.ctx.stroke();
        }
    }

    clear(isRemote = false) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!isRemote && this.onDrawCallback) this.onDrawCallback({ type: 'clear' });
    }

    setLock(locked) {
        this.canvas.style.pointerEvents = locked ? 'none' : 'auto';
    }
}
