class GameEngine {
    constructor(board) {
        this.board = board;
        this.scores = { host: 0, guest: 0 };
        this.settings = { maxScore: 50, timeLimit: 60 };
        this.words = ["苹果", "香蕉", "电脑", "太阳", "月亮", "汽车", "房子", "猫", "狗", "冰淇淋", "吉他", "足球", "超人", "汉堡", "彩虹"];
        
        this.hostName = "房主";
        this.guestName = "等待...";
        this.round = 0;
        this.currentWord = "";
        this.drawer = ""; 
        this.timerInterval = null;
        this.isMyTurn = false;
        this.gameState = 'idle'; // idle, playing, intermission, end
    }

    setSelfName(name) {
        if (network.isHost) this.hostName = name;
        else this.guestName = name;
        this.updateScoreUI();
    }

    setOpponentName(name) {
        if (network.isHost) this.guestName = name;
        else this.hostName = name;
        this.updateScoreUI();
    }

    // --- 游戏流程控制 ---

    startGame() {
        if (!network.isHost) return;
        this.scores = { host: 0, guest: 0 };
        this.round = 0;
        
        const data = { cat: 'game', type: 'start', scores: this.scores, hostName: this.hostName };
        network.send(data);
        this.handlePacket(data);
        
        setTimeout(() => this.nextRound(), 1000);
    }

    nextRound() {
        if (!network.isHost) return;

        // 检查胜利条件
        if (this.scores.host >= this.settings.maxScore || this.scores.guest >= this.settings.maxScore) {
            const winner = this.scores.host >= this.settings.maxScore ? this.hostName : this.guestName;
            const endData = { cat: 'game', type: 'gameOver', winner };
            network.send(endData);
            this.handlePacket(endData);
            return;
        }

        this.round++;
        this.drawer = (this.round % 2 !== 0) ? 'host' : 'guest';
        this.currentWord = this.words[Math.floor(Math.random() * this.words.length)];

        const roundData = { cat: 'game', type: 'newRound', word: this.currentWord, drawer: this.drawer, round: this.round };
        network.send(roundData);
        this.handlePacket(roundData);
    }

    // --- 核心消息处理 ---

    handlePacket(data) {
        if (data.cat === 'paint') return this.board.drawRemote(data);
        
        if (data.cat === 'chat') {
            const listId = data.type === 'guess' ? 'guess-list' : 'chat-list';
            const color = data.type === 'guess' ? '#d35400' : '#2d3436';
            this.appendMsg(listId, data.user, data.msg, color);
            return;
        }

        if (data.cat === 'game') {
            // 客人猜对，房主结算
            if (network.isHost && data.type === 'roundEnd' && data.reason === 'correct') {
                this.resolveRound(data);
                return;
            }
            this.handleGameLogic(data);
        }
    }

    handleGameLogic(data) {
        switch (data.type) {
            case 'start':
                this.scores = data.scores;
                if (data.hostName) this.hostName = data.hostName;
                this.updateScoreUI();
                document.getElementById('btn-start-game').style.display = 'none';
                this.appendMsg('chat-list', '系统', `🎮 游戏开始！目标 ${this.settings.maxScore} 分`, '#00b894');
                break;

            case 'newRound':
                this.gameState = 'playing';
                this.currentWord = data.word;
                this.drawer = data.drawer;
                this.isMyTurn = (network.isHost && this.drawer === 'host') || (!network.isHost && this.drawer === 'guest');

                // UI 重置
                document.getElementById('round-overlay').style.display = 'none';
                this.board.clear(true);
                this.board.setLock(!this.isMyTurn);
                document.getElementById('painter-tools').style.display = this.isMyTurn ? 'flex' : 'none';
                
                // 顶部状态栏
                const statusText = this.isMyTurn ? `题目: ${data.word}` : `提示: ${data.word.length} 个字`;
                document.getElementById('game-status').innerText = statusText;

                if (network.isHost) this.startTimer(this.settings.timeLimit);
                break;

            case 'tick':
                document.getElementById('timer').innerText = `⏱️ ${data.time}`;
                break;

            case 'roundEnd':
                this.endRoundUI(data);
                break;

            case 'gameOver':
                clearInterval(this.timerInterval);
                document.getElementById('round-overlay').style.display = 'flex';
                document.getElementById('round-msg').innerText = "🏆 冠军诞生";
                document.getElementById('round-word').innerText = data.winner;
                document.getElementById('btn-next-round').style.display = 'none'; // 游戏彻底结束
                // 如果想重开，可以刷新页面或显示重置按钮
                break;
        }
    }

    // --- 发送逻辑 ---

    sendChat() {
        const input = document.getElementById('chat-input');
        const val = input.value.trim();
        if (!val) return;
        const name = network.isHost ? this.hostName : this.guestName;
        const data = { cat: 'chat', type: 'talk', user: name, msg: val };
        network.send(data);
        this.handlePacket(data);
        input.value = '';
    }

    sendGuess() {
        if (this.isMyTurn) return; // 自己不能猜
        if (this.gameState !== 'playing') return;

        const input = document.getElementById('guess-input');
        const val = input.value.trim();
        if (!val) return;

        const name = network.isHost ? this.hostName : this.guestName;

        if (val === this.currentWord) {
            // 猜对了 -> 仅发包，不本地显示，等系统广播
            const winData = { cat: 'game', type: 'roundEnd', reason: 'correct', winnerName: name };
            if (network.isHost) this.resolveRound(winData);
            else network.send(winData);
        } else {
            // 猜错了 -> 广播显示
            const data = { cat: 'chat', type: 'guess', user: name, msg: val };
            network.send(data);
            this.handlePacket(data);
        }
        input.value = '';
    }

    // --- 结算系统 (Host Only) ---

    resolveRound(data) {
        if (!network.isHost || this.gameState !== 'playing') return;
        clearInterval(this.timerInterval);

        let msg = "";
        if (data.reason === 'correct') {
            this.scores.host += 10;
            this.scores.guest += 10;
            msg = `🎉 ${data.winnerName} 猜对了！`;
        } else if (data.reason === 'timeout') {
            msg = "⏰ 时间耗尽";
        } else if (data.reason === 'skip') {
            msg = "⏭️ 画手跳过";
        }

        const endData = {
            cat: 'game', type: 'roundEnd',
            scores: this.scores,
            word: this.currentWord,
            msg: msg
        };
        network.send(endData);
        this.handlePacket(endData);
    }

    endRoundUI(data) {
        this.gameState = 'intermission';
        clearInterval(this.timerInterval);
        this.scores = data.scores;
        this.updateScoreUI();

        document.getElementById('round-overlay').style.display = 'flex';
        document.getElementById('round-msg').innerText = data.msg;
        document.getElementById('round-word').innerText = data.word;
        
        // 只有房主能看到“下一轮”按钮
        if (network.isHost) {
            document.getElementById('btn-next-round').style.display = 'block';
        } else {
            document.getElementById('btn-next-round').style.display = 'none';
        }

        // 聊天区通知
        const sysMsg = `${data.msg} (答案: ${data.word})`;
        this.appendMsg('guess-list', '系统', sysMsg, '#00b894');
    }

    // 主动跳过
    endRound(isTimeout) {
        if (!this.isMyTurn) return;
        const reason = isTimeout ? 'timeout' : 'skip';
        if (network.isHost) this.resolveRound({reason});
        else network.send({cat: 'game', type: 'roundEnd', reason});
    }

    startTimer(s) {
        clearInterval(this.timerInterval);
        let t = s;
        this.timerInterval = setInterval(() => {
            t--;
            const data = {cat:'game', type:'tick', time:t};
            network.send(data);
            this.handleGameLogic(data);
            if (t <= 0) this.resolveRound({reason: 'timeout'});
        }, 1000);
    }

    updateScoreUI() {
        document.getElementById('name-host').innerText = this.hostName;
        document.getElementById('score-host').innerText = this.scores.host;
        document.getElementById('name-guest').innerText = this.guestName;
        document.getElementById('score-guest').innerText = this.scores.guest;
    }

    appendMsg(listId, user, text, color) {
        const list = document.getElementById(listId);
        if (!list) return;
        const div = document.createElement('div');
        div.className = 'msg-item';
        div.style.color = color;
        div.innerHTML = `<strong>${user}:</strong> ${text}`;
        list.appendChild(div);
        list.scrollTop = list.scrollHeight;
    }

    saveImage() {
        const link = document.createElement('a');
        link.download = `Gartic-${this.currentWord}.png`;
        link.href = this.board.canvas.toDataURL();
        link.click();
    }
}
