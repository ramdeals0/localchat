const conversationId = process.argv[2];
if (!conversationId) {
  console.error("Usage: node scripts/test-stream.mjs <conversationId>");
  process.exit(1);
}

const response = await fetch(
  `http://127.0.0.1:3001/api/chat/${conversationId}/messages`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "Hello" }),
  },
);

if (!response.ok || !response.body) {
  console.error("Request failed", response.status);
  process.exit(1);
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let tokens = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const chunks = buffer.split("\n\n");
  buffer = chunks.pop() ?? "";
  for (const chunk of chunks) {
    const line = chunk.split("\n").find((l) => l.startsWith("data: "));
    if (!line) continue;
    const event = JSON.parse(line.slice(6));
    if (event.type === "token") tokens += event.content;
    console.log(JSON.stringify(event));
  }
}

console.log("\n--- Assistant reply ---\n" + tokens);

const loaded = await fetch(
  `http://127.0.0.1:3001/api/conversations/${conversationId}`,
).then((r) => r.json());

console.log("\n--- Persisted messages ---");
for (const message of loaded.messages) {
  console.log(`${message.role}: ${message.content.slice(0, 120)}`);
}
