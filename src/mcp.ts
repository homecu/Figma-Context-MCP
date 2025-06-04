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

// Helper function to get the client's working directory
// This ensures files are created in the project where the MCP client is running
function getClientWorkingDirectory(): string {
  // Try different environment variables to find the actual client directory
  // If none of these work, use a safe directory in the user's home
  const userDir = process.env.PWD || process.env.INIT_CWD || process.cwd();
  
  // Make sure we're not using the root directory
  if (!userDir || userDir === '/') {
    // In case of error, use the user's home directory as a fallback
    return process.env.HOME || process.env.USERPROFILE || './';
  }
  
  return userDir;
}

// Function to generate detailed visual description
function generateDetailedVisualDescription(node: any, file: any): string {
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

  // TODO: Clean up all image download related code, particularly getImages in Figma service
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
            nodeId,
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
    "Get Figma data and save it to a .md file in the current project directory",
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
      fileName: z
        .string()
        .optional()
        .describe(
          "File name without extension (.md will be added automatically). Defaults to the Figma file name",
        ),
    },
    async ({ fileKey, nodeId, depth, fileName }) => {
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

        // Generate file name based on Figma file name or provided name
        const sanitizedFileName = (fileName || file.name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        const outputFileName = `${sanitizedFileName}.md`;

        // Save directly to the client's working directory
        const clientWorkingDir = getClientWorkingDirectory();

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

        // Create a safer file path - ensure we're not writing to sensitive directories
        let safePath = clientWorkingDir;
        
        // If path would end up in root or system directories, use current directory instead
        if (!safePath || safePath === '/' || safePath.startsWith('/usr') || safePath.startsWith('/etc')) {
          safePath = './';
          Logger.log(`Warning: Unsafe directory detected. Using current directory instead.`);
        }
        
        // Save to file directly in project root, with safe path
        const fullPath = path.join(safePath, outputFileName);
        fs.writeFileSync(fullPath, markdownContent, "utf-8");

        Logger.log(`Data saved to: ${fullPath}`);

        // Create or update .gitignore if it doesn't exist in client directory
        const gitignorePath = path.join(clientWorkingDir, ".gitignore");
        if (fs.existsSync(gitignorePath)) {
          const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
          if (!gitignoreContent.includes("*-figma-data.md")) {
            fs.appendFileSync(
              gitignorePath,
              "\n# Figma exported data\n*-figma-data.md\n*-visual-description.md\n*-technical-specification.md\n",
            );
            Logger.log("Added Figma file patterns to .gitignore");
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `✅ Figma data saved successfully\n\n📁 File: ${fullPath}\n📝 Size: ${(Buffer.byteLength(markdownContent) / 1024).toFixed(2)} KB\n\nThe file has been saved in your project directory.`,
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

  // Tool to generate detailed visual description
  server.tool(
    "generate_visual_description",
    "Generate an ultra-detailed visual description of a Figma mockup/frame as if dictating visual specifications to a front-end developer to recreate it pixel by pixel",
    {
      fileKey: z
        .string()
        .describe(
          "The key of the Figma file to fetch, often found in a provided URL like figma.com/(file|design)/<fileKey>/...",
        ),
      nodeId: z
        .string()
        .describe(
          "The ID of the specific node/frame to analyze visually, often found as URL parameter node-id=<nodeId>",
        ),
      fileName: z
        .string()
        .optional()
        .describe(
          "Description file name without extension (.md will be added automatically). Defaults to the node name",
        ),
    },
    async ({ fileKey, nodeId, fileName }) => {
      try {
        Logger.log(`Generating visual description for node ${nodeId} from file ${fileKey}`);

        // Get node data
        const file = await figmaService.getNode(fileKey, nodeId);
        const node = file.nodes[0]; // The main node we're analyzing

        if (!node) {
          throw new Error("Node not found or empty");
        }

        Logger.log(`Successfully fetched node: ${node.name}`);

        // Generate file name
        const sanitizedFileName = (fileName || node.name || "visual-analysis")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        const outputFileName = `${sanitizedFileName}-visual-description.md`;

        // Save directly to the client's working directory
        const clientWorkingDir = getClientWorkingDirectory();

        // Generate detailed visual description
        const visualDescription = generateDetailedVisualDescription(node, file);

        // Create Markdown content
        const markdownContent = `# Detailed Visual Description: ${node.name}

## Analysis Information
- **Figma File**: ${fileKey}
- **Analyzed Node**: ${node.name} (${nodeId})
- **Analysis Date**: ${new Date().toISOString()}
- **Element Type**: ${node.type}

---

## 🎯 Ultra-Detailed Visual Description

${visualDescription}

---

## 📊 Technical Node Data

\`\`\`yaml
${yaml.dump({ node }, { lineWidth: -1 })}
\`\`\`

---
*Generated automatically by Figma Context MCP - Visual Analysis*
`;

        // Save file directly in project root
        const fullPath = path.join(clientWorkingDir, outputFileName);
        fs.writeFileSync(fullPath, markdownContent, "utf-8");

        Logger.log(`Visual description saved to: ${fullPath}`);

        return {
          content: [
            {
              type: "text",
              text: `🎯 Visual description generated successfully\n\n📁 File: ${fullPath}\n📝 Size: ${(Buffer.byteLength(markdownContent) / 1024).toFixed(2)} KB\n\n📋 The description includes:\n• Complete hierarchical structure\n• Geometry and positioning\n• Colors, typography and visual effects\n• Detailed technical specifications\n\nThe file has been saved in your project directory. This description can be used by AI to generate precise front-end code.`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        Logger.error(`Error generating visual description for ${fileKey}/${nodeId}:`, message);
        return {
          isError: true,
          content: [{ type: "text", text: `❌ Error generating visual description: ${message}` }],
        };
      }
    },
  );

  // Tool to list exported files
  server.tool(
    "list_figma_exports",
    "List all Figma files exported to the project directory",
    {},
    async () => {
      try {
        const clientWorkingDir = getClientWorkingDirectory();

        // Search for all Figma exported files in the project directory
        const files = fs
          .readdirSync(clientWorkingDir)
          .filter((file: string) => {
            return (
              file.endsWith("-visual-description.md") ||
              file.endsWith("-technical-specification.md") ||
              file.endsWith("-figma-data.md")
            );
          })
          .map((file: string) => {
            const stats = fs.statSync(path.join(clientWorkingDir, file));
            return {
              name: file,
              size: `${(stats.size / 1024).toFixed(2)} KB`,
              modified: stats.mtime.toISOString(),
            };
          });

        if (files.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "📁 No Figma exported files found in the project directory.",
              },
            ],
          };
        }

        const fileList = files
          .map((f: any) => `- **${f.name}** (${f.size}) - Modified: ${f.modified}`)
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `📁 Exported Figma files in your project directory:\n\n${fileList}\n\nTotal: ${files.length} file(s)`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        return {
          isError: true,
          content: [{ type: "text", text: `❌ Error listing files: ${message}` }],
        };
      }
    },
  );

  // Tool to generate complete technical specification (combines API data + visual description)
  server.tool(
    "generate_technical_specification",
    "Generate a complete technical specification document by combining Figma API data and detailed visual description into a unified development-ready specification",
    {
      fileKey: z
        .string()
        .describe(
          "The key of the Figma file to fetch, often found in a provided URL like figma.com/(file|design)/<fileKey>/...",
        ),
      nodeId: z
        .string()
        .describe(
          "The ID of the specific node/frame to analyze, often found as URL parameter node-id=<nodeId>",
        ),
      depth: z
        .number()
        .optional()
        .describe("OPTIONAL. Controls how many levels deep to traverse the node tree for API data"),
      fileName: z
        .string()
        .optional()
        .describe(
          "Specification file name without extension (.md will be added automatically). Defaults to the node name",
        ),
    },
    async ({ fileKey, nodeId, depth, fileName }) => {
      // Helper function for structure tree
      function generateStructureTree(node: any, level: number): string {
        const indent = "  ".repeat(level);
        let tree = "";

        if (node.children && Array.isArray(node.children) && node.children.length > 0) {
          node.children.forEach((child: any) => {
            tree += `\n${indent}├── ${child.name || "Unnamed"} (${child.type})`;
            tree += generateStructureTree(child, level + 1);
          });
        }

        return tree;
      }

      // Helper function to infer element purpose
      function inferElementPurpose(node: any): string {
        const name = (node.name || "").toLowerCase();
        const type = node.type;

        if (type === "TEXT") return "Text element";
        if (type === "RECTANGLE" && name.includes("button")) return "Button component";
        if (type === "RECTANGLE" && name.includes("card")) return "Card or container component";
        if (type === "FRAME" && name.includes("header")) return "Header section";
        if (type === "FRAME" && name.includes("footer")) return "Footer section";
        if (type === "FRAME" && name.includes("nav")) return "Navigation component";
        if (type === "INSTANCE") return "Reusable component instance";
        if (name.includes("icon")) return "Icon element";
        if (name.includes("image")) return "Image asset";
        if (name.includes("input")) return "Input field component";
        if (type === "FRAME") return "Layout container";

        return `${type.toLowerCase()} component`;
      }

      try {
        Logger.log(
          `Generating complete technical specification for node ${nodeId} from file ${fileKey}`,
        );

        // Step 1: Get Figma API data
        Logger.log("Step 1: Fetching Figma API data...");
        let file: SimplifiedDesign;
        if (nodeId) {
          file = await figmaService.getNode(fileKey, nodeId, depth);
        } else {
          file = await figmaService.getFile(fileKey, depth);
        }

        const { nodes, globalVars, ...metadata } = file;
        const mainNode = nodes[0]; // The main node we're analyzing

        if (!mainNode) {
          throw new Error("Node not found or empty");
        }

        Logger.log(`Successfully fetched node: ${mainNode.name}`);

        // Step 2: Generate visual description
        Logger.log("Step 2: Generating detailed visual description...");
        const visualDescription = generateDetailedVisualDescription(mainNode, file);

        // Step 3: Combine everything into a unified specification
        Logger.log("Step 3: Creating unified technical specification...");

        // Generate file name
        const sanitizedFileName = (fileName || mainNode.name || "technical-spec")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        const outputFileName = `${sanitizedFileName}-technical-specification.md`;

        // Save directly to the client's working directory
        const clientWorkingDir = getClientWorkingDirectory();

        // Create API data YAML
        const apiData = {
          metadata,
          nodes,
          globalVars,
        };
        const yamlResult = yaml.dump(apiData, { lineWidth: -1 });

        // Create comprehensive specification document
        const specificationContent = `# Technical Specification: ${mainNode.name}

## 📋 Project Information
- **Figma File**: ${fileKey}
- **Target Node**: ${mainNode.name} (${nodeId})
- **Specification Date**: ${new Date().toISOString()}
- **Element Type**: ${mainNode.type}
- **Analysis Depth**: ${depth || "Full node structure"}

---

## 🎯 Executive Summary

This technical specification provides comprehensive development guidelines for implementing the "${mainNode.name}" component/screen from Figma. It combines raw API data with detailed visual analysis to ensure pixel-perfect implementation.

### Key Implementation Points:
- **Element Type**: ${mainNode.type}
- **Primary Function**: ${inferElementPurpose(mainNode)}
- **Complexity Level**: ${nodes.length > 5 ? "High" : nodes.length > 2 ? "Medium" : "Low"} (${nodes.length} total elements)
- **Last Modified**: ${metadata.lastModified || "Unknown"}

---

## 🎨 Detailed Visual Specification

${visualDescription}

---

## 🔧 Technical Implementation Guide

### 1. Structure Overview
The component should be implemented following this hierarchical structure:

\`\`\`
${mainNode.name} (${mainNode.type})
${generateStructureTree(mainNode, 1)}
\`\`\`

### 2. Development Recommendations

#### Frontend Framework Considerations:
- **React/Vue**: Use component composition following the node hierarchy
- **CSS Framework**: Consider using Tailwind CSS or CSS-in-JS for precise styling
- **Responsive**: Adapt fixed pixel values to responsive units (rem, %, vw/vh)

#### Implementation Checklist:
- [ ] Set up component structure following node hierarchy
- [ ] Implement exact colors and typography from specifications
- [ ] Add proper spacing and layout constraints
- [ ] Ensure accessibility (ARIA labels, semantic HTML)
- [ ] Test responsive behavior across breakpoints
- [ ] Validate against Figma design for pixel accuracy

#### Performance Considerations:
- [ ] Optimize image assets (WebP format, proper sizing)
- [ ] Use CSS transforms for animations
- [ ] Implement lazy loading for images
- [ ] Consider component code splitting

---

## 📊 Raw API Data

### Complete Figma Node Structure
\`\`\`yaml
${yamlResult}
\`\`\`

---

## 🚀 Next Steps

1. **Set up development environment** with chosen framework
2. **Create component structure** following the hierarchy above
3. **Implement styles** using the exact measurements and colors provided
4. **Add interactive states** (hover, focus, active) as needed
5. **Test across devices** to ensure responsive behavior
6. **Validate accessibility** with screen readers and keyboard navigation

---

## 📞 Developer Notes

This specification was automatically generated from Figma data and provides everything needed for accurate implementation. For questions about design intent or missing specifications, consult with the design team using the Figma file link above.

**Generated by**: Figma Context MCP - Technical Specification Generator  
**Specification Version**: 1.0  
**Last Updated**: ${new Date().toISOString()}
`;

        // Save file directly in project root
        const fullPath = path.join(clientWorkingDir, outputFileName);
        fs.writeFileSync(fullPath, specificationContent, "utf-8");

        Logger.log(`Technical specification saved to: ${fullPath}`);

        return {
          content: [
            {
              type: "text",
              text: `🎯 Complete technical specification generated successfully!\n\n📁 **File**: ${fullPath}\n📝 **Size**: ${(Buffer.byteLength(specificationContent) / 1024).toFixed(2)} KB\n\n📋 **Specification includes**:\n• Executive summary and implementation points\n• Ultra-detailed visual specifications\n• Complete development guide with checklist\n• Raw Figma API data for reference\n• Performance and accessibility recommendations\n\n🚀 **Ready for development**: This specification contains everything needed to implement the component pixel-perfectly.\n\n💡 **Developer tip**: The file has been saved in your project directory. Use this specification alongside your preferred frontend framework to ensure accurate implementation.`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        Logger.error(`Error generating technical specification for ${fileKey}/${nodeId}:`, message);
        return {
          isError: true,
          content: [
            { type: "text", text: `❌ Error generating technical specification: ${message}` },
          ],
        };
      }
    },
  );
}

export { createServer };
