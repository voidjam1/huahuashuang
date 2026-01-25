class GameEngine {
    constructor(board) {
        this.board = board;
        this.round = 0;
        this.currentWord = "";
        this.db = JSON.parse(localStorage.getItem('drawGuessDB')) || [];
    }

    // 房主发起新回合
    startNewRound() {
        this.round++;
        const words = this.db[0]?.words || ["猫", "狗"]; // 默认词库第一个主题
        const word = words[Math.floor(Math.random() * words.length)];
        const drawer = (this.round % 2 !== 0) ? 'host' : 'guest';

        const config = { cat: 'game', type: 'newRound', word, drawer, round: this.round };
        this.handleNewRound(config);
        network.send(config);
    }

    handleNewRound(data) {
        this.round = data.round;
        this.currentWord = data.word;
        const amIDrawing = (network.isHost && data.drawer === 'host') || (!network.isHost && data.drawer === 'guest');

        this.board.clear(true);
        this.board.setLock(!amIDrawing);
        
        document.getElementById('word-display').innerText = amIDrawing ? `题目: ${data.word}` : `题目: ??? (${data.word.length}字)`;
        document.getElementById('painter-tools').style.display = amIDrawing ? 'flex' : 'none';
        this.appendMsg('system', `--- 第 ${data.round} 局开始 ---`, 'blue');
    }

    send(type) {
        const input = document.getElementById(type + '-input');
        const val = input.value.trim();
        if (!val) return;

        this.appendMsg(type, '我', val);
        network.send({ cat: 'chat', type, msg: val });

        if (type === 'guess' && val === this.currentWord) {
            this.handleGameOver(true, '我');
            network.send({ cat: 'game', type: 'correct' });
        }
        input.value = '';
    }

    handleGameOver(win, name) {
        this.board.setLock(true);
        this.appendMsg('system', `${name} 猜对了！答案是: ${this.currentWord}`, 'green');
        if (network.isHost) setTimeout(() => this.startNewRound(), 3000); // 3秒后下一局
    }

    appendMsg(type, user, text, color) {
        const list = document.getElementById(type === 'chat' ? 'chat-list' : 'guess-list');
        const div = document.createElement('div');
        div.style.color = color || 'black';
        div.innerHTML = `<strong>${user}:</strong> ${text}`;
        list.appendChild(div);
        list.scrollTop = list.scrollHeight;
    }
}
