class NetworkManager {
    constructor() {
        this.client = null;
        this.roomID = null;
        this.isHost = false;
        this.myNickname = "玩家";
    }

    getNickname() {
        return document.getElementById('my-nickname').value.trim() || (this.isHost ? "房主" : "朋友");
    }

    // 统一的连接函数
    connectToCloud(roomId, isHost) {
        this.isHost = isHost;
        this.roomID = roomId;
        this.myNickname = this.getNickname();
        engine.setSelfName(this.myNickname);

        // 使用 EMQX 公共免费服务器 (支持 WebSocket 协议)
        // 这个服务器会自动寻找离你和你朋友最近的节点
        const options = {
            clean: true,
            connectTimeout: 4000,
            clientId: 'gartic_' + Math.random().toString(16).substr(2, 8),
        };

        // 这里的 wxs 代表加密的 WebSocket 连接，跨国传输更安全且不易被拦截
        this.client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', options);

        this.client.on('connect', () => {
            console.log('已连接至全球中转节点');
            // 订阅房间主题：gartic/room/房号
            this.client.subscribe(`gartic/room/${this.roomID}`, (err) => {
                if (!err) {
                    document.getElementById('lobby-overlay').style.display = 'none';
                    // 发送握手信号
                    this.send({ cat: 'handshake', name: this.myNickname });
                    engine.appendMsg('chat-list', '系统', `已进入房间: ${this.roomID}`, 'green');
                }
            });
        });

        this.client.on('message', (topic, payload) => {
            const data = JSON.parse(payload.toString());
            // 过滤掉自己发的消息
            if (data._from === options.clientId) return;

            if (data.cat === 'handshake') {
                engine.setOpponentName(data.name);
                engine.appendMsg('chat-list', '系统', `玩家【${data.name}】已就绪！`, 'green');
                engine.onPlayerJoined(this.isHost);
                // 朋友收到房主握手后，回传一个握手，确保双方都有名字
                if (this.isHost) this.send({ cat: 'handshake', name: this.myNickname });
            } else {
                engine.handlePacket(data);
            }
        });

        this.client.on('error', (err) => {
            alert('连接失败，请检查网络');
            console.error(err);
        });
    }

    createRoom() {
        // 随机生成一个 6 位数字房号
        const randomID = Math.floor(100000 + Math.random() * 900000).toString();
        document.getElementById('lobby-btns').style.display = 'none';
        document.getElementById('room-info-display').style.display = 'block';
        document.getElementById('my-room-id').innerText = randomID;
        
        this.connectToCloud(randomID, true);
    }

    joinRoom() {
        const id = document.getElementById('target-id').value.trim();
        if (!id) return alert("请输入房号");
        this.connectToCloud(id, false);
    }

    send(data) {
        if (this.client && this.client.connected) {
            // 附带发送者 ID 避免回环
            data._from = this.client.options.clientId;
            this.client.publish(`gartic/room/${this.roomID}`, JSON.stringify(data));
        }
    }
}

const network = new NetworkManager();
