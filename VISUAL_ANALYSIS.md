# 🎯 Análisis Visual Automatizado de Figma

Esta nueva herramienta del MCP automatiza el proceso de análisis visual detallado de mockups de Figma, eliminando la necesidad de copiar imágenes manualmente y usar prompts externos.

## 🚀 Herramienta: `generate_visual_description`

### Propósito

Genera una descripción visual ultra detallada de un mockup/frame de Figma como si fuera dictada a un desarrollador front-end para recrearla pixel a pixel.

### Parámetros

- **`fileKey`** (requerido): La clave del archivo de Figma
- **`nodeId`** (requerido): El ID del nodo/frame específico a analizar
- **`fileName`** (opcional): Nombre personalizado para el archivo de salida

### Uso

```json
{
  "tool": "generate_visual_description",
  "arguments": {
    "fileKey": "ABC123DEF456",
    "nodeId": "123:456",
    "fileName": "login-screen"
  }
}
```

### Lo que genera la herramienta

#### 📋 Descripción Visual Detallada

Para cada elemento analiza:

**🎯 Identificación y Propósito:**

- Nombre del elemento
- Su función aparente (botón, campo de entrada, etc.)

**📐 Geometría y Posición:**

- Medidas exactas (ancho, alto)
- Coordenadas (x, y)
- Espaciado interno (padding) y externo (margin)

**🎨 Apariencia Visual:**

- **Colores:** Códigos HEX para cada parte del elemento
- **Tipografía:** Fuente, tamaño, peso, color, alineación
- **Bordes:** Grosor, estilo, color, radio de esquinas
- **Sombras:** Dirección, distancia, desenfoque, color
- **Efectos:** Gradientes, blurs, etc.

#### 📁 Archivo de Salida

Se guarda en `.figma/[nombre]-visual-description.md` con:

- Descripción visual estructurada
- Datos técnicos en YAML
- Recomendaciones de implementación
- Metadatos del análisis

## 🔄 Workflow Automatizado

### Antes (Manual):

1. 👁️ Abrir Figma
2. 📋 Seleccionar mockup → Copy as PNG
3. 🤖 Pegar en Gemini/Claude con prompt específico
4. 📝 Copiar respuesta manualmente

### Ahora (Automatizado):

1. 🔗 Obtener URL de Figma
2. ⚡ Ejecutar `generate_visual_description`
3. ✅ Archivo `.md` generado automáticamente

## 🎯 Ventajas

- **⚡ Velocidad**: Análisis instantáneo sin copiar/pegar manual
- **📊 Precisión**: Datos exactos de la API de Figma
- **🗂️ Organización**: Archivos guardados en `.figma/`
- **🔄 Reproducible**: Mismo resultado cada vez
- **📝 Documentado**: Incluye metadatos y contexto

## 🛠️ Integración con IA

La descripción generada está optimizada para ser usada por IA para:

- Generar código HTML/CSS/JSX
- Crear componentes React/Vue/Angular
- Implementar diseños responsivos
- Generar documentación técnica

## 📋 Ejemplo de Salida

```markdown
# Descripción Visual Detallada: Login Screen

## 🏗️ Login Screen (FRAME)

### 🎯 Identificación y Propósito

- **Nombre**: Login Screen
- **Tipo**: FRAME
- **Función aparente**: Pantalla de inicio de sesión

### 📐 Geometría y Posición

- **Posición**: x=0px, y=0px
- **Dimensiones**: 375px × 812px

### 🎨 Apariencia Visual

#### **Colores:**

- **Relleno 1**: #FFFFFF (Opacidad: 100%)

### 👥 Elementos Hijos (3)

## 📦 Header (FRAME)

...análisis detallado de cada elemento hijo...
```

## 🚀 Uso en Cursor/Claude

Una vez configurado el MCP, puedes usar:

```
Analiza visualmente este mockup de Figma:
https://www.figma.com/file/ABC123/Design?node-id=123%3A456

Usa la herramienta generate_visual_description y luego implementa el diseño en React.
```

---

_Esta herramienta reemplaza el proceso manual de análisis visual y está integrada directamente en tu MCP de Figma._
