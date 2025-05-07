// This file contains helper functions for working with Figma nodes

/**
 * Finds a logo node within an array of Figma nodes
 * @param nodes - Array of Figma nodes to search through
 * @returns The logo node if found, otherwise null
 */
export function findLogoNode(nodes) {
  if (!nodes || !Array.isArray(nodes)) return null;

  return nodes.find((node) => {
    // Check if node name contains logo-related keywords
    const isLogo =
      node &&
      (
        (node.name && /logo|brand|icon/i.test(node.name)) ||
        // Check if it's an image node that might be a logo
        (node.type === 'IMAGE') ||
        // Check if it's a rectangle that might contain a logo image
        (node.type === 'RECTANGLE' &&
         node.fills &&
         node.fills.some(fill => fill.type === 'IMAGE'))
      );

    return isLogo;
  }) || null;
}

/**
 * Determines if a node is an input placeholder
 * @param node - Figma node to check
 * @returns Boolean indicating if the node is an input placeholder
 */
export const isInputPlaceholder = (node) => {
  if (node.type !== 'TEXT') return false;
  const text = node.characters?.toLowerCase() || '';
  return (
    /enter|type|your|e\.g\./.test(text) && !/\*$/.test(node.characters || '')
  );
};

/**
 * Determines if a node is a label
 * @param node - Figma node to check
 * @returns Boolean indicating if the node is a label
 */
export const isLabel = (node) => {
  if (node.type !== 'TEXT') return false;
  const text = node.characters?.toLowerCase() || '';
  return (
    /email|password|confirm|name|username|subject|message|phone/.test(text) &&
    /\*$/.test(node.characters || '')
  );
};

/**
 * Finds input candidate nodes within an array of Figma nodes
 * @param nodes - Array of Figma nodes to search through
 * @returns Array of input candidate nodes
 */
export function findInputCandidates(nodes) {
  if (!nodes || !Array.isArray(nodes)) return [];

  return nodes.filter(node => {
    // Check for rectangles that might be input fields
    if (node.type === 'RECTANGLE' || node.type === 'FRAME') {
      // Check if it has a child that's a placeholder text
      const hasPlaceholder = node.children?.some(child => isInputPlaceholder(child));
      if (hasPlaceholder) return true;

      // Check if it has a sibling or nearby node that's a label
      const hasNearbyLabel = nodes.some(otherNode =>
        isLabel(otherNode) &&
        Math.abs(otherNode.absoluteBoundingBox?.y - node.absoluteBoundingBox?.y) < 50
      );
      if (hasNearbyLabel) return true;
    }

    return false;
  });
}