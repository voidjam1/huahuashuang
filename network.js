class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.isHost = false;
    }

 createRoom() {
    this.isHost = true;
    this.peer = new Peer();
    
    this.peer.on('open', id => {
        const idDisplay = document.getElementById('my-room-id');
        idDisplay.innerText = id;
        document.getElementById('room-id-display').style.display = 'block';
        
        // --- 核心改动：一键复制逻辑 ---
        idDisplay.style.cursor = "pointer";
        idDisplay.title = "点击复制房号";
        idDisplay.onclick = () => {
            navigator.clipboard.writeText(id).then(() => {
                const originalText = idDisplay.innerText;
                idDisplay.innerText = "✅ 已复制！";
                setTimeout(() => idDisplay.innerText = originalText, 2000);
            });
        };

        // 自动传送房主
        setTimeout(() => {
            document.getElementById('lobby-overlay').style.display = 'none';
            document.getElementById('word-display').innerText = "等待玩家加入...";
            // 在主界面也显示一个可以点击复制的房号
            engine.appendMsg('system', `房号已生成：${id} (点击上方可复制)`, 'blue');
        }, 1500);
    });

    this.peer.on('connection', c => {
        this.conn = c;
        this.setup();
        engine.appendMsg('system', '👥 玩家已加入！', 'green');
    });
}

    this.peer.on('connection', c => {
        this.conn = c;
        this.setup();
        // 玩家进来时，发个系统广播
        engine.appendMsg('system', '✅ 玩家已加入，房主可以点“开始游戏”了', 'green');
    });
}

    this.peer.on('connection', c => {
        this.conn = c;
        this.setup();
        // 玩家进来时，发个系统广播
        setTimeout(() => {
            engine.appendMsg('system', '👥 好友已进入房间！', 'green');
        }, 500);
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
            if (this.isHost) {
                engine.appendMsg('system', '✅ 玩家已连接！请点击开始按钮', 'green');
            }
        });
        this.conn.on('data', data => this.handle(data));
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
