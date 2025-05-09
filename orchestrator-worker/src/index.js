async function comparePromptAndResponse(url, key, initialPrompt, initialResponse) {
	const compareResponse = await fetch(url, {
		method: "POST",
		headers: { "X-API-Key": key },
		body: JSON.stringify({
			prompt: initialPrompt,
			response: initialResponse
		}),
	});

	if (!compareResponse.ok) {
		return new Response("Failed to compare results.", { status: 500 });
	}

	const { response } = await compareResponse.json();
	return response;
}

async function fetchWishlist(key, prompt, url) {
	const wishlistResponse = await fetch(url, {
		method: "POST",
		headers: { "X-API-Key": key },
		body: JSON.stringify({
			prompt: prompt
		}),
	});

	if (!wishlistResponse.ok) {
		return new Response("Failed to fetch wishlist.", { status: 500 });
	}

	return await wishlistResponse.json();
}

async function formatResponse(response) {
	let data;

	if (response.startsWith("```")) {
		const lines = aiResponse.response.trim().split('\n');
		if (lines.length > 2) {
			response = lines.slice(1, -1).join('\n');
		} else {
			return new Response("Response is too short to remove first and last lines.", { status: 500 });
		}
	}

	try {
		data = JSON.parse(`${response}`);
	} catch {
		return new Response("AI response not valid JSON", { status: 500 });
	}

	return data.map(item => `- ${item.title}* - ${item.price}`).join("\n");
}

async function sendSlackMessage(url, response) {
	await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			text: response
		}),
	});
}

async function runCoreLogic(env) {
	try {
		const {
			COMPARE_URL,
			COMPARE_WISHLIST_API_KEY,
			SLACK_URL,
			WISHLIST_API_KEY,
			WISHLIST_PROMPT,
			WISHLIST_URL
		} = env;

		const wishlistResult = await fetchWishlist(
			WISHLIST_API_KEY,
			WISHLIST_PROMPT,
			WISHLIST_URL
		);

		if (wishlistResult.response.length > 0) {
			const finalResponse = await comparePromptAndResponse(
				COMPARE_URL,
				COMPARE_WISHLIST_API_KEY,
				wishlistResult.prompt,
				wishlistResult.response
			);

			const formattedFinalResponse = await formatResponse(finalResponse);

			await sendSlackMessage(SLACK_URL, formattedFinalResponse)
		}

		return JSON.stringify({
			"success": true
		});
	} catch (err) {
		return JSON.stringify({
			"success": false,
			"error": err
		})
	}
}

export default {
	async fetch(request, env, ctx) {
		const logicResponse = await runCoreLogic(env);
		return new Response(logicResponse);
	},
	async scheduled(event, env, ctx) {
		const logicResponse = await runCoreLogic(env);
		return new Response(logicResponse, { status: 500 });
	}
};
