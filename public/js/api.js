/*
 * api.js - INTEROPERABILITY (the Fish Game web service)
 * -----------------------------------------------------
 * The Fish Game service (https://marcconrad.com/uob/fish/doc.php) is written by
 * someone else and runs on a different server. Three systems cooperate here:
 *
 *   browser  --GET /api/fish (JSON)-->  OceanBloom server  --HTTPS GET (JSON)-->  Fish Game service
 *
 * The Fish Game service returns, for example:
 *   { "question": "https://www.sanfoh.com/uob/fish/data/ch_...png", "fish": 2, "chest": 7 }
 *   question = URL of a picture with fish and a treasure chest, fish = the correct count.
 * Our server (server.js) calls it, checks the answer has the shape we expect, and
 * passes on { imageUrl, answer }. This file calls OUR server.
 *
 * The rest of the game only calls FishApi.fetchQuestion() and does not know about
 * URLs or JSON. Here we also add a timeout so a slow server cannot freeze the game.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const FishApi = {
  URL: '/api/fish',
  TIMEOUT_MS: 25000,   // longer than the server's 3 attempts (about 20 s at most)

  async fetchQuestion() {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, this.TIMEOUT_MS);

    try {
      const response = await fetch(this.URL, {
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (response.status === 401) {
        window.location.href = 'login.html';
        throw new Error('Please log in again.');
      }
      const data = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        throw new Error(data.error || 'The server answered with HTTP ' + response.status);
      }
      if (typeof data.imageUrl !== 'string' || typeof data.answer !== 'number') {
        throw new Error('Unexpected response from the server.');
      }
      return { imageUrl: data.imageUrl, answer: data.answer };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('The Fish Game service took too long to answer.');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
};
