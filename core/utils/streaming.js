/**
 * Read a server-sent events response and emit parsed JSON events.
 * @param {Response} response
 * @param {(event: any) => void} onEvent
 * @returns {Promise<void>}
 */
export async function readSseStream(response, onEvent) {
  if (!response.body) {
    throw new Error("Streaming response body is empty.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let dataLines = [];
  let eventCount = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) {
        const data = dataLines.join("\n").trim();
        dataLines = [];
        if (!data) continue;
        if (data === "[DONE]") return;

        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (error) {
          continue;
        }

        eventCount += 1;
        onEvent?.(parsed);
        continue;
      }

      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
  }

  if (buffer) {
    if (buffer.startsWith("data:")) {
      dataLines.push(buffer.slice(5).trimStart());
    } else {
      const extracted = extractSseData(buffer);
      if (extracted) {
        dataLines.push(extracted);
      }
    }
  }

  const tail = dataLines.join("\n").trim();
  if (tail) {
    if (tail === "[DONE]") return;
    try {
      const parsed = JSON.parse(tail);
      eventCount += 1;
      onEvent?.(parsed);
    } catch (error) {
      // Ignore trailing parse errors.
    }
  }

  if (eventCount === 0) {
    console.warn("SSE stream ended without any events.");
  }
}

/**
 * Read a newline-delimited JSON response and emit parsed events.
 * @param {Response} response
 * @param {(event: any) => void} onEvent
 * @returns {Promise<void>}
 */
export async function readNdjsonStream(response, onEvent) {
  if (!response.body) {
    throw new Error("Streaming response body is empty.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventCount = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (error) {
        continue;
      }

      eventCount += 1;
      onEvent?.(parsed);
    }
  }

  const remaining = buffer.trim();
  if (remaining) {
    try {
      const parsed = JSON.parse(remaining);
      eventCount += 1;
      onEvent?.(parsed);
    } catch (error) {
      // Ignore trailing parse errors.
    }
  }

  if (eventCount === 0) {
    console.warn("NDJSON stream ended without any events.");
  }
}

function extractSseData(chunk) {
  const lines = chunk.split("\n");
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length) {
    return dataLines.join("\n");
  }

  // Fallback: some servers send raw JSON without "data:" lines.
  const trimmed = chunk.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    return trimmed.slice(jsonStart, jsonEnd + 1);
  }

  return null;
}
