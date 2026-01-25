class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.isHost = false;
    }

    createRoom() {
        this.isHost = true;
        this.peer = new Peer(); // 创建 Peer 实例
        
        this.peer.on('open', id => {
            // 1. 显示 ID
            const idSpan = document.getElementById('my-room-id');
            if (idSpan) idSpan.innerText = id;
            document.getElementById('room-id-display').style.display = 'block';
            
            // 2. 房主传送：1.5秒后自动进入房间
            setTimeout(() => {
                document.getElementById('lobby-overlay').style.display = 'none'; 
                document.getElementById('word-display').innerText = "等待好友加入...";
                engine.appendMsg('system', `房号已生成：${id} (点上方复制)`, 'blue');
            }, 1500);
        });

        // 核心改动：只需要一个监听连接的地方
        this.peer.on('connection', c => {
            this.conn = c;
            this.setup();
            engine.appendMsg('system', '✅ 好友已上线！可以开始游戏了', 'green');
        });
    }

    joinRoom() {
        const id = document.getElementById('target-id').value.trim();
        if (!id) return alert("请输入房号");
        this.isHost = false;
        this.peer = new Peer();
        this.peer.on('open', () => {
            this.conn = this.peer.connect(id);
            this.setup();
        });
    }

    setup() {
    this.conn.on('open', () => {
        document.getElementById('lobby-overlay').style.display = 'none';
        
        // 开启心跳保活
        if (this.heartbeat) clearInterval(this.heartbeat);
        this.heartbeat = setInterval(() => {
            if (this.conn && this.conn.open) {
                this.conn.send({ cat: 'heartbeat' });
            }
        }, 3000); // 每3秒发一次，保持链路活跃

        engine.appendMsg('system', '🎮', '连接已稳固，准备开始！', 'green');
    });

    this.conn.on('data', data => {
        if (data.cat === 'heartbeat') return; // 过滤心跳包
        this.handle(data);
    });

    this.conn.on('close', () => {
        clearInterval(this.heartbeat);
        engine.appendMsg('system', '⚠️', '连接丢失，正尝试重连...', 'red');
        // 房主不重连，客人尝试重新 connect 房主 ID
    });
}
    });

    this.conn.on('close', () => {
        engine.appendMsg('system', '❌ 连接已断开，请刷新页面重试', 'red');
        clearInterval(this.heartbeat);
    });

    this.conn.on('data', data => {
        if (data.cat === 'heartbeat') return; // 忽略心跳数据
        this.handle(data);
    });
}

    send(data) {
        if (this.conn && this.conn.open) this.conn.send(data);
    }

    handle(data) {
        if (data.cat === 'paint') board.drawRemote(data);
        else if (data.cat === 'chat') engine.appendMsg(data.type, '对方', data.msg);
        else if (data.cat === 'game') {
            if (data.type === 'newRound') engine.handleNewRound(data);
            if (data.type === 'win') engine.handleGameOver(true, '对方');
            if (data.type === 'tick') document.getElementById('timer').innerText = `⏱️ ${data.time}s`;
        }
    }
}
const network = new NetworkManager();
