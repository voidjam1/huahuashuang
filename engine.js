class GameEngine {
    constructor(board) {
        this.board = board;
        this.round = 0;
        this.currentWord = "";
        this.timer = null;
        // 尝试从本地加载词库，如果没有则使用默认词
        const saved = localStorage.getItem('drawGuessDB');
        this.words = saved ? JSON.parse(saved)[0].words : ["西瓜", "冰淇淋", "手机", "电脑", "小猫"];
    }

    startNewRound() {
        if (!network.isHost) return;
        this.round++;
        const word = this.words[Math.floor(Math.random() * this.words.length)];
        const drawer = (this.round % 2 !== 0) ? 'host' : 'guest';
        
        const data = { cat: 'game', type: 'newRound', word, drawer, round: this.round };
        this.handleNewRound(data);
        network.send(data);
        this.startTimer(60);
    }

    handleNewRound(data) {
        this.currentWord = data.word;
        const amIDrawing = (network.isHost && data.drawer === 'host') || (!network.isHost && data.drawer === 'guest');
        
        this.board.clear(true);
        this.board.setLock(!amIDrawing);
        document.getElementById('word-display').innerText = amIDrawing ? `题目: ${data.word}` : `题目: ??? (${data.word.length}字)`;
        document.getElementById('painter-tools').style.display = amIDrawing ? 'flex' : 'none';
        this.appendMsg('system', `🔔 第 ${data.round} 局开始！`, 'blue');
    }

    startTimer(s) {
        clearInterval(this.timer);
        let t = s;
        this.timer = setInterval(() => {
            t--;
            network.send({ cat: 'game', type: 'tick', time: t });
            document.getElementById('timer').innerText = `⏱️ ${t}s`;
            if (t <= 0) this.handleGameOver(false);
        }, 1000);
    }

    send(type) {
        const input = document.getElementById(type + '-input');
        const val = input.value.trim();
        if (!val) return;
        this.appendMsg(type, '我', val);
        network.send({ cat: 'chat', type, msg: val });
        if (type === 'guess' && val === this.currentWord) {
            network.send({ cat: 'game', type: 'win' });
            this.handleGameOver(true, '我');
        }
        input.value = '';
    }

    handleGameOver(win, winner = "对方") {
        clearInterval(this.timer);
        this.board.setLock(true);
        this.appendMsg('system', `🏁 游戏结束！答案是: ${this.currentWord}`, 'orange');
        if (win) this.appendMsg('system', `🏆 ${winner} 猜对了！`, 'green');
    }

    appendMsg(type, user, text, color) {
        const list = document.getElementById(type === 'chat' || type === 'system' ? 'chat-list' : 'guess-list');
        const div = document.createElement('div');
        div.style.color = color || 'black';
        div.innerHTML = `<strong>${user}:</strong> ${text}`;
        list.appendChild(div);
        list.scrollTop = list.scrollHeight;
    }
}
