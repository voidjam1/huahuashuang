class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.isHost = false;
        this.heartbeat = null;
    }

    createRoom() {
        this.isHost = true;
        this.peer = new Peer();
        
        // UI 更新：显示正在创建
        document.getElementById('lobby-btns').style.display = 'none';
        document.getElementById('room-info-display').style.display = 'block';

        this.peer.on('open', id => {
            document.getElementById('my-room-id').innerText = id;
            engine.appendMsg('system', 'System', `房号已生成: ${id}`, 'blue');
        });

        this.peer.on('connection', c => this.setupConnection(c));
    }

    joinRoom() {
        const id = document.getElementById('target-id').value.trim();
        if (!id) return alert("请输入房号");
        this.isHost = false;
        this.peer = new Peer();
        
        this.peer.on('open', () => {
            const c = this.peer.connect(id);
            this.setupConnection(c);
        });
    }

    setupConnection(conn) {
        this.conn = conn;
        
        this.conn.on('open', () => {
            // 关闭遮罩，进入游戏大厅
            document.getElementById('lobby-overlay').style.display = 'none';
            engine.appendMsg('system', 'System', '✅ 连接成功！', 'green');
            
            // 触发引擎的连接回调
            engine.onPlayerJoined(this.isHost);

            // 启动心跳
            this.heartbeat = setInterval(() => {
                if (this.conn.open) this.conn.send({ cat: 'heartbeat' });
            }, 3000);
        });

        this.conn.on('data', data => {
            if (data.cat === 'heartbeat') return;
            // 路由数据到引擎
            engine.handlePacket(data);
        });

        this.conn.on('close', () => {
            clearInterval(this.heartbeat);
            engine.appendMsg('system', 'System', '❌ 连接已断开', 'red');
            alert("对方已断线");
        });
    }

    send(data) {
        if (this.conn && this.conn.open) {
            this.conn.send(data);
        }
    }
}

const network = new NetworkManager();
