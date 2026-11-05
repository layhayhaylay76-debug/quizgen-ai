
const express = require("express");
const path = require("path");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/generate", async (req, res) => {
  try {
    const { topic, source, type, difficulty, amount } = req.body;

    if (!topic?.trim() && !source?.trim()) {
      return res.status(400).json({ error: "Enter a topic or paragraph." });
    }

    const count = Math.min(15, Math.max(5, Number(amount) || 10));
    const questionType = ["mcq", "tf", "short"].includes(type)
      ? type : "mcq";

    const prompt = `
Create exactly ${count} ${questionType} quiz questions.
Difficulty: ${difficulty || "Medium"}.

Topic: ${topic || "Not provided"}

Study material:
${source || "Create questions using the topic."}

Rules:
- Base questions on the supplied study material when available.
- MCQ: provide 4 options.
- True/False: provide options ["True","False"].
- Short answer: provide an empty options array.
- Give the correct answer and a short explanation.
- Return ONLY valid JSON in this format:
{
  "questions": [
    {
      "q": "Question",
      "opts": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "why": "Explanation"
    }
  ]
}
`;

const models = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash"
];

let response;
let data;

for (const model of models) {
  response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.Quiz_gen_AI
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7
        }
      })
    }
  );

  data = await response.json();

  if (response.ok) break;

  if (response.status !== 503 && response.status !== 429) break;
}
    

    if (!response.ok) {
  console.error("Gemini API error:", data);
  return res.status(502).json({
    error: `Gemini API error (${response.status}): ${data.error?.message || JSON.stringify(data)}`
  });
            }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      throw new Error("Gemini returned an empty response.");
    }

    const result = JSON.parse(resultText);

    if (!Array.isArray(result.questions)) {
      throw new Error("Invalid quiz format.");
    }

    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "QuizGen AI backend is running!" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`QuizGen AI running on port ${PORT}`);
});

