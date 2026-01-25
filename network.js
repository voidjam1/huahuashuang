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
        // 1. 显示 ID
        document.getElementById('my-room-id').innerText = id;
        document.getElementById('room-id-display').style.display = 'block';
        
        // 2. 自动显示主界面（房主传送门）
        setTimeout(() => {
            document.getElementById('lobby-overlay').style.display = 'none';
            // 在主界面上方显示房号
            document.getElementById('word-display').innerText = "等待玩家加入...";
            console.log("房主传送成功！房号:", id);
        }, 1000); // 留1秒给房主看一眼 ID
    });

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
