class NetworkManager {
    constructor() {
        this.client = null;
        this.roomID = null;
        this.isHost = false;
        this.myNickname = "";
        
        // 备选服务器列表 (自动轮询)
        this.brokerList = [
            // 线路1: HiveMQ (通常跨国连接最稳)
            'wss://broker.hivemq.com:8884/mqtt',
            // 线路2: EMQX (国内速度快，但偶尔抽风)
            'wss://broker.emqx.io:8084/mqtt',
            // 线路3: Mosquitto (老牌服务器)
            'wss://test.mosquitto.org:8081'
        ];
        this.currentBrokerIndex = 0;
    }

    showError(msg) {
        const el = document.getElementById('lobby-status');
        if (el) el.innerText = msg;
        console.log(`[系统状态] ${msg}`);
    }

    switchToGameView() {
        document.getElementById('view-lobby').style.display = 'none';
        document.getElementById('view-game').style.display = 'grid';
        document.getElementById('display-room-id').innerText = this.roomID;
        setTimeout(() => board.resize(), 100);
    }

    // --- 核心修改：递归尝试连接 ---
    connectToCloud(roomId, isHost) {
        // 如果是第一次调用，获取输入框的值
        if (!this.myNickname) {
            const nameInput = document.getElementById('lobby-nickname').value.trim();
            if (!nameInput) return this.showError("⚠️ 请先给自己起个名字！");
            this.myNickname = nameInput;
        }

        this.isHost = isHost;
        this.roomID = roomId;
        engine.setSelfName(this.myNickname);

        const currentUrl = this.brokerList[this.currentBrokerIndex];
        this.showError(`⏳ 正在尝试连接线路 ${this.currentBrokerIndex + 1}...`);
        console.log(`正在连接: ${currentUrl}`);

        // 防止重复连接
        if (this.client) {
            this.client.end();
            this.client = null;
        }

        const options = {
            clean: true,
            connectTimeout: 5000, // 5秒连不上就切线路
            keepalive: 30,
            clientId: 'gartic_' + Math.random().toString(16).substr(2, 8)
        };

        this.client = mqtt.connect(currentUrl, options);

        // 1. 连接成功
        this.client.on('connect', () => {
            console.log('✅ 连接成功:', currentUrl);
            const topic = `gartic_pro/room/${this.roomID}`;
            
            this.client.subscribe(topic, { qos: 1 }, (err) => {
                if (!err) {
                    this.showError("🚀 加入成功！");
                    this.switchToGameView();
                    if (this.isHost) document.getElementById('btn-start-game').style.display = 'block';
                    
                    // 进屋喊话
                    this.send({ cat: 'handshake', name: this.myNickname });
                    engine.appendMsg('chat-list', '系统', `已连接至线路 ${this.currentBrokerIndex + 1}`, '#00b894');
                } else {
                    // 订阅失败也算连接失败，切换下一个
                    this.tryNextBroker();
                }
            });
        });

        // 2. 收到消息
        this.client.on('message', (topic, payload) => {
            let data;
            try { data = JSON.parse(payload.toString()); } catch (e) { return; }
            if (data._from === this.client.options.clientId) return;

            if (data.cat === 'handshake') {
                engine.setOpponentName(data.name);
                engine.appendMsg('chat-list', '系统', `👋 ${data.name} 来了`, '#6c5ce7');
                if (data.isFirstHello) { 
                    this.send({ cat: 'handshake', name: this.myNickname, isFirstHello: false });
                }
            } else {
                engine.handlePacket(data);
            }
        });

        // 3. 连接错误 -> 自动切换
        this.client.on('error', (err) => {
            console.warn('当前线路连接失败:', err);
            this.tryNextBroker();
        });
        
        // 4. 连接断开 (如果是还没连上就断了)
        this.client.on('offline', () => {
            // 这里不立即切换，让 connectTimeout 去触发切换，防止网络抖动频繁切换
            this.showError("📡 正在寻找更佳线路...");
        });
    }

    tryNextBroker() {
        this.currentBrokerIndex++;
        if (this.currentBrokerIndex >= this.brokerList.length) {
            this.currentBrokerIndex = 0; // 如果都失败了，从头再来
            this.showError("❌ 所有线路繁忙，请检查你的网络连接...");
            return;
        }
        // 延迟 1 秒后重试下一个，给系统喘息时间
        setTimeout(() => {
            this.connectToCloud(this.roomID, this.isHost);
        }, 1000);
    }

    createRoom() {
        const randomID = Math.floor(100000 + Math.random() * 900000).toString();
        // 清空重试索引
        this.currentBrokerIndex = 0;
        this.connectToCloud(randomID, true);
    }

    joinRoom() {
        const id = document.getElementById('lobby-roomid').value.trim();
        if (!id || id.length !== 6) return this.showError("⚠️ 请输入 6 位房号");
        // 清空重试索引
        this.currentBrokerIndex = 0;
        this.connectToCloud(id, false);
    }

    send(data) {
        if (this.client && this.client.connected) {
            if (data.cat === 'handshake' && data.isFirstHello === undefined) data.isFirstHello = true;
            data._from = this.client.options.clientId;
            const topic = `gartic_pro/room/${this.roomID}`;
            const qos = data.cat === 'paint' ? 0 : 1;
            this.client.publish(topic, JSON.stringify(data), { qos });
        }
    }
}

const network = new NetworkManager();
