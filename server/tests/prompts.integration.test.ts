import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { closeDatabase, resetDatabaseForTests } from "../src/db/database.js";

describe("prompts API integration", () => {
  let dbPath: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    resetDatabaseForTests();
    dbPath = path.join(
      os.tmpdir(),
      `localchat-prompt-api-${Date.now()}-${Math.random()}.db`,
    );
    process.env.DATABASE_PATH = dbPath;
    app = createApp();
  });

  afterEach(() => {
    closeDatabase();
    resetDatabaseForTests();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    delete process.env.DATABASE_PATH;
  });

  it("creates, lists, duplicates, and uses a template", async () => {
    const createResponse = await request(app)
      .post("/api/prompts")
      .send({
        title: "Test template",
        userPromptTemplate: "Write about {{topic}}",
        category: "Testing",
      })
      .expect(201);

    const promptId = createResponse.body.id as string;

    await request(app).get("/api/prompts").expect(200).expect((response) => {
      expect(response.body).toHaveLength(6);
    });

    const duplicateResponse = await request(app)
      .post(`/api/prompts/${promptId}/duplicate`)
      .expect(201);
    expect(duplicateResponse.body.title).toContain("(copy)");

    const useResponse = await request(app)
      .post(`/api/prompts/${promptId}/use`)
      .send({ variables: { topic: "offline AI" } })
      .expect(201);

    expect(useResponse.body.conversationId).toBeTruthy();
    expect(useResponse.body.conversation.messages[0].content).toBe(
      "Write about offline AI",
    );
  });

  it("returns validation errors for incomplete template use", async () => {
    const createResponse = await request(app)
      .post("/api/prompts")
      .send({
        title: "Needs value",
        userPromptTemplate: "Analyze {{topic}}",
      })
      .expect(201);

    await request(app)
      .post(`/api/prompts/${createResponse.body.id}/use`)
      .send({ variables: {} })
      .expect(400);
  });

  it("filters archived prompts from default list", async () => {
    const createResponse = await request(app)
      .post("/api/prompts")
      .send({
        title: "Archived template",
        userPromptTemplate: "Hello",
      })
      .expect(201);

    await request(app)
      .put(`/api/prompts/${createResponse.body.id}`)
      .send({ isArchived: true })
      .expect(200);

    const listResponse = await request(app).get("/api/prompts").expect(200);
    expect(
      listResponse.body.some((prompt: { id: string }) => prompt.id === createResponse.body.id),
    ).toBe(false);

    const archivedResponse = await request(app)
      .get("/api/prompts?includeArchived=true")
      .expect(200);
    expect(
      archivedResponse.body.some(
        (prompt: { id: string }) => prompt.id === createResponse.body.id,
      ),
    ).toBe(true);
  });
});
