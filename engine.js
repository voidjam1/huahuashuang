class GameEngine {
    constructor(board) {
        this.board = board;
        this.themes = [];
        this.currentTheme = [];
        this.scores = { host: 0, guest: 0 };
        this.settings = { maxScore: 30, timeLimit: 60 };
        
        // 玩家信息
        this.hostName = "房主";
        this.guestName = "等待中...";
        this.myRole = ""; // 'host' or 'guest'
        
        this.round = 0;
        this.currentWord = "";
        this.drawer = ""; // 'host' or 'guest'
        this.timerInterval = null;
        this.isMyTurn = false;
        this.gameState = 'idle'; 
    }

    // 设置名字
    setSelfName(name) {
        this.myRole = network.isHost ? 'host' : 'guest';
        if (network.isHost) this.hostName = name;
        else this.guestName = name;
        this.updateScoreBoard();
    }

    setOpponentName(name) {
        if (network.isHost) this.guestName = name;
        else this.hostName = name;
        this.updateScoreBoard();
    }

    initThemes() {
        try {
            const saved = localStorage.getItem('drawGuessDB');
            const defaultThemes = [{title: "默认", words: ["苹果", "猫", "房子", "飞机", "电脑"]}];
            this.themes = saved ? JSON.parse(saved) : defaultThemes;
            if (!this.themes.length) this.themes = defaultThemes;
        } catch (e) { this.themes = [{title: "默认", words: ["错误"]}]; }

        const sel = document.getElementById('theme-selector');
        if (sel) sel.innerHTML = this.themes.map((t, i) => `<option value="${i}">${t.title}</option>`).join('');
    }

    onPlayerJoined(isHost) {
        if (isHost) {
            document.getElementById('host-controls').style.display = 'block';
            document.getElementById('guest-controls').style.display = 'none';
        } else {
            document.getElementById('host-controls').style.display = 'none';
            document.getElementById('guest-controls').style.display = 'block';
        }
        this.updateScoreBoard();
    }

    // --- 游戏流程 ---

    startGame() {
        if (!network.isHost) return;
        const themeIdx = document.getElementById('theme-selector').value;
        this.currentTheme = this.themes[themeIdx].words;
        this.settings.maxScore = parseInt(document.getElementById('max-score').value) || 30;
        this.settings.timeLimit = parseInt(document.getElementById('time-limit').value) || 60;
        this.scores = { host: 0, guest: 0 };
        this.round = 0;

        const config = { 
            cat: 'game', type: 'start', 
            settings: this.settings, scores: this.scores,
            hostName: this.hostName // 再次同步名字以防万一
        };
        this.handlePacket(config);
        network.send(config);
        setTimeout(() => this.nextRound(), 500);
    }

    nextRound() {
        if (!network.isHost) return;
        
        if (this.scores.host >= this.settings.maxScore || this.scores.guest >= this.settings.maxScore) {
            const winner = this.scores.host >= this.settings.maxScore ? this.hostName : this.guestName;
            const endData = { cat: 'game', type: 'gameOver', winner };
            this.handlePacket(endData);
            network.send(endData);
            return;
        }

        this.round++;
        this.drawer = (this.round % 2 !== 0) ? 'host' : 'guest';
        const word = this.currentTheme[Math.floor(Math.random() * this.currentTheme.length)];

        const roundData = { cat: 'game', type: 'newRound', word, drawer: this.drawer, round: this.round };
        this.handlePacket(roundData);
        network.send(roundData);
    }

    // --- 数据处理 ---

handlePacket(data) {
    if (data.cat === 'paint') {
        // 跨国高延迟下，如果 data 包含的是坐标点，直接传给 board
        // 建议在 painter.js 中对 drawRemote 增加一个逻辑：
        // 如果 data.type === 'start'，则重置上一次的绘图坐标，防止出现“瞬移的长直线”
        this.board.drawRemote(data);
    } 
        // 特殊：处理名字同步（防止中途加入显示错误）
        if (data.hostName && !network.isHost) {
            this.hostName = data.hostName;
            this.updateScoreBoard();
        }

        // 特殊：客人猜对请求
        if (network.isHost && data.cat === 'game' && data.type === 'roundEnd' && data.reason === 'correct') {
            this.resolveRound(data);
            return;
        }

        if (data.cat === 'paint') this.board.drawRemote(data);
        else if (data.cat === 'chat') {
            const listId = data.type === 'guess' ? 'guess-list' : 'chat-list';
            const color = data.type === 'guess' ? '#d35400' : '#2d3436';
            this.appendMsg(listId, data.user, data.msg, color);
        } 
        else if (data.cat === 'game') this.handleGameLogic(data);
    }

    handleGameLogic(data) {
        switch (data.type) {
            case 'start':
                this.scores = data.scores;
                this.settings = data.settings;
                this.updateScoreBoard();
                this.appendMsg('chat-list', '系统', `🎮 游戏开始！先得 ${this.settings.maxScore} 分者胜`, 'green');
                break;

            case 'newRound':
                this.gameState = 'playing';
                this.currentWord = data.word;
                this.drawer = data.drawer;
                this.isMyTurn = (network.isHost && this.drawer === 'host') || (!network.isHost && this.drawer === 'guest');

                // UI重置
                document.getElementById('round-overlay').style.display = 'none';
                document.getElementById('next-round-btn').style.display = 'none';
                this.board.clear(true);
                this.board.setLock(!this.isMyTurn);
                
                document.getElementById('painter-tools').style.display = this.isMyTurn ? 'flex' : 'none';
                document.getElementById('game-status').innerText = this.isMyTurn ? `题目: ${data.word}` : `猜词: ${data.word.length} 个字`;
                this.startTimer(this.settings.timeLimit);
                break;

            case 'tick':
                document.getElementById('timer').innerText = `⏱️ ${data.time}`;
                break;

            case 'roundEnd':
                this.endRoundUI(data);
                break;

            case 'gameOver':
                this.gameState = 'end';
                clearInterval(this.timerInterval);
                document.getElementById('round-overlay').style.display = 'flex';
                document.getElementById('round-msg').innerText = "🏆 最终冠军";
                document.getElementById('round-word').innerText = data.winner;
                document.getElementById('next-round-btn').style.display = 'none';
                break;
        }
    }

    // --- 输入与发送 ---

    sendChat() {
        const input = document.getElementById('chat-input');
        const val = input.value.trim();
        if (!val) return;
        const name = network.isHost ? this.hostName : this.guestName;
        const data = { cat: 'chat', type: 'talk', user: name, msg: val };
        this.handlePacket(data);
        network.send(data);
        input.value = '';
    }

    sendGuess() {
        if (this.isMyTurn) return alert("你自己画的还猜啥？");
        if (this.gameState !== 'playing') return;

        const input = document.getElementById('guess-input');
        const val = input.value.trim();
        if (!val) return;

        const name = network.isHost ? this.hostName : this.guestName;

        if (val === this.currentWord) {
            const winData = { cat: 'game', type: 'roundEnd', reason: 'correct', winnerName: name };
            if (network.isHost) this.resolveRound(winData);
            else {
                network.send(winData);
                this.appendMsg('guess-list', '我', val, '#27ae60'); 
            }
        } else {
            const data = { cat: 'chat', type: 'guess', user: name, msg: val };
            this.handlePacket(data);
            network.send(data);
        }
        input.value = '';
    }

    // --- 结算逻辑 (Host Only) ---

    resolveRound(data) {
        if (this.gameState !== 'playing') return;
        clearInterval(this.timerInterval);
        
        let msg = "";
        if (data.reason === 'correct') {
            this.scores.host += 10;
            this.scores.guest += 10;
            // 谁猜对了？如果是房主猜对，说明是客人在画
            // data.winnerName 来自发送者
            // 简单处理：显示"对方猜对了"或者名字
            const winnerName = (this.drawer === 'host') ? this.guestName : this.hostName;
            msg = `🎉 ${winnerName} 猜对了！`;
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
        this.handlePacket(endData);
        network.send(endData);
    }

    endRoundUI(data) {
        this.gameState = 'intermission';
        clearInterval(this.timerInterval);
        this.scores = data.scores;
        this.updateScoreBoard();

        // 弹窗
        document.getElementById('round-overlay').style.display = 'flex';
        document.getElementById('round-msg').innerText = data.msg;
        document.getElementById('round-word').innerText = data.word;
        
        if (network.isHost) document.getElementById('next-round-btn').style.display = 'block';
        else document.getElementById('round-msg').innerText += " (等待继续...)";

        // 全频道广播
        const sysMsg = `${data.msg} 答案是: ${data.word}`;
        this.appendMsg('guess-list', '系统', sysMsg, '#27ae60');
        
        const chatList = document.getElementById('chat-list');
        const div = document.createElement('div');
        div.className = 'sys-msg';
        div.innerText = sysMsg;
        chatList.appendChild(div);
        chatList.scrollTop = chatList.scrollHeight;
    }

    // 主动跳过
    endRound(isTimeout) {
        if (!this.isMyTurn) return;
        const reason = isTimeout ? 'timeout' : 'skip';
        if (network.isHost) this.resolveRound({reason});
        else network.send({cat: 'game', type: 'roundEnd', reason});
    }

    // --- 辅助功能 ---

    startTimer(s) {
        clearInterval(this.timerInterval);
        if (!network.isHost) return;
        let t = s;
        this.timerInterval = setInterval(() => {
            t--;
            network.send({cat:'game', type:'tick', time:t});
            this.handlePacket({cat:'game', type:'tick', time:t});
            if (t <= 0) this.resolveRound({reason: 'timeout'});
        }, 1000);
    }

    updateScoreBoard() {
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

    // 保存画作
    saveImage() {
        const link = document.createElement('a');
        const timestamp = new Date().toLocaleTimeString().replace(/:/g, '-');
        link.download = `GarticPro-${this.currentWord}-${timestamp}.png`;
        link.href = this.board.canvas.toDataURL();
        link.click();
    }
}
