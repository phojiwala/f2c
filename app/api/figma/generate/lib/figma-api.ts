// This file contains functions for interacting with the Figma API

/**
 * Fetches thumbnail images for specified nodes in a Figma file
 * @param fileKey - The Figma file key
 * @param nodeIds - Array of node IDs to fetch thumbnails for
 * @param accessToken - Figma API access token
 * @returns Map of node IDs to image URLs
 */
export const fetchFrameThumbnails = async (fileKey, nodeIds, accessToken) => {
  if (!fileKey || !nodeIds || !nodeIds.length || !accessToken) {
    return new Map();
  }

  const thumbnailMap = new Map();
  try {
    const idsString = nodeIds.join(',');
    const response = await fetch(
      `https://api.figma.com/v1/images/${fileKey}?ids=${idsString}&format=png&scale=1`,
      { headers: { 'X-Figma-Token': accessToken } }
    );

    if (!response.ok) {
      let errorBody = `Status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorBody += `, Message: ${errorData.err || errorData.message || JSON.stringify(errorData)}`;
      } catch (e) {
        /* Ignore */
      }
      throw new Error(`Failed to get image URLs (${errorBody})`);
    }

    const data = await response.json();
    if (data.err) {
      throw new Error(`Figma API error getting image URLs: ${data.err}`);
    }

    if (!data.images || Object.keys(data.images).length === 0) {
      console.warn('Figma API returned no image URLs for the requested IDs.');
      return thumbnailMap;
    }

    console.log('Received image URLs:', data.images);

    // Convert the images object to a Map
    Object.entries(data.images).forEach(([nodeId, imageUrl]) => {
      if (imageUrl) {
        thumbnailMap.set(nodeId, imageUrl);
      } else {
        console.warn(`No URL returned for image node ${nodeId}`);
      }
    });

    return thumbnailMap;
  } catch (error) {
    console.error('Failed to fetch thumbnails:', error);
    return thumbnailMap; // Return empty map on error
  }
};