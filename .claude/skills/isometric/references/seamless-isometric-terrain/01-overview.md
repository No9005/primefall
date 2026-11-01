# 01 — Overview & Core Concepts

## The goal

Ground tiles that form one continuous isometric map with no visible seams, no gaps, and consistent color.

## What seamless means

1. Identical diamond shape — every tile is the same 2:1 isometric rhombus.
2. Identical thickness — the soil base under each tile is the same height.
3. Surface fills the whole tile — no stray rim or empty corners.
4. Flat, neutral background — so it can be cut to a transparent PNG cleanly.

## Golden rule

> Shape first, texture second. Lock a fixed seed for the whole set so every tile is the same diamond. Only change the short surface phrase between tiles.

## Pipeline

```text
ComfyUI (fixed seed) -> raw 1024x1024 tile -> rembg / SAM -> transparent PNG -> engine tilemap
```
