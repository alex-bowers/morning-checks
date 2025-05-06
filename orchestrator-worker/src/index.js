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

async function formatResponse(response) {
	let data;
	try {
		data = JSON.parse(response);
	} catch {
		return new Response("AI response not valid JSON", { status: 500 });
	}

	return data.map(item => `- ${item.title}* - ${item.price}`).join("\n");
}

export default {
	async fetch(request, env, ctx) {
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

			return new Response(JSON.stringify({
				"success": true
			}));
		} catch (err) {
			return new Response(`Error: ${err}`, { status: 500 });
		}
	}
};
