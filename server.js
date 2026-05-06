const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;

const SYSTEM_PROMPT =
  "你是一个专业的中文邮件改写助手。只输出改写后的正文，不要解释、不要加标题、不要使用Markdown。";

const TONE_PROMPTS = {
  formal:
    "请将用户输入改写为正式、专业、商务的邮件语气。要求礼貌、清晰、简洁，适合职场沟通。",
  friendly:
    "请将用户输入改写为亲切、自然、友好的邮件语气。要求真诚、口语化但不失礼貌，适合同事或合作方沟通。",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("请求体过大"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function handleRewrite(req, res) {
  if (!ZHIPU_API_KEY) {
    sendJson(res, 500, { error: "服务端未配置 ZHIPU_API_KEY。" });
    return;
  }

  try {
    const bodyText = await readRequestBody(req);
    const body = JSON.parse(bodyText || "{}");
    const content = String(body.content || "").trim();
    const tone = body.tone === "friendly" ? "friendly" : "formal";

    if (!content) {
      sendJson(res, 400, { error: "content 不能为空。" });
      return;
    }

    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({
        model: "glm-4-flash",
        temperature: 0.7,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `${TONE_PROMPTS[tone]}\n\n原始内容如下：\n${content}`,
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      sendJson(res, response.status, { error: data.error?.message || "智谱接口请求失败。" });
      return;
    }

    const rewritten = data?.choices?.[0]?.message?.content?.trim();
    if (!rewritten) {
      sendJson(res, 502, { error: "未获取到有效改写结果。" });
      return;
    }

    sendJson(res, 200, { rewritten });
  } catch (error) {
    sendJson(res, 500, { error: `服务异常：${error.message}` });
  }
}

function serveIndexHtml(res) {
  const filePath = path.join(__dirname, "index.html");
  fs.readFile(filePath, "utf8", (err, content) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("无法读取 index.html");
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/rewrite") {
    handleRewrite(req, res);
    return;
  }

  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    serveIndexHtml(res);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
