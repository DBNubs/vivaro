// Utility functions for browser and Neutralino operations

/**
 * Opens a URL in the system browser.
 * Uses Neutralino's os.open() when available, otherwise falls back to window.open().
 *
 * @param {string} url - The URL to open
 * @param {boolean} preventDefault - Whether to prevent default link behavior (default: true)
 */
export const openExternalLink = async (url, preventDefault = true) => {
  if (!url) {
    console.warn('openExternalLink: No URL provided');
    return;
  }

  // Check if we're in Neutralino and os.open is available
  if (typeof window !== 'undefined' && window.Neutralino && window.Neutralino.os && window.Neutralino.os.open) {
    try {
      await window.Neutralino.os.open(url);
      return;
    } catch (error) {
      console.error('Error opening URL with Neutralino:', error);
      // Fall through to browser fallback
    }
  }

  // Browser fallback
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Error opening URL in browser:', error);
  }
};

/**
 * Handles click events on links, opening external links in the system browser.
 * Use this as an onClick handler for anchor tags that should open externally.
 *
 * @param {Event} event - The click event
 * @param {string} url - Optional URL (if not provided, will try to get from event.target.href)
 */
export const handleExternalLinkClick = async (event, url = null) => {
  event.preventDefault();
  event.stopPropagation();

  const linkUrl = url || event.currentTarget?.href || event.target?.href;
  if (linkUrl) {
    await openExternalLink(linkUrl);
  }
};
