class GameEngine {
    constructor(board) {
        this.board = board;
        this.userName = "玩家_" + Math.floor(Math.random() * 1000);
        this.targetWord = "猫"; // 模拟
        this.init();
    }

    init() {
        // 模拟词库加载
        const db = JSON.parse(localStorage.getItem('drawGuessDB')) || [];
        const select = document.getElementById('theme-select');
        select.innerHTML = db.map((t, i) => `<option value="${i}">${t.title}</option>`).join('');
    }

    send(type) {
        const input = document.getElementById(type + '-input');
        const text = input.value.trim();
        if (!text) return;

        if (type === 'guess') {
            this.processGuess(text);
        } else {
            this.appendMsg('chat-list', this.userName, text);
        }
        input.value = '';
    }

    processGuess(val) {
        const list = 'guess-list';
        if (val === this.targetWord) {
            this.appendMsg(list, "🎉 系统", `${this.userName} 猜中了答案！`, "green");
            this.board.setLock(true); // 作画结束
        } else if (this.targetWord.includes(val) && val.length > 1) {
            this.appendMsg(list, "💡 提示", `「${val}」很接近了！`, "orange");
        } else {
            this.appendMsg(list, this.userName, val);
        }
    }

    appendMsg(listId, user, text, color = "#333") {
        const el = document.getElementById(listId);
        const div = document.createElement('div');
        div.style.color = color;
        div.innerHTML = `<strong>${user}:</strong> ${text}`;
        el.appendChild(div);
        el.scrollTop = el.scrollHeight;
    }
}
