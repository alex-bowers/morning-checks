from flask import Flask, request, abort, Response
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup, Comment
from flask_caching import Cache
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv()
import time
import os
import random

def seconds_until_midnight():
    now = datetime.now()
    midnight = datetime.combine(now.date() + timedelta(days=1), datetime.min.time())
    return int((midnight - now).total_seconds())

app = Flask(__name__)
app.config["CACHE_TYPE"] = "SimpleCache"
app.config["CACHE_DEFAULT_TIMEOUT"] = seconds_until_midnight()
cache = Cache(app)

API_SECRET_TOKEN = os.getenv("API_SECRET_TOKEN")
WISHLIST_URL = os.getenv("SCRAPER_ROUTE")
USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.2420.81",
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/12.0 Chrome/79.0.3945.136 Mobile Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
]
random_user_agent = random.choice(USER_AGENTS)

@app.route("/wishlist-scraper-dom", methods=["GET"])
@cache.cached(timeout=seconds_until_midnight())
def get_wishlist_scraper_dom():
    auth = request.headers.get("X-API-Key")
    if auth != API_SECRET_TOKEN:
        abort(403)

    if not WISHLIST_URL:
        return "Route is not set", 500

    options = Options()
    options.add_argument(f"--user-agent={random_user_agent}")
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    service = Service("/usr/local/bin/chromedriver")
    driver = webdriver.Chrome(service=service, options=options)

    driver.get(WISHLIST_URL)
    time.sleep(3)

    # Scroll to load all content
    last_height = driver.execute_script("return document.body.scrollHeight")
    while True:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(3)
        new_height = driver.execute_script("return document.body.scrollHeight")
        if new_height == last_height:
            break
        last_height = new_height

    full_html = driver.page_source
    driver.quit()

    soup = BeautifulSoup(full_html, "html.parser")

    # Remove unwanted tags by name
    for tag in soup(["script", "style", "meta", "link", "svg", "img", "noscript", "iframe", "i", "header", "footer", "nav", "form"]):
        tag.decompose()

    # Remove elements by class or ID using CSS selectors
    selectors = [
        ".a-popover-preload",
        ".copilot-secure-display",
        "#navLeftFooter",
        "#be",
        "#a-popover-root",
        "#hmenu-canvas-background",
        ".navLeftFooter",
        ".a-spacing-base",
        '.aok-hidden'
    ]
    for selector in selectors:
        for el in soup.select(selector):
            el.decompose()

    # Remove comments
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        comment.extract()

    # Strip extra whitespace in text nodes
    for text_node in soup.find_all(string=True):
        if not isinstance(text_node, Comment):
            text_node.replace_with(" ".join(text_node.split()))

    uls = soup.find_all("ul")
    filtered_uls = [
        ul for ul in uls
        if ul.get("role") != "tablist" and ul.get("aria-hidden") != "true" and ul.has_attr("class")
    ]
    ul_html = "".join(str(ul) for ul in filtered_uls)

    return Response(ul_html, mimetype="text/html")
