class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.isHost = false;
        this.myId = null;
    }

    // 1. 创建房间 (房主逻辑)
    createRoom() {
        this.isHost = true;
        this.peer = new Peer(); // 自动生成 ID
        
        this.peer.on('open', (id) => {
            this.myId = id;
            document.getElementById('my-room-id').innerText = id;
            document.getElementById('room-id-display').style.display = 'block';
            document.getElementById('waiting-msg').style.display = 'block';
            document.getElementById('join-panel').style.display = 'none';
        });

        // 等待别人连接
        this.peer.on('connection', (conn) => {
            this.conn = conn;
            this.setupConnection();
            alert("🎉 玩家已连接！游戏即将开始！");
            document.getElementById('lobby-overlay').style.display = 'none';
            // 房主只有连接成功后才能控制游戏
            engine.startGame(); 
        });
    }

    // 2. 加入房间 (玩家逻辑)
    joinRoom() {
        const targetId = document.getElementById('target-id').value.trim();
        if (!targetId) return alert("请输入房间号");
        
        this.isHost = false;
        this.peer = new Peer();
        
        this.peer.on('open', () => {
            this.conn = this.peer.connect(targetId);
            this.setupConnection();
        });
    }

    // 3. 通用：连接建立后的处理
    setupConnection() {
        // 接收数据
        this.conn.on('data', (data) => {
            this.handleData(data);
        });

        this.conn.on('open', () => {
            console.log("连接成功!");
            if (!this.isHost) {
                document.getElementById('lobby-overlay').style.display = 'none';
                document.getElementById('word-display').innerText = "等待房主选题...";
                // 玩家只能看，不能画 (锁定画布)
                board.setLock(true);
            }
        });
    }

    // 4. 发送数据 (封装)
    send(data) {
        if (this.conn && this.conn.open) {
            this.conn.send(data);
        }
    }

    // 5. 路由：收到数据后分发给不同模块
    handleData(data) {
        // 同步绘画
        if (data.cat === 'paint') {
            board.drawRemote(data);
        } 
        // 同步游戏状态 (房主 -> 玩家)
        else if (data.cat === 'game') {
            if (data.type === 'start') {
                document.getElementById('word-display').innerText = "题目: ??? (猜猜看)";
                document.getElementById('timer').innerText = "正在作画";
                engine.appendMsg('system', '🔔 游戏开始！请看画猜词！', 'blue');
            } else if (data.type === 'end') {
                engine.appendMsg('system', `❌ 游戏结束，答案是：${data.ans}`, 'red');
            } else if (data.type === 'win') {
                engine.appendMsg('system', `🏆 恭喜对方猜中了！答案：${data.ans}`, 'green');
            }
        }
        // 同步聊天/猜词
        else if (data.cat === 'chat') {
            engine.appendMsg(data.type, '对方', data.msg);
            // 如果我是房主，我要负责判断对方猜得对不对
            if (this.isHost && data.type === 'guess') {
                engine.checkAnswer(data.msg);
            }
        }
    }
}

const network = new NetworkManager();
