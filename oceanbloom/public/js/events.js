/*
 * events.js - EVENT-DRIVEN PROGRAMMING
 * ------------------------------------
 * A tiny "event bus" (publish / subscribe). Components do not call each other
 * directly. Instead one component emits an event ("level:up") and any other
 * component that cares has subscribed to it with on().
 *
 * This is what keeps the code LOOSELY COUPLED: the game logic never mentions the
 * canvas, and the canvas never mentions the web service.
 *
 * Code origin: first version generated with Claude (Anthropic), then read, tested
 * and adapted by me. (Student: replace this line with your own wording/name.)
 */
const EventBus = {
  handlers: {},

  // Register a function that runs whenever `name` is emitted.
  on(name, handler) {
    if (!this.handlers[name]) {
      this.handlers[name] = [];
    }
    this.handlers[name].push(handler);
  },

  // Announce that something happened. Every subscriber is called with `data`.
  emit(name, data) {
    const list = this.handlers[name] || [];
    list.forEach(function (handler) {
      handler(data);
    });
  }
};
