"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki/bundle/web";

export default function TestShikiPage() {
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const testCode = `function hello(name) {
  if (name) {
    console.log(\`Hello, \${name}!\`);
  } else {
    console.log('Hello, World!');
  }
}`;

    async function test() {
      try {
        console.log("[TEST] Starting Shiki test...");
        const result = await codeToHtml(testCode, {
          lang: "javascript",
          theme: "vitesse-dark",
        });
        console.log("[TEST] Success! HTML length:", result.length);
        setHtml(result);
        setLoading(false);
      } catch (err) {
        console.error("[TEST] Failed:", err);
        setError(String(err));
        setLoading(false);
      }
    }

    test();
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-bold mb-4">Shiki Test Page</h1>

      {loading && <p>Loading Shiki...</p>}

      {error && (
        <div className="bg-red-500/10 border border-red-500 p-4 rounded mb-4">
          <h2 className="font-bold">Error:</h2>
          <pre className="text-sm">{error}</pre>
        </div>
      )}

      {html && (
        <div>
          <h2 className="font-bold mb-2">Result:</h2>
          <div
            className="code-highlight"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </div>
  );
}
