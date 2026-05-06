const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;

const SYSTEM_PROMPT =
  "你是一个专业的中文邮件改写助手。只输出改写后的正文，不要解释、不要加标题、不要使用Markdown。";

const TONE_PROMPTS = {
  formal:
    "请将用户输入改写为正式、专业、商务的邮件语气。要求礼貌、清晰、简洁，适合职场沟通。",
  friendly:
    "请将用户输入改写为亲切、自然、友好的邮件语气。要求真诚、口语化但不失礼貌，适合同事或合作方沟通。",
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "仅支持 POST。" });
  }

  if (!ZHIPU_API_KEY) {
    return res.status(500).json({ error: "服务端未配置 ZHIPU_API_KEY。" });
  }

  try {
    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const content = String(body.content || "").trim();
    const tone = body.tone === "friendly" ? "friendly" : "formal";

    if (!content) {
      return res.status(400).json({ error: "content 不能为空。" });
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
      return res
        .status(response.status >= 400 && response.status < 600 ? response.status : 502)
        .json({ error: data.error?.message || "智谱接口请求失败。" });
    }

    const rewritten = data?.choices?.[0]?.message?.content?.trim();
    if (!rewritten) {
      return res.status(502).json({ error: "未获取到有效改写结果。" });
    }

    return res.status(200).json({ rewritten });
  } catch (error) {
    return res.status(500).json({ error: `服务异常：${error.message}` });
  }
};
