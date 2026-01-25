class GameEngine {
    constructor(userId) {
        this.userId = userId;
        this.currentWord = "苹果"; // 示例
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('guess-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleGuess(e.target.value);
        });
    }

    handleGuess(val) {
        const input = val.trim();
        const guessArea = document.getElementById('guess-msgs');
        
        if (input === this.currentWord) {
            // 完全匹配：对其他人广播，自己显示成功
            this.logGuess(`🌟 ${this.userId} 猜中了答案！`, 'correct');
            // 此处应触发下一局逻辑
        } else if (this.isNearMiss(input, this.currentWord)) {
            // 模糊匹配：仅自己可见的提示
            this.logGuess(`🤏 「${input}」非常接近了！`, 'hint');
        } else {
            // 完全无关：正常显示
            this.logGuess(`${this.userId}: ${input}`, 'normal');
        }
        document.getElementById('guess-input').value = "";
    }

    // 模糊算法：简单示例（判断包含关系或长度差异）
    isNearMiss(a, b) {
        if (a.length < 2) return false;
        return b.includes(a) || a.includes(b);
    }

    logGuess(text, type) {
        const div = document.createElement('div');
        div.className = `msg-${type}`;
        div.innerText = text;
        const area = document.getElementById('guess-msgs');
        area.appendChild(div);
        area.scrollTop = area.scrollHeight;
    }
}
