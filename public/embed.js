/**
 * Slotly Embed Widget
 * Usage:
 *   <div id="slotly-widget" data-slug="call"></div>
 *   <script src="https://YOUR_DOMAIN/embed.js"></script>
 *
 * Options (data attributes on the container):
 *   data-slug     – event type slug (required, e.g. "intro", "call", "deep-dive")
 *   data-width    – widget width (default: "100%")
 *   data-height   – widget height (default: "620px")
 */
(function () {
  "use strict";

  // Determine the base URL from the script's own src
  var scripts = document.getElementsByTagName("script");
  var currentScript = scripts[scripts.length - 1];
  var scriptSrc = currentScript.src || "";
  var baseUrl = scriptSrc.replace(/\/embed\.js(\?.*)?$/, "");

  // Find all widget containers
  var containers = document.querySelectorAll("[id='slotly-widget'], [data-slotly]");

  if (containers.length === 0) return;

  containers.forEach(function (container) {
    var slug = container.getAttribute("data-slug") || "call";
    var width = container.getAttribute("data-width") || "100%";
    var height = container.getAttribute("data-height") || "620px";

    // Create iframe
    var iframe = document.createElement("iframe");
    iframe.src = baseUrl + "/book/" + slug;
    iframe.style.width = width;
    iframe.style.height = height;
    iframe.style.border = "none";
    iframe.style.borderRadius = "16px";
    iframe.style.overflow = "hidden";
    iframe.style.maxWidth = "100%";
    iframe.style.display = "block";
    iframe.style.margin = "0 auto";
    iframe.style.boxShadow = "0 4px 24px rgba(0,0,0,0.08)";
    iframe.setAttribute("title", "Book a meeting — Slotly");
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("allow", "clipboard-write");

    // Clear container and insert iframe
    container.innerHTML = "";
    container.appendChild(iframe);

    // Auto-resize: listen for postMessage from the embedded page
    window.addEventListener("message", function (e) {
      if (e.data && e.data.type === "slotly-resize" && e.source === iframe.contentWindow) {
        iframe.style.height = e.data.height + "px";
      }
    });
  });
})();
