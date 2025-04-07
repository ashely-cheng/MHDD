const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const axios = require("axios");

const app = express();
const port = 5000;
const SECRET_KEY = "your_secret_key";

// 更新 CORS 配置
app.use(cors({
    origin: true, // 或者指定你的前端地址，如 'http://127.0.0.1:8889'
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.options('*', cors()); // 允许所有路由的 OPTIONS 请求
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

//连接数据库
app.get("/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW() as current_time");
        res.json({ success: true, time: result.rows[0].current_time });
    } catch (error) {
        console.error("数据库连接错误:", error);
        res.status(500).json({ error: "数据库连接失败" });
    }
});

//调用api接口，储存返回结果
let nlpResult;
app.post('/predict', async (req, res) => {
    try {
        const { text } = req.body;
        const response = await axios.post('http://127.0.0.1:8000/predict', { text },);

        // 直接返回字符串
        res.json({ result: response.data.prediction });

        const resultString = response.data.prediction;
        nlpResult = resultString;
        console.log(resultString);


    } catch (error) {
        res.status(500).json({ error: 'Failed to get prediction' });
    }
});

// 修改parseNLPString函数，处理新的NLP输出格式
function parseNLPResult(nlpResult) {
    // 如果结果是 JSON 字符串，则解析；否则直接处理原始字符串
    let result;
    try {
        result = typeof nlpResult === 'string' ? JSON.parse(nlpResult) : nlpResult;
    } catch (e) {
        // 如果不是 JSON，则按原始字符串处理
        result = { intent: '0', slot: nlpResult || '' };
    }

    // 提取意图和槽位
    const intent = result.intent || '0'; // 默认意图为添加组件
    const slot = result.slot || '';

    // 解析槽位信息
    let scenes = {};
    let parts = slot.trim().split(" ");
    let currentScene = null;

    parts.forEach(part => {
        if (part.match(/[A-Z]/)) {
            currentScene = part; // 记录当前场景 (A, B, ...)
            if (!scenes[currentScene]) {
                scenes[currentScene] = [];
            }
        } else if (currentScene !== null && part !== '') {
            let componentId = parseInt(part, 10);
            if (!isNaN(componentId)) {
                scenes[currentScene].push(componentId);
            }
        }
    });

    return {
        intent: intent,
        scenes: scenes
    };
}


// 修改/components接口
// 全局组件状态存储

let componentStates = {
    'A': [],  // 客厅初始组件
    'B': [],  // 卧室初始组件
    'C': []   // 厨房初始组件
};

// // 修改/components接口，合并初始组件和动态添加的组件
// app.get("/components", async (req, res) => {
//     try {
//         console.log("[DEBUG] 原始NLP结果:", nlpResult);
//         const { intent, scenes } = parseNLPResult(nlpResult);
//         console.log("[DEBUG] 解析后的意图和场景:", { intent, scenes });

//         // 根据意图处理组件状态
//         switch(intent) {
//             case '0': // 添加组件
//                 for (const [scene, ids] of Object.entries(scenes)) {
//                     componentStates[scene] = [
//                         ...new Set([
//                             ...(componentStates[scene] || []),
//                             ...ids.map(id => parseInt(id))
//                         ])
//                     ];
//                 }
//                 break;

//             case '1': // 删除组件
//                 for (const [scene, ids] of Object.entries(scenes)) {
//                     componentStates[scene] = (componentStates[scene] || [])
//                         .filter(id => !ids.includes(parseInt(id)));
//                 }
//                 break;

//             // ...其他意图处理保持不变
//         }

//         console.log("[DEBUG] 处理后组件状态:", componentStates);

//         // 从数据库获取组件详情
//         const result = {};
//         for (const [scene, ids] of Object.entries(componentStates)) {
//             if (ids.length > 0) {
//                 const query = `SELECT * FROM components WHERE id = ANY($1)`;
//                 const { rows } = await pool.query(query, [ids]);

//                 // 保持原始顺序
//                 result[scene] = ids.map(id => 
//                     rows.find(row => row.id === id) || { id, html: `<div>组件${id}未找到</div>` }
//                 );
//             } else {
//                 result[scene] = []; // 确保空场景也返回空数组
//             }
//         }

//         res.json(result);
//     } catch (error) {
//         console.error("[ERROR] /components接口错误:", error);
//         res.status(500).json({ 
//             error: "内部服务器错误",
//             details: error.message 
//         });
//     }
// });


//修改后的components接口
app.get("/components", async (req, res) => {
    try {
        console.log("[DEBUG] 原始NLP结果:", nlpResult);
        const { intent, scenes } = parseNLPResult(nlpResult);
        console.log("[DEBUG] 解析后的意图和场景:", { intent, scenes });

        // 根据意图处理组件状态
        switch (intent) {
            case '0': // 添加组件
                for (const [scene, ids] of Object.entries(scenes)) {
                    componentStates[scene] = [
                        ...new Set([ // 使用Set去重
                            ...(componentStates[scene] || []),
                            ...ids.map(id => parseInt(id))
                        ])
                    ];
                }
                break;

            case '1': // 删除组件
                for (const [scene, ids] of Object.entries(scenes)) {
                    componentStates[scene] = (componentStates[scene] || [])
                        .filter(id => !ids.includes(parseInt(id)));
                }
                break;

            case '2': // 提高顺序
                for (const [scene, ids] of Object.entries(scenes)) {
                    ids.forEach(targetId => {
                        const arr = componentStates[scene] || [];
                        const index = arr.indexOf(parseInt(targetId));
                        if (index > 0) {
                            [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
                        }
                    });
                }
                break;

            case '3': // 降低顺序
                for (const [scene, ids] of Object.entries(scenes)) {
                    ids.forEach(targetId => {
                        const arr = componentStates[scene] || [];
                        const index = arr.indexOf(parseInt(targetId));
                        if (index >= 0 && index < arr.length - 1) {
                            [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];
                        }
                    });
                }
                break;
        }

        console.log("[DEBUG] 处理后组件状态:", componentStates);

        // 从数据库获取组件详情
        const result = {};
        for (const [scene, ids] of Object.entries(componentStates)) {
            if (ids.length > 0) {
                const query = `SELECT * FROM components WHERE id = ANY($1)`;
                const { rows } = await pool.query(query, [ids]);

                // 保持原始顺序
                result[scene] = ids.map(id =>
                    rows.find(row => row.id === id) || { id, html: `<div>组件${id}未找到</div>` }
                );
            }
        }

        res.json(result);
    } catch (error) {
        console.error("[ERROR] /components接口错误:", error);
        res.status(500).json({
            error: "内部服务器错误",
            details: error.message
        });
    }
});





// 在match1.js中修改/component/:id接口
// app.get("/component/:id", async (req, res) => {
//     try {
//         const { id } = req.params;
//         console.log("Fetching component ID:", id);

//         const query = `SELECT * FROM components WHERE id = $1`;
//         const { rows } = await pool.query(query, [id]);

//         console.log("Query result:", rows);

//         if (rows.length > 0) {
//             // 确保返回的数据包含id和html字段
//             const component = {
//                 id: rows[0].id,
//                 html: rows[0].html,
//                 relate_id: rows[0].relate_id || null
//             };
//             res.json(component);
//         } else {
//             res.status(404).json({ error: "组件不存在" });
//         }
//     } catch (error) {
//         console.error("数据库查询错误详情:", error);
//         res.status(500).json({ error: "服务器错误" });
//     }
// });
// app.get("/component/:id", async (req, res) => {
//     try {
//         const { id } = req.params;
//         console.log("Fetching component ID:", id);

//         const query = `SELECT * FROM components WHERE id = $1`;
//         const { rows } = await pool.query(query, [id]);

//         //console.log("Query result:", rows);

//         if (rows.length > 0) {
//             const component = rows[0];
//             let response = {
//                 id: component.id,
//                 html: component.html,
//                 name: component.name || `组件${component.id}`,
//                 relate_id: component.relate_id || null
//             };

//             // 如果有关联组件，直接获取关联组件内容
//             if (component.relate_id) {
//                 const relatedQuery = `SELECT * FROM components WHERE id = $1`;
//                 const relatedResult = await pool.query(relatedQuery, [component.relate_id]);

//                 if (relatedResult.rows.length > 0) {
//                     response.modalContent = relatedResult.rows[0].html;
//                 } else {
//                     response.modalContent = `<div class="error">关联组件未找到</div>`;
//                 }
//             } else {
//                 response.modalContent = `<div class="empty">该组件没有关联功能</div>`;
//             }

//             res.json(response);
//         } else {
//             res.status(404).json({ error: "组件不存在" });
//         }
//     } catch (error) {
//         console.error("数据库查询错误详情:", error);
//         res.status(500).json({ error: "服务器错误" });
//     }
// });
app.get("/component/:id", async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Fetching component ID:", id);

        // 查询组件
        const query = `SELECT id, html, name, relate_id FROM components WHERE id = $1`;
        const { rows } = await pool.query(query, [id]);

        if (rows.length > 0) {
            const component = rows[0];
            let response = {
                id: component.id,
                html: component.html,
                name: component.name || `组件${component.id}`,
                relate_id: component.relate_id || null
            };

            // 如果组件有关联ID，获取关联组件的内容
            if (component.relate_id) {
                const relatedQuery = `SELECT html FROM components WHERE id = $1`;
                const relatedResult = await pool.query(relatedQuery, [component.relate_id]);

                if (relatedResult.rows.length > 0) {
                    response.modalContent = relatedResult.rows[0].html;
                } else {
                    response.modalContent = `<div class="error">关联组件未找到</div>`;
                }
            } else {
                response.modalContent = `<div class="empty">该组件没有关联功能</div>`;
            }

            res.json(response); // 返回最终的组件数据
        } else {
            res.status(404).json({ error: "组件不存在" });
        }
    } catch (error) {
        console.error("数据库查询错误详情:", error);
        res.status(500).json({ error: "服务器错误" });
    }
});

// 新增接口：根据 relate_id 查询相关组件的 HTML 代码，弹窗功能（没成功）
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
    console.log("收到注册请求:", req.body); // 添加这行

    const { username, password } = req.body;

    // 验证逻辑...

    try {
        console.log("检查用户是否存在:", username);
        const userExists = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        console.log("检查结果:", userExists.rows);

        if (userExists.rows.length > 0) {
            console.log("用户名已存在");
            return res.status(400).json({ error: "用户名已存在" });
        }

        console.log("开始密码哈希...");
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log("密码哈希完成:", hashedPassword);

        console.log("插入用户到数据库...");
        const result = await pool.query(
            "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id",
            [username, hashedPassword]
        );
        console.log("插入成功，用户ID:", result.rows[0].id);

        res.status(201).json({ message: "用户注册成功" });
    } catch (error) {
        console.error("注册过程中出现错误:", error.stack); // 更详细的错误日志
        res.status(500).json({ error: "注册失败，请稍后再试" });
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

// 在文件顶部添加全局状态存储
let globalState = {};

// 修改保存状态接口
app.post('/save-state', async (req, res) => {
    try {
        const { username, state } = req.body;
        globalState[username] = state;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "保存状态失败" });
    }
});

// 修改获取状态接口
app.get('/get-state/:username', async (req, res) => {
    try {
        const { username } = req.params;
        console.log(`获取用户 ${username} 的状态`);

        // 从全局状态或数据库获取状态
        const state = globalState[username] || {};

        // 确保返回有效JSON
        res.json({
            success: true,
            state: state
        });
    } catch (error) {
        console.error("获取状态错误:", error);
        res.status(500).json({
            success: false,
            error: "获取状态失败",
            details: error.message
        });
    }
});

// 获取所有历史对话列表
app.get("/history-list", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, title, created_at FROM history WHERE user_id = $1 ORDER BY created_at DESC",
            [req.user.userId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "获取历史记录列表失败" });
    }
});

// 获取单个历史对话详情
// 在返回历史记录时确保content是对象
app.get("/history/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "SELECT id, title, content FROM history WHERE id = $1 AND user_id = $2",
            [id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "历史记录不存在" });
        }

        let history = result.rows[0];
        // 统一将content转为对象
        if (typeof history.content === 'string') {
            history.content = JSON.parse(history.content);
        }

        res.json(history);
    } catch (error) {
        res.status(500).json({ error: "获取历史记录失败" });
    }
});
// 创建新对话
app.post("/history/new", authenticateToken, async (req, res) => {
    try {
        const { title } = req.body;
        const result = await pool.query(
            "INSERT INTO history (user_id, title, content) VALUES ($1, $2, $3) RETURNING id",
            [req.user.userId, title, JSON.stringify({ messages: [] })]
        );
        res.json({ id: result.rows[0].id });
    } catch (error) {
        res.status(500).json({ error: "创建新对话失败" });
    }
});

// 更新历史对话内容
app.put("/history/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        await pool.query(
            "UPDATE history SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3",
            [JSON.stringify(content), id, req.user.userId]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "更新历史记录失败" });
    }
});

// 添加删除历史记录的接口
// 修改 DELETE 接口
app.delete("/history/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM history WHERE id = $1 AND user_id = $2",
            [id, req.user.userId]);
        res.json({ success: true });
    } catch (error) {
        console.error("删除历史记录失败:", error);
        res.status(500).json({ error: "删除历史记录失败" });
    }
});

app.listen(3000, () => {
    console.log(`Server is running on http://localhost:${3000}`);
});
