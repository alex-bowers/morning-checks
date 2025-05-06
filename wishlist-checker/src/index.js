export default {
	async fetch(request, env, ctx) {
		const key = request.headers.get("X-API-Key");
		if (key !== env.API_TOKEN) {
			return new Response("Forbidden", { status: 403 });
		}

		const { prompt } = await request.json();

		if (!prompt) {
			return new Response("Failed to find the prompt", { status: 400 });
		}

		const response = await fetch(env.WISHLIST_URL, {
			headers: { "X-API-Key": env.SECRET_TOKEN },
		});

		if (!response.ok) {
			return new Response("Failed to fetch DOM", { status: 500 });
		}

		const domText = await response.text();

		const fullPrompt = `
			${prompt}

			HTML:
			${domText}
		`;

		const cacheKey = `wishlist-cache-${new Date().toISOString().split("T")[0]}`;
		const cached = await env.CACHE.get(cacheKey);
		if (cached) {
			return new Response(JSON.stringify({
				prompt: fullPrompt,
				response: cached
			}));
		}

		const aiResponse = await env.AI.run("@cf/mistralai/mistral-small-3.1-24b-instruct", {
			messages: [{ role: "user", content: fullPrompt }],
		});

		let data;
		let initialResponse = aiResponse.response;

		if (initialResponse.startsWith("```")) {
			const lines = aiResponse.response.trim().split('\n');
			if (lines.length > 2) {
				initialResponse = lines.slice(1, -1).join('\n');
			} else {
				return new Response("Response is too short to remove first and last lines.", { status: 500 });
			}
		}

		try {
			data = JSON.parse(initialResponse);
		} catch {
			return new Response("AI response not valid JSON", { status: 500 });
		}

		if (data.length === 0) {
			return new Response("No cheap items found.");
		}

		const expiry = new Date();
		expiry.setUTCHours(23, 59, 59, 999);
		const ttl = Math.floor((expiry - new Date()) / 1000);

		await env.CACHE.put(cacheKey, initialResponse, { expirationTtl: ttl });

		return new Response(JSON.stringify({
			prompt: fullPrompt,
			response: initialResponse
		}));
	},
};
