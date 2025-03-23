const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const axios = require("axios");

const app = express();
const port = 5000;
const SECRET_KEY = "your_secret_key";

app.use(cors({ origin: "*" }));
app.use(express.json());

cors({ origin: '*' });

// 连接 PostgreSQL 数据库
const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "DB_2023090909026",
    password: "yap78963",
    port: 5432,
});

let nlpResult;

// 示例分析接口
app.post('/predict',async(req,res)=>{
  try{
    const{text}=req.body;
    const response = await axios.post('http://127.0.0.1:8000/predict',{ text },);

    // 直接返回字符串
    res.json({ result: response.data.prediction });

    const resultString = response.data.prediction;
    nlpResult = resultString;
    console.log(resultString);

    // // 提取结果字段
    // const resultString = response.data.result; // 关键修改：提取result字段
    // res.json({ result: resultString }); // 返回JSON
  }catch(error){
  res.status(500).json({ error:'Failed to get prediction'});
  }
});


function parseNLPString(nlpString) {
    let scenes = {};
    let parts = nlpString.split(" ");
    let currentScene = null;

    parts.forEach(part => {
        if (part.match(/[A-Z]/)) {
            currentScene = part; // 记录当前场景 (A, B, ...)
            if (!scenes[currentScene]) {
                scenes[currentScene] = [];
            }
        } else if (currentScene !== null) {
            let componentId = parseInt(part, 10);
            if (!isNaN(componentId)) {
                scenes[currentScene].push(componentId);
            }
        }
    });

    return scenes;
}

// 处理前端请求，返回组件数据（基于 NLP 解析）
app.get("/components", async (req, res) => {
    try {
        const scenes = parseNLPString(nlpResult);

        let result = {};
        for (let scene in scenes) {
            const ids = scenes[scene];
            const query = `SELECT * FROM components WHERE id = ANY($1)`;
            const { rows } = await pool.query(query, [ids]);
            result[scene] = rows;
        }

        res.json(result);
    } catch (error) {
        console.error("数据库查询错误:", error);
        res.status(500).json({ error: "服务器错误" });
    }
});

// 新增接口：根据 relate_id 查询相关组件的 HTML 代码
app.get("/related-component/:relateId", async (req, res) => {
    try {
        const { relateId } = req.params;
        const query = `SELECT html FROM components WHERE relate_id = $1`;
        const { rows } = await pool.query(query, [relateId]);

        if (rows.length > 0) {
            res.json({ html: rows[0].html }); // 返回相关组件的 HTML 代码
        } else {
            res.status(404).json({ error: "未找到相关组件" });
        }
    } catch (error) {
        console.error("数据库查询错误:", error);
        res.status(500).json({ error: "服务器错误" });
    }
});

// 用户注册
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [username, hashedPassword]);
        res.status(201).json({ message: "用户注册成功" });
    } catch (error) {
        res.status(500).json({ error: "注册失败" });
    }
});

// 用户登录
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "用户不存在" });
        }
        const user = result.rows[0];
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: "密码错误" });
        }
        const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: "1h" });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: "登录失败" });
    }
});

// 认证中间件
function authenticateToken(req, res, next) {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).json({ error: "未授权" });
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: "令牌无效" });
        req.user = user;
        next();
    });
}

// 存储对话记录
app.post("/save-history", authenticateToken, async (req, res) => {
    const { userMessage, aiReply } = req.body;
    try {
        await pool.query("INSERT INTO chat_history (user_id, user_message, ai_reply) VALUES ($1, $2, $3)",
            [req.user.userId, userMessage, aiReply]);
        res.json({ message: "会话记录已保存" });
    } catch (error) {
        res.status(500).json({ error: "保存失败" });
    }
});

// 获取历史记录
app.get("/history", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM chat_history WHERE user_id = $1", [req.user.userId]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "获取历史记录失败" });
    }
});

app.listen(3000, () => {
    console.log(`Server is running on http://localhost:${3000}`);
});