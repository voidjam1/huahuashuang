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
            document.getElementById('my-room-id').innerText = id;
            document.getElementById('room-id-display').style.display = 'block';
        });
        this.peer.on('connection', c => {
            this.conn = c;
            this.setup();
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
