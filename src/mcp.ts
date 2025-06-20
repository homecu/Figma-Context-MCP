import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FigmaService, type FigmaAuthOptions } from "./services/figma.js";
import type { SimplifiedDesign } from "./services/simplify-node-response.js";
import yaml from "js-yaml";
import { Logger } from "./utils/logger.js";
import fs from "fs";
import path from "path";

const serverInfo = {
  name: "Figma MCP Server",
  version: process.env.NPM_PACKAGE_VERSION ?? "unknown",
};

// Function to generate detailed visual description
// Currently unused but kept for future potential use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _generateDetailedVisualDescription(node: any, file: any): string {
  const analyzeNode = (currentNode: any, level: number = 0): string => {
    const indent = "  ".repeat(level);
    let description = "";

    // Element header
    description += `${indent}## ${level === 0 ? "🏗️ " : "📦 "}${currentNode.name || "Unnamed element"} (${currentNode.type})\n\n`;

    // 🎯 Identification and Purpose
    description += `${indent}### 🎯 Identification and Purpose\n`;
    description += `${indent}- **Name**: ${currentNode.name || "Unnamed"}\n`;
    description += `${indent}- **Type**: ${currentNode.type}\n`;
    description += `${indent}- **Apparent function**: ${inferElementPurpose(currentNode)}\n\n`;

    // 📐 Geometry and Position
    if (currentNode.absoluteBoundingBox || currentNode.size) {
      description += `${indent}### 📐 Geometry and Position\n`;

      if (currentNode.absoluteBoundingBox) {
        description += `${indent}- **Position**: x=${currentNode.absoluteBoundingBox.x}px, y=${currentNode.absoluteBoundingBox.y}px\n`;
        description += `${indent}- **Dimensions**: ${currentNode.absoluteBoundingBox.width}px × ${currentNode.absoluteBoundingBox.height}px\n`;
      }

      if (currentNode.layoutAlign) {
        description += `${indent}- **Alignment**: ${currentNode.layoutAlign}\n`;
      }

      if (currentNode.layoutGrow !== undefined) {
        description += `${indent}- **Growth**: ${currentNode.layoutGrow}\n`;
      }

      if (
        currentNode.paddingLeft ||
        currentNode.paddingTop ||
        currentNode.paddingRight ||
        currentNode.paddingBottom
      ) {
        description += `${indent}- **Padding**: top=${currentNode.paddingTop || 0}px, right=${currentNode.paddingRight || 0}px, bottom=${currentNode.paddingBottom || 0}px, left=${currentNode.paddingLeft || 0}px\n`;
      }

      if (currentNode.itemSpacing !== undefined) {
        description += `${indent}- **Item spacing**: ${currentNode.itemSpacing}px\n`;
      }

      description += "\n";
    }

    // 🎨 Visual Appearance
    description += `${indent}### 🎨 Visual Appearance\n`;

    // Colors
    if (currentNode.fills && Array.isArray(currentNode.fills) && currentNode.fills.length > 0) {
      description += `${indent}#### **Colors:**\n`;
      currentNode.fills.forEach((fill: any, index: number) => {
        if (fill.type === "SOLID") {
          const color = rgbToHex(fill.color);
          description += `${indent}- **Fill ${index + 1}**: ${color} (Opacity: ${Math.round((fill.opacity || 1) * 100)}%)\n`;
        }
      });
    }

    // Typography
    if (currentNode.style) {
      description += `${indent}#### **Typography:**\n`;
      description += `${indent}- **Font**: ${currentNode.style.fontFamily || "Not specified"}\n`;
      description += `${indent}- **Size**: ${currentNode.style.fontSize || "Not specified"}px\n`;
      description += `${indent}- **Weight**: ${currentNode.style.fontWeight || "Normal"}\n`;

      if (currentNode.style.textAlignHorizontal) {
        description += `${indent}- **Horizontal alignment**: ${currentNode.style.textAlignHorizontal}\n`;
      }

      if (currentNode.style.textAlignVertical) {
        description += `${indent}- **Vertical alignment**: ${currentNode.style.textAlignVertical}\n`;
      }

      if (currentNode.style.lineHeightPx) {
        description += `${indent}- **Line height**: ${currentNode.style.lineHeightPx}px\n`;
      }
    }

    // Borders
    if (
      currentNode.strokes &&
      Array.isArray(currentNode.strokes) &&
      currentNode.strokes.length > 0
    ) {
      description += `${indent}#### **Borders:**\n`;
      currentNode.strokes.forEach((stroke: any, index: number) => {
        if (stroke.type === "SOLID") {
          const color = rgbToHex(stroke.color);
          description += `${indent}- **Border ${index + 1}**: ${color}, width=${currentNode.strokeWeight || 1}px\n`;
        }
      });

      if (currentNode.cornerRadius !== undefined) {
        description += `${indent}- **Corner radius**: ${currentNode.cornerRadius}px\n`;
      }
    }

    // Effects (shadows, etc.)
    if (
      currentNode.effects &&
      Array.isArray(currentNode.effects) &&
      currentNode.effects.length > 0
    ) {
      description += `${indent}#### **Effects:**\n`;
      currentNode.effects.forEach((effect: any, index: number) => {
        if (effect.type === "DROP_SHADOW") {
          const color = rgbToHex(effect.color);
          description += `${indent}- **Shadow ${index + 1}**: color=${color}, offset=(${effect.offset?.x || 0}px, ${effect.offset?.y || 0}px), blur=${effect.radius || 0}px\n`;
        }
      });
    }

    // Text content
    if (currentNode.characters) {
      description += `${indent}#### **Content:**\n`;
      description += `${indent}- **Text**: "${currentNode.characters}"\n`;
    }

    description += "\n";

    // Process child elements
    if (
      currentNode.children &&
      Array.isArray(currentNode.children) &&
      currentNode.children.length > 0
    ) {
      description += `${indent}### 👥 Child Elements (${currentNode.children.length})\n\n`;
      currentNode.children.forEach((child: any, index: number) => {
        description += analyzeNode(child, level + 1);
        if (index < currentNode.children.length - 1) {
          description += `${indent}---\n\n`;
        }
      });
    }

    return description;
  };

  // Helper function to infer element purpose
  function inferElementPurpose(node: any): string {
    const name = (node.name || "").toLowerCase();
    const type = node.type;

    if (type === "TEXT") return "Text element";
    if (type === "RECTANGLE" && name.includes("button")) return "Button";
    if (type === "RECTANGLE" && name.includes("card")) return "Card or container";
    if (type === "FRAME" && name.includes("header")) return "Header";
    if (type === "FRAME" && name.includes("footer")) return "Footer";
    if (type === "FRAME" && name.includes("nav")) return "Navigation";
    if (type === "INSTANCE") return "Reusable component";
    if (name.includes("icon")) return "Icon";
    if (name.includes("image")) return "Image";
    if (name.includes("input")) return "Input field";

    return `${type.toLowerCase()} element`;
  }

  // Helper function to convert RGB to HEX
  function rgbToHex(rgb: any): string {
    if (!rgb) return "#000000";

    const toHex = (value: number) => {
      const hex = Math.round(value * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };

    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }

  // Generate complete description
  let fullDescription = analyzeNode(node);

  // Add global context
  fullDescription += `\n## 🌐 Global File Context\n\n`;
  fullDescription += `- **File name**: ${file.name}\n`;
  fullDescription += `- **Last modified**: ${file.lastModified || "Not specified"}\n`;

  if (file.globalVars && Object.keys(file.globalVars).length > 0) {
    fullDescription += `- **Global variables detected**: ${Object.keys(file.globalVars).length}\n`;
  }

  fullDescription += `\n## 🔧 Implementation Recommendations\n\n`;
  fullDescription += `This visual description has been automatically generated based on Figma data. `;
  fullDescription += `To implement this design:\n\n`;
  fullDescription += `1. **Use the hierarchical structure** described to organize your HTML/JSX\n`;
  fullDescription += `2. **Implement CSS styles** based on the specified measurements and colors\n`;
  fullDescription += `3. **Consider responsiveness** by adapting fixed measurements to relative units\n`;
  fullDescription += `4. **Optimize accessibility** by adding ARIA attributes and semantic tags\n\n`;

  return fullDescription;
}

function createServer(
  authOptions: FigmaAuthOptions,
  { isHTTP = false }: { isHTTP?: boolean } = {},
) {
  const server = new McpServer(serverInfo);
  // const figmaService = new FigmaService(figmaApiKey);
  const figmaService = new FigmaService(authOptions);
  registerTools(server, figmaService);

  Logger.isHTTP = isHTTP;

  return server;
}

function registerTools(server: McpServer, figmaService: FigmaService): void {
  // Tool to get file information
  server.tool(
    "get_figma_data",
    "When the nodeId cannot be obtained, obtain the layout information about the entire Figma file",
    {
      fileKey: z
        .string()
        .describe(
          "The key of the Figma file to fetch, often found in a provided URL like figma.com/(file|design)/<fileKey>/...",
        ),
      nodeId: z
        .string()
        .optional()
        .describe(
          "The ID of the node to fetch, often found as URL parameter node-id=<nodeId>, always use if provided",
        ),
      depth: z
        .number()
        .optional()
        .describe(
          "OPTIONAL. Do NOT use unless explicitly requested by the user. Controls how many levels deep to traverse the node tree,",
        ),
    },
    async ({ fileKey, nodeId, depth }) => {
      try {
        Logger.log(
          `Fetching ${
            depth ? `${depth} layers deep` : "all layers"
          } of ${nodeId ? `node ${nodeId} from file` : `full file`} ${fileKey}`,
        );

        let file: SimplifiedDesign;
        if (nodeId) {
          file = await figmaService.getNode(fileKey, nodeId, depth);
        } else {
          file = await figmaService.getFile(fileKey, depth);
        }

        Logger.log(`Successfully fetched file: ${file.name}`);
        const { nodes, globalVars, ...metadata } = file;

        const result = {
          metadata,
          nodes,
          globalVars,
        };

        Logger.log("Generating YAML result from file");
        const yamlResult = yaml.dump(result);

        Logger.log("Sending result to client");
        return {
          content: [{ type: "text", text: yamlResult }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        Logger.error(`Error fetching file ${fileKey}:`, message);
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching file: ${message}` }],
        };
      }
    },
  );

  // Tool to download images
  server.tool(
    "download_figma_images",
    "Download SVG and PNG images used in a Figma file based on the IDs of image or icon nodes",
    {
      fileKey: z.string().describe("The key of the Figma file containing the node"),
      nodes: z
        .object({
          nodeId: z
            .string()
            .describe("The ID of the Figma image node to fetch, formatted as 1234:5678"),
          imageRef: z
            .string()
            .optional()
            .describe(
              "If a node has an imageRef fill, you must include this variable. Leave blank when downloading Vector SVG images.",
            ),
          fileName: z.string().describe("The local name for saving the fetched file"),
        })
        .array()
        .describe("The nodes to fetch as images"),
      pngScale: z
        .number()
        .positive()
        .optional()
        .default(2)
        .describe(
          "Export scale for PNG images. Optional, defaults to 2 if not specified. Affects PNG images only.",
        ),
      localPath: z
        .string()
        .describe(
          "The absolute path to the directory where images are stored in the project. If the directory does not exist, it will be created. The format of this path should respect the directory format of the operating system you are running on. Don't use any special character escaping in the path name either.",
        ),
      svgOptions: z
        .object({
          outlineText: z
            .boolean()
            .optional()
            .default(true)
            .describe("Whether to outline text in SVG exports. Default is true."),
          includeId: z
            .boolean()
            .optional()
            .default(false)
            .describe("Whether to include IDs in SVG exports. Default is false."),
          simplifyStroke: z
            .boolean()
            .optional()
            .default(true)
            .describe("Whether to simplify strokes in SVG exports. Default is true."),
        })
        .optional()
        .default({})
        .describe("Options for SVG export"),
    },
    async ({ fileKey, nodes, localPath, svgOptions, pngScale }) => {
      try {
        const imageFills = nodes.filter(({ imageRef }) => !!imageRef) as {
          nodeId: string;
          imageRef: string;
          fileName: string;
        }[];
        const fillDownloads = figmaService.getImageFills(fileKey, imageFills, localPath);
        const renderRequests = nodes
          .filter(({ imageRef }) => !imageRef)
          .map(({ nodeId, fileName }) => ({
            nodeId: nodeId?.includes("-") ? nodeId.replace("-", ":") : nodeId,
            fileName,
            fileType: fileName.endsWith(".svg") ? ("svg" as const) : ("png" as const),
          }));

        const renderDownloads = figmaService.getImages(
          fileKey,
          renderRequests,
          localPath,
          pngScale,
          svgOptions,
        );

        const downloads = await Promise.all([fillDownloads, renderDownloads]).then(([f, r]) => [
          ...f,
          ...r,
        ]);

        // If any download fails, return false
        const saveSuccess = !downloads.find((success) => !success);
        return {
          content: [
            {
              type: "text",
              text: saveSuccess
                ? `Success, ${downloads.length} images downloaded: ${downloads.join(", ")}`
                : "Failed",
            },
          ],
        };
      } catch (error) {
        Logger.error(`Error downloading images from file ${fileKey}:`, error);
        return {
          isError: true,
          content: [{ type: "text", text: `Error downloading images: ${error}` }],
        };
      }
    },
  );

  // Tool to get figma data and save to file
  server.tool(
    "get_figma_data_to_file",
    "Get Figma data and save it to a .md file at the specified path",
    {
      fileKey: z
        .string()
        .describe(
          "The key of the Figma file to fetch, often found in a provided URL like figma.com/(file|design)/<fileKey>/...",
        ),
      nodeId: z
        .string()
        .optional()
        .describe(
          "The ID of the node to fetch, often found as URL parameter node-id=<nodeId>, always use if provided",
        ),
      depth: z
        .number()
        .optional()
        .describe(
          "OPTIONAL. Do NOT use unless explicitly requested by the user. Controls how many levels deep to traverse the node tree",
        ),
      filePath: z
        .string()
        .describe(
          "Complete path where the file should be saved, including filename and .md extension",
        ),
    },
    async ({ fileKey, nodeId, depth, filePath }) => {
      try {
        Logger.log(
          `Fetching ${
            depth ? `${depth} layers deep` : "all layers"
          } of ${nodeId ? `node ${nodeId} from file` : `full file`} ${fileKey}`,
        );

        let file: SimplifiedDesign;
        if (nodeId) {
          file = await figmaService.getNode(fileKey, nodeId, depth);
        } else {
          file = await figmaService.getFile(fileKey, depth);
        }

        Logger.log(`Successfully fetched file: ${file.name}`);
        const { nodes, globalVars, ...metadata } = file;

        const result = {
          metadata,
          nodes,
          globalVars,
        };

        // Use the provided path directly
        let outputPath = filePath;

        // Ensure the path ends with .md extension if not already present
        if (!outputPath.endsWith(".md")) {
          outputPath += ".md";
        }

        // Convert to YAML
        Logger.log("Generating YAML result from file");
        const yamlResult = yaml.dump(result, { lineWidth: -1 });

        // Create Markdown content with metadata
        const markdownContent = `# ${file.name}

## Metadata
- **File Key**: ${fileKey}
- **File Name**: ${file.name}
- **Node ID**: ${nodeId || "Full file"}
- **Depth**: ${depth || "All layers"}
- **Export Date**: ${new Date().toISOString()}
- **Last Modified**: ${metadata.lastModified || "Unknown"}

## Design Data

\`\`\`yaml
${yamlResult}
\`\`\`

---
*Generated by Figma Context MCP*
`;

        // Ensure the directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
          Logger.log(`Created directory: ${outputDir}`);
        }

        // Save to file
        fs.writeFileSync(outputPath, markdownContent, "utf-8");

        Logger.log(`Data saved to: ${outputPath}`);

        // Create or update .gitignore is no longer handled here since filePath is now required

        return {
          content: [
            {
              type: "text",
              text: `✅ Figma data saved successfully\n\n📁 File: ${outputPath}\n📝 Size: ${(Buffer.byteLength(markdownContent) / 1024).toFixed(2)} KB\n\nThe file has been saved to the specified location.`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        Logger.error(`Error processing Figma file ${fileKey}:`, message);
        return {
          isError: true,
          content: [{ type: "text", text: `❌ Error saving Figma data: ${message}` }],
        };
      }
    },
  );

}

export { createServer };
