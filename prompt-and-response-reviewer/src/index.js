export default {
	async fetch(request, env) {
		const key = request.headers.get("X-API-Key");
		if (key !== env.API_TOKEN) {
			return new Response("Forbidden", { status: 403 });
		}

		const { prompt, response } = await request.json();

		// First, use the reranker
		const rerankResult = await env.AI.run('@cf/baai/bge-reranker-base', {
			query: prompt,
			contexts: [{
				text: response
			}]
		});

		const score = rerankResult.response[0].score;

		// If score is high enough, return early
		if (score >= 0.9) {
			return new Response(JSON.stringify({
				status: "pass",
				score,
				response
			}), { headers: { "Content-Type": "application/json" } });
		}

		// Use AI to improve initial response if the rank score was too low.
		const newPrompt = `
			You are an assistant that checks if a response correctly answers a given prompt. If the response is incorrect, incomplete, or unclear, rewrite it so it fully satisfies the prompt.

			Only return the corrected response. Do not include explanations, markdown, or any extra text.

			Prompt:
			“””
			${prompt}
			“””

			Response:
			“””
			${response}
			“””

			Fix the response if needed so it correctly answers the prompt.
		`;

		const newResult = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
			prompt: newPrompt,
			max_tokens: 1024
		});

		return new Response(JSON.stringify({
			status: "fallback",
			score,
			response: newResult.response.trim()
		}),
		{
			headers: {
				"Content-Type": "application/json"
			}
		});
	}
  };
