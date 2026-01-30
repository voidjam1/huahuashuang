class NetworkManager {
    constructor() {
        this.client = null;
        this.roomID = null;
        this.isHost = false;
        this.myNickname = "";
    }

    // 显示大厅错误信息
    showError(msg) {
        document.getElementById('lobby-status').innerText = msg;
    }

    // 切换到游戏视图
    switchToGameView() {
        document.getElementById('view-lobby').style.display = 'none';
        document.getElementById('view-game').style.display = 'grid';
        document.getElementById('display-room-id').innerText = this.roomID;
        
        // 视图可见后，必须重新校准 canvas 尺寸
        setTimeout(() => board.resize(), 100);
    }

    connectToCloud(roomId, isHost) {
        const nameInput = document.getElementById('lobby-nickname').value.trim();
        if (!nameInput) {
            return this.showError("⚠️ 请先给自己起个名字！");
        }

        this.isHost = isHost;
        this.roomID = roomId;
        this.myNickname = nameInput;
        engine.setSelfName(this.myNickname);

        this.showError("⏳ 正在连接全球服务器...");

        const options = {
            clean: true,
            connectTimeout: 5000,
            keepalive: 30,
            reconnectPeriod: 2000,
            clientId: 'gartic_' + Math.random().toString(16).substr(2, 8)
        };

        // 使用支持 WSS 的公共 MQTT 服务器
        this.client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', options);

        this.client.on('connect', () => {
            console.log('✅ MQTT 连接成功');
            const topic = `gartic_pro/room/${this.roomID}`;
            
            this.client.subscribe(topic, { qos: 1 }, (err) => {
                if (!err) {
                    // 连接成功且订阅成功 -> 切换界面
                    this.switchToGameView();
                    
                    // 只有房主能看到“开始游戏”按钮
                    if (this.isHost) {
                        document.getElementById('btn-start-game').style.display = 'block';
                    }
                    
                    // 发送握手
                    this.send({ cat: 'handshake', name: this.myNickname });
                    engine.appendMsg('chat-list', '系统', `已加入房间: ${this.roomID}`, '#00b894');
                } else {
                    this.showError("❌ 订阅房间失败，请重试");
                }
            });
        });

        this.client.on('message', (topic, payload) => {
            let data;
            try { data = JSON.parse(payload.toString()); } catch (e) { return; }
            if (data._from === this.client.options.clientId) return;

            if (data.cat === 'handshake') {
                engine.setOpponentName(data.name);
                engine.appendMsg('chat-list', '系统', `👋 ${data.name} 进入了房间`, '#6c5ce7');
                
                // 如果是第一次打招呼，我也要回礼，告诉他我的名字
                if (data.isFirstHello) { 
                    this.send({ cat: 'handshake', name: this.myNickname, isFirstHello: false });
                }
            } else {
                engine.handlePacket(data);
            }
        });

        this.client.on('error', (err) => {
            console.error(err);
            this.showError("❌ 连接中断，正在重连...");
        });
        
        this.client.on('offline', () => {
            this.showError("📡 网络不稳定...");
        });
    }

    createRoom() {
        const randomID = Math.floor(100000 + Math.random() * 900000).toString();
        this.connectToCloud(randomID, true);
    }

    joinRoom() {
        const id = document.getElementById('lobby-roomid').value.trim();
        if (!id || id.length !== 6) {
            return this.showError("⚠️ 请输入正确的 6 位房号");
        }
        this.connectToCloud(id, false);
    }

    send(data) {
        if (this.client && this.client.connected) {
            if (data.cat === 'handshake' && data.isFirstHello === undefined) {
                data.isFirstHello = true;
            }
            data._from = this.client.options.clientId;
            const topic = `gartic_pro/room/${this.roomID}`;
            const qos = data.cat === 'paint' ? 0 : 1;
            this.client.publish(topic, JSON.stringify(data), { qos });
        }
    }
}

const network = new NetworkManager();
