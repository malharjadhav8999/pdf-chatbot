import { NextRequest, NextResponse } from "next/server";
import { ChatGroq } from "@langchain/groq";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { retrieveContext } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

type IncomingMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions about an uploaded PDF document ("{fileName}").

Use ONLY the context excerpts below to answer the user's question. The PDF can be about anything — legal contracts, research papers, manuals, reports, invoices, etc.

Rules:
- Answer clearly and concisely, in the same language as the question.
- If the answer is not contained in the excerpts, say you couldn't find it in the document instead of inventing an answer.
- Quote or reference specific details from the excerpts when helpful.

Context excerpts from the document:
---
{context}
---`;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        {
          error:
            "GROQ_API_KEY is not set. Copy .env.local.example to .env.local and add your free Groq key.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const sessionId: string = body.sessionId;
    const messages: IncomingMessage[] = body.messages ?? [];

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session id." }, { status: 400 });
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return NextResponse.json(
        { error: "No user message provided." },
        { status: 400 }
      );
    }

    const retrieved = await retrieveContext(sessionId, lastUser.content, 5);
    if (!retrieved) {
      return NextResponse.json(
        { error: "No PDF found for this session. Please upload a PDF first." },
        { status: 404 }
      );
    }

    const model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.2,
      streaming: true,
    });

    // Pass prior turns (excluding the last user msg) as conversation history.
    const history = messages
      .slice(0, messages.lastIndexOf(lastUser))
      .map((m) =>
        m.role === "user"
          ? new HumanMessage(m.content)
          : new AIMessage(m.content)
      );

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_PROMPT],
      new MessagesPlaceholder("history"),
      ["human", "{question}"],
    ]);

    const chain = prompt.pipe(model);

    const stream = await chain.stream({
      fileName: retrieved.fileName,
      context: retrieved.context,
      history,
      question: lastUser.content,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text =
              typeof chunk.content === "string"
                ? chunk.content
                : "";
            if (text) controller.enqueue(encoder.encode(text));
          }
        } catch (e) {
          console.error("[chat] stream error:", e);
          controller.enqueue(
            encoder.encode("\n\n[Error generating response]")
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Sources": JSON.stringify(retrieved.sources),
      },
    });
  } catch (err) {
    console.error("[chat] error:", err);
    return NextResponse.json(
      { error: "Failed to generate a response." },
      { status: 500 }
    );
  }
}
