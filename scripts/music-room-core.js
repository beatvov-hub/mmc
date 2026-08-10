(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MusicRoomCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ROUTES = Object.freeze(["YYY", "YYN", "YNY", "YNN", "NYY", "NYN", "NNY", "NNN"]);

  function answersToRoute(answers) {
    if (!Array.isArray(answers) || answers.length !== 3 || answers.some((answer) => typeof answer !== "boolean")) {
      return null;
    }
    return answers.map((answer) => (answer ? "Y" : "N")).join("");
  }

  function getDayInTimeZone(date, timeZone) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      timeZone: timeZone || "Asia/Tokyo"
    });
    return Number(formatter.format(date instanceof Date ? date : new Date(date)));
  }

  function selectTrack(tracks, setId, day, route) {
    if (!Array.isArray(tracks) || !ROUTES.includes(route)) return null;
    return tracks.find((track) => (
      track &&
      track.setId === setId &&
      track.day === day &&
      track.route === route &&
      track.published === true
    )) || null;
  }

  function isSafeHttpsUrl(value) {
    if (typeof value !== "string" || !value) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:";
    } catch (_error) {
      return false;
    }
  }

  return { ROUTES, answersToRoute, getDayInTimeZone, selectTrack, isSafeHttpsUrl };
});

