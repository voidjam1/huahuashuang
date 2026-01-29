class GameEngine {
    constructor(board) {
        this.board = board;
        this.themes = [];
        this.currentTheme = [];
        this.scores = { host: 0, guest: 0 };
        this.settings = { maxScore: 30, timeLimit: 60 };
        
        this.round = 0;
        this.currentWord = "";
        this.drawer = ""; // 'host' or 'guest'
        this.timerInterval = null;
        this.isMyTurn = false;
        
        // 游戏状态: idle(等待), playing(绘画中), intermission(回合结束展示)
        this.gameState = 'idle'; 
    }

    // 初始化词库（仅房主需要）
    initThemes() {
        try {
            const saved = localStorage.getItem('drawGuessDB');
            const defaultThemes = [
                {title: "基础", words: ["苹果", "香蕉", "猫", "狗", "太阳", "月亮", "电脑", "手机", "汽车", "房子"]}
            ];
            this.themes = saved ? JSON.parse(saved) : defaultThemes;
            if (!Array.isArray(this.themes) || this.themes.length === 0) this.themes = defaultThemes;
        } catch (e) {
            this.themes = [{title: "基础", words: ["错误修复", "测试"]}];
        }

        // 填充下拉框
        const selector = document.getElementById('theme-selector');
        if (selector) {
            selector.innerHTML = this.themes.map((t, i) => `<option value="${i}">${t.title}</option>`).join('');
        }
    }

    // 玩家连接回调
    onPlayerJoined(isHost) {
        if (isHost) {
            document.getElementById('host-controls').style.display = 'block';
            document.getElementById('guest-controls').style.display = 'none';
        } else {
            document.getElementById('host-controls').style.display = 'none';
            document.getElementById('guest-controls').style.display = 'block';
            this.appendMsg('system', 'System', '等待房主配置游戏...', 'blue');
        }
    }

    // 1. 房主点击开始游戏
    startGame() {
        if (!network.isHost) return;

        // 获取设置
        const themeIdx = document.getElementById('theme-selector').value;
        this.currentTheme = this.themes[themeIdx].words;
        this.settings.maxScore = parseInt(document.getElementById('max-score').value) || 30;
        this.settings.timeLimit = parseInt(document.getElementById('time-limit').value) || 60;
        this.scores = { host: 0, guest: 0 };
        this.round = 0;

        // 发送游戏配置同步
        const config = {
            cat: 'game', type: 'start', 
            settings: this.settings,
            scores: this.scores
        };
        this.handlePacket(config); // 自己处理
        network.send(config); // 发给对方

        // 延迟一下开始第一轮
        setTimeout(() => this.nextRound(), 500);
    }

    // 2. 开始新一轮（由房主触发逻辑）
    nextRound() {
        if (!network.isHost) return;

        // 检查是否有人获胜
        if (this.scores.host >= this.settings.maxScore || this.scores.guest >= this.settings.maxScore) {
            const winner = this.scores.host >= this.settings.maxScore ? '房主' : '朋友';
            const endData = { cat: 'game', type: 'gameOver', winner };
            this.handlePacket(endData);
            network.send(endData);
            return;
        }

        this.round++;
        // 轮流画：奇数局房主画，偶数局客人画
        this.drawer = (this.round % 2 !== 0) ? 'host' : 'guest';
        
        // 随机选词
        const word = this.currentTheme[Math.floor(Math.random() * this.currentTheme.length)];

        const roundData = {
            cat: 'game', type: 'newRound',
            word: word,
            drawer: this.drawer,
            round: this.round
        };

        this.handlePacket(roundData);
        network.send(roundData);
    }

    // 3. 处理网络包（核心状态更新）
    handlePacket(data) {
        if (data.cat === 'paint') {
            this.board.drawRemote(data);
        } else if (data.cat === 'chat') {
            const listId = data.isGuess ? 'guess-list' : 'chat-list';
            this.appendMsg(listId, data.user, data.msg, data.isGuess ? '#d63031' : '#2d3436');
        } else if (data.cat === 'game') {
            this.handleGameLogic(data);
        }
    }

    handleGameLogic(data) {
        switch (data.type) {
            case 'start':
                this.scores = data.scores;
                this.settings = data.settings;
                this.updateScoreBoard();
                this.appendMsg('system', 'System', `🎮 游戏开始！目标分数: ${this.settings.maxScore}`, 'green');
                break;

            case 'newRound':
                this.gameState = 'playing';
                this.currentWord = data.word;
                this.drawer = data.drawer;
                this.isMyTurn = (network.isHost && this.drawer === 'host') || (!network.isHost && this.drawer === 'guest');

                // UI 重置
                document.getElementById('round-overlay').style.display = 'none';
                document.getElementById('next-round-btn').style.display = 'none'; // 隐藏继续按钮
                this.board.clear(true);
                this.board.setLock(!this.isMyTurn);
                
                // 工具栏与提示
                document.getElementById('painter-tools').style.display = this.isMyTurn ? 'flex' : 'none';
                document.getElementById('game-status').innerText = this.isMyTurn ? `题目: ${data.word}` : `猜词: ${data.word.length} 个字`;
                
                // 启动倒计时（仅用于显示，逻辑由房主控制）
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
                document.getElementById('round-msg').innerText = "🏆 游戏结束";
                document.getElementById('round-word').innerText = `胜者: ${data.winner}`;
                document.getElementById('next-round-btn').style.display = 'none'; // 游戏结束不显示继续
                break;
        }
    }

    // 4. 输入处理（整合聊天与猜词）
    handleInput() {
        const input = document.getElementById('input-box');
        const val = input.value.trim();
        if (!val) return;

        // 如果在游戏中，且不是画画的人，且猜对了
        if (this.gameState === 'playing' && !this.isMyTurn && val === this.currentWord) {
            // 发送猜对信号
            const winData = { cat: 'game', type: 'roundEnd', reason: 'correct', winner: network.isHost ? 'host' : 'guest' };
            
            // 只有房主有权决定积分结算，如果是客人猜对，发给房主确认
            if (network.isHost) {
                this.resolveRound(winData);
            } else {
                network.send(winData); // 客人告诉房主“我猜对了”
                // 客人本地先不做结算，等房主广播 roundEnd
            }
        } else {
            // 普通聊天或没猜对
            const isGuess = this.gameState === 'playing' && !this.isMyTurn;
            const chatData = { 
                cat: 'chat', 
                user: network.isHost ? '房主' : '朋友', 
                msg: val, 
                isGuess: isGuess 
            };
            this.handlePacket(chatData); // 自己显示
            network.send(chatData);      // 发给对方
        }
        input.value = '';
    }

    // 5. 回合结算逻辑（仅房主运行）
    resolveRound(data) {
        // 防止多次触发
        if (this.gameState !== 'playing') return;

        clearInterval(this.timerInterval);
        
        let msg = "";
        if (data.reason === 'correct') {
            // 两人都得分
            this.scores.host += 10;
            this.scores.guest += 10;
            msg = "🎉 猜对了！双方+10分";
        } else if (data.reason === 'timeout') {
            msg = "⏰ 时间到！无人得分";
        } else if (data.reason === 'skip') {
             msg = "⏭️ 画手跳过了回合";
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

    // 如果客人发来 "roundEnd" (猜对了)，房主调用 resolveRound
    // 修改 handlePacket 对于 game 类型数据的处理：
    // 在 handleGameLogic 中增加：
    /* 注意：engine.js 的 handleGameLogic case 'roundEnd' 是处理UI展示
       而房主接收到客人的 'roundEnd' 请求（reason: correct）是在 handlePacket 的入口处拦截
       或者我们在 case 'roundEnd' 里区分“请求”和“广播”
       为了简单，我们在 handlePacket 顶部做特殊拦截：
    */
   
    // 修正后的 handlePacket 逻辑补充：
    /*
    handlePacket(data) {
        // 特殊逻辑：如果是客人发来的“我猜对了”请求，且我是房主
        if (network.isHost && data.cat === 'game' && data.type === 'roundEnd' && data.reason === 'correct') {
            this.resolveRound(data);
            return;
        }
        ... 原有逻辑
    }
    */
    // 由于代码结构，我将把这个补丁直接融合进上面的 handlePacket 方法里。

    // 6. 结束回合 UI 展示
    endRoundUI(data) {
        this.gameState = 'intermission';
        clearInterval(this.timerInterval);
        this.scores = data.scores;
        this.updateScoreBoard();

        document.getElementById('round-overlay').style.display = 'flex';
        document.getElementById('round-msg').innerText = data.msg;
        document.getElementById('round-word').innerText = data.word;
        
        // 只有房主显示“下一轮”按钮
        if (network.isHost) {
            document.getElementById('next-round-btn').style.display = 'block';
        } else {
            document.getElementById('round-msg').innerText += " (等待房主继续...)";
        }
    }

    // 主动跳过（仅画手）
    endRound(isTimeout) {
        if (!this.isMyTurn) return;
        const reason = isTimeout ? 'timeout' : 'skip';
        const data = { reason };
        
        if (network.isHost) {
            this.resolveRound(data);
        } else {
            // 客人请求跳过/超时
            network.send({ cat: 'game', type: 'roundEnd', reason });
        }
    }

    startTimer(s) {
        clearInterval(this.timerInterval);
        if (!network.isHost) return; // 只有房主控制时间流逝

        let t = s;
        this.timerInterval = setInterval(() => {
            t--;
            network.send({ cat: 'game', type: 'tick', time: t });
            this.handlePacket({ cat: 'game', type: 'tick', time: t }); // 更新自己
            
            if (t <= 0) {
                this.resolveRound({ reason: 'timeout' });
            }
        }, 1000);
    }

    updateScoreBoard() {
        document.getElementById('score-host').innerText = this.scores.host;
        document.getElementById('score-guest').innerText = this.scores.guest;
    }

    appendMsg(listId, user, text, color) {
        const list = document.getElementById(listId === 'system' ? 'chat-list' : listId);
        const div = document.createElement('div');
        div.style.color = color;
        div.innerHTML = `<strong>${user}:</strong> ${text}`;
        list.appendChild(div);
        list.scrollTop = list.scrollHeight;
    }
}

// 补丁：修正 handlePacket 以支持客人申报胜利
const originalHandle = GameEngine.prototype.handlePacket;
GameEngine.prototype.handlePacket = function(data) {
    if (network.isHost && data.cat === 'game' && data.type === 'roundEnd' && (data.reason === 'correct' || data.reason === 'skip' || data.reason === 'timeout')) {
        this.resolveRound(data);
        return;
    }
    
    if (data.cat === 'paint') {
        this.board.drawRemote(data);
    } else if (data.cat === 'chat') {
        const listId = data.isGuess ? 'guess-list' : 'chat-list';
        this.appendMsg(listId, data.user, data.msg, data.isGuess ? '#d63031' : '#2d3436');
    } else if (data.cat === 'game') {
        this.handleGameLogic(data);
    }
};
