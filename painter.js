class DrawingBoard {
    constructor(canvasId, callback) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.callback = callback;
        this.isDrawing = false;
        this.init();
    }

    init() {
        const resize = () => {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
        };
        window.addEventListener('resize', resize);
        resize();

        this.canvas.addEventListener('pointerdown', e => this.start(e));
        this.canvas.addEventListener('pointermove', e => this.draw(e));
        window.addEventListener('pointerup', () => this.stop());
    }

    start(e) {
        this.isDrawing = true;
        const x = e.offsetX / this.canvas.width;
        const y = e.offsetY / this.canvas.height;
        this.ctx.beginPath();
        this.ctx.moveTo(e.offsetX, e.offsetY);
        if (this.callback) this.callback({ type: 'start', x, y });
    }

    draw(e) {
        if (!this.isDrawing) return;
        const x = e.offsetX / this.canvas.width;
        const y = e.offsetY / this.canvas.height;
        this.ctx.strokeStyle = document.getElementById('colorPicker').value;
        this.ctx.lineWidth = document.getElementById('sizePicker').value;
        this.ctx.lineTo(e.offsetX, e.offsetY);
        this.ctx.stroke();
        if (this.callback) this.callback({ type: 'draw', x, y, color: this.ctx.strokeStyle, width: this.ctx.lineWidth });
    }

    stop() { this.isDrawing = false; }

    drawRemote(data) {
    // 关键点：将 0-1 的比例还原为对方屏幕的实际像素
    const x = data.x * this.canvas.width;
    const y = data.y * this.canvas.height;

    if (data.type === 'start') {
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
    } else if (data.type === 'draw') {
        this.ctx.strokeStyle = data.color || '#000';
        this.ctx.lineWidth = data.width || 5;
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
    } else if (data.clear) {
        this.clear(true);
    }
}

    clear(remote = false) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!remote && this.callback) this.callback({ type: 'start', x:0, y:0, clear: true }); // 模拟清除信号
    }

    setLock(locked) {
        this.canvas.style.pointerEvents = locked ? 'none' : 'auto';
    }
}
