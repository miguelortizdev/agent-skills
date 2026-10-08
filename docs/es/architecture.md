# Arquitectura

🇪🇸 Español | 🇺🇸 [English](../en/architecture.md)

## Fuente De Verdad

```text
Registry + Profiles
        ↓
Assets canónicos
        ↓
Installer + Ownership
        ↓
Host Adapters
        ↓
Claude | Codex | Cursor | Gemini | OpenCode | OpenChamber
```

El Registry describe IDs, rutas, dependencias, Hosts y MCP. Los Profiles
seleccionan una Foundation estable; los Adapters la traducen a rutas nativas del
Host sin duplicar contenido de Skills.

## Modos De Instalación

```text
Global Foundation  → assets base reutilizables + MCP a nivel de usuario
Project Full       → Foundation en el proyecto + contexto futuro resuelto
Project Overlay    → assets contextuales sobre una Foundation compatible
```

Los manifests de Ownership registran archivos creados y hashes. Uninstall y
reconciliación eliminan solo archivos sin cambios y administrados por la
instalación correspondiente. Los archivos del usuario y los compartidos por
otra instalación se conservan.

## Context Engine Genérico

El Context Scanner produce facts genéricos dentro de límites. El Rule Evaluator
soporta `file`, `path`, `dependency`, `text`, `anyOf`, `allOf` y `noneOf`. El
conocimiento contextual se declara en `appliesWhen` del asset del Registry; el
scanner, resolver, installer y adapters no contienen matching específico de
tecnologías.

El catálogo productivo actualmente habilita cero Contextual Skills. Tests
sintéticos prueban que futuros Skills pueden agregarse mediante reglas del
Registry sin cambiar el core.

Consulta [Instalación](installation.md), [Skills](skills.md) y [Hosts](hosts.md)
para detalles operativos.
