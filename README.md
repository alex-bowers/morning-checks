# Morning Checks

I wanted to automate some of the internet searches that I do each morning.

1. Check if there are any deals on my wish list. :white_check_mark:
2. Find any American sport highlight videos from the previous night. [WIP]

I chose a orchestrator-worker pattern and I have used Cloudflare Workers, a Python script and AI to start this project. Selenium is doing the scraping.

### Wishlist Checker
The [orchestrator worker](./orchestrator-worker/) triggers the [wishlist-checker](./wishlist-checker/) and once we have a response, we then compare that validity of the LLM's answer in [prompt-and-response-reviewer](./prompt-and-response-reviewer/). If the response does not pass a certain standard, I trigger a new prompt to a different model to try and improve on the previous response. Once this is done, I send a Slack notification if a deal has been found on my wish list.
